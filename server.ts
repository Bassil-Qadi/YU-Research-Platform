import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const socketServer = new Server(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  })

  ;(global as any).io = socketServer

  socketServer.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`)

    socket.on('join-project', (projectId: string) => {
      socket.join(`project:${projectId}`)
      console.log(`${socket.id} joined project:${projectId}`)
    })

    socket.on('leave-project', (projectId: string) => {
      socket.leave(`project:${projectId}`)
    })

    socket.on('typing', ({ projectId, userName }: { projectId: string; userName: string }) => {
      socket.to(`project:${projectId}`).emit('user-typing', { userName })
    })

    socket.on('stop-typing', ({ projectId }: { projectId: string }) => {
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