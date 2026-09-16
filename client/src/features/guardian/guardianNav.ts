// src/features/guardian/guardianNav.ts
import { LayoutDashboard, MessageSquareWarning, User } from "lucide-react";
import type { PortalNavItem } from "../../components/layout/PortalLayout";

export const GUARDIAN_NAV_ITEMS: PortalNavItem[] = [
  { to: "/guardian/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/guardian/complaints", label: "Complaints", icon: MessageSquareWarning },
  { to: "/guardian/profile", label: "My Profile", icon: User },
];