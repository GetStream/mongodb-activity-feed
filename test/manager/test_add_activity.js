import {dropDBs} from '../../test/utils.js'
import Activity from '../../src/models/activity'
import FeedGroup from '../../src/models/feed_group'
import Feed from '../../src/models/feed'
import ActivityFeed from '../../src/models/activity_feed'
import Follow from '../../src/models/follow'


const ADD_OPERATION = 1
const REMOVE_OPERATION = 2

describe('Add Activity', () => {
	before(async () => {
		await dropDBs();
	});

	describe('Add Activity To Flat Feed', () => {

		it('should add an activity', async () => {
            const activityData = {actor: 'user:123', verb: 'listen', object: 'Norah Jones', duration: 50}
            // create the feed group
            const group = await FeedGroup.create({name: 'user'})
            // create the feed
            const feed = await Feed.create({group: group, feedID: '123'})
            // create the activity
            let {actor, verb, object, target, time, ...extra} = activityData
            const activity = await Activity.create({actor: actor, verb: verb, object: object, target: target, time: time, extra: extra })
            console.log(activity)

            // create the activity feed
            const activityFeed = await ActivityFeed.create({feed: feed, activity: activity, operation: ADD_OPERATION, time: activity.time})
            console.log(activityFeed)

            // fanout to the followers in batches
            const followers = await Follow.find({target: feed}).lean()
            console.log(followers)

            // chunking time

            // read the feed

		});

        // follow
        // read ranked feed
        // read aggregate feed

	});
});
