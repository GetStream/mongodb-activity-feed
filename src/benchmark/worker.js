import './loadenv'
import { getFeedManager, SETTINGS } from './utils'

const fm = getFeedManager()

console.log(
	`starter the bull worker to process fanout tasks. Redis host ${SETTINGS.redis.host}:${
		SETTINGS.redis.port
	}, MongoDB hostname: ${SETTINGS.mongo}`,
)

fm.queue.process(5, job => {
	fm._fanout(...job.data.args)
})
