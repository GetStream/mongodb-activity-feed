import { FeedManager } from "../src/index.js";
import Redis from "ioredis";
import mongoose from "mongoose";

// Connect to Redis and MongoDB

const redis = new Redis("redis://localhost:6379/9");
const mongo = mongoose.connect(
  "mongodb://localhost:27017/spotify",
  {
    autoIndex: true,
    reconnectTries: Number.MAX_VALUE,
    reconnectInterval: 500,
    poolSize: 50,
    bufferMaxEntries: 0,
    keepAlive: 120
  }
);

const fm = new FeedManager(mongo, redis);

// follow a playlist, a friend and an artist
async function followExample() {
  const timelineJohn = await fm.getOrCreateFeed("timeline", "john");
  fm.follow(timelineJohn, await fm.getOrCreateFeed("artist", "goo goo dolls"));
  fm.follow(timelineJohn, await fm.getOrCreateFeed("user", "ben"));
  fm.follow(timelineJohn, await fm.getOrCreateFeed("playlist", "80s classics"));
  // note these examples use names, you'd typically use IDs for the 2nd argument
  // IE you'd do 'user', '1312312' instead of 'user', 'ben'
}

// example of adding an activity to the user ben feed
async function addActivity() {
  const activityData = {
    actor: "user:ben",
    verb: "listen",
    object: "Norah Jones",
    duration: 50,
    time: "2015-06-15"
  };
  const benUserFeed = await fm.getOrCreateFeed("user", "ben");
  await fm.addActivity(activityData, benUserFeed);
}

// example of how to read the timeline for John
async function readTimeline() {
  const timelineJohn = await fm.getOrCreateFeed("timeline", "john");
  return fm.readFeed(timelineJohn, 10);
}

// run all the examples
async function runExamples() {
  console.log(
    "following artist goo goo dolls, user ben and playlist 80s classics"
  );
  await followExample();
  console.log("adding an activity to the feed user:ben");
  await addActivity();
  console.log("reading the feed timeline:john");
  const results = await readTimeline();
  console.log(results);
}

runExamples()
  .then(() => {
    console.log("all done");
  })
  .catch(err => {
    console.log("uh oh", err);
  });
