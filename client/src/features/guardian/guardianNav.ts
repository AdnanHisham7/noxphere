// src/features/guardian/guardianNav.ts
import { LayoutDashboard, MessageSquareWarning, Bell, User } from "lucide-react";
import type { PortalNavItem } from "../../components/layout/PortalLayout";

export const GUARDIAN_NAV_ITEMS: PortalNavItem[] = [
  { to: "/guardian/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/guardian/alerts", label: "Alerts", icon: Bell },
  { to: "/guardian/complaints", label: "Complaints", icon: MessageSquareWarning },
  { to: "/guardian/profile", label: "My Profile", icon: User },
];