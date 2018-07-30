import redis from '../utils/redis'
import db from '../utils/db'
import { FeedManager } from '../index'

let fm = new FeedManager(db, redis)

fm.queue.process(5, job => {
	let activity = job.data.activity
	let group = job.data.group
	let origin = job.data.origin
	let operation = job.data.operation
	fm._fanout(activity, group, origin, operation)
})
