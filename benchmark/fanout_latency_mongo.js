import { getFeedManager, Timer, runBenchmark } from './utils'
import chunkify from '../src/utils/chunk'

const fm = getFeedManager()
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

	for (const group of chunkify(follows, 1000)) {
		await fm.followMany(group, 0)
	}
	// listen to changes in the last feed
	let feedID = followers - 1
	const connected = await fm.options.firehose.fayeClient.subscribe(
		`/feed-timeline--${feedID}`,
		message => {
			let foreignID = message.operations[0].activity.foreign_id
			t.stop('fanout and realtime', foreignID)
		},
	)
	console.log('connected', connected)
}

async function benchmarkFanout(n) {
	console.log(1, targetFeed)
	let activity = {
		foreign_id: `test:${n}`,
		actor: 'user:1',
		verb: 'tweet',
		object: 'tweet:1',
	}

	t.start('fanout and realtime', `test:${n}`)
	let response = await fm.addActivity(activity, targetFeed)
	console.log('2')

	return response
}

async function run() {
	await prepareBenchmark()
	console.log('starting benchmark now')
	await runBenchmark(benchmarkFanout, process.env.REPETITIONS, process.env.CONCURRENCY)
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
