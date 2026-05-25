import { Task, type ITask } from '../models/Task';

export interface TaskFilters {
  status?: string;
  priority?: string;
  assignee?: string;
  search?: string;
}

export interface QueryOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class TaskRepository {
  async findById(id: string): Promise<ITask | null> {
    return Task.findById(id)
      .populate('assignees', 'name email role')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('comments.author', 'name email');
  }

  async findAll(
    projectId: string,
    filters: TaskFilters,
    options: QueryOptions
  ): Promise<{ tasks: ITask[]; total: number }> {
    const query: any = { projectId };

    // Apply filtering
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.priority) {
      query.priority = filters.priority;
    }
    if (filters.assignee) {
      query.assignees = filters.assignee;
    }
    if (filters.search) {
      // Search matching title or description
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Pagination calculations
    const page = Math.max(1, options.page);
    const limit = Math.max(1, options.limit);
    const skip = (page - 1) * limit;

    // Sorting parameters
    const sortField = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
    const sortObj = { [sortField]: sortOrder };

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .populate('assignees', 'name email role')
        .sort(sortObj as any)
        .skip(skip)
        .limit(limit)
        .lean(), // Peak read performance optimization
      Task.countDocuments(query),
    ]);

    return { tasks: tasks as unknown as ITask[], total };
  }

  async create(taskData: Partial<ITask>): Promise<ITask> {
    const task = new Task(taskData);
    return task.save();
  }

  async update(id: string, taskData: Partial<ITask>): Promise<ITask | null> {
    return Task.findByIdAndUpdate(id, { $set: taskData }, { new: true, runValidators: true })
      .populate('assignees', 'name email role')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
  }

  async updateWithVersion(id: string, expectedVersion: number, taskData: Partial<ITask>): Promise<ITask | null> {
    return Task.findOneAndUpdate(
      { _id: id, __v: expectedVersion },
      { $set: taskData, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    )
      .populate('assignees', 'name email role')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
  }

  async delete(id: string): Promise<void> {
    await Task.findByIdAndDelete(id);
  }

  // BULK OPERATIONS - EXTREMELY CRITICAL
  async bulkUpdateStatus(projectId: string, taskIds: string[], status: string, userId: string): Promise<number> {
    const result = await Task.updateMany(
      { _id: { $in: taskIds }, projectId },
      { $set: { status, updatedBy: userId } }
    );
    return result.modifiedCount;
  }

  async bulkAssign(projectId: string, taskIds: string[], assigneeIds: string[], userId: string): Promise<number> {
    const result = await Task.updateMany(
      { _id: { $in: taskIds }, projectId },
      { $set: { assignees: assigneeIds, updatedBy: userId } }
    );
    return result.modifiedCount;
  }

  async bulkDelete(projectId: string, taskIds: string[]): Promise<number> {
    const result = await Task.deleteMany({ _id: { $in: taskIds }, projectId });
    return result.deletedCount;
  }

  async addAttachment(taskId: string, attachment: any): Promise<ITask | null> {
    return Task.findByIdAndUpdate(
      taskId,
      { $push: { attachments: attachment } },
      { new: true }
    ).populate('assignees', 'name email role');
  }

  async removeAttachment(taskId: string, attachmentId: string): Promise<ITask | null> {
    return Task.findByIdAndUpdate(
      taskId,
      { $pull: { attachments: { _id: attachmentId } } },
      { new: true }
    ).populate('assignees', 'name email role');
  }
}

export const taskRepository = new TaskRepository();
export default taskRepository;
