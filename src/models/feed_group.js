import mongoose, { Schema } from 'mongoose'
import timestamps from 'mongoose-timestamp'

export const FeedGroupSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
		},
	},
	{ collection: 'feed_group' },
)

FeedGroupSchema.plugin(timestamps)

module.exports = exports = mongoose.model('FeedGroup', FeedGroupSchema)
