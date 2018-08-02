import { getFeedManager, Timer, runBenchmark } from './utils'
import chunkify from '../src/utils/chunk'

const fm = getFeedManager()
const t = new Timer()
const followers = 10000
let targetID = `nick${followers}`
console.log(targetID)
// nick is very popular

const follows = []

for (let i = 0; i < followers; i++) {
	const source = `timeline:${i}`
	const target = `user:${targetID}`
	follows.push({ source, target })
}

async function prepareBenchmark() {
	// setup the follow relationships
	for (const group of chunkify(follows, 1000)) {
		await fm.followMany(group)
	}
	console.log(`created ${follows.length} follow relationships`)
	// listen to changes in the last feed
	const connected = await client.feed('timeline', followers - 1).subscribe(data => {
		if (data.new && data.new[0]) {
			t.stop('fanout and realtime', data.new[0].foreign_id)
		}
	})
	console.log(connected)
}

async function benchmarkFanout(n) {
	let activity = {
		foreign_id: `test:${n}`,
		actor: 'user:1',
		verb: 'tweet',
		object: 'tweet:1',
	}
	let feed = await fm.getOrCreateFeed('user', targetID)
	t.start('fanout and realtime', `test:${n}`)
	let response = await fm.addActivity(activity, feed)

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
