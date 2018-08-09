/*
Our last test is a little more complex. For this test we set up 100 feeds.
The first 50 feeds are followed by 5 other feeds. Feed 50-60 are followed by 100 other feeds, 60-70 by 1,000 feeds, 70-80 by 2,000
and 80-100 by 10,000. Again this is a rough approximation but it takes into account that some feeds
are very popular and others are not.

Next, we’ll scale up the number of new activities we’re adding per minute till the infrastructure breaks.

*/

import { getFeedManager, Timer, runBenchmark } from './utils'
import chunkify from '../src/utils/chunk'
import { FayeFirehose } from '../src/index'
import http from 'http'
import faye from 'faye'
const FAYE_URL = 'http://localhost:8000/faye'

const fm = getFeedManager()
const t = new Timer()

// setup faye
var server = http.createServer(),
	bayeux = new faye.NodeAdapter({ mount: '/faye', timeout: 45 })

bayeux.attach(server)
server.listen(8000)

const fayeFirehose = new FayeFirehose(FAYE_URL)
fm.options.firehose = fayeFirehose

async function prepareBenchmark() {
	let steps = [
		{ start: 0, stop: 50, followers: 5 },
		{ start: 50, stop: 60, followers: 100 },
		{ start: 60, stop: 70, followers: 1000 },
		{ start: 70, stop: 80, followers: 2000 },
		{ start: 80, stop: 100, followers: 10000 },
	]
	console.log('1 creating feeds')
	let follows = []
	for (const step of steps) {
		for (let x = step.start; x < step.stop; x++) {
			let target = await fm.getOrCreateFeed('user', x)
			for (let i = 0; i < step.followers; i++) {
				let source = await fm.getOrCreateFeed('timeline', `${x}-${i}`)
				follows.push({ source, target })
			}
		}
	}
	console.log('2 creating the follows')
	// actually do the follows
	for (const group of chunkify(follows, 1000)) {
		await fm.followMany(group, 0)
	}
	console.log('3 creating the user feeds')

	let userFeeds = {}
	for (let x = 0; x < 100; x++) {
		let feed = await fm.getOrCreateFeed('user', x)
		userFeeds[x] = feed
	}

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
	await runBenchmark(benchmark, process.env.REPETITIONS, process.env.CONCURRENCY)
}

run()
	.then(() => {
		console.log('done')
	})
	.catch(err => {
		console.log('err', err)
	})
