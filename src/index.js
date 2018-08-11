import Activity from './models/activity'
import FeedGroup from './models/feed_group'
import Feed from './models/feed'
import ActivityFeed from './models/activity_feed'
import Follow from './models/follow'
import chunkify from './utils/chunk'
import Redlock from 'redlock'
import Queue from 'bull'
import faye from 'faye'
import ioClient from 'socket.io-client'

export const OPERATIONS = { ADD_OPERATION: 1, REMOVE_OPERATION: 2 }

const updateOptions = { upsert: true, new: true }

// does nothing, just calls the callback with all the data
export class DummyFirehose {
	constructor(callback) {
		this.callback = callback
	}
	async notify(byFeed) {
		try {
			for (const operations of Object.values(byFeed)) {
				let feed = operations[0].feed
				await this.callback({ operations, feed })
			}
		} catch (e) {
			console.log('failed to call the callback..', e)
		}
	}
}

// socketio realtime notifications
export class SocketIOFirehose {
	constructor(socketIOUrl) {
		this.client = ioClient(socketIOUrl)
		const s = this.client
		s.on('connect_error', err => {
			console.log('connect_error', err)
		})
		s.on('connect_timeout', err => {
			console.log('connect_timeout', err)
		})
		s.on('error', err => {
			console.log('error', err)
		})
		s.on('reconnect_attempt', err => {
			console.log('error', err)
		})
		s.on('disconnect', err => {
			console.log('error', err)
		})
	}
	async notify(byFeed) {
		console.log('notify', byFeed)
		for (const operations of Object.values(byFeed)) {
			const feed = operations[0].feed
			const channel = `feed-${feed.group.name}--${feed.feedID}`
			const message = { operations, feed }
			console.log(channel, message)
			let s = this.client.emit(channel, message)
			s.on('connect_error', err => {
				console.log('connect_error', err)
			})
			s.on('connect_timeout', err => {
				console.log('connect_timeout', err)
			})
			s.on('error', err => {
				console.log('error', err)
			})
			s.on('reconnect_attempt', err => {
				console.log('error', err)
			})
			s.on('disconnect', err => {
				console.log('error', err)
			})
		}
	}
}

// faye realtime notifications
export class FayeFirehose {
	constructor(fayeURL) {
		if (fayeURL.connection) {
			this.fayeClient = fayeURL
		} else {
			this.fayeClient = new faye.Client(fayeURL, { timeout: 5, retry: 5 })
		}
	}
	async notify(byFeed) {
		let results = []

		for (const operations of Object.values(byFeed)) {
			let feed = operations[0].feed
			let channel = `/feed-${feed.group.name}--${feed.feedID}`
			// running more than one publish operation at the same time breaks faye...

			let result = await this.fayeClient.publish(channel, { operations, feed })
			results.push(result)
		}

		return results
	}
}

export class FeedManager {
	constructor(mongoConnection, redisConnection, options) {
		this.mongoConnection = mongoConnection
		this.redisConnection = redisConnection
		this.redlock = this._createLock()
		this.queue = new Queue('activity feed', redisConnection)
		if (!options) {
			options = {}
		}
		const defaultOptions = { bull: false, firehose: false }
		this.options = { ...defaultOptions, ...options }
	}

	async followMany(pairs, copyLimit = 300) {
		// start by using bulk writes to setup the follows
		let operations = []
		for (const followInstruction of pairs) {
			let document = {
				source: followInstruction.source,
				target: followInstruction.target,
			}
			operations.push({
				updateOne: { filter: document, update: document, upsert: true },
			})
		}
		if (operations.length >= 1) {
			try {
				await Follow.bulkWrite(operations, {
					ordered: false,
				})
			} catch (e) {
				// dont fail on records that already exist
				if (e.code !== 11000) throw e
			}
		}

		// group by source
		if (copyLimit > 0) {
			let grouped = {}
			for (const followInstruction of pairs) {
				if (!(followInstruction.source in grouped)) {
					grouped[followInstruction.source._id] = []
				}
				grouped[followInstruction.source._id].push(followInstruction.target._id)
			}

			// get the activity references
			for (const [sourceID, targetIDs] of Object.entries(grouped)) {
				const lock = await this.redlock.lock(`followLock${sourceID}`, 10 * 1000)
				const activityReferences = await ActivityFeed.find({
					feed: { $in: targetIDs },
				})
					.limit(copyLimit)
					.sort('-time')
				// write these to the source feed in one go
				const operations = []
				for (const reference of activityReferences) {
					let document = reference.toObject()
					document._id = null
					document.feed = sourceID
					operations.push({ insertOne: { document } })
				}
				// call the bulk create
				if (operations.length >= 1) {
					await ActivityFeed.bulkWrite(operations, { ordered: false })
				}
				await lock.unlock()
			}
		}
	}

	async follow(source, target, copyLimit = 300) {
		await this.followMany([{ source, target }], copyLimit)
	}

	async unfollow(source, target) {
		const lock = await this.redlock.lock(`followLock${source._id}`, 10 * 1000)

		// create the follow relationship
		const follow = await Follow.findOneAndDelete({ source, target })

		// remove the activities with the given origin
		await ActivityFeed.remove({
			feed: source,
			origin: target,
		})

		await lock.unlock()
		return follow
	}

	async addOrRemoveActivity(activityData, feed, operation) {
		if (!feed) {
			throw Error(`missing feed ${feed}`)
		}
		// create the activity
		let { actor, verb, object, target, time, foreign_id, ...extra } = activityData
		if (!time) {
			time = new Date()
		}
		const values = { actor, verb, object, target, time, foreign_id, extra }

		let search
		if (values.foreign_id) {
			search = { foreign_id: values.foreign_id, time: values.time }
		} else {
			search = { ...values }
		}
		const activity = await Activity.findOneAndUpdate(search, values, {
			upsert: true,
			new: true,
		})

		// create the activity feed for the primary feed
		let op = await ActivityFeed.create({
			feed: feed,
			activity: activity,
			operation: operation,
			time: activity.time,
			origin: feed,
		})
		await this.notify([op])

		// fanout to the followers in batches
		const followers = await Follow.find({ target: feed }).sort({ target: -1 })
		const groups = chunkify(followers, 500)
		let origin = feed
		let promises = []
		for (const group of groups) {
			if (this.options.bull) {
				const promise = this.queue.add({
					args: [activity, group, origin, operation],
				})
				promises.push(promise)
			} else {
				const promise = this._fanout(activity, group, origin, operation)
				promises.push(promise)
			}
		}
		if (promises.length > 0) {
			await Promise.all(promises)
		}

		return activity
	}

	async _fanout(activity, group, origin, operation) {
		let bulkWrites = []
		let operations = []
		for (const follow of group) {
			if (!follow.source) {
				throw Error(`missing follow.source ${follow}`)
			}
			let document = {
				feed: follow.source,
				activity: activity,
				operation: operation,
				time: activity.time,
				origin,
			}
			operations.push(document)
			bulkWrites.push({ insertOne: { document } })
		}
		if (operations.length >= 1) {
			await ActivityFeed.bulkWrite(bulkWrites, { ordered: false })
			await this.notify(operations)
		}
	}

	async getFeedGroupMap() {
		const feedGroups = await FeedGroup.find({})
		const feedGroupMap = {}
		for (const group of feedGroups) {
			feedGroupMap[group.id] = group
		}
		return feedGroupMap
	}

	async notify(operations) {
		const byFeed = {}
		const feedGroupMap = await this.getFeedGroupMap()

		if (this.options.firehose !== false) {
			for (const operation of operations) {
				// make sure we add the full group if its missing
				if (!operation.feed.group.name) {
					let groupID = operation.feed.group._id || operation.feed.group
					if (!feedGroupMap[groupID]) {
						throw Error(`cant find feedgroup with id ${groupID}`)
					}
					operation.feed.group = feedGroupMap[groupID]
				}

				if (!(operation.feed._id in byFeed)) {
					byFeed[operation.feed._id] = []
				}
				byFeed[operation.feed._id].push(operation)
			}
			await this.options.firehose.notify(byFeed)
		}
	}

	async readFeed(feed, offset, limit, rankingMethod, aggregationMethod) {
		// read the feed sorted by the activity time
		const searchDepth = 1000
		const operations = await ActivityFeed.find({ feed })
			.sort({ time: -1, operationTime: -1 })
			.limit(searchDepth)
		// next order by the operationTime to handle scenarios where people add/remove
		operations.sort((a, b) => {
			return b.operationTime - a.operationTime
		})
		// TODO: there are edge cases here with add/remove on older activities
		// For example if you add 1 activity with a recent time 1500 times and remove it 1500 times.
		// Next you add an activity with an older time
		// the feed will show up empty
		const seen = {}
		const activities = []
		for (const activityOperation of operations) {
			if (activityOperation.activity in seen) {
				// ignore
			} else {
				if (activityOperation.operation === OPERATIONS.ADD_OPERATION) {
					activities.push(activityOperation.activity)
				}
				seen[activityOperation.activity] = true
			}
		}
		// add the extra properties back to the object
		let serialized = []

		for (const activity of activities) {
			let activityData = activity.toObject()
			let { extra, ...others } = activityData
			let serializedActivity = { ...extra, ...others }
			serialized.push(serializedActivity)
		}

		if (aggregationMethod && rankingMethod) {
			throw new Error('cant use both ranking and aggregation at the same time')
		}

		// support aggregation
		let aggregated
		if (aggregationMethod) {
			aggregated = {}
			for (const activity of serialized) {
				const key = aggregationMethod(activity)
				if (!(key in aggregated)) {
					aggregated[key] = { group: key, time: activity.time, activities: [] }
				}
				aggregated[key].activities.push(activity)
			}
			serialized = Object.values(aggregated)
		}

		// ensure that we are sorted by time and not operation time
		if (rankingMethod) {
			serialized.sort(rankingMethod)
		} else {
			serialized.sort((a, b) => {
				return b.time - a.time
			})
		}

		let selectedActivities = serialized.slice(offset, limit)

		return selectedActivities
	}

	async getOrCreateFeed(group, feedID) {
		const feedMap = await this.getOrCreateFeeds([{ group, feedID }])
		return feedMap[group][feedID]
	}

	async getOrCreateFeeds(feedReferences) {
		// step one, setup all the groups
		const feedsByGroup = []
		const groupMap = {}
		const groupIDMap = {}
		for (const feedReference of feedReferences) {
			if (!(feedReference.group in feedsByGroup)) {
				feedsByGroup[feedReference.group] = []
			}
			feedsByGroup[feedReference.group].push(feedReference.feedID)
		}
		for (const name of Object.keys(feedsByGroup)) {
			const group = await FeedGroup.findOneAndUpdate(
				{ name },
				{ name },
				updateOptions,
			)
			groupMap[name] = group
			groupIDMap[group._id] = group
		}
		// step two, create the feeds
		let operations = []
		for (const feedReference of feedReferences) {
			let document = {
				group: groupMap[feedReference.group],
				feedID: feedReference.feedID,
			}
			operations.push({
				updateOne: { filter: document, update: document, upsert: true },
			})
		}
		let bulkResponse
		if (operations.length >= 1) {
			bulkResponse = await Feed.bulkWrite(operations, { ordered: false })
		}

		// step three, read the feeds and return the feedmap
		const feedMap = {}
		for (const groupName of Object.keys(feedsByGroup)) {
			feedMap[groupName] = {}
		}
		// lookup the objects, there doesn't seem to be a better way to do this
		// bulkWrite doesn't return the ids for things that didn't change...
		let conditions = []
		for (const [groupName, feedIDs] of Object.entries(feedsByGroup)) {
			conditions.push({
				feedID: { $in: feedIDs },
				group: groupMap[groupName]._id,
			})
		}
		const feeds = await Feed.find({ $or: conditions })
		for (const feed of feeds) {
			const group = groupIDMap[feed.group]
			feedMap[group.name][feed.feedID] = feed
		}

		return feedMap
	}

	async addActivity(activityData, feed) {
		return await this.addOrRemoveActivity(
			activityData,
			feed,
			OPERATIONS.ADD_OPERATION,
		)
	}

	async removeActivity(activityData, feed) {
		return await this.addOrRemoveActivity(
			activityData,
			feed,
			OPERATIONS.REMOVE_OPERATION,
		)
	}

	_createLock() {
		let redlock = new Redlock(
			// you should have one client for each independent redis node
			// or cluster
			[this.redisConnection],
			{
				// the expected clock drift; for more details
				// see http://redis.io/topics/distlock
				driftFactor: 0.01, // time in ms

				// the max number of times Redlock will attempt
				// to lock a resource before erroring
				retryCount: 3,

				// the time in ms between attempts
				retryDelay: 300, // time in ms

				// the max time in ms randomly added to retries
				// to improve performance under high contention
				// see https://www.awsarchitectureblog.com/2015/03/backoff.html
				retryJitter: 200, // time in ms
			},
		)
		return redlock
	}
}
