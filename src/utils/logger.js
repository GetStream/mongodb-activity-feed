import config from '../config'
import winston from 'winston'

const logger = winston.createLogger({
	level: config.logger.level,
	transports: [new winston.transports.Console()],
})

export default logger
