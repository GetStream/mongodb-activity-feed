import ioS from 'socket.io'

const ioServer = ioS(8002)
import ioClient from 'socket.io-client'

console.log('started server')
ioServer.on('connection', function(serverSocket) {
	serverSocket.on('firehose', function(msg) {
		let channels = msg.channels || [msg.channel]
		for (const channel of channels) {
			io.emit(channel, msg)
		}
	})
})
