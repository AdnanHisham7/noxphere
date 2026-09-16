// src/infrastructure/services/SchedulerService.ts
/**
 * Scheduler Service
 * Handles timed jobs:
 * - Pre-session location & time alerts to guardians
 * - Post-session pickup alerts
 * - Fee overdue reminders (3-day, same-day, post-due)
 * Uses Bull queue backed by Redis for reliability.
 */
import Queue from 'bull';
import { config } from '../../config/app.config';
import { logger } from '../../shared/utils/logger';
import { notificationService } from './NotificationService';
import { FranchiseModel } from '../database/models/Franchise.model';
import { AcademyModel } from '../database/models/Academy.model';
import { StudentModel } from '../database/models/Student.model';
import { FeeModel } from '../database/models/Fee.model';
import { UserModel } from '../database/models/User.model';

// ─── Queues ───────────────────────────────────────────────────────────────────
const sessionReminderQueue = new Queue('session-reminders', config.redis.url);
const feeReminderQueue = new Queue('fee-reminders', config.redis.url);

// ─── Session Reminder Processor ───────────────────────────────────────────────
sessionReminderQueue.process(async (job) => {
  const { franchiseId, type } = job.data; // type: 'pre' | 'post'

  try {
    const franchise = await FranchiseModel.findById(franchiseId);
    if (!franchise || !franchise.isActive) return;

    // Get all guardians for this franchise
    const students = await StudentModel.find({ franchiseId, isActive: true }).select('guardianIds');
    const allGuardianIds = [...new Set(students.flatMap((s) => s.guardianIds.map((id) => id.toString())))];
    if (allGuardianIds.length === 0) return;

    if (type === 'pre') {
      const sessionTimes = franchise.sessionTimes;
      const today = new Date().getDay();
      const todaySession = sessionTimes.find((s) => s.dayOfWeek === today);
      if (!todaySession) return;

      const locationUrl = `https://maps.google.com/?q=${franchise.location.latitude},${franchise.location.longitude}`;
      await notificationService.sendSessionReminder(
        allGuardianIds,
        todaySession.startTime,
        franchise.location.name,
        locationUrl,
        franchiseId
      );
      logger.info(`[Scheduler] Pre-session alert sent to ${allGuardianIds.length} guardians for franchise ${franchiseId}`);
    } else if (type === 'post') {
      await notificationService.send({
        userIds: allGuardianIds,
        type: 'session_reminder',
        title: 'Session Ending Soon',
        body: `Training at ${franchise.location.name} is ending. Please head to the pickup point.`,
        franchiseId,
        channels: ['push'],
      });
      logger.info(`[Scheduler] Post-session alert sent to ${allGuardianIds.length} guardians for franchise ${franchiseId}`);
    }
  } catch (err) {
    logger.error('[Scheduler] Session reminder error:', err);
    throw err; // Bull will retry
  }
});

// ─── Fee Reminder Processor ───────────────────────────────────────────────────
// Scenario: before `academy.dueDateAlertDays` days of an installment's due
// date, alert the guardian — both a system notification and a WhatsApp
// text+image message, where the image is the academy's configured
// payment QR code.
feeReminderQueue.process(async (job) => {
  const { feeId, installmentNumber } = job.data;

  try {
    const fee = await FeeModel.findById(feeId).populate('studentId');
    if (!fee) return;

    const student = fee.studentId as any;
    if (!student || !student.guardianIds || student.guardianIds.length === 0) return;

    const guardians = await UserModel.find({ _id: { $in: student.guardianIds } }).select('_id');
    const guardianIds = guardians.map((g) => g._id.toString());
    if (guardianIds.length === 0) return;

    const installment = fee.installments.find((inst) => inst.installmentNumber === installmentNumber);
    if (!installment || installment.status === 'paid' || installment.status === 'refunded') return;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    // Prevent duplicate alerts if an alert was already sent today for this installment
    if (installment.lastReminderAt && new Date(installment.lastReminderAt) >= todayStart) {
      return;
    }

    const franchise = await FranchiseModel.findById(fee.franchiseId).select('academyId').lean();
    const academy = franchise ? await AcademyModel.findById(franchise.academyId).select('dueDateAlertDays feeQrImageUrl').lean() : null;

    const instDueDate = new Date(installment.dueDate);
    const daysUntilDue = Math.ceil((instDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    await notificationService.sendFeeDueAlert(
      guardianIds,
      `${student.firstName} ${student.lastName}`,
      installment.amount - installment.paidAmount,
      instDueDate.toLocaleDateString('en-IN'),
      daysUntilDue,
      fee.franchiseId.toString(),
      academy?.feeQrImageUrl,
    );

    installment.reminderSentCount = (installment.reminderSentCount || 0) + 1;
    installment.lastReminderAt = new Date();
    await fee.save();

    logger.info(`[Scheduler] Fee due-soon alert sent for student ${student.firstName} ${student.lastName} (Installment #${installmentNumber}, due in ${daysUntilDue} days)`);
  } catch (err) {
    logger.error('[Scheduler] Fee reminder error:', err);
    throw err;
  }
});

// ─── Scheduler API ────────────────────────────────────────────────────────────
export class SchedulerService {
  /**
   * Schedule pre-session and post-session alerts for a franchise
   * Called when a franchise session is configured or updated.
   */
  async scheduleFranchiseAlerts(franchiseId: string): Promise<void> {
    const franchise = await FranchiseModel.findById(franchiseId);
    if (!franchise || !franchise.isActive) return;

    const now = new Date();
    const today = now.getDay();

    for (const session of franchise.sessionTimes) {
      if (session.dayOfWeek !== today) continue;

      const [startHour, startMin] = session.startTime.split(':').map(Number);
      const [endHour, endMin] = session.endTime.split(':').map(Number);

      const sessionStart = new Date();
      sessionStart.setHours(startHour, startMin, 0, 0);

      const sessionEnd = new Date();
      sessionEnd.setHours(endHour, endMin, 0, 0);

      const preAlertTime = new Date(sessionStart.getTime() - franchise.alertBeforeMinutes * 60_000);
      const postAlertTime = new Date(sessionEnd.getTime() + franchise.notificationAlertAfterMinutes * 60_000);

      const preDelay = preAlertTime.getTime() - now.getTime();
      const postDelay = postAlertTime.getTime() - now.getTime();

      if (preDelay > 0) {
        await sessionReminderQueue.add({ franchiseId, type: 'pre' }, { delay: preDelay, jobId: `pre-${franchiseId}-${today}` });
        logger.info(`[Scheduler] Pre-session alert scheduled in ${Math.round(preDelay / 60_000)} minutes`);
      }

      if (postDelay > 0) {
        await sessionReminderQueue.add({ franchiseId, type: 'post' }, { delay: postDelay, jobId: `post-${franchiseId}-${today}` });
        logger.info(`[Scheduler] Post-session alert scheduled in ${Math.round(postDelay / 60_000)} minutes`);
      }
    }
  }

  /**
   * Schedule the installment-due-soon reminder for a specific fee
   * installment, timed `daysBefore` days before its due date.
   */
  async scheduleSingleFeeReminder(
    feeId: string,
    installmentNumber: number,
    dueDate: Date,
    daysBefore: number,
  ): Promise<void> {
    const now = new Date();
    const alertTime = new Date(dueDate.getTime() - daysBefore * 24 * 60 * 60_000);
    const delay = Math.max(0, alertTime.getTime() - now.getTime());

    // Skip if the installment due date has already passed by more than 1 day
    if (dueDate.getTime() < now.getTime() - 24 * 60 * 60_000) {
      return;
    }

    await feeReminderQueue.add(
      { feeId, installmentNumber },
      {
        delay,
        jobId: `fee-due-${feeId}-${installmentNumber}`,
      },
    );

    logger.info(`[Scheduler] Fee due-soon reminder queued for fee ${feeId} installment ${installmentNumber}, in ${Math.round(delay / 60_000)} minute(s)`);
  }

  /**
   * Schedule the installment-due-soon reminder for a specific fee
   * installment, timed `academy.dueDateAlertDays` days before its due
   * date (default 3). Called once per installment when a fee record is
   * created — see AdminFeesUseCases.createFee.
   */
  async scheduleFeeReminders(feeId: string, installmentNumber: number, dueDate: Date, franchiseId: string): Promise<void> {
    const franchise = await FranchiseModel.findById(franchiseId).select('academyId').lean();
    const academy = franchise ? await AcademyModel.findById(franchise.academyId).select('dueDateAlertDays').lean() : null;
    const daysBefore = academy?.dueDateAlertDays ?? 3;
    await this.scheduleSingleFeeReminder(feeId, installmentNumber, dueDate, daysBefore);
  }

  /**
   * Evaluates all pending installments across active academies and franchises,
   * checking if any installment has entered its configured `academy.dueDateAlertDays` window.
   * Sends the due-soon alert with the academy's fee QR code to guardians.
   * Safe to run periodically (daily/hourly): guarantees no duplicate alerts are sent on the same day.
   */
  async checkAndSendDueSoonFeeAlerts(): Promise<number> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    let sentCount = 0;

    try {
      const activeFranchises = await FranchiseModel.find({ isActive: true }).select('_id academyId').lean();
      if (activeFranchises.length === 0) return 0;

      const academyIds = [...new Set(activeFranchises.map((f) => f.academyId?.toString()).filter(Boolean))];
      const academies = await AcademyModel.find({ _id: { $in: academyIds } }).select('_id dueDateAlertDays feeQrImageUrl').lean();
      const academyMap = new Map(academies.map((a) => [a._id.toString(), a]));

      for (const franchise of activeFranchises) {
        if (!franchise.academyId) continue;
        const academy = academyMap.get(franchise.academyId.toString());
        const daysBefore = academy?.dueDateAlertDays ?? 3;
        const qrImageUrl = academy?.feeQrImageUrl;

        // Window threshold: today + daysBefore days at end of day
        const thresholdDate = new Date(todayStart.getTime() + (daysBefore + 1) * 24 * 60 * 60_000);

        const fees = await FeeModel.find({
          franchiseId: franchise._id,
          overallStatus: { $in: ['pending', 'partial', 'overdue'] },
          'installments.status': { $in: ['pending', 'partial'] },
          'installments.dueDate': { $lte: thresholdDate },
        }).populate('studentId');

        for (const fee of fees) {
          const student = fee.studentId as any;
          if (!student || !student.guardianIds || student.guardianIds.length === 0) continue;

          let feeModified = false;

          for (const inst of fee.installments) {
            if (inst.status === 'paid' || inst.status === 'refunded') continue;

            const instDueDate = new Date(inst.dueDate);
            const daysUntilDue = Math.ceil((instDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            // Must be within the alert window (e.g. <= daysBefore)
            if (daysUntilDue > daysBefore) continue;

            // Prevent spam: if an alert was already sent today for this installment, skip
            if (inst.lastReminderAt && new Date(inst.lastReminderAt) >= todayStart) {
              continue;
            }

            const guardians = await UserModel.find({ _id: { $in: student.guardianIds } }).select('_id');
            const guardianIds = guardians.map((g) => g._id.toString());
            if (guardianIds.length === 0) continue;

            const studentName = `${student.firstName} ${student.lastName}`.trim();
            const remainingAmount = inst.amount - inst.paidAmount;

            try {
              await notificationService.sendFeeDueAlert(
                guardianIds,
                studentName,
                remainingAmount,
                instDueDate.toLocaleDateString('en-IN'),
                daysUntilDue,
                franchise._id.toString(),
                qrImageUrl,
              );

              inst.reminderSentCount = (inst.reminderSentCount || 0) + 1;
              inst.lastReminderAt = new Date();
              feeModified = true;
              sentCount++;

              logger.info(
                `[Scheduler] Automated due-soon alert sent for ${studentName} (Installment #${inst.installmentNumber}, due in ${daysUntilDue} days)`
              );
            } catch (alertErr) {
              logger.error(`[Scheduler] Failed to send automated due-soon alert for fee ${fee._id}:`, alertErr);
            }
          }

          if (feeModified) {
            await fee.save();
          }
        }
      }

      logger.info(`[Scheduler] Due-soon fee check completed. Sent ${sentCount} alert(s).`);
    } catch (err) {
      logger.error('[Scheduler] Error in checkAndSendDueSoonFeeAlerts:', err);
    }

    return sentCount;
  }

  /**
   * Initialize daily scheduling of all active franchises
   * Run once at startup, then daily via cron/interval
   */
  async initDailySchedule(): Promise<void> {
    const activeFranchises = await FranchiseModel.find({ isActive: true }).select('_id');
    for (const franchise of activeFranchises) {
      await this.scheduleFranchiseAlerts(franchise._id.toString());
    }
    logger.info(`[Scheduler] Daily schedule initialized for ${activeFranchises.length} active franchises`);

    // Run automated due-soon fee check on startup
    await this.checkAndSendDueSoonFeeAlerts();

    // Schedule periodic hourly check to ensure due-soon alerts fire reliably
    setInterval(() => {
      this.checkAndSendDueSoonFeeAlerts().catch((err) => {
        logger.error('[Scheduler] Periodic fee sweep error:', err);
      });
    }, 60 * 60 * 1000);
  }

  /**
   * Cancel alerts for a franchise (e.g., session cancelled)
   */
  async cancelFranchiseAlerts(franchiseId: string): Promise<void> {
    const today = new Date().getDay();
    const preJob = await sessionReminderQueue.getJob(`pre-${franchiseId}-${today}`);
    const postJob = await sessionReminderQueue.getJob(`post-${franchiseId}-${today}`);
    if (preJob) await preJob.remove();
    if (postJob) await postJob.remove();
    logger.info(`[Scheduler] Cancelled alerts for franchise ${franchiseId}`);
  }
}

export const schedulerService = new SchedulerService();
