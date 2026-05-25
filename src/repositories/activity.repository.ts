import { ActivityLog, type IActivityLog } from '../models/ActivityLog';

export class ActivityRepository {
  async log(projectId: string, userId: string, action: string, details: string): Promise<IActivityLog> {
    const logEntry = new ActivityLog({
      projectId,
      userId,
      action,
      details,
    });
    return logEntry.save();
  }

  async findProjectActivities(
    projectId: string,
    page = 1,
    limit = 20
  ): Promise<{ logs: IActivityLog[]; total: number }> {
    const skip = (Math.max(1, page) - 1) * limit;

    const [logs, total] = await Promise.all([
      ActivityLog.find({ projectId })
        .populate('userId', 'name email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments({ projectId }),
    ]);

    return { logs: logs as unknown as IActivityLog[], total };
  }
}

export const activityRepository = new ActivityRepository();
export default activityRepository;
