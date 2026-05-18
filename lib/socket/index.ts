/**
 * Socket.io server setup — Phase 2+
 * @see https://socket.io/docs/v4/server-initialization/
 */
export function getSocketServerUrl(): string {
  return process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3000";
}

/** Client hook placeholder; implement in Phase 2 */
export const SOCKET_EVENTS = {
  MESSAGE_NEW: "message:new",
  PROJECT_UPDATE: "project:update",
  NOTIFICATION: "notification",
} as const;
