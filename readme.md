## Activity Feed Node & Mongo DB

Simple example of how to build a news feed with Node and MongoDB.
I created it for this blogpost: "Building Activity Feeds with MongoDB vs the alternatives"

https://docs.google.com/document/d/11gfMOPgE476fLsb2sXYy955X2G4egUv4p7-zlXdf8hU/edit

It uses [CRDTs](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) to reduce the need for locks.

### Install

```bash
yarn add mongodb-activity-feed
```

### MongoDB & Redis Activity Feed

```bash
brew install redis mongodb
brew services start redis
brew services start mongodb
```

### Initialization

Here's a very short example

```node
import { FeedManager } from 'mongodb-activity-feed'
const fm = new FeedManager(mongoConnection, redisConnection, {
	bull: false,
	firehose: false,
})
```

And a bit longer one:

```node
import { FeedManager, FayeFirehose } from 'mongodb-activity-feed'
import Redis from 'ioredis'
import mongoose from 'mongoose'

const redis = new Redis('redis://localhost:6379/9')
const mongo = mongoose.connect(
	'mongodb://localhost:27017/mydb',
	{
		autoIndex: true,
		reconnectTries: Number.MAX_VALUE,
		reconnectInterval: 500,
		poolSize: 50,
		bufferMaxEntries: 0,
		keepAlive: 120,
	},
)
const fayeFirehose = new FayeFirehose('http://localhost:8000/faye')

const fm = new FeedManager(mongo, redis, { bull: true, firehose: fayeFirehose })
```

The **bull** option determines if activity fanout is done over a bull queue or synchronous.
The **firehose** option allows you to listen to feed changes in realtime using Faye.

## Timeline MongoDB

Here's a quick tutorial on a simple timeline with mongodb-activity-feed

```node
const timelineScott = await fm.getOrCreateFeed('timeline', 'scott')
const userNick = await fm.getOrCreateFeed('user', 'nick')
await fm.follow(timelineScott, userNick)
const activity = {
	actor: 'user:nick',
	verb: 'watch',
	object: 'video:123',
}
await fm.addActivity(activity, userNick)
const activities = await fm.readFeed(timelineScott, 0, 10)
```

## Notification System MongoDB

Here's a quick tutorial on a simple timeline with mongodb-activity-feed

```node
const notificationBen = await fm.getOrCreateFeed('notification', 'ben')
// lets say you want to notify Ben that Nick likes his post
const activity = {
	actor: 'user:nick',
	verb: 'like',
	object: 'post:123',
}
await fm.addActivity(activity, notificationBen)
// group together all activities with the same verb and actor
const aggregationMethod = activity => {
	return activity.verb + '__' + activity.actor
}
const groups = await fm.readFeed(notificationBen, 0, 3, null, aggregationMethod)
```

### Adding an activity

Add an activity like this.

```node
const activity = {
	actor: 'user:nick',
	verb: 'like',
	object: 'post:123',
}
fm.addActivity(activity, feed)
```

### Removing an activity

Remove an activity:

```node
const activity = {
	actor: 'user:nick',
	verb: 'like',
	object: 'post:123',
}
fm.removeActivity(activity, feed)
```

### Follow a feed

```node
// follow with a copy limit of 10
const timelineScott = await fm.getOrCreateFeed('timeline', 'scott')
const userNick = await fm.getOrCreateFeed('user', 'nick')
await fm.follow(timelineScott, userNick, 10)
```

### Follow Many Feeds

```node
// follow with a copy limit of 10
const source = await fm.getOrCreateFeed('timeline', 'scott')
const target = await fm.getOrCreateFeed('user', 'nick')
const target2 = await fm.getOrCreateFeed('user', 'john')
await fm.followMany([{ source, target }, { source, target2 }], 10)
```

### Unfollow a feed

```node
const timelineScott = await fm.getOrCreateFeed('timeline', 'scott')
const userNick = await fm.getOrCreateFeed('user', 'nick')
await fm.unfollow(timelineScott, userNick)
```

### Create Many Feeds at Once

```node
const feedReferences = [
	{ group: 'timeline', feedID: 'scott' },
	{ group: 'notification', feedID: 'ben' },
]
const feedMap = await fm.getOrCreateFeeds(feedReferences)
```

## Reading a feed from MongoDB

### Basic Read

```node
const notificationAlex = await fm.getOrCreateFeed('notification', 'alex')
await fm.readFeed(notificationAlex, 0, 10)
```

### Ranked Feed

```node
const notificationAlex = await fm.getOrCreateFeed('notification', 'alex')
// asumes that you have a property on your activity called "popularity"
const rankingMethod = (a, b) => {
	return b.popularity - a.popularity
}
const activities = await fm.readFeed(notificationAlex, 0, 3, rankingMethod)
```

### Aggregated Feed

```node
const notificationAlex = await fm.getOrCreateFeed('notification', 'alex')
// group together all activities with the same verb and actor
const aggregationMethod = activity => {
	return activity.verb + '__' + activity.actor
}
await fm.readFeed(notificationAlex, 0, 10, null, aggregationMethod)
```

Activities are unique on the combination of `foreign_id` and `time`.
If you don't specify foreign id the full activity object will be used.

### Firehose Configuration

```node
// socket (recommended)
const firehose = new SocketIOFirehose(SOCKET_URL)
// faye
const firehoseFaye = new FayeFirehose(FAYE_URL)
// dummy firehose
const firehoseDummy = new new DummyFirehose(message => {})()
fm = new FeedManager(mongo, redis, { firehose: firehose, bull: false })
```

## Pros/Cons

MongoDB is a nice general purpose database. For building activity feeds it's not a great fit though.
Cassandra and Redis will in most scenarios outperform a MongoDB based solution.

Dedicated activity feed databases like [Stream](https://getstream.io/) are typically 10x more performant and easier to use.

So in most cases you shouldn't run your activity feed on MongoDB.
It only makes sense if your traffic is relatively small and you're not able to use cloud hosted APIs.
Unless you really need to run your feeds on-prem you should not use this in prod.

If you do need to run on-prem I'd recommend the open source [Stream-Framework](https://github.com/tschellenbach/stream-framework)

## Contributing

Pull requests are welcome but be sure to improve test coverage.

### Running tests

```bash
yarn test
```

### Linting

```bash
yarn lint
```

### Prettier

```bash
yarn prettier
```

## Benchmarks

These docs aim to make it easy to reproduce these benchmark.
Initial plan is to run these again in 2019 to see how Mongo and Stream changed.

### Benchmark prep (dev mode)

** Step 1 - Clone the repo **

```bash
git clone https://github.com/GetStream/mongodb-activity-feed.git
cd mongodb-activity-feed
yarn install
brew install redis mongodb
brew services start redis
brew services start mongodb
```

** Step 2 - Environment variables **

You'll want to configure the following environment variables in a `.env` file

```bash
STREAM_APP_ID=appid
STREAM_API_KEY=key
STREAM_API_SECRET=secret
MONGODB_CONNECTION=connectionstring
SOCKET_URL=http://localhost:8002
REDIS_HOST=localhost
REDIS_PORT=6379
```

** Step 3 - Start worker and socketio **

For dev purposes you can use this setup to start the processes

```bash
yarn build
pm2 start process.json
```

This will start a worker and socket.io cluster.

** Step 4 - Benchmark dir **

```bash
cd dist/benchmark
```

### Benchmark 1 - Read latency

MongoDB

```bash
# flush your mongo instance before running this
REPETITIONS=10 CONCURRENCY=5 node read_latency_mongo.js
```

Stream

```bash
 REPETITIONS=10 CONCURRENCY=5 node read_latency.js
```

The blogpost runs the benchmark with 10 repetitions and concurrency set to 5, 10 and 20.

### Benchmark 2 - Fanout & realtime latency

MongoDB

```bash
# flush your mongo instance before running this
CONCURRENCY=1 node fanout_latency_mongo.js
```

Stream

```bash
CONCURRENCY=1 node babel-node fanout_latency.js
```

The blogpost runs the benchmark with 1, 3 and 10 for the concurrency.

### Benchmark 3 - Network Simulation/ Capacity

MongoDB

```bash
# flush your mongo instance before running this
MAX_FOLLOWERS=1000 node capacity_mongo.js
```

Stream

```bash
MAX_FOLLOWERS=1000 node capacity.js
```

The blogpost increase max followers from 1k to 10k and finally 50k

### Benchmark prep (production notes)

1.  SocketIO:

Note that you need to configure the load balancer for Socket.io to be sticky

https://socket.io/docs/using-multiple-nodes/

2.  Redis

For optimal performance be sure to setup redis to _not_ be persistent
