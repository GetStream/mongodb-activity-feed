import { getFeedManager } from './utils'

const fm = getFeedManager()

async function run() {
	const db = await fm.mongoConnection
	await db.connection.db.dropDatabase()

	await fm.redisConnection.flushall()

	console.log('all done flushing redis and mongo')
}

run()
	.then(() => {
		console.log('done')
		process.exit()
	})
	.catch(err => {
		console.log('err', err)
		process.exit(1)
	})
