import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { protect } from '../middleware/auth.middleware';
import { restrictToProjectRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createProjectSchema,
  updateProjectSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '../validators/project.validator';

const router = Router();

// Public route to validate invitation token before login
router.post('/join/validate', projectController.validateInvitation);

// Apply auth protection globally to all project routes
router.use(protect);

router.post('/', validate(createProjectSchema), projectController.createProject);
router.get('/', projectController.getUserProjects);
router.post('/join', projectController.joinProject);

// viewer can read project details and activities
router.get('/:projectId', restrictToProjectRole(['admin', 'manager', 'member', 'viewer']), projectController.getProjectDetails);
router.get('/:projectId/activities', restrictToProjectRole(['admin', 'manager', 'member', 'viewer']), projectController.getActivityLog);

// Admin only project configuration
router.patch('/:projectId', restrictToProjectRole(['admin']), validate(updateProjectSchema), projectController.updateProject);
router.delete('/:projectId', restrictToProjectRole(['admin']), projectController.deleteProject);

// Only admin/manager can invite
router.post('/:projectId/invite', restrictToProjectRole(['admin', 'manager']), validate(inviteMemberSchema), projectController.inviteMember);

// Only admin can manage members
router.delete('/:projectId/members/:memberId', restrictToProjectRole(['admin']), projectController.removeMember);
router.patch('/:projectId/members/role', restrictToProjectRole(['admin']), validate(updateMemberRoleSchema), projectController.updateMemberRole);

export default router;
