// src/features/guardian/GuardianChildDetailPage.tsx
import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  CalendarCheck,
  Wallet,
  TrendingUp,
  QrCode,
  Copy,
  FileText,
  Clock,
  MapPin,
  ExternalLink,
  CheckCircle2,
  X,
  Globe,
} from "lucide-react";
import QRCode from "react-qr-code";
import {
  useGetChildProfileQuery,
  useGetChildAttendanceQuery,
  useGetChildFeesQuery,
  useGetChildPerformanceQuery,
  useGetChildSessionsQuery,
  type GuardianChild,
} from "../../store/api/guardianApi";
import { useTogglePublicProfileMutation } from "../../store/api/consentApi";
import { NoxSkeleton, NoxEmptyState, NoxStatusBadge, NoxStatCard } from "../../components/portal-ui";

type Tab = "attendance" | "schedule" | "fees" | "performance";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "schedule", label: "Schedule & Events", icon: Clock },
  { id: "fees", label: "Fees", icon: Wallet },
  { id: "performance", label: "Performance", icon: TrendingUp },
];

const GuardianChildDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const studentId = id!;
  const [tab, setTab] = useState<Tab>("attendance");

  const { data: profile, isLoading: profileLoading } = useGetChildProfileQuery(studentId);

  const teamName = typeof profile?.teamId === "object" ? profile?.teamId?.name : undefined;

  return (
    <div>
      <Link
        to="/guardian/dashboard"
        className="inline-flex items-center gap-2 text-sm text-nox-mid hover:text-nox-high transition-colors mb-6"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>

      {profileLoading && <NoxSkeleton className="h-24 mb-8" />}

      {profile && (
        <div className="nox-card p-6 mb-8 flex flex-wrap items-center gap-5 justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-core-400/[0.12] text-core-400 font-orbital font-semibold text-lg">
              {profile.firstName.charAt(0)}
              {profile.lastName.charAt(0)}
            </span>
            <div>
              <h1 className="font-orbital text-xl font-semibold text-nox-high">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-sm text-nox-mid mt-0.5">
                {teamName ?? profile.ageGroup}
                {profile.position ? ` · ${profile.position}` : ""}
                {profile.jerseyNumber ? ` · #${profile.jerseyNumber}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <NoxStatCard label="Attendance" value={`${profile.attendancePercentage}%`} accent="ion" />
            <NoxStatCard label="Rating" value={profile.overallRating?.toFixed(1) ?? "—"} accent="plasma" />
          </div>
        </div>
      )}

      {profile && (
        <button
          onClick={() => window.open(`/students/${studentId}/report`, "_blank")}
          className="inline-flex items-center gap-2 text-xs text-core-400 hover:underline mb-8"
        >
          <FileText size={13} />
          Download full report (performance, attendance, fees)
        </button>
      )}

      {profile && <PublicProfileToggleCard studentId={studentId} profile={profile} />}

      <div className="flex gap-2 border-b border-white/[0.06] mb-6 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-core-400 text-core-400"
                  : "border-transparent text-nox-mid hover:text-nox-high"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "attendance" && <AttendanceTab studentId={studentId} />}
      {tab === "schedule" && <ScheduleTab studentId={studentId} />}
      {tab === "fees" && <FeesTab studentId={studentId} />}
      {tab === "performance" && <PerformanceTab studentId={studentId} />}
    </div>
  );
};

const PublicProfileToggleCard: React.FC<{ studentId: string; profile: GuardianChild }> = ({
  studentId,
  profile,
}) => {
  const [toggle, { isLoading }] = useTogglePublicProfileMutation();
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const initialSettings = profile.publicProfileSettings || {};
  const [settings, setSettings] = useState({
    showPhoto: initialSettings.showPhoto !== false,
    showPosition: initialSettings.showPosition !== false,
    showJerseyNumber: initialSettings.showJerseyNumber !== false,
    showAgeGroup: initialSettings.showAgeGroup !== false,
    showRating: initialSettings.showRating !== false,
    showTeam: initialSettings.showTeam !== false,
    bio: initialSettings.bio || "",
    preferredFoot: initialSettings.preferredFoot || "",
  });

  const enabled = !!profile.publicProfileEnabled;
  const publicUrl = profile.publicProfileToken
    ? `${window.location.origin}/players/${profile.publicProfileToken}`
    : null;

  const handleToggle = async () => {
    try {
      await toggle({ studentId, enabled: !enabled, settings }).unwrap();
      toast.success(enabled ? "Public player page disabled" : "Public player page enabled");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update this — try again");
    }
  };

  const handleSaveSettings = async () => {
    try {
      await toggle({ studentId, enabled: true, settings }).unwrap();
      toast.success("Public profile visibility settings saved!");
      setShowSettings(false);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to save settings");
    }
  };

  const handleCopy = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Public profile link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="nox-card p-5 mb-8 space-y-4 border-core-400/20 bg-gradient-to-r from-core-400/[0.03] to-transparent">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-core-400/[0.12] flex items-center justify-center flex-shrink-0">
            <Globe size={18} className="text-core-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-nox-high">Public Player Profile &amp; QR Code</p>
              <span className={`text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${
                enabled ? "bg-field-400/10 text-field-400" : "bg-white/10 text-slate-400"
              }`}>
                {enabled ? "Active" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-nox-mid mt-0.5 max-w-xl">
              Turn this on to share {profile.firstName}&apos;s verified public player card (ratings, match stats, and profile) with scouts and academy administrators.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
            enabled ? "bg-core-400" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && publicUrl && (
        <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 w-full sm:max-w-md">
            <code className="text-xs text-core-400 truncate flex-1 font-mono">{publicUrl}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
              title="Copy link"
            >
              {copied ? <CheckCircle2 size={14} className="text-field-400" /> : <Copy size={14} />}
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="nox-btn-secondary !py-2 !px-3 text-xs flex-1 sm:flex-initial"
            >
              {copied ? <CheckCircle2 size={13} className="text-field-400" /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy Link"}
            </button>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="nox-btn-secondary !py-2 !px-3 text-xs flex-1 sm:flex-initial"
            >
              <QrCode size={13} />
              Show QR
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="nox-btn-secondary !py-2 !px-3 text-xs flex-1 sm:flex-initial"
            >
              {showSettings ? "Close Settings" : "Visibility Settings"}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="nox-btn-primary !py-2 !px-3 text-xs flex-1 sm:flex-initial"
            >
              <ExternalLink size={13} />
              View Card
            </a>
          </div>
        </div>
      )}

      {/* Visibility Preferences & Academy Lock Notice */}
      {enabled && showSettings && (
        <div className="pt-4 border-t border-white/[0.08] space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="font-orbital text-xs font-semibold uppercase tracking-wider text-nox-high">
              Public Profile Visibility Controls
            </h4>
            <span className="text-[11px] text-nox-low">Select what data can be viewed publicly</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: "showPhoto", label: "Show Photo / Avatar" },
              { key: "showPosition", label: "Show Playing Position" },
              { key: "showJerseyNumber", label: "Show Jersey Number" },
              { key: "showAgeGroup", label: "Show Age Category" },
              { key: "showRating", label: "Show Player Rating" },
              { key: "showTeam", label: "Show Academy / Squad" },
            ].map(({ key, label }) => {
              const active = (settings as any)[key] !== false;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSettings((s) => ({ ...s, [key]: !active }))}
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

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                Player Statement / Bio (Optional)
              </label>
              <textarea
                value={settings.bio}
                onChange={(e) => setSettings((s) => ({ ...s, bio: e.target.value }))}
                placeholder="Write a brief intro or scout statement for this player..."
                rows={2}
                maxLength={300}
                className="input text-xs w-full resize-none"
              />
            </div>
            <div>
              <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                Preferred Foot
              </label>
              <select
                value={settings.preferredFoot}
                onChange={(e) => setSettings((s) => ({ ...s, preferredFoot: e.target.value }))}
                className="input text-xs w-full"
              >
                <option value="">Unspecified</option>
                <option value="right">Right</option>
                <option value="left">Left</option>
                <option value="both">Both (Ambidextrous)</option>
              </select>
            </div>
          </div>

          {/* Academy Verified Record Notice */}
          <div className="p-3.5 rounded-xl bg-amber-400/[0.06] border border-amber-400/20 flex items-start gap-3">
            <span className="text-amber-400 text-sm font-bold">🔒</span>
            <div>
              <p className="text-xs font-semibold text-amber-300">
                Official Academy Roster Player · Data Locked
              </p>
              <p className="text-[11px] text-nox-low mt-0.5 leading-relaxed">
                Core student information (Legal Name, Date of Birth, Squad assignment, Jersey #) is verified and administered directly by the academy coaching staff. Directly editing these official roster records is prohibited. If any player details need correction, please contact your academy coach or manager.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="nox-btn-secondary !py-2 !px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isLoading}
              className="nox-btn-primary !py-2 !px-4 text-xs"
            >
              {isLoading ? "Saving…" : "Save Visibility Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Interactive QR Code Modal */}
      {showQrModal && publicUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="nox-card max-w-sm w-full p-6 text-center relative border-core-400/30">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-nox-mid hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center justify-center gap-2 text-core-400 font-mono text-2xs uppercase tracking-wider mb-2">
              <Globe size={12} /> Verified Player ID
            </div>
            <h3 className="font-orbital font-bold text-lg text-nox-high mb-1">
              {profile.firstName} {profile.lastName}
            </h3>
            <p className="text-xs text-nox-mid mb-5">
              Scan this QR code to view the public verified player card and stats.
            </p>

            <div className="bg-white p-4 rounded-xl inline-block shadow-xl border border-slate-200 mb-5">
              <QRCode value={publicUrl} size={180} />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCopy}
                className="nox-btn-secondary w-full text-xs justify-center py-2.5"
              >
                {copied ? <CheckCircle2 size={14} className="text-field-400" /> : <Copy size={14} />}
                {copied ? "Link Copied to Clipboard" : "Copy Profile Link"}
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full text-xs text-slate-400 hover:text-white py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AttendanceTab: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { data, isLoading } = useGetChildAttendanceQuery({ studentId });

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!data || data.records.length === 0) {
    return (
      <NoxEmptyState title="No attendance records yet" body="Sessions will appear here once marked by a coach." />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <NoxStatCard label="Present" value={data.summary.present} accent="ion" />
        <NoxStatCard label="Absent" value={data.summary.absent} accent="core" />
        <NoxStatCard label="Late" value={data.summary.late} accent="plasma" />
        <NoxStatCard label="Rate" value={`${data.summary.percentage}%`} accent="ion" />
      </div>
      <div className="nox-card divide-y divide-white/[0.06]">
        {data.records.map((r) => (
          <div key={r._id} className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm text-nox-high">
                {new Date(r.sessionDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              {r.remarks && <div className="text-xs text-nox-low mt-0.5">{r.remarks}</div>}
            </div>
            <NoxStatusBadge status={r.status} />
          </div>
        ))}
      </div>
    </div>
  );
};

const ScheduleTab: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { data: sessions, isLoading } = useGetChildSessionsQuery(studentId);

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!sessions || sessions.length === 0) {
    return (
      <NoxEmptyState
        title="No scheduled events or sessions yet"
        body="Upcoming training sessions, matches, and batch schedules will appear here once planned by the coaches."
      />
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((s) => (
        <div
          key={s.id}
          className="nox-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-core-400/30 transition-colors"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-core-400/10 text-core-400 font-semibold">
                {s.type}
              </span>
              <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-400">
                {s.targetType === "batch"
                  ? "Custom Batch"
                  : s.targetType === "category"
                  ? s.category || "Category"
                  : s.teamName || "Team"}
              </span>
              <NoxStatusBadge status={s.status} />
            </div>
            <h4 className="font-orbital text-sm font-semibold text-nox-high">
              {s.notes || `${s.type.charAt(0).toUpperCase() + s.type.slice(1)} Session`}
            </h4>
            <div className="flex flex-wrap items-center gap-4 text-xs text-nox-mid pt-1">
              <span className="flex items-center gap-1.5">
                <CalendarCheck size={13} className="text-core-400" />
                {new Date(s.date).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-core-400" />
                {s.startTime} - {s.endTime}
              </span>
              {s.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-core-400" />
                  {s.location} {s.fieldNumber ? `(Field ${s.fieldNumber})` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const FeesTab: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { data, isLoading } = useGetChildFeesQuery(studentId);

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!data || data.length === 0) {
    return <NoxEmptyState title="No fee records yet" body="Fee plans set up by your academy will appear here." />;
  }

  return (
    <div className="space-y-5">
      {data.map((fee) => (
        <div key={fee._id} className="nox-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-orbital text-sm font-medium text-nox-high capitalize">
                {fee.feeType.replace("_", " ")}
              </div>
              <div className="text-xs text-nox-low font-mono mt-0.5">
                ₹{fee.finalAmount.toLocaleString("en-IN")} total
              </div>
            </div>
            <NoxStatusBadge status={fee.overallStatus} />
          </div>
          <div className="space-y-2">
            {fee.installments.map((inst) => (
              <div
                key={inst.installmentNumber}
                className="flex items-center justify-between text-sm bg-white/[0.02] rounded-lg px-3 py-2.5"
              >
                <span className="text-nox-mid">
                  Installment {inst.installmentNumber} · due{" "}
                  {new Date(inst.dueDate).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-nox-high font-mono">
                    ₹{inst.paidAmount.toLocaleString("en-IN")} / ₹{inst.amount.toLocaleString("en-IN")}
                  </span>
                  <NoxStatusBadge status={inst.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const PerformanceTab: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { data, isLoading } = useGetChildPerformanceQuery(studentId);

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!data || data.length === 0) {
    return (
      <NoxEmptyState
        title="No performance records yet"
        body="Coach assessments and session notes will show up here as they're added."
      />
    );
  }

  return (
    <div className="nox-card divide-y divide-white/[0.06]">
      {data.map((p) => (
        <div key={p._id} className="px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nox-high">
              {new Date(p.createdAt).toLocaleDateString()}
            </span>
            {typeof p.overallRating === "number" && (
              <span className="font-orbital text-sm font-semibold text-core-400">
                {p.overallRating.toFixed(1)}
              </span>
            )}
          </div>
          {p.notes && <p className="text-xs text-nox-mid mt-1.5">{String(p.notes)}</p>}
        </div>
      ))}
    </div>
  );
};

export default GuardianChildDetailPage;