import ioS from 'socket.io'

const SOCKETIO_PORT = 8002
const ioServer = ioS(SOCKETIO_PORT)
import { SETTINGS } from './utils'

let redis = require('socket.io-redis')

ioServer.adapter(redis({ host: process.env.REDIS_HOST, port: process.env.REDIS_PORT }))
console.log(
	`starter socket server on port ${SOCKETIO_PORT} with redis host ${
		SETTINGS.redis.host
	}:${SETTINGS.redis.port}`,
)
ioServer.on('connection', function(serverSocket) {
	serverSocket.on('firehose', function(msg) {
		let channels = msg.channels || [msg.channel]
		for (const channel of channels) {
			ioServer.emit(channel, msg)
		}
	})
})
