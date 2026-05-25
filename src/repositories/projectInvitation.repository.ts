import { ProjectInvitation, type IProjectInvitation } from '../models/ProjectInvitation';

export class ProjectInvitationRepository {
  async findPendingByEmail(email: string): Promise<IProjectInvitation[]> {
    return ProjectInvitation.find({ email: email.toLowerCase(), status: 'pending' });
  }

  async findPendingByEmailAndProject(email: string, projectId: string): Promise<IProjectInvitation | null> {
    return ProjectInvitation.findOne({ email: email.toLowerCase(), projectId, status: 'pending' });
  }

  async create(invitationData: Partial<IProjectInvitation>): Promise<IProjectInvitation> {
    const invitation = new ProjectInvitation(invitationData);
    return invitation.save();
  }

  async updateStatus(id: string, status: 'accepted' | 'declined'): Promise<IProjectInvitation | null> {
    return ProjectInvitation.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  }

  async deletePendingByEmailAndProject(email: string, projectId: string): Promise<void> {
    await ProjectInvitation.deleteMany({ email: email.toLowerCase(), projectId, status: 'pending' });
  }
}

export const projectInvitationRepository = new ProjectInvitationRepository();
export default projectInvitationRepository;
