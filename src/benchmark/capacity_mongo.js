/*
Our last test is a little more complex. For this test we set up 100 feeds.
The first 50 feeds are followed by 5 other feeds. Feed 50-60 are followed by 100 other feeds, 60-70 by 1,000 feeds, 70-80 by 2,000
and 80-100 by 10,000. Again this is a rough approximation but it takes into account that some feeds
are very popular and others are not.

Next, we’ll scale up the number of new activities we’re adding per minute till the infrastructure breaks.

*/
import './loadenv'
import { getFeedManager, Timer, runBenchmark } from './utils'
import chunkify from '../utils/chunk'

const fm = getFeedManager()
fm.options.bull = true
const t = new Timer()

const maxFollowers = process.env.MAX_FOLLOWERS || 1000

async function prepareBenchmark() {
	let steps = [
		{ start: 0, stop: 50, followers: maxFollowers / 10 ** 4 },
		{ start: 50, stop: 70, followers: maxFollowers / 10 ** 3 },
		{ start: 70, stop: 85, followers: maxFollowers / 10 ** 2 },
		{ start: 85, stop: 95, followers: maxFollowers / 10 },
		{ start: 95, stop: 100, followers: maxFollowers },
	]
	console.log('steps', steps)

	let feedReferences = []
	for (const step of steps) {
		for (let x = step.start; x < step.stop; x++) {
			let target = { group: 'user', feedID: x }
			feedReferences.push(target)
			for (let i = 0; i < step.followers; i++) {
				let source = { group: 'timeline', feedID: `${x}-${i}` }
				feedReferences.push(source)
			}
		}
	}
	console.log('2 creating the feeds', feedReferences.length)
	let feedMap = await fm.getOrCreateFeeds(feedReferences)

	let follows = []
	for (const step of steps) {
		for (let x = step.start; x < step.stop; x++) {
			let target = feedMap['user'][x]
			for (let i = 0; i < step.followers; i++) {
				let source = feedMap['timeline'][`${x}-${i}`]
				follows.push({ source, target })
			}
		}
	}
	console.log('creating the follows', follows.length)

	// actually do the follows
	let promises = []
	for (const group of chunkify(follows, 1000)) {
		promises.push(fm.followMany(group, 0))
	}
	await Promise.all(promises)
	console.log('3 creating the user feeds')

	let userFeeds = feedMap['user']

	let last = maxFollowers - 1

	fm.options.firehose.client.on(`feed-timeline--99-${last}`, message => {
		let foreignID = message.operations[0].activity.foreign_id
		t.stop('fanout and realtime', foreignID)
		t.stop('benchmark')
	})

	console.log('ready for benchmark')

	return userFeeds
}

async function benchmarkCapacity(n, userFeeds) {
	let promises = []
	let activity = {
		foreign_id: `capacity:${n}`,
		actor: 'user:1',
		verb: 'tweet',
		object: 'tweet:1',
	}
	console.log('adding activity', `capacity:${n}`)
	t.start('fanout and realtime', `capacity:${n}`)
	for (let feed of Object.values(userFeeds)) {
		promises.push(fm.addActivity(activity, feed))
	}
	await Promise.all(promises)
}

async function run() {
	const userFeeds = await prepareBenchmark()
	async function benchmark(n) {
		await benchmarkCapacity(n, userFeeds)
	}

	console.log(
		'starting benchmark now',
		process.env.REPETITIONS,
		process.env.CONCURRENCY,
	)
	t.start('benchmark')
	await runBenchmark(benchmark, 1, 1)

	setInterval(() => {
		console.log('summarize')
		t.summarize()
	}, 5000)
}

run()
	.then(() => {
		console.log('done')
	})
	.catch(err => {
		console.log('err', err)
	})
