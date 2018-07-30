import { dropDBs } from "../../test/utils.js";
import redis from "../../src/utils/redis";
import db from "../../src/utils/db";

import { expect } from "chai";

import { FeedManager } from "../../src/index";

// TODO:
// - activity uniqueness is not well defined
// - readme update
// - examples folder
// - make mongo connection configurable

describe("Test Feed Operations", () => {
  let timelineScott, timelineTom, timelineFederico, userJosh, userAlex, userBen;

  const options = { bull: false };
  let fm = new FeedManager(db, redis, options);

  before(async () => {
    await dropDBs();
    timelineScott = await fm.getOrCreateFeed("timeline", "scott");
    timelineTom = await fm.getOrCreateFeed("timeline", "tom");
    timelineFederico = await fm.getOrCreateFeed("timeline", "federico");

    userJosh = await fm.getOrCreateFeed("user", "josh");
    userAlex = await fm.getOrCreateFeed("user", "alex");
    userBen = await fm.getOrCreateFeed("user", "ben");
  });

  it("should create a feed", async () => {
    const timelineThierry = await fm.getOrCreateFeed("timeline", "thierry");
    expect(timelineThierry).to.not.be.null;
    const timelineThierry2 = await fm.getOrCreateFeed("timeline", "thierry");
    expect(timelineThierry2).to.not.be.null;
    expect(timelineThierry2._id.toString()).to.equal(
      timelineThierry._id.toString()
    );
  });

  it("should add an activity", async () => {
    const activityData = {
      actor: "user:123",
      verb: "listen",
      object: "Norah Jones",
      duration: 50,
      time: "2015-06-15"
    };
    const activity = await fm.addActivity(activityData, userJosh);
    expect(activity).to.not.be.null;
    const activity2 = await fm.addActivity(activityData, userJosh);
    expect(activity2).to.not.be.null;
    expect(activity._id.toString()).to.equal(activity2._id.toString());
  });

  it("should follow a feed", async () => {
    await fm.follow(timelineScott, userJosh);
  });

  it("should unfollow a feed", async () => {
    await fm.follow(timelineScott, userJosh);
    await fm.unfollow(timelineScott, userJosh);
  });

  it("should read an empty feed", async () => {
    const feed = await fm.getOrCreateFeed("test", "thierry");
    let activities = await fm.readFeed(feed, 3);
    expect(activities.length).to.equal(0);
  });

  it("should read a feed with 1 activity", async () => {
    const feed = await fm.getOrCreateFeed("test", "thierry");
    const activityData = {
      actor: "user:123",
      verb: "listen",
      object: "Norah Jones",
      duration: 50,
      time: "2015-06-15"
    };
    await fm.addActivity(activityData, feed);
    let activities = await fm.readFeed(feed, 0, 3);
    expect(activities.length).to.equal(1);
  });

  it("should read a feed in chronological order", async () => {
    const feed = await fm.getOrCreateFeed("chronological", "scott");
    let activityData = {
      actor: "user:123",
      verb: "listen",
      object: "Norah Jones",
      popularity: 10,
      time: "2017-06-15"
    };
    await fm.addActivity(activityData, feed);
    activityData = {
      actor: "user:123",
      verb: "listen",
      object: "Savage Garden",
      popularity: 20,
      time: "2015-06-15"
    };
    await fm.addActivity(activityData, feed);
    let activities = await fm.readFeed(feed, 0, 3);
    expect(activities.length).to.equal(2);
    // first one should be norah jones since time is 2017
    expect(activities[0].popularity).to.equal(10);
  });

  it("should read a ranked feed", async () => {
    const feed = await fm.getOrCreateFeed("ranking", "scott");
    let activityData = {
      actor: "user:123",
      verb: "listen",
      object: "Norah Jones",
      popularity: 10,
      time: "2017-06-15"
    };
    await fm.addActivity(activityData, feed);
    activityData = {
      actor: "user:123",
      verb: "listen",
      object: "Savage Garden",
      popularity: 20,
      time: "2015-06-15"
    };
    let rankingMethod = (a, b) => {
      return b.popularity - a.popularity;
    };
    await fm.addActivity(activityData, feed);
    let activities = await fm.readFeed(feed, 0, 3, rankingMethod);
    expect(activities.length).to.equal(2);
    // first one should be savage garden since its more popular
    expect(activities[0].popularity).to.equal(20);
  });

  it("should aggregate a feed", async () => {
    const feed = await fm.getOrCreateFeed("agg", "scott");
    let activityData = {
      actor: "user:123",
      verb: "listen",
      object: "Norah Jones",
      popularity: 10,
      time: "2017-06-15"
    };
    await fm.addActivity(activityData, feed);
    activityData = {
      actor: "user:123",
      verb: "listen",
      object: "Savage Garden",
      popularity: 20,
      time: "2015-06-15"
    };
    // group together all activities with the same verb and actor
    let aggregationMethod = activity => {
      return activity.verb + "__" + activity.actor;
    };
    await fm.addActivity(activityData, feed);
    let groups = await fm.readFeed(feed, 0, 3, null, aggregationMethod);
    expect(groups.length).to.equal(1);
    expect(groups[0].activities.length).to.equal(2);
  });

  it("should remove an activity", async () => {
    const feed = await fm.getOrCreateFeed("test", "nick");
    const activityData = {
      actor: "user:123",
      verb: "listen",
      object: "Norah Jones",
      duration: 50,
      time: "2015-06-15"
    };
    let activity = await fm.addActivity(activityData, feed);
    let activity2 = await fm.removeActivity(activityData, feed);
    expect(activity._id.toString()).to.equal(activity2._id.toString());

    let activities = await fm.readFeed(feed, 0, 3);
    expect(activities.length).to.equal(0);
  });

  it("should fanout when adding an activity", async () => {
    await fm.follow(timelineTom, userAlex);
    const activityData = {
      actor: "user:123",
      verb: "listen",
      object: "Carrie Underwood",
      duration: 55
    };
    await fm.addActivity(activityData, userAlex);
    let userFeedActivities = await fm.readFeed(userAlex, 0, 3);
    expect(userFeedActivities.length).to.equal(1);
    let timelineFeedActivities = await fm.readFeed(timelineTom, 0, 3);
    expect(timelineFeedActivities.length).to.equal(1);
  });

  it("should copy on follow", async () => {
    const activityData = {
      actor: "user:ben",
      verb: "listen",
      object: "Carrie Underwood",
      duration: 55
    };
    await fm.addActivity(activityData, userBen);
    // verify there is 1 activity in the user feed
    let userFeedActivities = await fm.readFeed(userBen, 0, 3);
    expect(userFeedActivities.length).to.equal(1);
    // verify the timeline is empty
    let timelineFeedActivities = await fm.readFeed(timelineFederico, 0, 3);
    expect(timelineFeedActivities.length).to.equal(0);
    // follow and see if we got the record
    await fm.follow(timelineFederico, userBen);
    timelineFeedActivities = await fm.readFeed(timelineFederico, 0, 3);
    expect(timelineFeedActivities.length).to.equal(1);
  });
});
