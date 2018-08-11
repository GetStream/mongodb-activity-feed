import ioS from 'socket.io'

const ioServer = ioS(8002)
import ioClient from 'socket.io-client'

console.log('started server')
ioServer.on('connection', function(serverSocket) {
	serverSocket.on('firehose', function(msg) {
		console.log('sending to all clients on', msg.channel)
		ioServer.emit(msg.channel, msg)
	})
})
