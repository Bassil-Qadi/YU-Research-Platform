import type { Server } from "socket.io";

declare global {
  /**
   * The Socket.io server, attached by server.ts once the HTTP server is up.
   * Route handlers read it to broadcast; it is undefined under `next build`
   * and anywhere the custom server is not the entry point.
   */
  // eslint-disable-next-line no-var
  var io: Server | undefined;
}

export {};
