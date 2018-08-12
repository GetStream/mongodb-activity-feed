import { getStreamClient, Timer, runBenchmark } from './utils'
import chunkify from '../src/utils/chunk'

let client = getStreamClient()
const t = new Timer()
const maxFollowers = 50000

async function prepareBenchmark() {
	let steps = [
		{ start: 0, stop: 50, followers: maxFollowers / 10 ** 4 },
		{ start: 50, stop: 70, followers: maxFollowers / 10 ** 3 },
		{ start: 70, stop: 85, followers: maxFollowers / 10 ** 2 },
		{ start: 85, stop: 95, followers: maxFollowers / 10 },
		{ start: 95, stop: 100, followers: maxFollowers },
	]
	console.log('steps', steps)

	let follows = []
	for (const step of steps) {
		for (let x = step.start; x < step.stop; x++) {
			let target = `user:${maxFollowers}-${x}`
			for (let i = 0; i < step.followers; i++) {
				let source = `timeline:${maxFollowers}-${x}-${i}`
				follows.push({ source, target })
			}
		}
	}
	console.log('creating the follows', follows.length)

	// actually do the follows
	for (const group of chunkify(follows, 1000)) {
		await client.followMany(group, 0)
	}
	console.log('3 creating the user feeds')

	let last = maxFollowers - 1

	const connected = await client
		.feed('timeline', `${maxFollowers}-99-${last}`)
		.subscribe(data => {
			if (data.new && data.new[0]) {
				t.stop('fanout and realtime', data.new[0].foreign_id)
				t.stop('benchmark')
			}
		})
	console.log(connected)

	console.log('ready for benchmark')

	return
}

async function benchmarkCapacity(n) {
	let promises = []
	let activity = {
		foreign_id: `capacity:${n}`,
		actor: 'user:1',
		verb: 'tweet',
		object: 'tweet:1',
	}
	console.log('adding activity', `capacity:${n}`)
	t.start('fanout and realtime', `capacity:${n}`)
	for (let x = 0; x < 100; x++) {
		const feed = client.feed('user', `${maxFollowers}-${x}`)
		const promise = feed.addActivity(activity)
		promises.push(promise)
	}
	await Promise.all(promises)
}

async function run() {
	await prepareBenchmark()
	async function benchmark(n) {
		await benchmarkCapacity(n)
	}

	console.log(
		'starting benchmark now',
		process.env.REPETITIONS,
		process.env.CONCURRENCY,
	)
	t.start('benchmark')
	await runBenchmark(benchmark, process.env.REPETITIONS, process.env.CONCURRENCY)

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
