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
});

const util = require('util');
const sinon = require('sinon');
const mock = require('mock-require');

// Do Mocking here if needed

require('./setup-tests');
