import mongoose, { Schema } from 'mongoose';
import timestamps from 'mongoose-timestamp';

export const FollowSchema = new Schema(
	{
        source: {
            type: Schema.Types.ObjectId,
            ref: 'Feed',
            required: true,
            index: true,
        },
        target: {
            type: Schema.Types.ObjectId,
            ref: 'Feed',
            required: true,
            index: true,
        }
	},
	{ collection: 'follow' },
);

FollowSchema.plugin(timestamps);

module.exports = exports = mongoose.model('Follow', FollowSchema);
