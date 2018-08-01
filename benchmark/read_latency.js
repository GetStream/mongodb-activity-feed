import stream from 'getstream'

let client = stream.connect(
	process.env.API_KEY,
	process.env.API_SECRET,
)

let activities = []
let feed = client.feed('timeline_aggregated', 'test')

for (let i = 0; i < 1000; i++) {
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
	let response = await feed.addActivities(activities)
	console.log(response.duration)
}

async function benchmarkReads() {
	let response = await feed.get({ limit: 20 })
	return response
}

async function run() {
	await prepareBenchmark()

	let concurrency = process.env.CONCURRENCY || 1
	let promises = []
	for (let i = 0; i < concurrency; i++) {
		promises.push(benchmarkReads())
	}
	let results = await Promise.all(promises)
	for (const result of results) {
		console.log(result.duration)
	}
}

run()
	.then(() => {
		console.log('done')
	})
	.catch(err => {
		console.log('err', err)
	})
