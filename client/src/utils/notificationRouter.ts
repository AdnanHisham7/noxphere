// src/utils/notificationRouter.ts
import { MyNotification } from "../store/api/myNotificationsApi";

export interface NotificationTarget {
  url: string | null;
  entityId?: string;
  tab?: string;
}

/**
 * Maps a notification and user role to its target destination URL and entity ID for highlighting.
 */
export function getNotificationTarget(
  notification: MyNotification | { type?: string; data?: Record<string, any>; title?: string; body?: string },
  userRole?: string
): NotificationTarget | null {
  const type = notification.type || "";
  const data = (notification as any).data || {};

  // If a direct external/internal link is attached, navigate there directly
  if (data.linkUrl && typeof data.linkUrl === "string") {
    return { url: data.linkUrl };
  }

  // 1. Complaints
  if (type.startsWith("complaint_") || type === "complaint") {
    const complaintId = data.complaintId || data.id;
    if (userRole === "guardian") {
      return {
        url: complaintId ? `/guardian/complaints?highlight=${complaintId}` : "/guardian/complaints",
        entityId: complaintId,
      };
    }
    // Coach, Manager, Operational Manager
    return {
      url: complaintId ? `/complaints?highlight=${complaintId}` : "/complaints",
      entityId: complaintId,
    };
  }

  // 2. Attendance alerts
  if (type.startsWith("attendance_")) {
    const studentId = data.studentId;
    const sessionId = data.sessionId;
    if (userRole === "guardian") {
      if (studentId) {
        return {
          url: `/guardian/children/${studentId}?tab=attendance${sessionId ? `&highlight=${sessionId}` : `&highlight=${studentId}`}`,
          entityId: sessionId || studentId,
          tab: "attendance",
        };
      }
      return { url: "/guardian/dashboard#sessions-section" };
    }
    if (userRole === "student") {
      return {
        url: `/student/progress?tab=attendance${sessionId ? `&highlight=${sessionId}` : ""}`,
        entityId: sessionId,
        tab: "attendance",
      };
    }
    if (userRole === "coach") {
      if (sessionId) {
        return { url: `/schedule?highlight=${sessionId}`, entityId: sessionId };
      }
      if (studentId) {
        return { url: `/coach/students/${studentId}`, entityId: studentId };
      }
      return { url: "/schedule" };
    }
    // Manager / Operational Manager
    if (studentId) {
      return {
        url: `/students/${studentId}?tab=attendance${sessionId ? `&highlight=${sessionId}` : ""}`,
        entityId: sessionId || studentId,
        tab: "attendance",
      };
    }
    if (sessionId) {
      return { url: `/schedule?highlight=${sessionId}`, entityId: sessionId };
    }
    return { url: "/schedule" };
  }

  // 3. Schedule / Sessions
  if (type.startsWith("session_") || type === "batch_session_invite") {
    const sessionId = data.sessionId;
    if (userRole === "guardian") {
      const studentId = data.studentId;
      if (studentId) {
        return {
          url: `/guardian/children/${studentId}?tab=schedule${sessionId ? `&highlight=${sessionId}` : ""}`,
          entityId: sessionId,
          tab: "schedule",
        };
      }
      return {
        url: sessionId ? `/guardian/dashboard?highlight=${sessionId}#sessions-section` : "/guardian/dashboard#sessions-section",
        entityId: sessionId,
      };
    }
    if (userRole === "student") {
      return {
        url: sessionId ? `/student/dashboard?highlight=${sessionId}` : "/student/dashboard",
        entityId: sessionId,
      };
    }
    // Coach, Manager, Operational Manager
    return {
      url: sessionId ? `/schedule?highlight=${sessionId}` : "/schedule",
      entityId: sessionId,
    };
  }

  // 4. Fees / Payments
  if (type.startsWith("fee_") || type.startsWith("payment_")) {
    const feeId = data.feeId;
    const studentId = data.studentId;
    if (userRole === "guardian") {
      if (studentId) {
        return {
          url: `/guardian/children/${studentId}?tab=fees${feeId ? `&highlight=${feeId}` : ""}`,
          entityId: feeId || studentId,
          tab: "fees",
        };
      }
      return { url: "/guardian/dashboard" };
    }
    if (userRole === "student") {
      return {
        url: `/student/progress?tab=fees${feeId ? `&highlight=${feeId}` : ""}`,
        entityId: feeId,
        tab: "fees",
      };
    }
    if (userRole === "coach") {
      return null;
    }
    // Manager, Operational Manager
    return {
      url: feeId ? `/fees?highlight=${feeId}` : studentId ? `/fees?highlight=${studentId}` : "/fees",
      entityId: feeId || studentId,
    };
  }

  // 5. Selection updates
  if (type.startsWith("selection_")) {
    const studentId = data.studentId;
    if (userRole === "guardian") {
      if (studentId) {
        return {
          url: `/guardian/children/${studentId}?tab=overview&highlight=${studentId}`,
          entityId: studentId,
        };
      }
      return { url: "/guardian/dashboard" };
    }
    if (userRole === "student") {
      return {
        url: "/student/progress?tab=performance",
        tab: "performance",
      };
    }
    // Coach, Manager, Operational Manager
    return {
      url: studentId ? `/selection?highlight=${studentId}` : "/selection",
      entityId: studentId,
    };
  }

  // 6. Performance updates
  if (type.startsWith("performance_")) {
    const studentId = data.studentId;
    if (userRole === "guardian") {
      if (studentId) {
        return {
          url: `/guardian/children/${studentId}?tab=performance${studentId ? `&highlight=${studentId}` : ""}`,
          entityId: studentId,
          tab: "performance",
        };
      }
      return { url: "/guardian/dashboard" };
    }
    if (userRole === "student") {
      return {
        url: "/student/progress?tab=performance",
        tab: "performance",
      };
    }
    if (userRole === "coach") {
      if (studentId) return { url: `/coach/students/${studentId}`, entityId: studentId };
      return { url: "/coach/dashboard" };
    }
    // Manager, Operational Manager
    if (studentId) {
      return {
        url: `/students/${studentId}?tab=performance`,
        entityId: studentId,
        tab: "performance",
      };
    }
    return { url: "/students" };
  }

  // 7. Registration requests / applications
  if (type.startsWith("registration_")) {
    const requestId = data.requestId;
    if (userRole === "manager" || userRole === "operational_manager") {
      return {
        url: requestId ? `/students?tab=requests&highlight=${requestId}` : "/students?tab=requests",
        entityId: requestId,
        tab: "requests",
      };
    }
    if (userRole === "guardian") return { url: "/guardian/dashboard" };
    if (userRole === "student") return { url: "/student/dashboard" };
    return null;
  }

  // 8. Transfer wall
  if (type.startsWith("transfer_")) {
    const transferId = data.transferId || data.requestId;
    if (userRole === "manager" || userRole === "operational_manager") {
      return {
        url: transferId ? `/transfer-wall?tab=incoming&highlight=${transferId}` : "/transfer-wall?tab=incoming",
        entityId: transferId,
        tab: "incoming",
      };
    }
    return null;
  }

  // 9. NFC Cards
  if (type.startsWith("nfc_")) {
    const requestId = data.requestId;
    if (userRole === "super_admin" || userRole === "manager" || userRole === "operational_manager") {
      return {
        url: requestId ? `/nfc-cards?highlight=${requestId}` : "/nfc-cards",
        entityId: requestId,
      };
    }
    if (userRole === "guardian") return { url: "/guardian/dashboard" };
    if (userRole === "student") return { url: "/student/dashboard" };
    return null;
  }

  // 10. Platform Tickets
  if (type.startsWith("platform_ticket_")) {
    const ticketId = data.ticketId;
    if (userRole === "super_admin") {
      return {
        url: ticketId ? `/admin/support?highlight=${ticketId}` : "/admin/support",
        entityId: ticketId,
      };
    }
    if (userRole === "manager" || userRole === "operational_manager") {
      return {
        url: ticketId ? `/complaints?tab=platform_support&highlight=${ticketId}` : "/complaints?tab=platform_support",
        entityId: ticketId,
        tab: "platform_support",
      };
    }
    return null;
  }

  // 11. Announcements / Broadcasts
  if (type === "announcement" || type === "broadcast") {
    if (userRole === "guardian") return { url: "/guardian/alerts" };
    if (userRole === "student") return { url: "/student/dashboard" };
    return { url: "/notifications" };
  }

  return null;
}
