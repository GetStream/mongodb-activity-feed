require('babel-register')({
	presets: [
		[
			'env',
			{
				targets: {
					node: 'current',
				},
			},
		],
	],
	plugins: [
		'shebang',
		'transform-async-generator-functions',
		[
			'istanbul',
			{
				exclude: ['test', 'setup-tests.js', 'test-entry.js'],
			},
		],
	],
})

// Do Mocking here if needed

require('./setup-tests')
