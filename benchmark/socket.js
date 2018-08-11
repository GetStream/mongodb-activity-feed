import ioS from 'socket.io'

const ioServer = ioS(8002)
import ioClient from 'socket.io-client'

console.log('started server')
ioServer.on('connection', function(socket) {
	console.log('connected')

	socket.on('a', function(data) {
		console.log('name', data)
	})
})

const socket = ioClient('http://localhost:8002')
socket.emit('ferret', 'tobi', 'two', function(data) {
	console.log(data) // data will be 'woot'
})

let l = socket.emit('a', { tony: 'twofingers' })

socket.on('ferret', function(name, two, fn) {
	console.log('name', name)
	fn('woot' + name)
})
console.log('l', l)
