import mongoose, { Schema } from 'mongoose'
import timestamps from 'mongoose-timestamp'

export const FeedSchema = new Schema(
	{
		group: {
			type: Schema.Types.ObjectId,
			ref: 'FeedGroup',
			required: true,
		},
		feedID: {
			type: String,
			required: true,
		},
	},
	{ collection: 'feed' },
)

FeedSchema.index({ group: 1, feedID: 1 }, { unique: true })

FeedSchema.plugin(timestamps)

module.exports = exports = mongoose.model('Feed', FeedSchema)
