// src/features/student-portal/studentNav.ts
import { LayoutDashboard, TrendingUp, User } from "lucide-react";
import type { PortalNavItem } from "../../components/layout/PortalLayout";

export const STUDENT_NAV_ITEMS: PortalNavItem[] = [
  { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/student/progress", label: "My progress", icon: TrendingUp },
  { to: "/student/profile", label: "My Profile", icon: User },
];
