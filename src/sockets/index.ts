import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../constants/events';
import { projectRepository } from '../repositories/project.repository';

// In-memory lookup track active collaborators: maps projectId -> Map(userId -> { name, action, taskId })
const activeCollaborators = new Map<string, Map<string, { name: string; action: 'viewing' | 'editing'; taskId: string }>>();

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    if (!user) return;

    console.log(`[Socket Connected] User: ${user.name} (${user.id})`);

    // Join personal room for private alerts / real-time notifications
    socket.join(`user:${user.id}`);

    // Join Project Channel
    socket.on(SOCKET_EVENTS.JOIN_PROJECT, async (projectId: string) => {
      const isMember = await projectRepository.isUserMember(projectId, user.id);
      if (!isMember) {
        socket.emit('project:join_denied', { projectId, message: 'Access denied for this project.' });
        return;
      }

      socket.join(`project:${projectId}`);
      console.log(`[Socket] User ${user.name} joined room project:${projectId}`);
      
      // Initialize active collaborators trackers
      if (!activeCollaborators.has(projectId)) {
        activeCollaborators.set(projectId, new Map());
      }
      
      // Send current active list of collaborators to the joining user
      const projectUsers = Array.from(activeCollaborators.get(projectId)!.entries()).map(([id, info]) => ({
        id,
        ...info,
      }));
      socket.emit('collaborators:list', projectUsers);
    });

    // Leave Project Channel
    socket.on(SOCKET_EVENTS.LEAVE_PROJECT, (projectId: string) => {
      socket.leave(`project:${projectId}`);
      console.log(`[Socket] User ${user.name} left room project:${projectId}`);
      
      // Remove from active list
      const projectMap = activeCollaborators.get(projectId);
      if (projectMap) {
        projectMap.delete(user.id);
        
        // Broadcast updated active collaborators list
        const projectUsers = Array.from(projectMap.entries()).map(([id, info]) => ({
          id,
          ...info,
        }));
        io.to(`project:${projectId}`).emit('collaborators:list', projectUsers);
      }
    });

    // Collaborative Indicators (Viewing a task)
    socket.on(SOCKET_EVENTS.COLLABORATOR_VIEWING, async ({ projectId, taskId }: { projectId: string; taskId: string }) => {
      const isMember = await projectRepository.isUserMember(projectId, user.id);
      if (!isMember) return;

      const projectMap = activeCollaborators.get(projectId);
      if (projectMap) {
        projectMap.set(user.id, { name: user.name, action: 'viewing', taskId });
        
        // Broadcast updated collaborators list
        const projectUsers = Array.from(projectMap.entries()).map(([id, info]) => ({
          id,
          ...info,
        }));
        io.to(`project:${projectId}`).emit('collaborators:list', projectUsers);
      }
    });

    // Collaborative Indicators (Editing a task)
    socket.on(SOCKET_EVENTS.COLLABORATOR_EDITING, async ({ projectId, taskId }: { projectId: string; taskId: string }) => {
      const isMember = await projectRepository.isUserMember(projectId, user.id);
      if (!isMember) return;

      const projectMap = activeCollaborators.get(projectId);
      if (projectMap) {
        projectMap.set(user.id, { name: user.name, action: 'editing', taskId });
        
        // Broadcast updated collaborators list
        const projectUsers = Array.from(projectMap.entries()).map(([id, info]) => ({
          id,
          ...info,
        }));
        io.to(`project:${projectId}`).emit('collaborators:list', projectUsers);
      }
    });

    // Handle user disconnects
    socket.on('disconnect', () => {
      console.log(`[Socket Disconnected] User: ${user.name} (${user.id})`);
      
      // Clear user from all active collaborator trackers
      for (const [projectId, projectMap] of activeCollaborators.entries()) {
        if (projectMap.has(user.id)) {
          projectMap.delete(user.id);
          
          // Broadcast update
          const projectUsers = Array.from(projectMap.entries()).map(([id, info]) => ({
            id,
            ...info,
          }));
          io.to(`project:${projectId}`).emit('collaborators:list', projectUsers);
        }
      }
    });
  });
}
