## Activity Feed Node & Mongo DB ##

Simple example of how to build a news feed with node and mongodb.
I created it for this blogpost: "Building Activity Feeds with MongoDB vs the alternatives"

https://docs.google.com/document/d/11gfMOPgE476fLsb2sXYy955X2G4egUv4p7-zlXdf8hU/edit#

## Init ##

```
const fm = new FeedManager(mongoConnection, redisConnection)
```

### Adding an activity ###

Add an activity like this.

```
fm.addActivity(activity)
```

### Follow a feed ###

```
fm.feed('timeline', 1).follow('topic', 2)
```

## Read a feed from MongoDB ##

```
fm.feed('timeline', 123).get(10)
```

## Running tests

```
NODE_ENV=test node_modules/mocha/bin/_mocha --timeout 15000 --require test-entry.js "test/**/*.js"
```

Or if you're lazy

```
yarn test
```
