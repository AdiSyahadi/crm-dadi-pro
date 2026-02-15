import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../middleware/auth';

let io: SocketIOServer | null = null;

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
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET as jwt.Secret) as JwtPayload;
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as JwtPayload;

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

    // Handle typing indicator
    socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${data.conversationId}`).emit('chat:typing', {
        userId: user.userId,
        conversationId: data.conversationId,
        isTyping: data.isTyping,
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${user.userId}`);
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
}
