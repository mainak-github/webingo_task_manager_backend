export const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  JOIN_PROJECT: 'project:join',
  LEAVE_PROJECT: 'project:leave',
  
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  TASK_BULK_UPDATED: 'task:bulk_updated',
  
  COLLABORATOR_VIEWING: 'collaborator:viewing',
  COLLABORATOR_EDITING: 'collaborator:editing',
  
  NOTIFICATION_RECEIVED: 'notification:received',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
