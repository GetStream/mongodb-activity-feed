import mongoose, { Schema } from 'mongoose'
import timestamps from 'mongoose-timestamp'
import autopopulate from 'mongoose-autopopulate'

export const FollowSchema = new Schema(
	{
		source: {
			type: Schema.Types.ObjectId,
			ref: 'Feed',
			required: true,
			autopopulate: true,
			index: true,
		},
		target: {
			type: Schema.Types.ObjectId,
			ref: 'Feed',
			required: true,
			index: true,
		},
	},
	{ collection: 'follow' },
)

FollowSchema.index({ source: 1, target: 1 }, { unique: true })
FollowSchema.index({ target: -1 })

FollowSchema.plugin(timestamps)
FollowSchema.plugin(autopopulate)

module.exports = exports = mongoose.model('Follow', FollowSchema)
