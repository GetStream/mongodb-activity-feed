import dotenv from 'dotenv';
import path from 'path';

const configs = {
	development: { config: 'dev' },
	production: { config: 'prod' },
	test: {
		config: 'test',
		env: path.resolve(__dirname, '..', '..', 'test', '.env'),
	},
};

const currentEnvironment = process.env.NODE_ENV || 'development';

// workaround based on https://github.com/motdotla/dotenv/issues/133
const defaultPath = path.resolve(__dirname, '..', '..', '..', 'app', '.env');
const envPath = configs[currentEnvironment].env || defaultPath;

console.log(`Loading .env from '${envPath}'`);
dotenv.config({ path: envPath });


const config = require(`./${configs[currentEnvironment].config}`);

const _default = {}

module.exports = Object.assign({ env: currentEnvironment }, _default, config);
