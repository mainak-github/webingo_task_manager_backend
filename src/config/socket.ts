import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { socketAuth } from '../middleware/socketAuth.middleware';
import { socketService } from '../services/socket.service';
import { env } from './env';
import { registerSocketHandlers } from '../sockets/index';

export function setupSocket(server: HTTPServer): SocketIOServer {
  const allowedOrigins = [
    env.clientUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ];

  const io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket'],
  });

  // Attach JWT Authentication Handshake Check
  io.use(socketAuth);

  // Initialize helper singleton service
  socketService.init(io);

  // Register all listeners
  registerSocketHandlers(io);

  return io;
}
