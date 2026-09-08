// src/features/profile/ProfilePage.tsx
import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import {
  User,
  Shield,
  Key,
  Building2,
  Calendar,
  Phone,
  Mail,
  Lock,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  LogOut,
  Shirt,
  Award,
  Sun,
  Moon,
  ArrowRight,
  ExternalLink,
  Save,
  Check,
  CreditCard,
  HeartPulse,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { RootState } from "@/store";
import {
  useGetMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useLogoutMutation,
} from "@/store/api/authApi";
import { updateUser, clearCredentials } from "@/store/slices/authSlice";
import { clearActiveFranchise } from "@/store/slices/uiSlice";
import { clearNotifications } from "@/store/slices/notificationSlice";
import { baseApi } from "@/store/api/baseApi";
import { Avatar, Button, Input, Card, Badge, Modal, ImageUploadField } from "@/components/ui";
import { ThemeToggle } from "@/components/common/ThemeToggle";

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  super_admin: { label: "Super Admin", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  manager: { label: "Academy Manager", color: "text-volt-600 dark:text-volt-400", bg: "bg-volt-400/10 border-volt-400/20" },
  coach: { label: "Tactical Coach", color: "text-blue-600 dark:text-ice-400", bg: "bg-blue-500/10 border-blue-500/20" },
  employee: { label: "Academy Staff", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10 border-teal-500/20" },
  guardian: { label: "Parent / Guardian", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
  student: { label: "Football Player", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
};

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const authUser = useSelector((s: RootState) => s.auth.user);
  const { data: profile, isLoading, refetch } = useGetMeQuery();
  const [updateProfileMutation, { isLoading: isSavingProfile }] = useUpdateProfileMutation();
  const [changePasswordMutation, { isLoading: isChangingPassword }] = useChangePasswordMutation();
  const [logoutMutation] = useLogoutMutation();

  const [activeTab, setActiveTab] = useState<"details" | "security" | "preferences">("details");

  // Editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [cardPhoto, setCardPhoto] = useState<string | undefined>(undefined);
  const [showCardPhotoModal, setShowCardPhotoModal] = useState(false);

  // Password reset fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Logout confirmation modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Sync profile data to form state
  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || "");
      setLastName(profile.lastName || "");
      setPhone(profile.phone || "");
      setAvatar(profile.avatar || undefined);
      if (profile.studentDetails?.photo) {
        setCardPhoto(profile.studentDetails.photo);
      }
    } else if (authUser) {
      setFirstName(authUser.firstName || "");
      setLastName(authUser.lastName || "");
    }
  }, [profile, authUser]);

  const role = profile?.role || authUser?.role || "student";
  const roleConfig = ROLE_LABELS[role] || { label: role, color: "text-slate-600", bg: "bg-slate-100" };

  const isStudent = role === "student";
  const studentDetails = profile?.studentDetails;
  const isEnrolledInAcademy = isStudent && (studentDetails?.isEnrolledInAcademy || !!profile?.franchiseId || !!profile?.academyId);
  const academyName = profile?.academyName || "Academy";
  const franchiseName = profile?.franchiseName;

  // Save profile changes (restricted for enrolled students)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEnrolledInAcademy) {
      toast.error("Profile editing is disabled for academy-enrolled students.");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }

    try {
      const res = await updateProfileMutation({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatar: avatar || undefined,
      }).unwrap();

      dispatch(
        updateUser({
          firstName: res.firstName,
          lastName: res.lastName,
          avatar: res.avatar,
        })
      );
      toast.success("Profile details updated successfully");
      setShowAvatarModal(false);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update profile");
    }
  };

  // Save student player card photo
  const handleSaveCardPhoto = async () => {
    try {
      await updateProfileMutation({
        photo: cardPhoto || "",
      }).unwrap();
      toast.success("Player card photo updated successfully!");
      setShowCardPhotoModal(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update player card photo");
    }
  };

  // Change / Reset Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("New password cannot be the same as your current password");
      return;
    }

    try {
      await changePasswordMutation({
        currentPassword,
        newPassword,
      }).unwrap();

      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to change password. Please check your current password.");
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation({}).unwrap();
    } catch {}
    dispatch(clearCredentials());
    dispatch(clearActiveFranchise());
    dispatch(clearNotifications());
    dispatch(baseApi.util.resetApiState());
    navigate("/login", { replace: true });
  };

  const hasPasswordLength = newPassword.length >= 8;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/10 shadow-sm transition-all duration-200">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-r from-volt-400/10 via-blue-500/10 to-purple-500/10 dark:from-volt-400/15 dark:via-blue-500/10 dark:to-transparent pointer-events-none" />

        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <Avatar
                name={`${profile?.firstName || authUser?.firstName || ""} ${profile?.lastName || authUser?.lastName || ""}`}
                src={avatar || profile?.avatar || authUser?.avatar}
                size="lg"
                className="w-20 h-20 text-xl font-bold ring-4 ring-white dark:ring-pitch-800 shadow-md"
              />
              {!isEnrolledInAcademy && (
                <button
                  onClick={() => setShowAvatarModal(true)}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-volt-400 text-pitch-950 hover:bg-volt-300 shadow-sm transition-all"
                  title="Change avatar"
                >
                  <Sparkles size={13} />
                </button>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                  {profile?.firstName || authUser?.firstName} {profile?.lastName || authUser?.lastName}
                </h1>
                <span className={`text-2xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${roleConfig.bg} ${roleConfig.color}`}>
                  {roleConfig.label}
                </span>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Mail size={14} className="text-slate-400 flex-shrink-0" />
                <span>{profile?.email || authUser?.email}</span>
                <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={11} /> Verified
                </span>
              </p>

              {/* Organization info badge */}
              {(academyName || franchiseName) && (
                <div className="flex items-center gap-2 pt-1 text-xs text-slate-600 dark:text-slate-400">
                  <Building2 size={13} className="text-volt-500 flex-shrink-0" />
                  <span className="font-semibold">{academyName}</span>
                  {franchiseName && (
                    <>
                      <span>·</span>
                      <span className="text-slate-500">{franchiseName}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
            <button
              onClick={() => setActiveTab("security")}
              className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-2"
            >
              <Key size={14} />
              <span>Change Password</span>
            </button>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="text-xs px-3.5 py-2 rounded-lg border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors flex items-center gap-2 font-medium"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-t border-slate-200 dark:border-white/10 px-6 sm:px-8 bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "details"
                ? "border-volt-500 text-slate-900 dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <User size={15} />
            <span>Basic Data</span>
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "security"
                ? "border-volt-500 text-slate-900 dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Key size={15} />
            <span>Security & Password</span>
          </button>

          <button
            onClick={() => setActiveTab("preferences")}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "preferences"
                ? "border-volt-500 text-slate-900 dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Shield size={15} />
            <span>Permissions & Preferences</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BASIC DATA */}
      {activeTab === "details" && (
        <div className="space-y-6">
          {/* Critical Notice for Enrolled Students */}
          {isEnrolledInAcademy && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 dark:bg-amber-500/8 text-amber-800 dark:text-amber-300 flex items-start gap-4">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex-shrink-0">
                <Lock size={18} />
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-display font-bold uppercase tracking-wide text-xs">
                  Academy Administered Player Record
                </p>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-amber-200/80">
                  You are officially enrolled with <strong>{academyName}</strong>. To safeguard competitive integrity and registration compliance, personal profile information (name, date of birth, squad allocation, and contact records) can only be edited by an authorized <strong>Academy Manager</strong>.
                </p>
                <p className="text-2xs text-slate-500 dark:text-amber-300/60 pt-0.5">
                  If your personal details or contact info require updates, please consult your coach or academy manager.
                </p>
              </div>
            </div>
          )}

          {/* Personal Information Card */}
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
              <div>
                <h3 className="font-display font-bold text-slate-900 dark:text-white text-lg">
                  User Information
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Primary account identity and communication credentials
                </p>
              </div>
              {!isEnrolledInAcademy && (
                <span className="text-2xs font-mono uppercase tracking-wider text-slate-400">
                  Editable Fields
                </span>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    First Name {isEnrolledInAcademy && <Lock size={12} className="inline ml-1 text-amber-500" />}
                  </label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isEnrolledInAcademy || isSavingProfile}
                    className={isEnrolledInAcademy ? "opacity-75 cursor-not-allowed bg-slate-100 dark:bg-pitch-800" : ""}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Last Name {isEnrolledInAcademy && <Lock size={12} className="inline ml-1 text-amber-500" />}
                  </label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isEnrolledInAcademy || isSavingProfile}
                    className={isEnrolledInAcademy ? "opacity-75 cursor-not-allowed bg-slate-100 dark:bg-pitch-800" : ""}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Email Address <Lock size={12} className="inline ml-1 text-slate-400" />
                  </label>
                  <Input
                    value={profile?.email || authUser?.email || ""}
                    disabled
                    className="opacity-75 cursor-not-allowed bg-slate-100 dark:bg-pitch-800"
                  />
                  <p className="text-2xs text-slate-400 mt-1">Unique login credential identifier</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Phone Number <Lock size={12} className="inline ml-1 text-slate-400" />
                  </label>
                  <Input
                    value={profile?.phone || authUser?.phone || "Not provided"}
                    disabled
                    className="opacity-75 cursor-not-allowed bg-slate-100 dark:bg-pitch-800"
                  />
                  <p className="text-2xs text-slate-400 mt-1">
                    Registered primary contact (managed by academy administration)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Account Role
                  </label>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-pitch-800/60">
                    <Shield size={16} className={roleConfig.color} />
                    <span className="text-sm font-semibold text-slate-800 dark:text-white capitalize">
                      {roleConfig.label}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Affiliated Organization
                  </label>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-pitch-800/60">
                    <Building2 size={16} className="text-volt-500" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                      {academyName} {franchiseName ? `(${franchiseName})` : ""}
                    </span>
                  </div>
                </div>
              </div>

              {!isEnrolledInAcademy && (
                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-white/5">
                  <Button type="submit" loading={isSavingProfile} className="btn-primary">
                    <Save size={15} className="mr-1.5" />
                    Save Changes
                  </Button>
                </div>
              )}
            </form>
          </Card>

          {/* Student Specific Detailed Profile Card */}
          {isStudent && (
            <Card className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-volt-400/10 text-volt-500 flex items-center justify-center font-bold">
                    <Shirt size={20} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-slate-900 dark:text-white text-lg">
                      Football Player Dossier
                    </h3>
                    <p className="text-xs text-slate-500">
                      Roster metadata, squad assignment, and athletic ratings
                    </p>
                  </div>
                </div>

                {studentDetails?.jerseyNumber && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-pitch-950 text-white dark:bg-white dark:text-pitch-950 font-display font-black text-lg">
                    <span className="text-xs text-volt-400 dark:text-volt-600">#</span>
                    <span>{studentDetails.jerseyNumber}</span>
                  </div>
                )}
              </div>

              {/* Player Card Headshot Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-pitch-800/40 border border-slate-200/60 dark:border-white/5">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-pitch-900 border-2 border-volt-400 flex items-center justify-center shrink-0 shadow-sm">
                    {cardPhoto || studentDetails?.photo ? (
                      <img src={cardPhoto || studentDetails?.photo} alt="Player Card" className="w-full h-full object-cover object-top" />
                    ) : (
                      <Shirt size={24} className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Official Player Card Photo</span>
                      {!isEnrolledInAcademy && (
                        <span className="text-3xs font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">
                          Editable Free Agent
                        </span>
                      )}
                    </h4>
                    <p className="text-2xs text-slate-500 max-w-md">
                      Headshot displayed on your verified digital FUT card, public scout profile, and smart NFC ID card.
                    </p>
                  </div>
                </div>
                {!isEnrolledInAcademy ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs shrink-0"
                    onClick={() => setShowCardPhotoModal(true)}
                  >
                    Change Card Photo
                  </Button>
                ) : (
                  <span className="text-2xs text-slate-400 font-mono shrink-0">
                    Managed by Academy
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-pitch-800/50 border border-slate-200/70 dark:border-white/5">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Position</span>
                  <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {studentDetails?.position || "Not specified"}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-pitch-800/50 border border-slate-200/70 dark:border-white/5">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Age Category</span>
                  <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {studentDetails?.ageGroup || "U-15"}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-pitch-800/50 border border-slate-200/70 dark:border-white/5">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Attendance</span>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {studentDetails?.attendancePercentage ?? 100}%
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-pitch-800/50 border border-slate-200/70 dark:border-white/5">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Coach Rating</span>
                  <p className="text-base font-bold text-volt-500 mt-1 flex items-center gap-1">
                    <Award size={16} />
                    <span>{studentDetails?.overallRating ? `${studentDetails.overallRating}/10` : "—"}</span>
                  </p>
                </div>
              </div>

              {/* Guardian & Emergency Info */}
              {(studentDetails?.guardian?.name || studentDetails?.emergencyContactName) && (
                <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <HeartPulse size={14} className="text-rose-500" />
                    Emergency & Guardian Contact
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {studentDetails?.guardian?.name && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-pitch-800/40 border border-slate-200/50 dark:border-white/5 space-y-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Parent / Guardian: {studentDetails.guardian.name}
                        </span>
                        {studentDetails.guardian.phone && (
                          <p className="text-slate-500">Phone: {studentDetails.guardian.phone}</p>
                        )}
                        {studentDetails.guardian.email && (
                          <p className="text-slate-500">Email: {studentDetails.guardian.email}</p>
                        )}
                      </div>
                    )}

                    {studentDetails?.emergencyContactName && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-pitch-800/40 border border-slate-200/50 dark:border-white/5 space-y-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Emergency Contact: {studentDetails.emergencyContactName}
                        </span>
                        {studentDetails.emergencyContactPhone && (
                          <p className="text-slate-500">Phone: {studentDetails.emergencyContactPhone}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Public Portfolio / Card link */}
              {studentDetails?.publicProfileToken && (
                <div className="border-t border-slate-100 dark:border-white/5 pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Sparkles size={15} className="text-volt-500" />
                    <span>Public Scout Portfolio is active</span>
                  </div>
                  <Link
                    to={`/players/${studentDetails.publicProfileToken}`}
                    target="_blank"
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <span>View Public Card</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: SECURITY & PASSWORD */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
              <div>
                <h3 className="font-display font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                  <Key size={18} className="text-volt-500" />
                  Reset / Change Password
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your authentication password to maintain high account security
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5 max-w-xl">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Security Checklist */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-pitch-800/40 border border-slate-200/60 dark:border-white/5 space-y-1.5 text-xs">
                <div className={`flex items-center gap-2 ${hasPasswordLength ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400"}`}>
                  <Check size={14} />
                  <span>Minimum 8 characters length</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordsMatch ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400"}`}>
                  <Check size={14} />
                  <span>New password and confirmation match</span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  loading={isChangingPassword}
                  disabled={!hasPasswordLength || !passwordsMatch}
                  className="btn-primary"
                >
                  <Key size={14} className="mr-1.5" />
                  Update Password
                </Button>
              </div>
            </form>
          </Card>

          {/* Active Session Card */}
          <Card className="p-6 sm:p-8 space-y-4">
            <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">
              Active Session Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-pitch-800/40 border border-slate-200/60 dark:border-white/5">
                <span className="text-2xs uppercase tracking-wider text-slate-400 font-bold">Client Interface</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">Noxphere Web Application</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-pitch-800/40 border border-slate-200/60 dark:border-white/5">
                <span className="text-2xs uppercase tracking-wider text-slate-400 font-bold">Authentication Mode</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">JWT Bearer Token (Encrypted)</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-pitch-800/40 border border-slate-200/60 dark:border-white/5">
                <span className="text-2xs uppercase tracking-wider text-slate-400 font-bold">Account Status</span>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  Active & Operational
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: PREFERENCES & PERMISSIONS */}
      {activeTab === "preferences" && (
        <div className="space-y-6">
          {/* Theme Preference Card */}
          <Card className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">
                  Display Appearance
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle between high-contrast Dark Mode and clean Daylight mode
                </p>
              </div>
              <ThemeToggle size="md" />
            </div>
          </Card>

          {/* Role Permissions Card */}
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
              <div>
                <h3 className="font-display font-bold text-slate-900 dark:text-white text-lg">
                  Role Capabilities & Privileges
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permissions governed by your role: <strong>{roleConfig.label}</strong>
                </p>
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${roleConfig.bg} ${roleConfig.color}`}>
                {roleConfig.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { name: "Live Session Attendance", active: role === "super_admin" || role === "manager" || role === "coach" || role === "employee" },
                { name: "Performance Evaluations", active: role === "super_admin" || role === "manager" || role === "coach" },
                { name: "Squad Roster Administration", active: role === "super_admin" || role === "manager" },
                { name: "Fee & Billing Ledger", active: role === "super_admin" || role === "manager" },
                { name: "Smart NFC Card Operations", active: role === "super_admin" || role === "manager" },
                { name: "Academy Settings & Branding", active: role === "super_admin" || role === "manager" },
                { name: "Staff & Coach Management", active: role === "super_admin" || role === "manager" },
                { name: "Transfer Wall Listings", active: role === "super_admin" || role === "manager" },
                { name: "Player Portfolio View", active: true },
              ].map((perm) => (
                <div
                  key={perm.name}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs transition-colors ${
                    perm.active
                      ? "bg-white dark:bg-pitch-800/60 border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100"
                      : "bg-slate-50 dark:bg-pitch-900/40 border-slate-200/40 dark:border-white/5 text-slate-400 opacity-60"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      perm.active
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-200 dark:bg-white/5 text-slate-400"
                    }`}
                  >
                    {perm.active ? <Check size={12} strokeWidth={2.5} /> : <Lock size={11} />}
                  </div>
                  <span className="font-medium">{perm.name}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Navigation based on Role */}
          <Card className="p-6 sm:p-8 space-y-4">
            <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">
              Quick Shortcuts
            </h3>
            <div className="flex flex-wrap gap-3">
              {role === "student" && (
                <>
                  <Link to="/student/dashboard" className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5">
                    <span>Student Dashboard</span>
                    <ArrowRight size={13} />
                  </Link>
                  <Link to="/student/progress" className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5">
                    <span>My Progress & Reports</span>
                    <ArrowRight size={13} />
                  </Link>
                </>
              )}
              {role === "guardian" && (
                <>
                  <Link to="/guardian/dashboard" className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5">
                    <span>Guardian Dashboard</span>
                    <ArrowRight size={13} />
                  </Link>
                  <Link to="/guardian/complaints" className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5">
                    <span>Complaints & Support</span>
                    <ArrowRight size={13} />
                  </Link>
                </>
              )}
              {role === "coach" && (
                <>
                  <Link to="/coach/dashboard" className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5">
                    <span>Coach Dashboard</span>
                    <ArrowRight size={13} />
                  </Link>
                  <Link to="/schedule" className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5">
                    <span>Training Sessions</span>
                    <ArrowRight size={13} />
                  </Link>
                </>
              )}
              {(role === "manager" || role === "super_admin") && (
                <>
                  <Link to="/dashboard" className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5">
                    <span>Admin Dashboard</span>
                    <ArrowRight size={13} />
                  </Link>
                  <Link to="/students" className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5">
                    <span>Squad Management</span>
                    <ArrowRight size={13} />
                  </Link>
                  <Link to="/fees" className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5">
                    <span>Fee Tracking</span>
                    <ArrowRight size={13} />
                  </Link>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Avatar Upload Modal */}
      {showAvatarModal && (
        <Modal isOpen onClose={() => setShowAvatarModal(false)} title="Update Avatar" size="sm">
          <div className="space-y-4 py-2">
            <ImageUploadField
              label="Profile Photo"
              category="player_photo"
              value={avatar}
              onChange={(url) => setAvatar(url)}
              shape="circle"
              helperText="Upload a square JPEG, PNG or WebP image"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <Button
                type="button"
                loading={isSavingProfile}
                onClick={handleSaveProfile}
                className="btn-primary text-xs py-1.5 px-4"
              >
                Save Photo
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Student Card Photo Upload Modal */}
      {showCardPhotoModal && (
        <Modal isOpen onClose={() => setShowCardPhotoModal(false)} title="Update Player Card Photo" size="sm">
          <div className="space-y-4 py-2">
            <ImageUploadField
              label="Player Card Headshot"
              category="player_photo"
              value={cardPhoto}
              onChange={(url) => setCardPhoto(url)}
              shape="circle"
              helperText="Upload a sharp headshot. This is used on your public FUT card and NFC pass."
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCardPhotoModal(false)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <Button
                type="button"
                loading={isSavingProfile}
                onClick={handleSaveCardPhoto}
                className="btn-primary text-xs py-1.5 px-4"
              >
                Save Card Photo
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <Modal isOpen onClose={() => setShowLogoutModal(false)} title="Confirm Sign Out" size="sm">
          <div className="space-y-4 py-2 text-sm text-slate-600 dark:text-slate-300">
            <p>Are you sure you want to sign out of your Noxphere account?</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="btn-secondary text-xs py-1.5 px-3.5"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold shadow-sm transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ProfilePage;
