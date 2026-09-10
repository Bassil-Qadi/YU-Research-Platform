import mongoose, { Schema, Document, Types, type Model } from 'mongoose'

export interface IConversation extends Document {
  participants: Types.ObjectId[]
  /** The participant pair as one sorted string — see the index note below. */
  pairKey:       string
  lastMessageAt?: Date
  createdAt: Date
  updatedAt: Date
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
      validate: {
        validator: (v: Types.ObjectId[]) => v.length === 2,
        message:   'A direct conversation has exactly two participants',
      },
    },
    /**
     * Uniqueness cannot be enforced on `participants` directly: an index on an
     * array field is multikey, so a unique one would make each *individual*
     * user appear in at most one conversation ever. A scalar derived from the
     * sorted pair gives the constraint that was actually wanted.
     */
    pairKey: { type: String, required: true, unique: true, index: true },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
)

// The inbox query: everything I am part of, most recent first.
ConversationSchema.index({ participants: 1, lastMessageAt: -1 })

/** Canonical ordering for a participant pair. */
export function sortedPair(a: string | Types.ObjectId, b: string | Types.ObjectId) {
  return [a.toString(), b.toString()]
    .sort()
    .map((id) => new mongoose.Types.ObjectId(id))
}

/** The unique key for a pair, in the same canonical order. */
export function pairKeyFor(a: string | Types.ObjectId, b: string | Types.ObjectId) {
  return [a.toString(), b.toString()].sort().join(':')
}

const Conversation: Model<IConversation> =
  mongoose.models.Conversation ??
  mongoose.model<IConversation>('Conversation', ConversationSchema)

export default Conversation
