import nodemailer from 'nodemailer';
import { env } from './env';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (env.mailUser && env.mailPass) {
      this.transporter = nodemailer.createTransport({
        host: env.mailHost,
        port: env.mailPort,
        secure: env.mailPort === 465,
        auth: {
          user: env.mailUser,
          pass: env.mailPass,
        },
      });
      console.log('[Mail] SMTP mail transport configured successfully.');
    } else {
      console.warn('[Mail] SMTP credentials missing. Utilizing console output logger fallback.');
    }
  }

  async sendMail({ to, subject, html }: MailOptions): Promise<void> {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: env.mailFrom,
          to,
          subject,
          html,
        });
        console.log(`[Mail] Email sent to ${to} successfully.`);
        return;
      } catch (error) {
        console.error('[Mail] Failed to send email via SMTP:', error);
      }
    }

    // Mock local logs fallback
    console.log(`
============================================================
[MOCK MAIL LOGGER]
From: ${env.mailFrom}
To: ${to}
Subject: ${subject}
Content:
${html.replace(/<[^>]*>/g, '')}
============================================================
    `);
  }
}

export const mailService = new MailService();
export default mailService;
