'use strict';

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ── Env validation ────────────────────────────────────────────────────────────
require('./lib/env');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// ── Allowed origins (comma-separated in env, fallback to localhost in dev) ────
const rawOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

// ── Input sanitization helpers ────────────────────────────────────────────────
const MAX_NAME_LEN    = 50;
const MAX_MSG_LEN     = 2000;
const MAX_ROOM_ID_LEN = 64;

/**
 * Strip HTML/script tags and trim whitespace.
 * Lightweight — no DOM available in Node, so we use a regex-based approach.
 */
function sanitizeText(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/[<>&"'`]/g, (c) => ({   // entity-encode remaining special chars
      '<': '&lt;', '>': '&gt;', '&': '&amp;',
      '"': '&quot;', "'": '&#x27;', '`': '&#x60;',
    }[c]))
    .trim()
    .slice(0, maxLen);
}

function sanitizeRoomId(str) {
  if (typeof str !== 'string') return '';
  // Allow only alphanumeric and hyphens
  return str.replace(/[^a-zA-Z0-9-]/g, '').slice(0, MAX_ROOM_ID_LEN);
}

// ── HTTP rate limiter (applied to all HTTP requests) ─────────────────────────
const httpLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 120,              // max 120 HTTP requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please slow down.',
});

// ── Per-socket event rate limiter ─────────────────────────────────────────────
const SOCKET_RATE_WINDOW_MS = 10_000; // 10 seconds
const SOCKET_RATE_MAX       = 30;     // max 30 events per 10s per socket

function createSocketRateLimiter() {
  let count = 0;
  let windowStart = Date.now();
  return function isRateLimited() {
    const now = Date.now();
    if (now - windowStart > SOCKET_RATE_WINDOW_MS) {
      count = 0;
      windowStart = now;
    }
    count++;
    return count > SOCKET_RATE_MAX;
  };
}

// ── Room TTL ──────────────────────────────────────────────────────────────────
const ROOM_TTL_MS        = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_INTERVAL   = 60 * 1000;           // check every 60 s

const app    = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      // ── HTTPS redirect in production ────────────────────────────────────────
      if (!dev) {
        const proto = req.headers['x-forwarded-proto'];
        if (proto && proto !== 'https') {
          res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
          res.end();
          return;
        }
      }

      // ── Helmet security headers ─────────────────────────────────────────────
      // Apply helmet as a Node middleware-style call before handing off to Next
      const helmetMiddleware = helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://fonts.googleapis.com'],
            styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
            fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
            imgSrc:         ["'self'", 'data:', 'blob:'],
            mediaSrc:       ["'self'", 'blob:'],
            connectSrc:     ["'self'", 'wss:', 'ws:', ...allowedOrigins],
            frameSrc:       ["'none'"],
            objectSrc:      ["'none'"],
            upgradeInsecureRequests: !dev ? [] : null,
          },
        },
        crossOriginEmbedderPolicy: false, // needed for WebRTC
        hsts: !dev ? { maxAge: 31536000, includeSubDomains: true } : false,
      });

      // ── HTTP rate limit ─────────────────────────────────────────────────────
      await new Promise((resolve, reject) => {
        httpLimiter(req, res, (err) => (err ? reject(err) : resolve()));
      });

      if (res.headersSent) return; // rate limiter may have responded

      await new Promise((resolve) => helmetMiddleware(req, res, resolve));

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[Server] Error handling request:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  });

  // ── Socket.IO with restricted CORS ───────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? true : allowedOrigins,  // dev: allow all; prod: whitelist only
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Limit incoming message size
    maxHttpBufferSize: 1e5, // 100 KB
  });

  // ── In-memory room store ─────────────────────────────────────────────────────
  // Map: roomId → { participants: Map(socketId → participant), lastActivity: Date }
  const rooms = new Map();

  function touchRoom(roomId) {
    const r = rooms.get(roomId);
    if (r) r.lastActivity = Date.now();
  }

  // ── Room TTL cleanup ─────────────────────────────────────────────────────────
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms) {
      const idle = now - room.lastActivity > ROOM_TTL_MS;
      const empty = room.participants.size === 0;
      if (idle || empty) {
        // Disconnect all ghost sockets still in this room
        for (const socketId of room.participants.keys()) {
          const s = io.sockets.sockets.get(socketId);
          if (s) s.disconnect(true);
        }
        rooms.delete(roomId);
        if (!dev) console.log(`[Cleanup] Removed room ${roomId} (idle=${idle}, empty=${empty})`);
      }
    }
  }, CLEANUP_INTERVAL);

  // Prevent cleanup from blocking process exit
  cleanupInterval.unref();

  // ── Socket connection handler ────────────────────────────────────────────────
  io.on('connection', (socket) => {
    if (!dev) console.log(`[Socket] Connected: ${socket.id}`);

    const isRateLimited = createSocketRateLimiter();

    // Middleware to throttle any socket that fires too many events
    socket.use(([event], next) => {
      if (isRateLimited()) {
        console.warn(`[Rate Limit] Socket ${socket.id} throttled on event "${event}"`);
        return next(new Error('rate_limit'));
      }
      next();
    });

    // ── JOIN ROOM ─────────────────────────────────────────────────────────────
    socket.on('join-room', ({ roomId, userName, isHost }) => {
      const safeRoom = sanitizeRoomId(roomId);
      const safeName = sanitizeText(userName, MAX_NAME_LEN) || 'Guest';

      if (!safeRoom) return;

      socket.join(safeRoom);

      if (!rooms.has(safeRoom)) {
        rooms.set(safeRoom, { participants: new Map(), lastActivity: Date.now() });
      }
      const room = rooms.get(safeRoom);
      touchRoom(safeRoom);

      // Only allow isHost if no one else is in the room
      const effectiveIsHost = room.participants.size === 0 ? true : Boolean(isHost && room.participants.size === 0);

      const participant = {
        id:      socket.id,
        name:    safeName,
        isHost:  effectiveIsHost,
        audioOn: true,
        videoOn: true,
      };
      room.participants.set(socket.id, participant);

      const others = [...room.participants.values()].filter((p) => p.id !== socket.id);
      socket.emit('room-participants', others);
      socket.to(safeRoom).emit('user-joined', participant);

      socket.roomId    = safeRoom;
      socket.userName  = safeName;

      console.log(`[Room ${safeRoom}] "${safeName}" (${socket.id}) joined. Total: ${room.participants.size}`);
    });

    // ── WebRTC SIGNALING ──────────────────────────────────────────────────────
    socket.on('offer', ({ to, offer }) => {
      if (typeof to !== 'string') return;
      io.to(to).emit('offer', { from: socket.id, offer });
      touchRoom(socket.roomId);
    });

    socket.on('answer', ({ to, answer }) => {
      if (typeof to !== 'string') return;
      io.to(to).emit('answer', { from: socket.id, answer });
      touchRoom(socket.roomId);
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      if (typeof to !== 'string') return;
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // ── MEDIA TOGGLES ─────────────────────────────────────────────────────────
    socket.on('toggle-audio', ({ roomId, audioOn }) => {
      const safeRoom = sanitizeRoomId(roomId);
      const room = rooms.get(safeRoom);
      if (room && room.participants.has(socket.id)) {
        room.participants.get(socket.id).audioOn = Boolean(audioOn);
        socket.to(safeRoom).emit('participant-audio-toggle', { id: socket.id, audioOn: Boolean(audioOn) });
        touchRoom(safeRoom);
      }
    });

    socket.on('toggle-video', ({ roomId, videoOn }) => {
      const safeRoom = sanitizeRoomId(roomId);
      const room = rooms.get(safeRoom);
      if (room && room.participants.has(socket.id)) {
        room.participants.get(socket.id).videoOn = Boolean(videoOn);
        socket.to(safeRoom).emit('participant-video-toggle', { id: socket.id, videoOn: Boolean(videoOn) });
        touchRoom(safeRoom);
      }
    });

    // ── CHAT ──────────────────────────────────────────────────────────────────
    socket.on('send-message', ({ roomId, message }) => {
      const safeRoom = sanitizeRoomId(roomId);
      const room = rooms.get(safeRoom);
      if (!room) return;

      const sender = room.participants.get(socket.id);
      if (!sender) return; // must be in the room

      const safeText = sanitizeText(message, MAX_MSG_LEN);
      if (!safeText) return; // drop empty messages

      const payload = {
        id:         `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId:   socket.id,
        senderName: sender.name,
        text:       safeText,
        timestamp:  new Date().toISOString(),
      };
      io.to(safeRoom).emit('new-message', payload);
      touchRoom(safeRoom);
    });

    // ── HOST CONTROLS ─────────────────────────────────────────────────────────
    socket.on('mute-participant', ({ roomId, targetId }) => {
      const safeRoom = sanitizeRoomId(roomId);
      const room = rooms.get(safeRoom);
      const requester = room?.participants.get(socket.id);
      if (!requester?.isHost) return; // server-side host check

      if (typeof targetId !== 'string') return;
      io.to(targetId).emit('force-mute');
      socket.to(safeRoom).emit('participant-audio-toggle', { id: targetId, audioOn: false });
      touchRoom(safeRoom);
    });

    socket.on('kick-participant', ({ roomId, targetId }) => {
      const safeRoom = sanitizeRoomId(roomId);
      const room = rooms.get(safeRoom);
      const requester = room?.participants.get(socket.id);
      if (!requester?.isHost) return; // server-side host check

      if (typeof targetId !== 'string') return;
      io.to(targetId).emit('kicked');
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.leave(safeRoom);
        room.participants.delete(targetId);
      }
      io.to(safeRoom).emit('user-left', { id: targetId });
      touchRoom(safeRoom);
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const roomId = socket.roomId;
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          room.participants.delete(socket.id);
          socket.to(roomId).emit('user-left', { id: socket.id });
          if (room.participants.size === 0) {
            rooms.delete(roomId);
          }
        }
      }
      if (!dev) console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port} [${dev ? 'development' : 'production'}]`);
    console.log(`> Allowed origins: ${allowedOrigins.join(', ')}`);

    // ── Self-ping to prevent Render free-tier spin-down ──────────────────────
    // Pings the server's own health endpoint every 10 minutes.
    // Only runs in production — no need to keep dev server awake.
    if (!dev) {
      const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
      const selfUrl = process.env.NEXTAUTH_URL || `http://localhost:${port}`;

      const pingInterval = setInterval(async () => {
        try {
          const res = await fetch(`${selfUrl}/api/health`);
          console.log(`[Self-Ping] ${new Date().toISOString()} → ${res.status}`);
        } catch (err) {
          console.warn(`[Self-Ping] Failed: ${err.message}`);
        }
      }, PING_INTERVAL_MS);

      // Don't let the ping interval keep the process alive if everything else exits
      pingInterval.unref();
      console.log(`> Self-ping enabled every 10 min → ${selfUrl}/api/health`);
    }
  });
});
