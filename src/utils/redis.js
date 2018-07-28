import Redis from "ioredis";

import config from "../config";
import logger from "./logger";

const redis = new Redis(config.redis.uri);

export default redis;
