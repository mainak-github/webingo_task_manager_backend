import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { projectService } from '../services/project.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const validateInvitation = asyncHandler(async (req: any, res: Response) => {
  const { token } = req.body;
  const result = await projectService.validateInvitationToken(token);
  res.status(200).json(new ApiResponse(200, result, 'Invitation validated.'));
});

export const createProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const project = await projectService.createProject(req.body, userId);
  res.status(201).json(new ApiResponse(201, project, 'Project created successfully.'));
});

export const getUserProjects = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const projects = await projectService.getUserProjects(userId);
  res.status(200).json(new ApiResponse(200, projects, 'Projects fetched successfully.'));
});

export const getProjectDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const project = await projectService.getProjectDetails(projectId);
  res.status(200).json(new ApiResponse(200, project, 'Project details fetched successfully.'));
});

export const inviteMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { email, role } = req.body;
  const actorId = req.user!.id;

  await projectService.inviteMember(projectId, email, role, actorId);
  res.status(200).json(new ApiResponse(200, null, `Invitation email successfully sent to ${email}.`));
});

export const joinProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { token } = req.body;
  const userId = req.user!.id;

  const project = await projectService.joinProjectViaToken(token, userId);
  res.status(200).json(new ApiResponse(200, project, `Successfully joined project: ${project.name}`));
});

export const removeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, memberId } = req.params;
  const actorId = req.user!.id;

  const project = await projectService.removeMember(projectId, memberId, actorId);
  res.status(200).json(new ApiResponse(200, project, 'Member removed successfully from project.'));
});

export const updateMemberRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { userId, role } = req.body;
  const actorId = req.user!.id;

  const project = await projectService.updateMemberRole(projectId, userId, role, actorId);
  res.status(200).json(new ApiResponse(200, project, 'Member role updated successfully in project.'));
});

export const updateProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const actorId = req.user!.id;

  const project = await projectService.updateProject(projectId, req.body, actorId);
  res.status(200).json(new ApiResponse(200, project, 'Project details updated successfully.'));
});

export const deleteProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const actorId = req.user!.id;

  await projectService.deleteProject(projectId, actorId);
  res.status(200).json(new ApiResponse(200, null, 'Project deleted successfully.'));
});

export const getActivityLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '20', 10);

  const { logs, total } = await projectService.getProjectActivityLog(projectId, page, limit);
  res.status(200).json(new ApiResponse(200, { logs, total, page, limit }, 'Project activities fetched successfully.'));
});
