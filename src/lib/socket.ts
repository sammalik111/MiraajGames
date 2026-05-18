"use client";

// Lazy singleton — one socket per browser tab, shared across components.
// Cookies ride along for the session-token handshake on the server.

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) socket = io({ withCredentials: true });
  return socket;
}
