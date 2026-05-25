import { Router } from 'express';
import * as taskController from '../controllers/task.controller';
import { protect } from '../middleware/auth.middleware';
import { restrictToProjectRole, restrictToTaskRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { upload } from '../middleware/upload.middleware';
import {
  createTaskSchema,
  updateTaskSchema,
  bulkUpdateStatusSchema,
  bulkAssignSchema,
  bulkDeleteSchema,
} from '../validators/task.validator';

const router = Router();

// Apply auth protection globally to all task routes
router.use(protect);

// Project-scoped routes
// viewer + member + manager + admin can read tasks
router.get('/:projectId/tasks', restrictToProjectRole(['admin', 'manager', 'member', 'viewer']), taskController.getProjectTasks);
router.get('/:projectId/analytics', restrictToProjectRole(['admin', 'manager', 'member', 'viewer']), taskController.getProjectAnalytics);

// Admin/manager can create any task; members can create tasks assigned to themselves.
router.post('/:projectId/tasks', restrictToProjectRole(['admin', 'manager', 'member']), validate(createTaskSchema), taskController.createTask);

// Bulk operations — only admin and manager
router.post('/:projectId/tasks/bulk-status', restrictToProjectRole(['admin', 'manager']), validate(bulkUpdateStatusSchema), taskController.bulkUpdateStatus);
router.post('/:projectId/tasks/bulk-assign', restrictToProjectRole(['admin', 'manager']), validate(bulkAssignSchema), taskController.bulkAssign);
router.post('/:projectId/tasks/bulk-delete', restrictToProjectRole(['admin']), validate(bulkDeleteSchema), taskController.bulkDelete);

// Task-specific routes
router.get('/tasks/:taskId', restrictToTaskRole(['admin', 'manager', 'member', 'viewer']), taskController.getTaskDetails);
router.patch('/tasks/:taskId', restrictToTaskRole(['admin', 'manager', 'member']), validate(updateTaskSchema), taskController.updateTask);
router.delete('/tasks/:taskId', restrictToTaskRole(['admin', 'manager']), taskController.deleteTask);

// Attachments — viewer cannot upload
router.post('/tasks/:taskId/attachments', restrictToTaskRole(['admin', 'manager', 'member']), upload.single('file'), taskController.uploadAttachment);
router.get('/tasks/:taskId/attachments/:attachmentId/download', restrictToTaskRole(['admin', 'manager', 'member', 'viewer']), taskController.downloadAttachment);
router.delete('/tasks/:taskId/attachments/:attachmentId', restrictToTaskRole(['admin', 'manager', 'member']), taskController.removeAttachment);

// Comments
router.post('/tasks/:taskId/comments', restrictToTaskRole(['admin', 'manager', 'member']), taskController.addComment);
router.delete('/tasks/:taskId/comments/:commentId', restrictToTaskRole(['admin', 'manager', 'member']), taskController.deleteComment);

// Timers
router.post('/tasks/:taskId/timer/start', restrictToTaskRole(['admin', 'manager', 'member']), taskController.startTimer);
router.post('/tasks/:taskId/timer/pause', restrictToTaskRole(['admin', 'manager', 'member']), taskController.pauseTimer);
router.post('/tasks/:taskId/timer/resume', restrictToTaskRole(['admin', 'manager', 'member']), taskController.resumeTimer);
router.post('/tasks/:taskId/timer/stop', restrictToTaskRole(['admin', 'manager', 'member']), taskController.stopTimer);
router.post('/tasks/:taskId/timer/finish', restrictToTaskRole(['admin', 'manager', 'member']), taskController.finishTimer);

export default router;
