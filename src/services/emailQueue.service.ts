import { mailService } from '../config/mail';
import { MailJob } from '../models/MailJob';

class EmailQueueService {
  private activeWorkers = 0;
  private maxWorkers = 2; // Process up to 2 emails concurrently

  constructor() {
    // Start background processing check every 15 seconds to pick up any missed or retried jobs
    setInterval(() => {
      this.processQueue();
    }, 15000);
  }

  // Push email job to durable database queue
  async queueMail(to: string, subject: string, html: string): Promise<void> {
    try {
      await MailJob.create({ to, subject, html });
      // Trigger process queue step immediately in the background without blocking
      this.processQueue();
    } catch (err: any) {
      console.error('[Email Queue] Error queueing mail:', err.message);
      // Fallback: send synchronously to prevent losing notifications
      mailService.sendMail({ to, subject, html }).catch(() => {});
    }
  }

  // Active queue worker loop
  async processQueue(): Promise<void> {
    if (this.activeWorkers >= this.maxWorkers) return;

    this.activeWorkers++;

    try {
      // Atomic find and lock to prevent multiple cluster node race conditions
      const job = await MailJob.findOneAndUpdate(
        { status: { $in: ['pending', 'failed'] }, attempts: { $lt: 3 } },
        { $set: { status: 'processing' } },
        { new: true, sort: { createdAt: 1 } }
      );

      if (!job) {
        this.activeWorkers--;
        return;
      }

      try {
        console.log(`[Email Queue] Processing job ${job._id} to ${job.to} (Attempt ${job.attempts + 1})...`);
        await mailService.sendMail({ to: job.to, subject: job.subject, html: job.html });
        
        job.status = 'completed';
        await job.save();
        console.log(`[Email Queue] Job ${job._id} finished successfully.`);
      } catch (err: any) {
        job.status = 'failed';
        job.attempts += 1;
        job.error = err.message;
        await job.save();
        console.error(`[Email Queue] Job ${job._id} attempt failed:`, err.message);
      }

      this.activeWorkers--;
      // Tail call to check and process the next available job
      this.processQueue();
    } catch (err: any) {
      this.activeWorkers--;
      console.error('[Email Queue] General processing error:', err.message);
    }
  }
}

export const emailQueueService = new EmailQueueService();
export default emailQueueService;
