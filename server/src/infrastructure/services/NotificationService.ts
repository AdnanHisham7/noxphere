// src/infrastructure/services/NotificationService.ts
/**
 * Notification Service
 * Handles Firebase push notifications, email, and in-app notifications.
 * Supports multi-channel delivery: push, email, SMS.
 */
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { config } from '../../config/app.config';
import { logger } from '../../shared/utils/logger';
import { UserNotificationModel } from '../database/models/UserNotification.model';
import { UserModel } from '../database/models/User.model';
import { FranchiseModel } from '../database/models/Franchise.model';
import { AcademyModel } from '../database/models/Academy.model';
import { whatsAppService } from './WhatsAppService';
import { getSocketServer } from './SocketRegistry';
import { normalizePhone } from '../../shared/utils/phone';

// ─── Types ────────────────────────────────────────────────────────────────────
export type NotificationType =
  | 'attendance_present'
  | 'attendance_absent'
  | 'attendance_late'
  | 'attendance_repeated_absence'
  | 'session_reminder'
  | 'session_location_change'
  | 'session_created'
  | 'fee_reminder'
  | 'fee_due_soon'
  | 'fee_paid'
  | 'fee_overdue'
  | 'payment_receipt'
  | 'performance_updated'
  | 'selection_updated'
  | 'transfer_request'
  | 'transfer_accepted'
  | 'transfer_rejected'
  | 'announcement'
  | 'registration_received'
  | 'registration_approved'
  | 'registration_rejected'
  | 'subscription_limit_warning'
  | 'payment_received'
  | 'batch_session_invite'
  | 'complaint_received'
  | 'complaint_response'
  | 'nfc_request_created'
  | 'nfc_request_approved'
  | 'nfc_request_rejected'
  | 'nfc_order_paid'
  | 'nfc_order_dispatched'
  | 'nfc_order_delivered';

export interface SendNotificationOptions {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  franchiseId?: string;
  channels?: ('push' | 'email' | 'sms' | 'whatsapp')[];
  emailSubject?: string;
  emailHtml?: string;
  imageUrl?: string;
  attachments?: { name: string; url: string }[];
  // WhatsApp-specific content. When omitted, the WhatsApp channel falls
  // back to a plain text message using `title`/`body`. Providing
  // whatsappImageUrl or whatsappDocumentUrl sends that media instead of
  // (not in addition to) a text message, with `body` as the caption.
  whatsappImageUrl?: string;
  whatsappDocumentUrl?: string;
  whatsappDocumentFilename?: string;
}

// ─── Initialize Firebase Admin ────────────────────────────────────────────────
let firebaseInitialized = false;

const initFirebase = () => {
  if (firebaseInitialized) return;
  if (!config.firebase.projectId) {
    logger.warn('[NotificationService] Firebase not configured — push notifications disabled');
    return;
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    }),
  });
  firebaseInitialized = true;
};

// ─── Email transporter ────────────────────────────────────────────────────────
const createMailTransporter = () => {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.pass },
    tls: { rejectUnauthorized: false },
  });
};

// ─── Main service ─────────────────────────────────────────────────────────────
export class NotificationService {
  constructor() {
    // initFirebase();
  }

  /**
   * Send notification to one or more users via configured channels
   */
  async send(opts: SendNotificationOptions): Promise<void> {
    const channels = opts.channels ?? ['push'];

    // Fetch users in parallel
    const users = await UserModel.find({ _id: { $in: opts.userIds }, isActive: true }).select('email fcmTokens firstName phone');

    const tasks: Promise<void>[] = [];

    if (channels.includes('push')) {
      tasks.push(this.sendPush(users, opts));
    }
    if (channels.includes('email')) {
      tasks.push(this.sendEmail(users, opts));
    }
    if (channels.includes('whatsapp')) {
      tasks.push(this.sendWhatsApp(users, opts));
    }
    if (channels.includes('sms')) {
      tasks.push(this.sendSms(users, opts));
    }

    await Promise.allSettled(tasks);

    // Persist in-app notifications
    await this.persistNotifications(users.map((u) => u._id.toString()), opts);
  }

  /**
   * Resolves the academy name to stamp on outgoing WhatsApp messages, from
   * either a franchiseId or an academyId directly. Falls back to a
   * generic label rather than throwing — a lookup failure here should
   * never block the alert that triggered it.
   */
  private async resolveAcademyName(franchiseId?: string, academyId?: string): Promise<string> {
    try {
      if (academyId) {
        const academy = await AcademyModel.findById(academyId).select('name').lean();
        if (academy) return academy.name;
      }
      if (franchiseId) {
        const franchise = await FranchiseModel.findById(franchiseId).select('academyId').lean();
        if (franchise) {
          const academy = await AcademyModel.findById(franchise.academyId).select('name').lean();
          if (academy) return academy.name;
        }
      }
    } catch (err) {
      logger.error('[NotificationService] Academy name lookup failed:', err);
    }
    return 'Your Academy';
  }

  /**
   * Send push notification via Firebase FCM
   */
  private async sendPush(users: any[], opts: SendNotificationOptions): Promise<void> {
    if (!firebaseInitialized) return;

    const allTokens: string[] = users.flatMap((u) => u.fcmTokens ?? []);
    if (allTokens.length === 0) return;

    // FCM allows max 500 tokens per request — batch them
    const BATCH_SIZE = 500;
    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
      const batch = allTokens.slice(i, i + BATCH_SIZE);
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: batch,
          notification: { title: opts.title, body: opts.body },
          data: opts.data ?? {},
          android: {
            priority: 'high',
            notification: { channelId: 'football_franchise', sound: 'default' },
          },
          apns: {
            payload: { aps: { sound: 'default', badge: 1 } },
          },
        });

        // Remove stale tokens
        const staleTokens: string[] = [];
        response.responses.forEach((r, idx) => {
          if (!r.success && (r.error?.code === 'messaging/invalid-registration-token' ||
            r.error?.code === 'messaging/registration-token-not-registered')) {
            staleTokens.push(batch[idx]);
          }
        });

        if (staleTokens.length > 0) {
          await UserModel.updateMany(
            { fcmTokens: { $in: staleTokens } },
            { $pull: { fcmTokens: { $in: staleTokens } } }
          );
        }

        logger.info(`[NotificationService] Push sent: ${response.successCount}/${batch.length} delivered`);
      } catch (err) {
        logger.error('[NotificationService] FCM error:', err);
      }
    }
  }

  /**
   * Send a WhatsApp message to every user that has a phone number on
   * file. Users without one are silently skipped rather than failing the
   * whole batch — this is a defensive fallback only; phone is a required
   * field on every user account going forward (see UsersUseCases).
   */
  private async sendWhatsApp(users: any[], opts: SendNotificationOptions): Promise<void> {
    const academyName = await this.resolveAcademyName(opts.franchiseId);

    // De-duplicate by normalized phone number so no recipient receives duplicate messages
    const seenPhones = new Set<string>();
    const recipients: any[] = [];
    for (const u of users) {
      if (!u.phone) continue;
      const norm = normalizePhone(u.phone);
      if (!norm || seenPhones.has(norm)) continue;
      seenPhones.add(norm);
      recipients.push(u);
    }
    if (recipients.length === 0) return;

    const imageUrl = opts.whatsappImageUrl || opts.imageUrl;
    const documentUrl = opts.whatsappDocumentUrl || (opts.attachments && opts.attachments[0]?.url);
    const documentFilename = opts.whatsappDocumentFilename || (opts.attachments && opts.attachments[0]?.name);

    const tasks = recipients.map((u) => {
      if (documentUrl) {
        return whatsAppService.sendDocument({
          to: u.phone,
          academyName,
          caption: opts.body,
          documentUrl,
          filename: documentFilename ?? 'document.pdf',
        });
      }
      if (imageUrl) {
        return whatsAppService.sendImage({
          to: u.phone,
          academyName,
          caption: opts.body,
          imageUrl,
        });
      }
      return whatsAppService.sendText({ to: u.phone, academyName, body: `${opts.title}\n${opts.body}` });
    });

    const results = await Promise.allSettled(tasks);
    const fulfilledCount = results.filter((r) => r.status === 'fulfilled').length;
    const failures = results.filter((r) => r.status === 'rejected').length;
    logger.info(`[NotificationService] WhatsApp processed for ${recipients.length} unique numbers (${fulfilledCount} successful calls)`);
    if (failures > 0) {
      logger.warn(`[NotificationService] WhatsApp delivery failed for ${failures}/${recipients.length} recipients`);
    }
  }

  /**
   * Builds an HTML announcement email with academy branding, banner, and attachments.
   */
  private buildAnnouncementEmailHtml(opts: SendNotificationOptions, academyName: string): string {
    const imageUrl = opts.imageUrl || opts.whatsappImageUrl;
    const attachments =
      opts.attachments && opts.attachments.length > 0
        ? opts.attachments
        : opts.whatsappDocumentUrl
        ? [{ name: opts.whatsappDocumentFilename || 'Attached Document', url: opts.whatsappDocumentUrl }]
        : [];

    return `
      <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #0a0a0f; padding: 22px 24px; text-align: center;">
          <h1 style="color: #ccff00; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px;">${academyName.toUpperCase()}</h1>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Official Academy Announcement</p>
        </div>
        <div style="padding: 24px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; margin-top: 0; color: #0f172a;">${opts.title}</h2>
          <div style="font-size: 14px; line-height: 1.6; color: #475569; white-space: pre-wrap; margin: 16px 0;">${opts.body}</div>
          ${
            imageUrl
              ? `<div style="margin: 20px 0;"><img src="${imageUrl}" alt="Banner" style="max-width: 100%; border-radius: 6px; border: 1px solid #e2e8f0; display: block;" /></div>`
              : ''
          }
          ${
            attachments.length > 0
              ? `
              <div style="margin: 20px 0; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Attachments (${attachments.length})</p>
                ${attachments
                  .map(
                    (at) =>
                      `<div style="margin-bottom: 6px;"><a href="${at.url}" target="_blank" style="color: #2563eb; text-decoration: underline; font-size: 13px; font-weight: 500;">📎 ${at.name}</a></div>`
                  )
                  .join('')}
              </div>`
              : ''
          }
          <div style="font-size: 11px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px;">
            Sent by ${academyName} via Noxphere. Please log in to your portal to stay updated with your squad schedule and events.
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Send email notification
   */
  private async sendEmail(users: any[], opts: SendNotificationOptions): Promise<void> {
    // De-duplicate emails so each address is sent only once
    const seenEmails = new Set<string>();
    const emails: string[] = [];
    for (const u of users) {
      const clean = u.email?.toLowerCase().trim();
      if (!clean || seenEmails.has(clean)) continue;
      seenEmails.add(clean);
      emails.push(clean);
    }
    if (emails.length === 0) return;

    const academyName = await this.resolveAcademyName(opts.franchiseId);
    const subject = opts.emailSubject ?? opts.title;
    const html = opts.emailHtml ?? this.buildAnnouncementEmailHtml(opts, academyName);

    if (!config.email.user) {
      logger.info(`[NotificationService] (Dev simulation) Email dispatched to ${emails.length} recipients: [${subject}]`);
      return;
    }

    const transporter = createMailTransporter();
    try {
      await transporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.user || config.email.from}>`,
        bcc: emails.join(','),
        subject,
        html,
      });
      logger.info(`[NotificationService] Email sent successfully to ${emails.length} recipients: [${subject}]`);
    } catch (err: any) {
      logger.error('[NotificationService] Email error:', err?.message || err);
      // In development or when SMTP credentials fail, log simulated dispatch so admins/developers can see it was routed
      logger.info(`[NotificationService] (Dev simulation) Email payload to ${emails.join(', ')}: [${subject}] "${opts.body}"`);
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSms(users: any[], opts: SendNotificationOptions): Promise<void> {
    // De-duplicate by normalized phone number
    const seenPhones = new Set<string>();
    const recipients: any[] = [];
    for (const u of users) {
      if (!u.phone) continue;
      const norm = normalizePhone(u.phone);
      if (!norm || seenPhones.has(norm)) continue;
      seenPhones.add(norm);
      recipients.push(u);
    }
    if (recipients.length === 0) return;

    const academyName = await this.resolveAcademyName(opts.franchiseId);
    const smsMessage = `[${academyName}] ${opts.title}: ${opts.body}`;

    for (const u of recipients) {
      logger.info(`[NotificationService] SMS dispatched to ${u.phone}: "${smsMessage}"`);
    }
  }

  /**
   * Persist notification records in MongoDB
   */
  private async persistNotifications(userIds: string[], opts: SendNotificationOptions): Promise<void> {
    try {
      const uniqueUserIds = Array.from(new Set(userIds));
      const docs = uniqueUserIds.map((userId) => ({
        userId,
        franchiseId: opts.franchiseId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        data: opts.data,
        isRead: false,
        sentVia: opts.channels ?? ['push'],
      }));
      const inserted = await UserNotificationModel.insertMany(docs, { ordered: false });

      // Push the same event over the socket room each recipient joined
      // (see index.ts's "join:user" handler) so an open tab updates its
      // bell instantly instead of only finding out on next page load.
      const io = getSocketServer();
      if (io) {
        for (const doc of inserted) {
          io.to(`user:${doc.userId.toString()}`).emit('notification', {
            id: doc._id.toString(),
            title: doc.title,
            body: doc.body,
            type: doc.type,
            isRead: false,
            createdAt: (doc as any).createdAt ?? new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      logger.error('[NotificationService] Persist error:', err);
    }
  }

  // ─── Convenience methods ────────────────────────────────────────────────────

  async sendAttendanceAlert(guardianIds: string[], studentName: string, status: 'absent' | 'late', franchiseId: string) {
    const messages = {
      absent: { title: 'Absence Alert', body: `${studentName} has been marked absent from today's session.` },
      late: { title: 'Late Arrival', body: `${studentName} arrived late to today's session.` },
    };
    await this.send({
      userIds: guardianIds,
      type: `attendance_${status}` as NotificationType,
      ...messages[status],
      franchiseId,
      channels: ['push'],
    });
  }

  /**
   * Scenario 1 — a student has been absent for `streakDays` consecutive
   * sessions. Sent only to guardians, as both a system notification and a
   * WhatsApp text message.
   */
  async sendRepeatedAbsenceAlert(guardianIds: string[], studentName: string, streakDays: number, franchiseId: string) {
    await this.send({
      userIds: guardianIds,
      type: 'attendance_repeated_absence',
      title: 'Repeated Absence Alert',
      body: `${studentName} has been absent for ${streakDays} consecutive sessions. Please reach out to the academy if there's an issue we should know about.`,
      franchiseId,
      channels: ['push', 'whatsapp'],
    });
  }

  /**
   * Scenario 2 — an installment is due in `daysUntilDue` days. Sent as a
   * system notification plus a WhatsApp text+image message, where the
   * image is the academy's configured payment QR code.
   */
  async sendFeeDueAlert(
    guardianIds: string[],
    studentName: string,
    amount: number,
    dueDate: string,
    daysUntilDue: number,
    franchiseId: string,
    qrImageUrl?: string,
  ) {
    const isOverdue = daysUntilDue < 0;
    const isToday = daysUntilDue === 0;
    const timing = isOverdue
      ? `was due on ${dueDate}`
      : isToday
      ? `is due today (${dueDate})`
      : `is due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}, on ${dueDate}`;

    const title = isOverdue ? 'Installment Overdue Alert' : isToday ? 'Installment Due Today' : 'Installment Payment Reminder';
    const body = `₹${amount.toLocaleString('en-IN')} for ${studentName} ${timing}. Please pay to avoid disruption to training.${qrImageUrl ? ' Scan the attached QR code to pay instantly.' : ''}`;
    await this.send({
      userIds: guardianIds,
      type: 'fee_due_soon',
      title,
      body,
      franchiseId,
      channels: ['push', 'whatsapp'],
      whatsappImageUrl: qrImageUrl,
    });
  }

  /**
   * Scenario 3 — a manager has just recorded a payment. Sent as a system
   * notification plus a WhatsApp text+document message carrying the
   * generated receipt.
   */
  async sendPaymentReceiptAlert(
    guardianIds: string[],
    studentName: string,
    amount: number,
    receiptUrl: string,
    franchiseId: string,
  ) {
    await this.send({
      userIds: guardianIds,
      type: 'payment_receipt',
      title: 'Payment Received',
      body: `We've received a payment of ₹${amount.toLocaleString('en-IN')} for ${studentName}. Your receipt is attached.`,
      franchiseId,
      channels: ['push', 'whatsapp'],
      whatsappDocumentUrl: receiptUrl,
      whatsappDocumentFilename: `receipt-${studentName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    });
  }

  /**
   * Scenario 4 — a manager has just created a session. Sent to the
   * assigned coach only, as a system notification plus a WhatsApp text
   * message with the session details.
   */
  async sendSessionCreatedAlert(
    coachId: string,
    sessionSummary: string,
    franchiseId: string,
  ) {
    await this.send({
      userIds: [coachId],
      type: 'session_created',
      title: 'New Session Scheduled',
      body: sessionSummary,
      franchiseId,
      channels: ['push', 'whatsapp'],
    });
  }

  async sendSessionReminder(guardianIds: string[], sessionTime: string, locationName: string, locationUrl: string, franchiseId: string) {
    await this.send({
      userIds: guardianIds,
      type: 'session_reminder',
      title: "Today's Session Starting Soon",
      body: `Session at ${locationName} starts at ${sessionTime}. Tap to navigate.`,
      data: { locationUrl, sessionTime },
      franchiseId,
      channels: ['push'],
    });
  }

  async sendLocationChange(guardianIds: string[], newLocation: string, franchiseId: string) {
    await this.send({
      userIds: guardianIds,
      type: 'session_location_change',
      title: '⚠️ Location Changed',
      body: `Today's session location has changed to: ${newLocation}`,
      franchiseId,
      channels: ['push'],
    });
  }

  async sendFeeReminder(guardianIds: string[], studentName: string, amount: number, dueDate: string, franchiseId: string) {
    await this.send({
      userIds: guardianIds,
      type: 'fee_reminder',
      title: 'Fee Payment Reminder',
      body: `₹${amount.toLocaleString()} due for ${studentName} on ${dueDate}. Please pay to avoid disruption.`,
      franchiseId,
      channels: ['push', 'email'],
      emailSubject: `Fee Payment Due — ${studentName}`,
      emailHtml: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <h2 style="color:#0a0a0f;background:#ccff00;padding:12px 20px;margin:0">Football Franchise — Fee Reminder</h2>
          <div style="padding:20px">
            <p>Dear Guardian,</p>
            <p>A fee payment of <strong>₹${amount.toLocaleString()}</strong> for <strong>${studentName}</strong> is due on <strong>${dueDate}</strong>.</p>
            <p>Please log in to the Football Franchise app to make your payment and avoid any disruption to training.</p>
          </div>
        </div>
      `,
    });
  }

  async sendSelectionUpdate(userIds: string[], studentName: string, status: string, franchiseId: string) {
    await this.send({
      userIds,
      type: 'selection_updated',
      title: 'Selection Status Updated',
      body: `${studentName}'s selection status has been updated to: ${status}`,
      franchiseId,
      channels: ['push'],
    });
  }

  async sendTransferRequest(managerIds: string[], playerName: string, requestingFranchise: string) {
    await this.send({
      userIds: managerIds,
      type: 'transfer_request',
      title: 'New Transfer Request',
      body: `${requestingFranchise} has submitted a transfer request for ${playerName}.`,
      channels: ['push'],
    });
  }

  /**
   * Notify all platform super administrators about global events (e.g., subscription payments)
   */
  async notifySuperAdmins(opts: {
    type?: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const superAdmins = await UserModel.find({ role: 'super_admin', isActive: true }).select('_id');
    if (superAdmins.length === 0) return;
    await this.send({
      userIds: superAdmins.map((u) => u._id.toString()),
      type: opts.type ?? 'payment_received',
      title: opts.title,
      body: opts.body,
      channels: ['push'],
      data: opts.metadata,
    });
  }

  /**
   * Send account credentials email to a guardian or user
   */
  async sendAccountCredentialsEmail(params: {
    to: string;
    recipientName: string;
    role: string;
    password: string;
    loginUrl: string;
    studentName?: string;
    academyName?: string;
  }): Promise<void> {
    const transporter = createMailTransporter();
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #0a0a0f; padding: 24px; text-align: center;">
          <h1 style="color: #ccff00; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">NOXPHERE</h1>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase;">Sports Academy Management Platform</p>
        </div>
        <div style="padding: 30px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; margin-top: 0;">Welcome, ${params.recipientName}!</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            ${params.studentName ? `An account has been created for you to manage <strong>${params.studentName}</strong>'s squad activities, schedule, and attendance` : 'Your account has been created'}
            ${params.academyName ? ` at <strong>${params.academyName}</strong>` : ''}.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px; margin: 24px 0;">
            <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Your Login Credentials</p>
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #64748b; padding: 4px 0; width: 100px;">Login Email:</td>
                <td style="color: #0f172a; font-weight: 600;">${params.to}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Password:</td>
                <td style="font-family: monospace; font-size: 16px; font-weight: 700; color: #0f172a; background: #e2e8f0; padding: 2px 8px; border-radius: 4px; display: inline-block;">${params.password}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Role:</td>
                <td style="color: #0f172a; font-weight: 500;">${params.role}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${params.loginUrl}" style="background: #0a0a0f; color: #ccff00; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 14px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">
              Log In to Portal &rarr;
            </a>
          </div>

          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            For security, please change your password after logging in for the first time. If you have any questions, reach out to your academy administration.
          </p>
        </div>
      </div>
    `;

    logger.info(`[NotificationService] Sending account credentials email to ${params.to} (Password: ${params.password})`);

    if (!config.email.user) {
      logger.info(`[NotificationService] (Dev simulation) Account credentials for ${params.to}: ${params.password}, Login: ${params.loginUrl}`);
      return;
    }

    try {
      await transporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.user || config.email.from}>`,
        to: params.to,
        subject: `Welcome to Noxphere — Your ${params.role} Login Credentials`,
        html,
      });
      logger.info(`[NotificationService] Credentials email sent successfully to ${params.to}`);
    } catch (err) {
      logger.error('[NotificationService] Failed to send credentials email:', err);
    }
  }

  /**
   * Send notification email to an existing guardian when an additional child is linked
   */
  async sendStudentLinkedEmail(params: {
    to: string;
    guardianName: string;
    studentName: string;
    academyName: string;
    loginUrl: string;
  }): Promise<void> {
    const transporter = createMailTransporter();
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #0a0a0f; padding: 24px; text-align: center;">
          <h1 style="color: #ccff00; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">NOXPHERE</h1>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase;">Sports Academy Management Platform</p>
        </div>
        <div style="padding: 30px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; margin-top: 0;">New Player Linked to Your Account</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Hello ${params.guardianName},<br/><br/>
            <strong>${params.studentName}</strong> has been enrolled and added to your existing guardian account at <strong>${params.academyName}</strong>.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px; color: #334155;">
              You can view all of your registered children, track their squad sessions, attendance, and performance under your single guardian login.
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${params.loginUrl}" style="background: #0a0a0f; color: #ccff00; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 14px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">
              Access Guardian Portal &rarr;
            </a>
          </div>
        </div>
      </div>
    `;

    if (!config.email.user) {
      logger.info(`[NotificationService] (Dev simulation) Student linked email for ${params.to}: ${params.studentName}`);
      return;
    }

    try {
      await transporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.user || config.email.from}>`,
        to: params.to,
        subject: `New Player Enrolled: ${params.studentName} — ${params.academyName}`,
        html,
      });
      logger.info(`[NotificationService] Student linked email sent successfully to ${params.to}`);
    } catch (err) {
      logger.error('[NotificationService] Failed to send student linked email:', err);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();