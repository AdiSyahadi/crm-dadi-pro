import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../middleware/auth';
import { prisma } from '../config/database';

let io: SocketIOServer | null = null;

// Track which users are viewing which conversations
// Key: conversationId, Value: Map<socketId, { userId, userName }>
const conversationViewers = new Map<string, Map<string, { userId: string; userName: string }>>();

function broadcastViewers(conversationId: string) {
  if (!io) return;
  const viewers = conversationViewers.get(conversationId);
  const list = viewers ? Array.from(viewers.values()) : [];
  // Deduplicate by userId (same user may have multiple tabs)
  const unique = Array.from(new Map(list.map((v) => [v.userId, v])).values());
  io.to(`conversation:${conversationId}`).emit('conversation:viewers', {
    conversationId,
    viewers: unique,
  });
}

function removeViewerFromAll(socketId: string) {
  for (const [convId, viewers] of conversationViewers.entries()) {
    if (viewers.delete(socketId)) {
      broadcastViewers(convId);
      if (viewers.size === 0) conversationViewers.delete(convId);
    }
  }
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.isDev
        ? (origin: any, cb: any) => {
            // In development, allow any localhost/127.0.0.1 origin
            if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
              cb(null, true);
            } else {
              cb(null, env.FRONTEND_URL);
            }
          }
        : env.FRONTEND_URL,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET as jwt.Secret) as JwtPayload;
      const dbUser = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { name: true } });
      (socket as any).user = decoded;
      (socket as any).userName = dbUser?.name || 'Agent';
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as JwtPayload;
    const userName: string = (socket as any).userName;

    console.log(`🔌 Socket connected: ${user.userId} (org: ${user.organizationId})`);

    // Join organization room
    socket.join(`org:${user.organizationId}`);
    // Join personal room
    socket.join(`user:${user.userId}`);

    // Handle joining specific conversation room
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Internal chat rooms
    socket.on('internal-chat:join', (chatId: string) => {
      socket.join(`internal-chat:${chatId}`);
    });
    socket.on('internal-chat:leave', (chatId: string) => {
      socket.leave(`internal-chat:${chatId}`);
    });

    // Handle typing indicator
    socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${data.conversationId}`).emit('chat:typing', {
        userId: user.userId,
        conversationId: data.conversationId,
        isTyping: data.isTyping,
      });
    });

    // Handle conversation viewing (collision detection)
    socket.on('conversation:viewing', (conversationId: string) => {
      // Remove from any previous conversation
      removeViewerFromAll(socket.id);
      // Add to new conversation
      if (!conversationViewers.has(conversationId)) {
        conversationViewers.set(conversationId, new Map());
      }
      conversationViewers.get(conversationId)!.set(socket.id, {
        userId: user.userId,
        userName,
      });
      broadcastViewers(conversationId);
    });

    socket.on('conversation:stop-viewing', () => {
      removeViewerFromAll(socket.id);
    });

    socket.on('disconnect', () => {
      removeViewerFromAll(socket.id);
      console.log(`🔌 Socket disconnected: ${user.userId}`);
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
}
