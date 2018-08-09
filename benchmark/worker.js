import { getFeedManager, Timer, runBenchmark } from './utils'

const fm = getFeedManager()

console.log('starting the worker')

fm.queue.process(5, job => {
	let activity = job.data.activity
	let group = job.data.group
	let origin = job.data.origin
	let operation = job.data.operation
	console.log('fanout')
	fm._fanout(activity, group, origin, operation)
})
