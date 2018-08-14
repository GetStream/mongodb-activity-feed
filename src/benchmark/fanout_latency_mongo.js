import './loadenv'
import { getFeedManager, Timer, runBenchmark } from './utils'
import chunkify from '../utils/chunk'

const fm = getFeedManager()
fm.options.bull = true

const t = new Timer()
const followers = 20000
let targetID = `nick${followers}`

let feedMap
let targetFeed

async function prepareBenchmark() {
	console.log('prepping benchmark')
	// setup the follow relationships
	const follows = []
	const target = await fm.getOrCreateFeed('user', targetID)
	targetFeed = target
	const feedReferences = []
	for (let i = 0; i < followers; i++) {
		feedReferences.push({ group: 'timeline', feedID: i })
	}
	// batch create since we want this to be fast
	feedMap = await fm.getOrCreateFeeds(feedReferences)
	for (let i = 0; i < followers; i++) {
		const source = feedMap['timeline'][i]
		if (!source) {
			throw new Error('whoops')
		}
		follows.push({ source, target })
	}
	let promises = []
	for (const group of chunkify(follows, 1000)) {
		promises.push(fm.followMany(group, 0))
	}
	await Promise.all(promises)
	// listen to changes in the last feed
	let feedID = followers - 1
	console.log('listening to socketurl', fm.options.firehose.url)
	fm.options.firehose.client.on(`feed-timeline--${feedID}`, data => {
		let foreignID = data.operations[0].activity.foreign_id
		t.stop('fanout and realtime', foreignID)
	})
	console.log('connected')
}

async function benchmarkFanout(n) {
	let activity = {
		foreign_id: `test:${n}`,
		actor: 'user:1',
		verb: 'tweet',
		object: 'tweet:1',
	}

	t.start('fanout and realtime', `test:${n}`)
	let response = await fm.addActivity(activity, targetFeed)

	return response
}

async function run() {
	await prepareBenchmark()
	console.log('starting benchmark now')
	await runBenchmark(benchmarkFanout, process.env.REPETITIONS, process.env.CONCURRENCY)
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
