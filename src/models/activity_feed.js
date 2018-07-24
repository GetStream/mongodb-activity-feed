import mongoose, { Schema } from 'mongoose';
import autopopulate from 'mongoose-autopopulate';

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
            index: true,
			autopopulate: true,
		},
        operation: {
			type: Number,
	        required: true
        },
        time: {
            type: Date,
            default: Date.now,
			required: true,
        }
	},
	{ collection: 'activity_feed' },
);

ActivityFeedSchema.index({ feed: 1, time: -1 });

module.exports = exports = mongoose.model('ActivityFeed', ActivityFeedSchema);
