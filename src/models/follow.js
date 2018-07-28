import mongoose, { Schema } from "mongoose";
import timestamps from "mongoose-timestamp";

export const FollowSchema = new Schema(
  {
    source: {
      type: Schema.Types.ObjectId,
      ref: "Feed",
      required: true,
      index: true
    },
    target: {
      type: Schema.Types.ObjectId,
      ref: "Feed",
      required: true,
      index: true
    }
  },
  { collection: "follow" }
);

FollowSchema.index({ source: 1, target: 1 }, { unique: true });

FollowSchema.plugin(timestamps);

module.exports = exports = mongoose.model("Follow", FollowSchema);
