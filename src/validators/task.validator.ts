import { z } from 'zod';
import { TASK_STATUS_VALUES } from '../constants/taskStatus';

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Task title is required').max(150),
    description: z.string().max(2000).optional(),
    status: z.enum(TASK_STATUS_VALUES as [string, ...string[]]).optional().default('todo'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
    assignees: z.array(z.string()).optional().default([]),
    dueDate: z.string().datetime({ precision: 3 }).or(z.string().date()).optional().nullable(),
    isMarketplaceIntegrated: z.boolean().optional(),
    marketplaceType: z.enum(['none', 'stripe', 'shopify', 'amazon', 'custom']).optional(),
    integrationDetails: z.string().max(1000).optional(),
  }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Task title is required').max(150).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(TASK_STATUS_VALUES as [string, ...string[]]).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    assignees: z.array(z.string()).optional(),
    dueDate: z.string().datetime({ precision: 3 }).or(z.string().date()).optional().nullable(),
    isMarketplaceIntegrated: z.boolean().optional(),
    marketplaceType: z.enum(['none', 'stripe', 'shopify', 'amazon', 'custom']).optional(),
    integrationDetails: z.string().max(1000).optional(),
    progress: z.number().min(0).max(100).optional(),
    timeSpent: z.number().optional(),
    timerStartedAt: z.string().datetime().or(z.string()).optional().nullable(),
    version: z.number().int().min(0).optional(),
  }),
});


export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    taskIds: z.array(z.string()).min(1, 'Task IDs array cannot be empty'),
    status: z.enum(TASK_STATUS_VALUES as [string, ...string[]]),
  }),
});

export const bulkAssignSchema = z.object({
  body: z.object({
    taskIds: z.array(z.string()).min(1, 'Task IDs array cannot be empty'),
    assigneeIds: z.array(z.string()),
  }),
});

export const bulkDeleteSchema = z.object({
  body: z.object({
    taskIds: z.array(z.string()).min(1, 'Task IDs array cannot be empty'),
  }),
});
