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
import { dropDBs } from '../test/utils'
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

const maxFollowers = 1000

async function prepareBenchmark() {
	let steps = [
		{ start: 0, stop: 50, followers: maxFollowers / 10 ** 4 },
		{ start: 50, stop: 60, followers: maxFollowers / 10 ** 3 },
		{ start: 60, stop: 80, followers: maxFollowers / 10 ** 2 },
		{ start: 80, stop: 95, followers: maxFollowers / 10 },
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

	console.log('creating the follows')

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

	// actually do the follows
	for (const group of chunkify(follows, 1000)) {
		await fm.followMany(group, 0)
	}
	console.log('3 creating the user feeds')

	let userFeeds = feedMap['user']

	let last = maxFollowers - 1

	const connected = await fayeFirehose.fayeClient.subscribe(
		`/feed-timeline--99-${last}`,
		message => {
			let foreignID = message.operations[0].activity.foreign_id
			t.stop('fanout and realtime', foreignID)
		},
	)

	console.log('ready for benchmark', connected)

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
	await dropDBs()
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
	setTimeout(() => {
		t.summarize()
	}, 7000)
}

run()
	.then(() => {
		console.log('done')
	})
	.catch(err => {
		console.log('err', err)
	})
