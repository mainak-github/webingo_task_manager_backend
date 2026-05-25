import type { Server } from 'socket.io';
import { SOCKET_EVENTS } from '../constants/events';

class SocketService {
  private io: Server | null = null;

  init(ioServer: Server): void {
    this.io = ioServer;
    console.log('[Socket] SocketService initialized with Server instance.');
  }

  getIO(): Server {
    if (!this.io) {
      throw new Error('Socket.io has not been initialized yet.');
    }
    return this.io;
  }

  // Helper broadcast project room events cleanly
  toRoom(projectId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`project:${projectId}`).emit(event, data);
      console.log(`[Socket Broadcast] Event "${event}" sent to room project:${projectId}`);
    }
  }

  // Send direct notification alert
  toUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }
}

export const socketService = new SocketService();
export default socketService;
