import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll } from 'vitest'

let server: MongoMemoryServer | null = null

/**
 * Start a throwaway MongoDB for this test file and wipe it between tests.
 *
 * Real Mongoose against a real MongoDB, so schema defaults, validators and
 * indexes behave exactly as they do in production — several of the bugs this
 * suite guards against were specifically about that behaviour.
 */
export function useDatabase() {
  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    const uri = server.getUri()

    process.env.MONGODB_URI = uri

    // lib/db/connect caches the connection on globalThis; point it at ours so
    // route handlers reuse this database instead of dialling out.
    await mongoose.connect(uri)
    global.mongooseCache = { conn: mongoose, promise: Promise.resolve(mongoose) }
  })

  afterEach(async () => {
    const { collections } = mongoose.connection
    await Promise.all(
      Object.values(collections).map((collection) => collection.deleteMany({}))
    )
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await server?.stop()
    global.mongooseCache = undefined
    server = null
  })
}
