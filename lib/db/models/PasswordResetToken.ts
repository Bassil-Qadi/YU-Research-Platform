import mongoose, { Schema, Document, Types, type Model } from 'mongoose'

/**
 * A pending "forgot password" request.
 *
 * Only the SHA-256 of the token is stored. The token itself exists in exactly
 * two places — the link in the email and the URL in the person's browser — so
 * a dump of this collection cannot be used to take over an account.
 */
export interface IPasswordResetToken extends Document {
  userId:    Types.ObjectId
  /** Hex SHA-256 of the token that was emailed. */
  tokenHash: string
  expiresAt: Date
  /** Set the moment it is spent, so a link works exactly once. */
  usedAt?:   Date
  createdAt: Date
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt:    { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

// Mongo sweeps expired requests on its own; nothing has to remember to tidy up.
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const PasswordResetToken: Model<IPasswordResetToken> =
  mongoose.models.PasswordResetToken ??
  mongoose.model<IPasswordResetToken>('PasswordResetToken', PasswordResetTokenSchema)

export default PasswordResetToken
