interface MasterTemplateOptions {
  title: string;
  accentColor: string;
  headline: string;
  bodyHtml: string;
}

function buildMasterTemplate({ title, accentColor, headline, bodyHtml }: MasterTemplateOptions): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    .wrapper {
      background-color: #f8fafc;
      width: 100%;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }
    .header {
      padding: 32px 32px 20px;
      border-bottom: 1px solid #f1f5f9;
    }
    .logo {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-decoration: none;
    }
    .accent-bar {
      height: 4px;
      background-color: ${accentColor};
    }
    .content {
      padding: 32px;
    }
    .headline {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    .body-text {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin: 0;
    }
    .btn-container {
      margin: 28px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      background-color: ${accentColor};
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 6px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.08);
    }
    .otp-card {
      background-color: #f1f5f9;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      margin: 28px 0;
      border: 1px solid #e2e8f0;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #0f172a;
      margin: 0;
    }
    .footer {
      padding: 24px 32px 32px;
      background-color: #f8fafc;
      border-top: 1px solid #f1f5f9;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .footer a {
      color: #64748b;
      text-decoration: underline;
    }
    .highlight {
      font-weight: 600;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="accent-bar"></div>
      <div class="header">
        <span class="logo">
          <span style="color: #2563eb;">Web</span>Bingo
        </span>
      </div>
      <div class="content">
        <h1 class="headline">${headline}</h1>
        <div class="body-text">
          ${bodyHtml}
        </div>
      </div>
      <div class="footer">
        <p>This is an automated notification from your <strong>WebBingo Task Workspace</strong>.</p>
        <p>&copy; 2026 WebBingo, Inc. All rights reserved.</p>
        <p>Questions? Reach out to <a href="mailto:support@webbingo.com">support@webbingo.com</a>.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildVerificationOtpEmail(name: string, otpCode: string): string {
  const accentColor = '#2563eb'; // MIUI Blue
  const headline = 'Verify your email address';
  const bodyHtml = `
    <p>Hi <span class="highlight">${name}</span>,</p>
    <p>Thank you for signing up on WebBingo Task Manager. To complete your registration and secure your new real-time collaborative workspace, please enter the following 6-digit verification code:</p>
    
    <div class="otp-card">
      <h2 class="otp-code">${otpCode}</h2>
    </div>
    
    <p>This code is highly sensitive and will expire in <span class="highlight">10 minutes</span>. Please do not share this code with anyone.</p>
    <p>If you didn't request this email, you can safely ignore it.</p>
  `;
  return buildMasterTemplate({
    title: 'Verify Your Email Address - WebBingo',
    accentColor,
    headline,
    bodyHtml,
  });
}

export function build2faOtpEmail(name: string, otpCode: string): string {
  const accentColor = '#0d9488'; // MIUI Teal
  const headline = 'Two-Factor Authentication';
  const bodyHtml = `
    <p>Hi <span class="highlight">${name}</span>,</p>
    <p>A login request to your WebBingo account requires verification. Please use the following 6-digit 2FA verification code to sign in:</p>
    
    <div class="otp-card">
      <h2 class="otp-code">${otpCode}</h2>
    </div>
    
    <p>This code is highly sensitive and will expire in <span class="highlight">10 minutes</span>. If you didn't attempt to log in to your account just now, please change your password immediately as someone may have gained access to your credentials.</p>
  `;
  return buildMasterTemplate({
    title: 'Two-Factor Authentication Code - WebBingo',
    accentColor,
    headline,
    bodyHtml,
  });
}

export function buildPasswordResetEmail(name: string, resetLink: string): string {
  const accentColor = '#f59e0b'; // MIUI Amber
  const headline = 'Reset your password';
  const bodyHtml = `
    <p>Hi <span class="highlight">${name}</span>,</p>
    <p>We received a request to reset your password for your WebBingo account. Click the button below to choose a new password:</p>
    
    <div class="btn-container">
      <a href="${resetLink}" class="btn" target="_blank">Reset Password</a>
    </div>
    
    <p>This link will remain active for <span class="highlight">1 hour</span>. If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
    
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #94a3b8;">
      <p>If the button above does not work, copy and paste the following URL into your web browser:</p>
      <p style="word-break: break-all;"><a href="${resetLink}" style="color: #2563eb;">${resetLink}</a></p>
    </div>
  `;
  return buildMasterTemplate({
    title: 'Password Reset Request - WebBingo',
    accentColor,
    headline,
    bodyHtml,
  });
}

export function buildProjectInvitationEmail(
  projectName: string,
  role: string,
  invitationLink: string,
  inviterName: string
): string {
  const accentColor = '#6366f1'; // Indigo Accent
  const headline = 'You have been invited!';
  const bodyHtml = `
    <p>Hi there,</p>
    <p><span class="highlight">${inviterName}</span> has invited you to join the collaborative workspace project <span class="highlight">"${projectName}"</span> as a <span class="highlight">${role}</span>.</p>
    
    <p>Collaborate in real-time, log hours, track checklists, and coordinate board cards with the rest of the team.</p>
    
    <div class="btn-container">
      <a href="${invitationLink}" class="btn" target="_blank">Accept Invitation</a>
    </div>
    
    <p>This invitation will expire in <span class="highlight">24 hours</span>. Please sign in or create an account with the email address that received this invitation to gain access.</p>
    
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #94a3b8;">
      <p>If the button above does not work, copy and paste the following URL into your web browser:</p>
      <p style="word-break: break-all;"><a href="${invitationLink}" style="color: #2563eb;">${invitationLink}</a></p>
    </div>
  `;
  return buildMasterTemplate({
    title: `Join Project "${projectName}" on WebBingo`,
    accentColor,
    headline,
    bodyHtml,
  });
}

export function buildTaskUpdatedEmail(
  name: string,
  taskTitle: string,
  updaterName: string,
  changesHtml: string,
  taskUrl: string
): string {
  const accentColor = '#2563eb'; // MIUI Blue
  const headline = 'Task Card Updated';
  const bodyHtml = `
    <p>Hi <span class="highlight">${name}</span>,</p>
    <p>A task card you are collaborating on, <span class="highlight">"${taskTitle}"</span>, has been updated by <span class="highlight">${updaterName}</span>:</p>
    
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; margin: 20px 0;">
      <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 14px; font-weight: 700;">Summary of Updates</h4>
      <div style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0;">
        ${changesHtml}
      </div>
    </div>
    
    <div class="btn-container">
      <a href="${taskUrl}" class="btn" target="_blank">View Task Board</a>
    </div>
    
    <p>Thank you for coordinating with the team on your WebBingo workspace!</p>
  `;
  return buildMasterTemplate({
    title: `Task "${taskTitle}" Updated on WebBingo`,
    accentColor,
    headline,
    bodyHtml,
  });
}

export function buildNewCommentEmail(
  name: string,
  taskTitle: string,
  commentAuthor: string,
  commentText: string,
  taskUrl: string
): string {
  const accentColor = '#0d9488'; // MIUI Teal
  const headline = 'New Comment Posted';
  const bodyHtml = `
    <p>Hi <span class="highlight">${name}</span>,</p>
    <p><span class="highlight">${commentAuthor}</span> posted a new comment on task <span class="highlight">"${taskTitle}"</span>:</p>
    
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; margin: 20px 0; font-style: italic;">
      <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.6;">"${commentText}"</p>
    </div>
    
    <div class="btn-container">
      <a href="${taskUrl}" class="btn" target="_blank">Open Comments</a>
    </div>
    
    <p>Coordinating and replying keeps your task card status moving forward!</p>
  `;
  return buildMasterTemplate({
    title: `New Comment on Task "${taskTitle}" - WebBingo`,
    accentColor,
    headline,
    bodyHtml,
  });
}

export function buildNewAttachmentEmail(
  name: string,
  taskTitle: string,
  uploaderName: string,
  attachmentName: string,
  taskUrl: string
): string {
  const accentColor = '#a855f7'; // Purple Accent
  const headline = 'New File Uploaded';
  const bodyHtml = `
    <p>Hi <span class="highlight">${name}</span>,</p>
    <p><span class="highlight">${uploaderName}</span> uploaded a new file attachment <span class="highlight">"${attachmentName}"</span> to task <span class="highlight">"${taskTitle}"</span>.</p>
    
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; border: 1px dashed #e2e8f0; margin: 20px 0; text-align: center;">
      <span style="font-size: 14px; font-weight: 600; color: #6366f1;">
        📎 ${attachmentName}
      </span>
    </div>
    
    <div class="btn-container">
      <a href="${taskUrl}" class="btn" target="_blank">View Attachment</a>
    </div>
    
    <p>Please review the uploaded resources at your earliest convenience.</p>
  `;
  return buildMasterTemplate({
    title: `New Attachment on "${taskTitle}" - WebBingo`,
    accentColor,
    headline,
    bodyHtml,
  });
}

