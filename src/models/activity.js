import mongoose, { Schema } from 'mongoose'
import timestamps from 'mongoose-timestamp'

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
		foreign_id: {
			type: String,
			required: true,
		},
		target: {
			type: String,
			required: false,
		},
		extra: {
			type: Object,
		},
		time: {
			type: Date,
			default: Date.now,
		},
	},
	{ collection: 'activity' },
)

ActivitySchema.plugin(timestamps)

ActivitySchema.pre('find', function() {
	this.start = Date.now()
})

ActivitySchema.post('find', function(result) {
	// prints number of milliseconds the query took
	console.log('find() took ' + (Date.now() - this.start) + ' millis')
})

module.exports = exports = mongoose.model('Activity', ActivitySchema)
