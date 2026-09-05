import { loadEnvConfig } from '@next/env'
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server, type DefaultEventsMap } from 'socket.io'
import mongoose from 'mongoose'
import { authenticateHandshake, type SocketData } from '@/lib/socket/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import { isMember } from '@/lib/projects/membership'

// The socket layer reads AUTH_SECRET and MONGODB_URI, so .env.local has to be
// loaded here rather than left to Next's own startup.
loadEnvConfig(process.cwd())

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

/** Membership is re-read per join, so removing someone takes effect at once. */
async function canJoinProject(projectId: string, userId: string) {
  if (!mongoose.isValidObjectId(projectId)) return false

  await connectDB()
  const project = await Project.findById(projectId).select('members').lean()

  return isMember(project, userId)
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const socketServer = new Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true, // the handshake has to carry the session cookie
    },
  })

  global.io = socketServer

  // No session, no socket. Without this every room below is world-readable.
  socketServer.use(async (socket, err) => {
    const user = await authenticateHandshake(socket.handshake.headers.cookie)
    if (!user) return err(new Error('Unauthorized'))

    socket.data.user = user
    err()
  })

  socketServer.on('connection', (socket) => {
    const user = socket.data.user
    console.log(`Socket connected: ${socket.id} (user ${user.id})`)

    // Derived from the session, never from the client: a socket can only ever
    // receive its own notifications.
    socket.join(`user:${user.id}`)

    socket.on('join-project', async (projectId: unknown) => {
      if (typeof projectId !== 'string') return

      if (!(await canJoinProject(projectId, user.id))) {
        socket.emit('join-denied', { projectId })
        return
      }

      socket.join(`project:${projectId}`)
    })

    socket.on('leave-project', (projectId: unknown) => {
      if (typeof projectId === 'string') socket.leave(`project:${projectId}`)
    })

    socket.on('typing', ({ projectId }: { projectId: string }) => {
      // Only rooms this socket actually belongs to, and the authenticated
      // display name rather than whatever the client claimed to be called.
      if (!socket.rooms.has(`project:${projectId}`)) return
      socket.to(`project:${projectId}`).emit('user-typing', { userName: user.name })
    })

    socket.on('stop-typing', ({ projectId }: { projectId: string }) => {
      if (!socket.rooms.has(`project:${projectId}`)) return
      socket.to(`project:${projectId}`).emit('user-stop-typing')
    })

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`)
    })
  })

  const PORT = parseInt(process.env.PORT ?? '3000')
  httpServer.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`)
  })
})
