import redis from "../utils/redis";
import db from "../utils/db";
import { FeedManager } from "../index";

let fm = new FeedManager(db, redis);

fm.queue.process(5, job => {
  let origin = job.data.origin;
  let group = job.data.group;
});
