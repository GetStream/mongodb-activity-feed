import { getFeedManager, Timer, runBenchmark } from './utils'

let activities = []

const fm = getFeedManager()
const t = new Timer()

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
	let feed = await fm.getOrCreateFeed('timeline_aggregated', 'test')
	for (const activity of activities) {
		await fm.addActivity(activity, feed)
	}
	console.log('starting benchmark')
}

async function benchmarkReads(feed, aggregationMethod) {
	t.start('read feed')
	let response = await fm.readFeed(feed, 0, 20, null, aggregationMethod)
	t.stop('read feed')
	return response
}

async function run() {
	await prepareBenchmark()
	let feed = await fm.getOrCreateFeed('timeline_aggregated', 'test')

	const aggregationMethod = activity => {
		return activity.verb
	}

	const callable = benchmarkReads.bind(this, feed, aggregationMethod)

	await runBenchmark(callable, process.env.REPETITIONS, process.env.CONCURRENCY)

	t.summarize()
}

run()
	.then(() => {
		console.log('done')
	})
	.catch(err => {
		console.log('err', err)
	})
