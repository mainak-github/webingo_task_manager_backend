import { Project, type IProject } from '../models/Project';
import type { Role } from '../constants/roles';

export class ProjectRepository {
  async findById(id: string, populated = true): Promise<IProject | null> {
    const query = Project.findById(id);
    if (populated) {
      query.populate('members.user', 'name email role');
    }
    return query;
  }

  async findUserProjects(userId: string): Promise<IProject[]> {
    // Highly indexed query leveraging .lean() to deliver <50ms response
    const projects = await Project.find({ 'members.user': userId })
      .populate('members.user', 'name email role')
      .sort({ updatedAt: -1 })
      .lean();
    return projects as unknown as IProject[];
  }

  async create(projectData: Partial<IProject>): Promise<IProject> {
    const project = new Project(projectData);
    return project.save();
  }

  async update(id: string, projectData: Partial<IProject>): Promise<IProject | null> {
    return Project.findByIdAndUpdate(id, { $set: projectData }, { new: true, runValidators: true });
  }

  async delete(id: string): Promise<void> {
    await Project.findByIdAndDelete(id);
  }

  async addMember(projectId: string, userId: string, role: Role): Promise<IProject | null> {
    return Project.findByIdAndUpdate(
      projectId,
      { $addToSet: { members: { user: userId, role } } },
      { new: true }
    ).populate('members.user', 'name email role');
  }

  async removeMember(projectId: string, userId: string): Promise<IProject | null> {
    return Project.findByIdAndUpdate(
      projectId,
      { $pull: { members: { user: userId } } },
      { new: true }
    ).populate('members.user', 'name email role');
  }

  async updateMemberRole(projectId: string, userId: string, role: Role): Promise<IProject | null> {
    return Project.findOneAndUpdate(
      { _id: projectId, 'members.user': userId },
      { $set: { 'members.$.role': role } },
      { new: true }
    ).populate('members.user', 'name email role');
  }

  async isUserMember(projectId: string, userId: string): Promise<boolean> {
    const count = await Project.countDocuments({ _id: projectId, 'members.user': userId });
    return count > 0;
  }

  async getUserRoleInProject(projectId: string, userId: string): Promise<Role | null> {
    // Lean projection of project members array
    const project = await Project.findOne(
      { _id: projectId, 'members.user': userId },
      { 'members.$': 1 }
    ).lean();

    if (!project || project.members.length === 0) return null;
    return project.members[0].role;
  }
}

export const projectRepository = new ProjectRepository();
export default projectRepository;
