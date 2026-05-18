// Custom Next.js server with Socket.io for in-game chat.
//
// Replaces `next start` / `next dev`. The HTTP server hosts both Next's
// request handler and Socket.io on the same port — Caddy reverse-proxies
// everything (including the /socket.io/ WebSocket upgrade) transparently.
//
// Chat is ephemeral: messages are broadcast to a room and never persisted.
// Lost on disconnect/reload by design.

import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { getToken } from "next-auth/jwt";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => {
  // Let Socket.io's own listener handle its handshake/poll requests.
  // Without this, Next responds 404 first and the upgrade never lands.
  if (req.url?.startsWith("/socket.io")) return;
  handle(req, res);
});

const io = new Server(httpServer);

io.use(async (socket, nextFn) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || "";
    const token = await getToken({
      req: { headers: { cookie: cookieHeader } },
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token?.sub) return nextFn(new Error("unauthorized"));
    socket.data.userId = token.sub;
    socket.data.name = token.name || token.email || "Player";
    nextFn();
  } catch {
    nextFn(new Error("auth failed"));
  }
});

io.on("connection", (socket) => {
  socket.on("chat:join", (roomId) => {
    if (typeof roomId === "string" && roomId) socket.join(`chat:${roomId}`);
  });
  socket.on("chat:leave", (roomId) => {
    if (typeof roomId === "string") socket.leave(`chat:${roomId}`);
  });
  socket.on("chat:send", ({ roomId, text } = {}) => {
    if (typeof roomId !== "string" || typeof text !== "string") return;
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) return;
    io.to(`chat:${roomId}`).emit("chat:message", {
      userId: socket.data.userId,
      name: socket.data.name,
      text: trimmed,
      ts: Date.now(),
    });
  });
});

httpServer.listen(port, () => {
  console.log(`> Ready on http://localhost:${port} (${dev ? "dev" : "prod"})`);
});
