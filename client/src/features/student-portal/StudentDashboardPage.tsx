import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  CalendarCheck,
  TrendingUp,
  Wallet,
  MessageSquare,
  QrCode,
  Copy,
  CheckCircle2,
  ExternalLink,
  Globe,
  Compass,
  SlidersHorizontal,
  UserCheck,
  Lock,
  X,
} from "lucide-react";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";
import { RootState } from "../../store";
import {
  useGetMyDashboardQuery,
  useUpdateMyProfileMutation,
  useUpdateMyPublicProfileSettingsMutation,
} from "../../store/api/studentPortalApi";
import { NoxPageHeader, NoxStatCard, NoxSkeleton, NoxEmptyState, NoxStatusBadge } from "../../components/portal-ui";
import { NfcPlayerCardSection } from "./NfcPlayerCardSection";

const StudentDashboardPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const { data, isLoading, isError } = useGetMyDashboardQuery();
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const [updateProfile, { isLoading: isUpdatingProfile }] = useUpdateMyProfileMutation();
  const [updateSettings, { isLoading: isUpdatingSettings }] = useUpdateMyPublicProfileSettingsMutation();

  const isFreeAgent = data ? !data.profile.franchiseId : false;

  // Free Agent Visibility State
  const [visibilitySettings, setVisibilitySettings] = useState({
    showPhoto: true,
    showPosition: true,
    showJerseyNumber: true,
    showAgeGroup: true,
    showRating: true,
    showTeam: true,
    bio: "",
    preferredFoot: "",
  });

  // Free Agent Profile Form State
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    position: "",
    jerseyNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  useEffect(() => {
    if (data?.profile) {
      const s = data.profile.publicProfileSettings || {};
      setVisibilitySettings({
        showPhoto: s.showPhoto !== false,
        showPosition: s.showPosition !== false,
        showJerseyNumber: s.showJerseyNumber !== false,
        showAgeGroup: s.showAgeGroup !== false,
        showRating: s.showRating !== false,
        showTeam: s.showTeam !== false,
        bio: s.bio || "",
        preferredFoot: s.preferredFoot || "",
      });

      setProfileForm({
        firstName: data.profile.firstName || "",
        lastName: data.profile.lastName || "",
        dateOfBirth: data.profile.dateOfBirth
          ? new Date(data.profile.dateOfBirth).toISOString().split("T")[0]
          : "",
        position: data.profile.position || "",
        jerseyNumber: data.profile.jerseyNumber !== undefined ? String(data.profile.jerseyNumber) : "",
        emergencyContactName: data.profile.medicalInfo?.emergencyContactName || "",
        emergencyContactPhone: data.profile.medicalInfo?.emergencyContactPhone || "",
      });
    }
  }, [data]);

  const publicProfileUrl = data?.profile?.publicProfileToken
    ? `${window.location.origin}/players/${data.profile.publicProfileToken}`
    : "";

  const handleCopyLink = () => {
    if (!publicProfileUrl) return;
    navigator.clipboard.writeText(publicProfileUrl);
    setCopied(true);
    toast.success("Public profile link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveVisibility = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({
        enabled: data?.profile?.publicProfileEnabled ?? true,
        settings: visibilitySettings,
      }).unwrap();
      toast.success("Public profile visibility preferences updated!");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update visibility settings");
    }
  };

  const handleTogglePublicEnabled = async () => {
    try {
      const nextState = !data?.profile?.publicProfileEnabled;
      await updateSettings({
        enabled: nextState,
        settings: visibilitySettings,
      }).unwrap();
      toast.success(nextState ? "Public player card enabled" : "Public player card disabled");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update public status");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        dateOfBirth: profileForm.dateOfBirth || undefined,
        position: profileForm.position || undefined,
        jerseyNumber: profileForm.jerseyNumber ? parseInt(profileForm.jerseyNumber, 10) : undefined,
        emergencyContactName: profileForm.emergencyContactName.trim() || undefined,
        emergencyContactPhone: profileForm.emergencyContactPhone.trim() || undefined,
      }).unwrap();
      toast.success("Player profile updated successfully!");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update profile");
    }
  };

  return (
    <div>
      <NoxPageHeader
        eyebrow="Student portal"
        title={`Hey${user?.firstName ? `, ${user.firstName}` : ""}`}
        subtitle={
          isFreeAgent
            ? "Manage your verified player profile, public visibility, and recruitment card."
            : "Your attendance, fees and coach feedback, all in one place."
        }
      />

      {isLoading && (
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <NoxSkeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {isError && (
        <NoxEmptyState
          title="No student record linked yet"
          body="Once your academy links this account to your student profile, your dashboard will show up here."
        />
      )}

      {data && (
        <>
          {/* Public Profile & Player Card Banner */}
          {publicProfileUrl && (
            <div className="nox-card p-5 mb-8 border-core-400/20 bg-gradient-to-r from-core-400/[0.04] to-transparent">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-2xs font-mono uppercase tracking-wider text-core-400 bg-core-400/10 px-2.5 py-0.5 rounded-full font-semibold">
                      <Globe size={12} /> Public Player Profile
                    </span>
                    {isFreeAgent ? (
                      <span className="text-2xs font-mono uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full font-semibold">
                        Free Agent • Unattached
                      </span>
                    ) : (
                      <span className="text-2xs font-mono uppercase tracking-wider text-field-400 bg-field-400/10 px-2.5 py-0.5 rounded-full">
                        {data.profile.team?.name || "Enrolled in Academy"}
                      </span>
                    )}
                  </div>
                  <h3 className="font-orbital font-semibold text-nox-high text-base">
                    Share Your Player Card &amp; Match Stats
                  </h3>
                  <p className="text-xs text-nox-low max-w-xl">
                    Anyone with your public link or QR code can view your verified stats, overall rating, and player card.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="nox-btn-secondary !py-2 !px-3 text-xs flex-1 sm:flex-initial"
                  >
                    {copied ? <CheckCircle2 size={14} className="text-field-400" /> : <Copy size={14} />}
                    {copied ? "Link Copied" : "Copy Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="nox-btn-secondary !py-2 !px-3 text-xs"
                    title="View QR Code"
                  >
                    <QrCode size={14} />
                    <span className="hidden sm:inline">QR Code</span>
                  </button>
                  <a
                    href={publicProfileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="nox-btn-primary !py-2 !px-3 text-xs"
                  >
                    <ExternalLink size={14} />
                    <span className="hidden sm:inline">Preview Card</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Smart NFC Player Card Section */}
          <NfcPlayerCardSection
            player={{
              firstName: data.profile.firstName,
              lastName: data.profile.lastName,
              position: data.profile.position,
              jerseyNumber: data.profile.jerseyNumber,
              publicProfileToken: data.profile.publicProfileToken,
              guardianPhone: data.profile.guardian?.phone,
            }}
          />

          {/* QR Code Modal */}
          {showQrModal && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setShowQrModal(false)}
            >
              <div
                className="card p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border-slate-200 dark:border-white/15"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-mono uppercase tracking-wider text-core-400 font-semibold flex items-center gap-1">
                    <Globe size={12} /> Verified Player ID
                  </span>
                  <button onClick={() => setShowQrModal(false)} className="text-slate-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <h3 className="font-orbital font-semibold text-lg text-slate-900 dark:text-white">
                  Player Public QR Code
                </h3>
                <p className="text-xs text-slate-500">
                  Scan with any phone camera to view {data.profile.firstName}&apos;s verified player card.
                </p>
                <div className="p-4 bg-white rounded-xl inline-block mx-auto shadow-inner">
                  <QRCode value={publicProfileUrl} size={180} level="H" bgColor="#FFFFFF" fgColor="#000000" />
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQrModal(false)}
                    className="btn-secondary w-full text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FREE AGENT SPECIFIC HUB: Attendance, fees, rating & coach notes are HIDDEN */}
          {isFreeAgent ? (
            <div className="space-y-8">
              {/* Informational Status Card */}
              <div className="nox-card p-6 border-amber-400/20 bg-amber-400/[0.02] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Compass size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-orbital font-semibold text-nox-high text-base">
                        Independent Free Agent Status
                      </h3>
                      <span className="text-2xs font-mono uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-semibold">
                        Unattached
                      </span>
                    </div>
                    <p className="text-xs text-nox-low mt-0.5 max-w-xl leading-relaxed">
                      You are registered as an independent player. Academy session attendance, fee installments, and coach evaluations will activate automatically once you join an academy squad. You have full control over your verified public player card below.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-nox-mid">Public Card:</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={data.profile.publicProfileEnabled}
                    onClick={handleTogglePublicEnabled}
                    disabled={isUpdatingSettings}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      data.profile.publicProfileEnabled ? "bg-core-400" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        data.profile.publicProfileEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Grid: Public Profile Viewing Controls & Edit My Information */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* 1. Public Profile Viewing Controls */}
                <div className="nox-card p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal size={17} className="text-core-400" />
                      <h3 className="font-orbital font-semibold text-nox-high text-sm">
                        Public Profile Viewing Controls
                      </h3>
                    </div>
                    <span className="text-[11px] text-nox-low font-mono">Scout Visibility</span>
                  </div>

                  <p className="text-xs text-nox-low">
                    Configure exactly what scouts, recruiters, and visitors can see when viewing your public player card.
                  </p>

                  <form onSubmit={handleSaveVisibility} className="space-y-4">
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { key: "showPhoto", label: "Show Photo / Avatar" },
                        { key: "showPosition", label: "Show Position" },
                        { key: "showJerseyNumber", label: "Show Jersey Number" },
                        { key: "showAgeGroup", label: "Show Age Category" },
                        { key: "showRating", label: "Show Rating" },
                      ].map(({ key, label }) => {
                        const active = (visibilitySettings as any)[key] !== false;
                        return (
                          <button
                            type="button"
                            key={key}
                            onClick={() =>
                              setVisibilitySettings((s) => ({ ...s, [key]: !active }))
                            }
                            className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all ${
                              active
                                ? "bg-core-400/10 border-core-400/40 text-nox-high font-semibold"
                                : "bg-white/[0.02] border-white/[0.06] text-nox-low hover:text-nox-mid"
                            }`}
                          >
                            <span>{label}</span>
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] shrink-0 ml-2 ${
                                active
                                  ? "bg-core-400 border-core-400 text-pitch-950 font-bold"
                                  : "border-white/20 bg-transparent"
                              }`}
                            >
                              {active && "✓"}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                          Personal Statement / Bio
                        </label>
                        <textarea
                          value={visibilitySettings.bio}
                          onChange={(e) =>
                            setVisibilitySettings((s) => ({ ...s, bio: e.target.value }))
                          }
                          placeholder="Introduce yourself to recruiters (e.g. key playing strengths, preferred tactical role)..."
                          rows={3}
                          maxLength={300}
                          className="input text-xs w-full resize-none"
                        />
                      </div>

                      <div>
                        <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                          Preferred Foot
                        </label>
                        <select
                          value={visibilitySettings.preferredFoot}
                          onChange={(e) =>
                            setVisibilitySettings((s) => ({ ...s, preferredFoot: e.target.value }))
                          }
                          className="input text-xs w-full"
                        >
                          <option value="">Unspecified</option>
                          <option value="right">Right</option>
                          <option value="left">Left</option>
                          <option value="both">Both (Ambidextrous)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isUpdatingSettings}
                        className="nox-btn-primary !py-2 !px-4 text-xs"
                      >
                        {isUpdatingSettings ? "Saving…" : "Save Visibility Preferences"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* 2. Edit My Player Information (Editable for unattached player) */}
                <div className="nox-card p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2">
                      <UserCheck size={17} className="text-field-400" />
                      <h3 className="font-orbital font-semibold text-nox-high text-sm">
                        Edit Player Information
                      </h3>
                    </div>
                    <span className="text-[11px] text-field-400 font-mono font-semibold">
                      Editable · Unattached
                    </span>
                  </div>

                  <p className="text-xs text-nox-low">
                    As an independent player, you can freely update your verified personal and tactical details.
                  </p>

                  <form onSubmit={handleSaveProfile} className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          required
                          value={profileForm.firstName}
                          onChange={(e) =>
                            setProfileForm((p) => ({ ...p, firstName: e.target.value }))
                          }
                          className="input text-xs w-full"
                        />
                      </div>
                      <div>
                        <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          required
                          value={profileForm.lastName}
                          onChange={(e) =>
                            setProfileForm((p) => ({ ...p, lastName: e.target.value }))
                          }
                          className="input text-xs w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                          Playing Position
                        </label>
                        <select
                          value={profileForm.position}
                          onChange={(e) =>
                            setProfileForm((p) => ({ ...p, position: e.target.value }))
                          }
                          className="input text-xs w-full"
                        >
                          <option value="">Select position</option>
                          <option value="Forward">Forward</option>
                          <option value="Striker">Striker</option>
                          <option value="Winger">Winger</option>
                          <option value="Midfielder">Midfielder</option>
                          <option value="Attacking Midfielder">Attacking Midfielder</option>
                          <option value="Defensive Midfielder">Defensive Midfielder</option>
                          <option value="Defender">Defender</option>
                          <option value="Center Back">Center Back</option>
                          <option value="Full Back">Full Back</option>
                          <option value="Goalkeeper">Goalkeeper</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                          Jersey Number
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={profileForm.jerseyNumber}
                          onChange={(e) =>
                            setProfileForm((p) => ({ ...p, jerseyNumber: e.target.value }))
                          }
                          placeholder="e.g. 10"
                          className="input text-xs w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={profileForm.dateOfBirth}
                        onChange={(e) =>
                          setProfileForm((p) => ({ ...p, dateOfBirth: e.target.value }))
                        }
                        className="input text-xs w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                          Emergency Contact Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.emergencyContactName}
                          onChange={(e) =>
                            setProfileForm((p) => ({ ...p, emergencyContactName: e.target.value }))
                          }
                          placeholder="Guardian / Emergency contact"
                          className="input text-xs w-full"
                        />
                      </div>
                      <div>
                        <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                          Emergency Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={profileForm.emergencyContactPhone}
                          onChange={(e) =>
                            setProfileForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))
                          }
                          placeholder="+91 98765 43210"
                          className="input text-xs w-full"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isUpdatingProfile}
                        className="nox-btn-primary !py-2 !px-4 text-xs"
                      >
                        {isUpdatingProfile ? "Saving…" : "Save Player Information"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            /* ACADEMY ENROLLED STUDENT VIEW: Attendance, rating, fees, coach notes are displayed */
            <>
              {/* Academy verification banner */}
              <div className="mb-6 p-3.5 rounded-xl bg-core-400/[0.06] border border-core-400/20 flex items-center justify-between text-xs text-nox-high">
                <div className="flex items-center gap-2.5">
                  <Lock size={15} className="text-core-400 shrink-0" />
                  <span>
                    Official Academy Roster Player: Roster details (Name, DOB, Squad, Jersey #) are verified and managed by your academy coaches.
                  </span>
                </div>
                <span className="font-mono text-2xs uppercase tracking-wider text-core-400 shrink-0 font-semibold">
                  Roster Locked
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                <NoxStatCard
                  label="Attendance"
                  value={`${data.profile.attendancePercentage}%`}
                  icon={<CalendarCheck size={18} />}
                  accent="ion"
                />
                <NoxStatCard
                  label="Rating"
                  value={data.profile.overallRating?.toFixed(1) ?? "—"}
                  icon={<TrendingUp size={18} />}
                  accent="plasma"
                />
                <NoxStatCard
                  label="Today"
                  value={data.todayStatus ?? "Not marked"}
                  icon={<Wallet size={18} />}
                  accent="core"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h2 className="font-orbital text-lg font-medium text-nox-high mb-4">Fee reminders</h2>
                  {[...data.overdueFees, ...data.upcomingFees].length === 0 ? (
                    <NoxEmptyState title="You're all caught up" body="No pending fee installments right now." />
                  ) : (
                    <div className="nox-card divide-y divide-white/[0.06]">
                      {[...data.overdueFees, ...data.upcomingFees].map((f, i) => {
                        const isOverdue = data.overdueFees.includes(f);
                        return (
                          <div key={i} className="flex items-center justify-between px-5 py-4">
                            <div>
                              <div className="text-sm text-nox-high">Installment {f.installmentNumber}</div>
                              <div className="text-xs text-nox-low font-mono mt-0.5">
                                Due {new Date(f.dueDate).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-orbital text-sm font-semibold text-nox-high">
                                ₹{f.amount.toLocaleString("en-IN")}
                              </div>
                              <NoxStatusBadge status={isOverdue ? "overdue" : "pending"} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="font-orbital text-lg font-medium text-nox-high mb-4 flex items-center gap-2">
                    <MessageSquare size={17} className="text-core-400" />
                    Recent coach notes
                  </h2>
                  {data.recentRemarks.length === 0 ? (
                    <NoxEmptyState title="No notes yet" body="Coach feedback will appear here as it's added." />
                  ) : (
                    <div className="nox-card divide-y divide-white/[0.06]">
                      {data.recentRemarks.map((r) => (
                        <div key={r._id} className="px-5 py-4">
                          <div className="text-xs text-nox-low font-mono">
                            {new Date(r.date).toLocaleDateString()}
                          </div>
                          <p className="text-sm text-nox-mid mt-1">{r.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <Link to="/student/progress" className="nox-btn-secondary">
                  View full attendance &amp; performance
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default StudentDashboardPage;
