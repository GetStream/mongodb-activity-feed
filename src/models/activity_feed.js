import mongoose, { Schema } from 'mongoose'
import autopopulate from 'mongoose-autopopulate'

export const ActivityFeedSchema = new Schema(
	{
		feed: {
			type: Schema.Types.ObjectId,
			ref: 'Feed',
			required: true,
			index: true,
		},
		activity: {
			type: Schema.Types.ObjectId,
			ref: 'Activity',
			required: true,
			autopopulate: true,
		},
		time: {
			type: Date,
			default: Date.now,
			required: true,
		},
		operation: {
			type: Number,
			required: true,
		},
		operationTime: {
			type: Date,
			default: Date.now,
			required: true,
		},
		origin: {
			type: Schema.Types.ObjectId,
			ref: 'Feed',
			required: true,
		},
	},
	{ collection: 'activity_feed' },
)

ActivityFeedSchema.index({ feed: 1, time: -1, operationTime: -1 })
ActivityFeedSchema.plugin(autopopulate)

ActivityFeedSchema.pre('find', function() {
	this.start = Date.now()
})

ActivityFeedSchema.post('find', function() {
	// prints number of milliseconds the query took
	console.log('find() took ' + (Date.now() - this.start) + ' millis')
})

module.exports = exports = mongoose.model('ActivityFeed', ActivityFeedSchema)
