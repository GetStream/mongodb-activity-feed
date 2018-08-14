import './loadenv'
import { getStreamClient, Timer, runBenchmark } from './utils'

let activities = []

let client = getStreamClient()
const t = new Timer()
let feed = client.feed('timeline_aggregated', 'test')

for (let i = 0; i < 3000; i++) {
	let activity = {
		foreign_id: `test:${i}`,
		time: '2018-08-01T04:06:02.223654',
		actor: `user:${i}`,
		verb: 'tweet',
		object: `tweet:${i}`,
	}
	activities.push(activity)
}

async function prepareBenchmark() {
	await feed.addActivities(activities.slice(0, 1000))
	await feed.addActivities(activities.slice(1000, 2000))
	await feed.addActivities(activities.slice(2000, 3000))

	console.log('starting benchmark now')
}

async function benchmarkReads(n) {
	let response = await feed.get({ limit: 20 })
	t.duration('read feed', response.duration.replace('ms', '') * 1)
	return response
}

async function run() {
	await prepareBenchmark()
	await runBenchmark(benchmarkReads, process.env.REPETITIONS, process.env.CONCURRENCY)

	t.summarize()
}

run()
	.then(() => {
		console.log('done')
	})
	.catch(err => {
		console.log('err', err)
	})
