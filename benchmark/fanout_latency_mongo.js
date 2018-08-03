import { getFeedManager, Timer, runBenchmark } from './utils'
import chunkify from '../src/utils/chunk'
import { FayeFirehose } from '../src/index'
import http from 'http'
import faye from 'faye'
const FAYE_URL = 'http://localhost:8000/faye'

const fm = getFeedManager()
const t = new Timer()
const followers = 10000
let targetID = `nick${followers}`

// setup faye
var server = http.createServer(),
	bayeux = new faye.NodeAdapter({ mount: '/faye', timeout: 45 })

bayeux.attach(server)
server.listen(8000)

const fayeFirehose = new FayeFirehose(FAYE_URL)
fm.options.firehose = fayeFirehose

async function prepareBenchmark() {
	// setup the follow relationships
	const follows = []
	for (let i = 0; i < followers; i++) {
		const source = await fm.getOrCreateFeed('timeline', i)
		const target = await fm.getOrCreateFeed('user', targetID)
		follows.push({ source, target })
	}
	for (const group of chunkify(follows, 1000)) {
		await fm.followMany(group)
	}
	// listen to changes in the last feed
	let feedID = followers - 1
	const connected = await fayeFirehose.fayeClient.subscribe(
		`/feed-timeline--${feedID}`,
		message => {
			let foreignID = message.operations[0].activity.foreign_id
			t.stop('fanout and realtime', foreignID)
		},
	)
	console.log('connected', connected)
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
