import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

/** How many mounted subscribers currently want each project room. */
const roomSubscribers = new Map<string, number>()

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000', {
      autoConnect: true,
      // The server authenticates the handshake from the session cookie, which
      // is only sent when credentials are enabled.
      withCredentials: true,
    })

    // Room membership lives on the server and does not survive a reconnect,
    // so re-join everything the app still has subscribers for.
    socket.on('connect', () => {
      roomSubscribers.forEach((_, projectId) => {
        socket?.emit('join-project', projectId)
      })
    })
  }

  return socket
}

/**
 * Subscribe to a project's room for as long as the caller needs it, and return
 * the release function.
 *
 * Rooms are reference-counted because the socket is a singleton: the chat and
 * the task board both want the same room, and whichever unmounted first would
 * otherwise leave the room out from under the other.
 */
export function joinProjectRoom(projectId: string): () => void {
  const activeSocket = getSocket()
  const subscribers = roomSubscribers.get(projectId) ?? 0

  roomSubscribers.set(projectId, subscribers + 1)
  if (subscribers === 0) activeSocket.emit('join-project', projectId)

  let released = false

  return () => {
    if (released) return
    released = true

    const remaining = (roomSubscribers.get(projectId) ?? 1) - 1
    if (remaining > 0) {
      roomSubscribers.set(projectId, remaining)
      return
    }

    roomSubscribers.delete(projectId)
    activeSocket.emit('leave-project', projectId)
  }
}
