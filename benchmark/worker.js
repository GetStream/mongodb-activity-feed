import { getFeedManager, Timer, runBenchmark } from './utils'

const fm = getFeedManager()

console.log('starting the worker')

fm.queue.process(5, job => {
	fm._fanout(...job.data.args)
})
