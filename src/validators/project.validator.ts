import { z } from 'zod';
import { ROLE_VALUES } from '../constants/roles';

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Project name is required').max(100),
    description: z.string().max(500).optional(),
    category: z.string().max(50).optional(),
    deadline: z.string().datetime().or(z.string().date()).optional().nullable(),
    budget: z.number().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
});

export const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Project name is required').max(100).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(['active', 'archived']).optional(),
    category: z.string().max(50).optional(),
    deadline: z.string().datetime().or(z.string().date()).optional().nullable(),
    budget: z.number().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
});


export const inviteMemberSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email format'),
    role: z.enum(ROLE_VALUES as [string, ...string[]]).optional().default('member'),
  }),
});

export const updateMemberRoleSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    role: z.enum(ROLE_VALUES as [string, ...string[]]),
  }),
});
