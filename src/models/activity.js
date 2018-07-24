import mongoose, { Schema } from 'mongoose';
import timestamps from 'mongoose-timestamp';

export const ActivitySchema = new Schema(
	{
		actor: {
			type: String,
			required: true,
		},
		verb: {
			type: String,
			required: true,
		},
		object: {
			type: String,
			required: true,
		},
		target: {
			type: String,
			required: false,
		},
		extra: {
			type: Map,
		},
        time: {
            type: Date,
            default: Date.now,
        }
	},
	{ collection: 'activity' },
);

ActivitySchema.plugin(timestamps);

module.exports = exports = mongoose.model('Activity', ActivitySchema);
