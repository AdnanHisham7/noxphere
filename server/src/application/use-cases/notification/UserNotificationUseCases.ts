// src/application/use-cases/notification/UserNotificationUseCases.ts
import { UserNotificationModel } from "../../../infrastructure/database/models/UserNotification.model";
import { NotFoundError, ForbiddenError } from "../../../shared/errors/AppError";

// Every event in the app (attendance, fees, sessions, selection, transfers,
// announcements — see NotificationService's convenience methods) already
// writes a per-user UserNotification row. Until this use case existed,
// nothing ever read that collection back: the bell icon only ever showed
// whatever arrived over a live socket connection during the current tab
// session, so it started empty on every page load and never persisted a
// "read" state to the server (see notificationSlice.markAllRead, which was
// local-Redux-only before this change).
export class UserNotificationUseCases {
  async listMine(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total, unreadCount] = await Promise.all([
      UserNotificationModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      UserNotificationModel.countDocuments({ userId }),
      UserNotificationModel.countDocuments({ userId, isRead: false }),
    ]);
    return {
      items: items.map((n) => ({
        id: n._id.toString(),
        title: n.title,
        body: n.body,
        type: n.type,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markRead(id: string, userId: string) {
    const notification = await UserNotificationModel.findById(id);
    if (!notification) throw new NotFoundError("Notification");
    if (notification.userId.toString() !== userId) {
      throw new ForbiddenError("This notification doesn't belong to you");
    }
    notification.isRead = true;
    await notification.save();
    return {
      id: notification._id.toString(),
      title: notification.title,
      body: notification.body,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await UserNotificationModel.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } },
    );
    return { updated: result.modifiedCount };
  }
}