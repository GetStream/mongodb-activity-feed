## Activity Feed Node & Mongo DB

Simple example of how to build a news feed with Node and MongoDB.
I created it for this blogpost: "Building Activity Feeds with MongoDB vs the alternatives"

https://docs.google.com/document/d/11gfMOPgE476fLsb2sXYy955X2G4egUv4p7-zlXdf8hU/edit

It uses CRDTs https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type to reduce the need for locks.

## News Feed Mongo

## Notification Feed Node

## Timeline

### Init

```
import {FeedManager} from 'mongodb-activity-feed'
const fm = new FeedManager(mongoConnection, redisConnection)
fm.feed('user', '123')
```

### Adding an activity

Add an activity like this.

```
fm.addActivity(activity, feed)
```

```
fm.removeActivity(activityID)
```

```
fm.removeActivityFromFeed(activityID, feed)
```

### Follow a feed

```
fm.follow(a, b)
fm.unfollow(a, b)
```

### Read a feed from MongoDB

```
fm.readFeed('user', '123', options)
```

## Running tests

```
NODE_ENV=test node_modules/mocha/bin/_mocha --timeout 15000 --require test-entry.js "test/**/*.js"
```

Or if you're lazy

```
yarn test
```

## Pros/Cons

The cost/performance of a MongoDB based activity feed is substantially worse compared to Stream (https://getstream.io/).
Unless you need to run your feeds on-prem you should not use this in prod.
