// setup faye
var http = require('http')
var faye = require('faye')
var bayeux = new faye.NodeAdapter({ mount: '/faye' })

var server = http.createServer()

bayeux.attach(server)
server.listen({ port: 8000 }, function() {
	console.log('server running on port 8000')
})
server.on('error', e => {
	console.log('error', e)
})

var client = new faye.Client('http://localhost:8000/faye')

client
	.subscribe('/messages', function(message) {
		console.log('Got a message: ' + message.text)
	})
	.then(function() {
		client.publish('/messages', {
			text: 'Hello world',
		})
	})
	.catch(function(err) {
		console.log('whoops', err)
	})
