import ioCallable from 'socket.io'

const ioServer = ioCallable(8002)
import ioClient from 'socket.io-client'

console.log('started server')
ioServer.on('connection', function(socket) {
	console.log('connected')
	socket.on('ferret', function(name, two, fn) {
		console.log('name', name)
		fn('woot' + name)
	})
	socket.on('a', function(data, fn) {
		console.log('name', data)
		fn('woot' + data)
	})
})

const socket = ioClient('http://localhost:8002')
socket.emit('ferret', 'tobi', 'two', function(data) {
	console.log(data) // data will be 'woot'
})

socket.emit('a', { tony: 'twofingers' }, function(data) {
	console.log(data) // data will be 'woot'
})
