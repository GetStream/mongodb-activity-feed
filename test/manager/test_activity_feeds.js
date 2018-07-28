import {dropDBs} from '../../test/utils.js'
import Activity from '../../src/models/activity'
import FeedGroup from '../../src/models/feed_group'
import Feed from '../../src/models/feed'
import ActivityFeed from '../../src/models/activity_feed'
import Follow from '../../src/models/follow'
import chunkify from '../../src/utils/chunk'
import redis from '../../src/utils/redis'

import { expect } from 'chai';
import Redlock from 'redlock'


const ADD_OPERATION = 1
const REMOVE_OPERATION = 2
const updateOptions = {upsert: true, new:true}

// TODO:
// - operation log time vs ordering...
// - depedency injection for redis and mongo connection
// - testing and code cleanup
// - read ranked feed
// - read aggregate feed
// - beatify & docs


var redlock = new Redlock(
	// you should have one client for each independent redis node
	// or cluster
	[redis],
	{
		// the expected clock drift; for more details
		// see http://redis.io/topics/distlock
		driftFactor: 0.01, // time in ms

		// the max number of times Redlock will attempt
		// to lock a resource before erroring
		retryCount:  10,

		// the time in ms between attempts
		retryDelay:  200, // time in ms

		// the max time in ms randomly added to retries
		// to improve performance under high contention
		// see https://www.awsarchitectureblog.com/2015/03/backoff.html
		retryJitter:  200 // time in ms
	}
);

export async function follow(source, target) {
	const lock = await redlock.lock(`followLock${source._id}`, 10*1000)

	// create the follow relationship
	const follow = await Follow.findOneAndUpdate({source, target}, {source, target}, updateOptions)

	// get the activity references
	const activityReferences = ActivityFeed.find({feed: target}).limit(300).sort('-time')

	// write these to the source feed
	const operations = []
	for (reference of activityReferences) {
		let document = reference.toObject()
		document._id = null
		document.feed = source
		operations.push({ insertOne: { document } })
	}
	console.log(operations)
	// call the bulk create
	await ActivityFeed.bulkWrite(operations, { ordered: false })

	await lock.unlock()
}

export async function unfollow(source, target) {
	const lock = await redlock.lock(`followLock${source._id}`, 10*1000)

	// create the follow relationship
	const follow = await Follow.findOneAndDelete({source, target})

	// remove the activities with the given origin
	const activityReferences = ActivityFeed.remove({feed: source, origin:target})

	await lock.unlock()
}

export async function readFeed(feed, limit) {
	// read the feed
	const operations = await ActivityFeed.find({feed}).sort('-time').limit(1000)
	const seen = {}
	const activities = []
	for (const activityOperation of operations) {
		console.log(activityOperation)
		if (activityOperation.activity in seen) {
			// ignore
		} else {
			if (activityOperation.operation == ADD_OPERATION) {
				activities.push(activityOperation.activity)
			}
			seen[activityOperation.activity] = true
		}
	}
	return activities.slice(0, limit)
}




export async function getOrCreateFeed(name, feedID) {
	const group = await FeedGroup.findOneAndUpdate({name}, {name}, updateOptions)
	const feed = await Feed.findOneAndUpdate({group: group, feedID}, {group: group, feedID}, updateOptions)
	return feed
}

async function addOrRemoveActivity(activityData, feed, operation) {
	// create the activity
	let {actor, verb, object, target, time, ...extra} = activityData
	if (!time) {
		time = new Date()
	}
	const values = {actor: actor, verb: verb, object: object, target: target, time: time, extra: extra }
	const activity = await Activity.findOneAndUpdate(values, values, {upsert: true, new: true})

	// create the activity feed for the primary feed
	const activityFeed = await ActivityFeed.create({feed: feed, activity: activity, operation: operation, time: activity.time, origin:feed})

	// fanout to the followers in batches
	const followers = await Follow.find({target: feed}).select('source').lean()
	const groups = chunkify(followers)
	for (const group of groups) {
		for (const follow of group) {
			const activityFeed = await ActivityFeed.create({feed: follow.source, activity: activity, operation: operation, time: activity.time, origin: feed})
		}
	}
	return activity
}

export async function addActivity(activityData, feed) {
	return addOrRemoveActivity(activityData, feed, ADD_OPERATION)
}

export async function removeActivity(activityData, feed) {
	return addOrRemoveActivity(activityData, feed, REMOVE_OPERATION)
}

describe('Test Feed Operations', () => {



		before(async () => {
			await dropDBs();
			const timelineGroup = await FeedGroup.create({name: 'timeline'})
			const userGroup = await FeedGroup.create({name: 'user'})

			const feed1 = await Feed.create({group: userGroup, feedID: 'thierry'})
			const feed2 = await Feed.create({group: timelineGroup, feedID: 'tommaso'})
			const follow = await Follow.create({source: feed2, target: feed1})
		});

		it('should create a feed', async() => {
			const timelineThierry = await getOrCreateFeed('timeline', 'thierry')
			expect(timelineThierry).to.not.be.null
			const timelineThierry2 = await getOrCreateFeed('timeline', 'thierry')
			expect(timelineThierry2).to.not.be.null
			expect(timelineThierry2._id.toString()).to.equal(timelineThierry._id.toString())
		});

		it('should add an activity', async() => {
			const activityData = {actor: 'user:123', verb: 'listen', object: 'Norah Jones', duration: 50, time: '2015-06-15'}
			const userTommaso = await getOrCreateFeed('user', 'tommaso')
			const activity = await addActivity(activityData, userTommaso)
			expect(activity).to.not.be.null
			const activity2 = await addActivity(activityData, userTommaso)
			expect(activity2).to.not.be.null
			expect(activity._id.toString()).to.equal(activity2._id.toString())

		});

		it('should follow a feed', async() => {
			const timelineThierry = await getOrCreateFeed('timeline', 'thierry')
			const userTommaso = await getOrCreateFeed('user', 'tommaso')
			const relation = follow(timelineThierry, userTommaso)
		})

		it('should read an empty feed', async() => {
			const feed = await getOrCreateFeed('test', 'thierry')
			let activities = await readFeed(feed, 3)
			expect(activities.length).to.equal(0)

		})

		it('should read a feed with 1 activity', async() => {
			const feed = await getOrCreateFeed('test', 'thierry')
			const activityData = {actor: 'user:123', verb: 'listen', object: 'Norah Jones', duration: 50, time: '2015-06-15'}
			let activity = await addActivity(activityData, feed)
			let activities = await readFeed(feed, 3)
			expect(activities.length).to.equal(1)
		})

		it('should remove an activity', async() => {
			const feed = await getOrCreateFeed('test', 'thierry')
			const activityData = {actor: 'user:123', verb: 'listen', object: 'Norah Jones', duration: 50, time: '2015-06-15'}
			let activity = await addActivity(activityData, feed)
			let activity2 = await removeActivity(activityData, feed)
			expect(activity._id.toString()).to.equal(activity2._id.toString())


			let activities = await readFeed(feed, 3)
			expect(activities.length).to.equal(0)
		})


});
