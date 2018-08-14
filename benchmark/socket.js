import ioS from 'socket.io'

const ioServer = ioS(8002)
let redis = require('socket.io-redis')
ioServer.adapter(redis({ host: 'localhost', port: 6379 }))
console.log('started server')
ioServer.on('connection', function(serverSocket) {
	serverSocket.on('firehose', function(msg) {
		let channels = msg.channels || [msg.channel]
		for (const channel of channels) {
			ioServer.emit(channel, msg)
		}
	})
})
