import React, { useState, useMemo, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useHighlightEffect } from "../../hooks/useEntityHighlight";
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
  Lock,
  Check,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Filter,
  Receipt,
  Download,
  AlertTriangle,
  User,
  Award,
} from "lucide-react";
import QRCode from "react-qr-code";
import { PayFeeModal } from "./PayFeeModal";
import { FeeReceiptModal } from "./FeeReceiptModal";
import { formatCurrency } from "../../utils/currency";
import { computeMajorAndSubmetricSkills } from "../students/skillMetricsHelper";
import {
  useGetChildProfileQuery,
  useGetChildAttendanceQuery,
  useGetChildFeesQuery,
  useGetChildPerformanceQuery,
  useGetChildRemarksQuery,
  useGetChildSessionsQuery,
  type GuardianChild,
} from "../../store/api/guardianApi";
import { useTogglePublicProfileMutation } from "../../store/api/consentApi";
import {
  NoxSkeleton,
  NoxEmptyState,
  NoxStatusBadge,
  NoxStatCard,
} from "../../components/portal-ui";
import { Select, getMapsLink } from "../../components/ui";

type Tab = "attendance" | "schedule" | "fees" | "performance";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "schedule", label: "Schedule & Events", icon: Clock },
  { id: "fees", label: "Fees", icon: Wallet },
  { id: "performance", label: "Performance", icon: TrendingUp },
];

const PaginationControls: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  totalItems: number;
  itemName: string;
}> = ({ currentPage, totalPages, onPageChange, totalItems, itemName }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-pitch-200/50 dark:border-white/[0.06] text-xs text-nox-mid">
      <span className="font-mono text-2xs">
        Showing page {currentPage} of {totalPages} ({totalItems} {itemName})
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-lg border border-pitch-200 dark:border-white/10 bg-pitch-100 dark:bg-white/[0.04] text-nox-high disabled:opacity-30 disabled:cursor-not-allowed hover:bg-pitch-200 dark:hover:bg-white/10 transition-colors"
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="px-2 py-0.5 rounded font-mono text-2xs font-semibold bg-core-400/10 text-core-400">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-lg border border-pitch-200 dark:border-white/10 bg-pitch-100 dark:bg-white/[0.04] text-nox-high disabled:opacity-30 disabled:cursor-not-allowed hover:bg-pitch-200 dark:hover:bg-white/10 transition-colors"
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

const GuardianChildDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const studentId = id!;
  const queryTab = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    queryTab && ["attendance", "schedule", "fees", "performance"].includes(queryTab)
      ? queryTab
      : "attendance"
  );

  useEffect(() => {
    const t = searchParams.get("tab") as Tab | null;
    if (t && ["attendance", "schedule", "fees", "performance"].includes(t)) {
      setTab(t);
    }
  }, [searchParams]);

  useHighlightEffect();

  const { data: profile, isLoading: profileLoading } =
    useGetChildProfileQuery(studentId);

  const teamName =
    typeof profile?.teamId === "object" ? profile?.teamId?.name : undefined;

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
        <div className="nox-card p-4 sm:p-6 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full md:w-auto">
            <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-core-400/[0.12] text-core-400 font-orbital font-semibold text-base sm:text-lg shrink-0">
              {profile.firstName.charAt(0)}
              {profile.lastName.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-orbital text-lg sm:text-xl font-semibold text-nox-high truncate">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-xs sm:text-sm text-nox-mid mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium text-nox-high">{teamName ?? profile.ageGroup}</span>
                {profile.position && <span>· {profile.position}</span>}
                {profile.jerseyNumber && <span>· #{profile.jerseyNumber}</span>}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0">
            <NoxStatCard
              label="Attendance"
              value={`${profile.attendancePercentage}%`}
              accent="ion"
            />
            <NoxStatCard
              label="Rating"
              value={profile.overallRating?.toFixed(1) ?? "—"}
              accent="plasma"
            />
          </div>
        </div>
      )}

      {profile && (
        <button
          onClick={() => window.open(`/students/${studentId}/report`, "_blank")}
          className="inline-flex items-center gap-2 text-xs text-core-400 hover:underline mb-6"
        >
          <FileText size={13} />
          Download full report (performance, attendance, fees)
        </button>
      )}

      {profile && (
        <PublicProfileToggleCard studentId={studentId} profile={profile} />
      )}

      <div className="flex gap-2 border-b border-pitch-200/60 dark:border-white/[0.06] mb-6 overflow-x-auto no-scrollbar flex-nowrap -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-core-400 text-core-400 font-semibold"
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
      {tab === "fees" && (
        <FeesTab
          studentId={studentId}
          studentName={
            profile ? `${profile.firstName} ${profile.lastName}` : undefined
          }
        />
      )}
      {tab === "performance" && <PerformanceTab studentId={studentId} />}
    </div>
  );
};

const PublicProfileToggleCard: React.FC<{
  studentId: string;
  profile: GuardianChild;
}> = ({ studentId, profile }) => {
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
      toast.success(
        enabled ? "Public player page disabled" : "Public player page enabled",
      );
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
    <div className="nox-card p-4 sm:p-5 mb-8 space-y-4 border-core-400/20 bg-gradient-to-r from-core-400/[0.03] to-transparent overflow-hidden">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-core-400/[0.12] flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
            <Globe size={18} className="text-core-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <p className="text-sm font-semibold text-nox-high">
                Public Player Profile &amp; QR Code
              </p>
              <span
                className={`text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                  enabled
                    ? "bg-field-400/10 text-field-400"
                    : "bg-white/10 text-slate-400"
                }`}
              >
                {enabled ? "Active" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-nox-mid mt-1 sm:mt-0.5 max-w-xl leading-relaxed">
              Turn this on to share {profile.firstName}&apos;s verified public
              player card (ratings, match stats, and profile) with scouts and
              academy administrators.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-volt-400 focus:ring-offset-2 dark:focus:ring-offset-pitch-900 mt-1 sm:mt-0 ${
            enabled ? "bg-volt-400" : "bg-slate-300 dark:bg-pitch-700"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled && publicUrl && (
        <div className="pt-3 border-t border-white/[0.06] flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 w-full xl:max-w-md min-w-0">
            <code className="text-xs text-core-400 truncate flex-1 font-mono select-all">
              {publicUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex-shrink-0 p-1 rounded hover:bg-white/[0.06]"
              title="Copy link"
            >
              {copied ? (
                <CheckCircle2 size={15} className="text-field-400" />
              ) : (
                <Copy size={15} />
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 xl:flex xl:items-center gap-2 w-full xl:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="nox-btn-secondary !py-2 !px-3 text-xs w-full xl:w-auto justify-center"
            >
              {copied ? (
                <CheckCircle2 size={13} className="text-field-400 shrink-0" />
              ) : (
                <Copy size={13} className="shrink-0" />
              )}
              <span className="truncate">{copied ? "Copied" : "Copy Link"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="nox-btn-secondary !py-2 !px-3 text-xs w-full xl:w-auto justify-center"
            >
              <QrCode size={13} className="shrink-0" />
              <span className="truncate">Show QR</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="nox-btn-secondary !py-2 !px-3 text-xs w-full xl:w-auto justify-center"
            >
              <span className="truncate">
                {showSettings ? "Close Settings" : "Visibility"}
                <span className="hidden sm:inline"> Settings</span>
              </span>
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="nox-btn-primary !py-2 !px-3 text-xs w-full xl:w-auto justify-center"
            >
              <ExternalLink size={13} className="shrink-0" />
              <span className="truncate">View Card</span>
            </a>
          </div>
        </div>
      )}

      {/* Visibility Preferences & Academy Lock Notice */}
      {enabled && showSettings && (
        <div className="pt-4 border-t border-white/[0.08] space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
            <h4 className="font-orbital text-xs font-semibold uppercase tracking-wider text-nox-high">
              Public Profile Visibility Controls
            </h4>
            <span className="text-[11px] text-nox-low">
              Select what data can be viewed publicly
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
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
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border text-left text-xs transition-all ${
                    active
                      ? "bg-core-400/10 border-core-400/40 text-nox-high font-semibold"
                      : "bg-white/[0.02] border-white/[0.06] text-nox-low hover:text-nox-mid"
                  }`}
                >
                  <span className="min-w-0 pr-2 leading-snug">{label}</span>
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] shrink-0 ${
                      active
                        ? "bg-core-400 border-core-400 text-pitch-950 font-bold"
                        : "border-white/20 bg-transparent"
                    }`}
                  >
                    {active && (
                      <Check size={11} className="text-pitch-950 stroke-[3]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-2xs uppercase tracking-wider text-nox-low font-mono block mb-1">
                Player Statement / Bio (Optional)
              </label>
              <textarea
                value={settings.bio}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, bio: e.target.value }))
                }
                placeholder="Write a brief intro or scout statement for this player..."
                rows={2}
                maxLength={300}
                className="input text-xs w-full resize-none"
              />
            </div>
            <div>
              <Select
                label="Preferred Foot"
                value={settings.preferredFoot}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, preferredFoot: e.target.value }))
                }
              >
                <option value="">Unspecified</option>
                <option value="right">Right</option>
                <option value="left">Left</option>
                <option value="both">Both (Ambidextrous)</option>
              </Select>
            </div>
          </div>

          {/* Academy Verified Record Notice */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-amber-400/[0.06] border border-amber-400/20 flex items-start gap-2.5 sm:gap-3">
            <Lock size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-amber-300">
                Official Academy Roster Player · Data Locked
              </p>
              <p className="text-[11px] text-nox-low mt-0.5 leading-relaxed">
                Core student information (Legal Name, Date of Birth, Squad
                assignment, Jersey #) is verified and administered directly by
                the academy coaching staff. Directly editing these official
                roster records is prohibited. If any player details need
                correction, please contact your academy coach or manager.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="nox-btn-secondary !py-2 !px-4 text-xs w-full sm:w-auto justify-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isLoading}
              className="nox-btn-primary !py-2 !px-4 text-xs w-full sm:w-auto justify-center"
            >
              {isLoading ? "Saving…" : "Save Visibility Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Interactive QR Code Modal */}
      {showQrModal && publicUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="nox-card max-w-sm w-full p-5 sm:p-6 text-center relative border-core-400/30 max-h-[92vh] overflow-y-auto my-auto">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 text-nox-mid hover:text-slate-900 dark:hover:text-white transition-colors p-1"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center justify-center gap-2 text-core-400 font-mono text-2xs uppercase tracking-wider mb-2">
              <Globe size={12} /> Verified Player ID
            </div>
            <h3 className="font-orbital font-bold text-base sm:text-lg text-nox-high mb-1 break-words">
              {profile.firstName} {profile.lastName}
            </h3>
            <p className="text-xs text-nox-mid mb-4 sm:mb-5 leading-relaxed">
              Scan this QR code to view the public verified player card and
              stats.
            </p>

            <div className="bg-white p-3 sm:p-4 rounded-xl inline-block shadow-xl border border-slate-200 mb-4 sm:mb-5 max-w-[210px] w-full">
              <div className="w-full flex items-center justify-center">
                <QRCode
                  value={publicUrl}
                  size={180}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  viewBox="0 0 256 256"
                />
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCopy}
                className="nox-btn-secondary w-full text-xs justify-center py-2.5"
              >
                {copied ? (
                  <CheckCircle2 size={14} className="text-field-400 shrink-0" />
                ) : (
                  <Copy size={14} className="shrink-0" />
                )}
                <span>
                  {copied ? "Link Copied to Clipboard" : "Copy Profile Link"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white py-2"
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
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlightId");
  const { data, isLoading } = useGetChildAttendanceQuery({ studentId });
  const [filterStatus, setFilterStatus] = useState<
    "all" | "present" | "absent" | "late"
  >("all");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const filteredRecords = (data?.records || []).filter((r) => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus;
  });

  useEffect(() => {
    if (!highlightId || !filteredRecords.length) return;
    const idx = filteredRecords.findIndex(
      (r) => r._id === highlightId || (r as any).sessionId === highlightId
    );
    if (idx !== -1) {
      setPage(Math.floor(idx / ITEMS_PER_PAGE) + 1);
    }
  }, [highlightId, filteredRecords.length]);

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!data || data.records.length === 0) {
    return (
      <NoxEmptyState
        title="No attendance records yet"
        body="Sessions will appear here once marked by a coach."
      />
    );
  }

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const pagedRecords = filteredRecords.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <NoxStatCard
          label="Present"
          value={data.summary.present}
          accent="ion"
        />
        <NoxStatCard label="Absent" value={data.summary.absent} accent="core" />
        <NoxStatCard label="Late" value={data.summary.late} accent="plasma" />
        <NoxStatCard
          label="Rate"
          value={`${data.summary.percentage}%`}
          accent="ion"
        />
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] p-2 rounded-xl border border-pitch-200/50 dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(["all", "present", "absent", "late"] as const).map((status) => {
            const count =
              status === "all"
                ? data.records.length
                : data.records.filter((r) => r.status === status).length;
            const active = filterStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setFilterStatus(status);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all flex items-center gap-1.5 ${
                  active
                    ? "bg-pitch-900 text-white dark:bg-white dark:text-pitch-950 font-semibold shadow-sm"
                    : "text-nox-mid hover:text-nox-high"
                }`}
              >
                <span>{status}</span>
                <span className="text-2xs font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-nox-mid">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <span className="text-2xs font-mono text-nox-low px-2">
          {filteredRecords.length} record{filteredRecords.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Attendance Log Card */}
      {filteredRecords.length === 0 ? (
        <div className="py-8 text-center nox-card">
          <p className="text-sm text-nox-mid">No records match the selected filter.</p>
        </div>
      ) : (
        <div className="nox-card divide-y divide-pitch-200/50 dark:divide-white/[0.06] overflow-hidden">
          {pagedRecords.map((r) => (
            <div
              key={r._id}
              id={`entity-${(r as any).sessionId || r._id}`}
              data-highlight-id={(r as any).sessionId || r._id}
              className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.01] transition-colors"
            >
              <div>
                <div className="text-sm font-medium text-nox-high">
                  {new Date(r.sessionDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                {r.remarks && (
                  <div className="text-xs text-nox-mid mt-0.5">{r.remarks}</div>
                )}
              </div>
              <NoxStatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}

      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={filteredRecords.length}
        itemName="records"
      />
    </div>
  );
};

const ScheduleTab: React.FC<{ studentId: string }> = ({ studentId }) => {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlightId");
  const { data: sessions, isLoading } = useGetChildSessionsQuery(studentId);
  const [activeView, setActiveView] = useState<"upcoming" | "past">("upcoming");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const isUpcoming = (s: any) => {
    if (s.status === "completed" || s.status === "cancelled") {
      return false;
    }
    return (s.date || "") >= todayStr;
  };

  const upcomingSessions = (sessions || []).filter(isUpcoming);
  const pastSessions = (sessions || []).filter((s: any) => !isUpcoming(s));

  useEffect(() => {
    if (!highlightId || !sessions) return;
    const inUpcoming = upcomingSessions.findIndex((s: any) => (s.id || s._id) === highlightId);
    if (inUpcoming !== -1) {
      setActiveView("upcoming");
      setPage(Math.floor(inUpcoming / ITEMS_PER_PAGE) + 1);
      return;
    }
    const inPast = pastSessions.findIndex((s: any) => (s.id || s._id) === highlightId);
    if (inPast !== -1) {
      setActiveView("past");
      setPage(Math.floor(inPast / ITEMS_PER_PAGE) + 1);
      return;
    }
  }, [highlightId, sessions]);

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!sessions || sessions.length === 0) {
    return (
      <NoxEmptyState
        title="No scheduled events or sessions yet"
        body="Upcoming training sessions, matches, and batch schedules will appear here once planned by the coaches."
      />
    );
  }

  const activeList = activeView === "upcoming" ? upcomingSessions : pastSessions;
  const totalPages = Math.ceil(activeList.length / ITEMS_PER_PAGE);
  const pagedList = activeList.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const renderSessionCard = (s: any) => (
    <div
      key={s.id || s._id}
      id={`entity-${s.id || s._id}`}
      data-highlight-id={s.id || s._id}
      className="nox-card p-4 sm:p-5 flex flex-col justify-between gap-3.5 hover:border-core-400/30 transition-all rounded-2xl"
    >
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-core-400/10 text-core-600 dark:text-core-400 font-semibold border border-core-400/20">
            {s.type}
          </span>
          <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-transparent">
            {s.targetType === "batch"
              ? "Custom Batch"
              : s.targetType === "category"
                ? s.category || "Category"
                : s.teamName || (typeof s.teamId === "object" ? s.teamId?.name : undefined) || "Team"}
          </span>
          {s.attendanceStatus ? (
            <NoxStatusBadge status={s.attendanceStatus} />
          ) : (
            <NoxStatusBadge status={s.status} />
          )}
        </div>
        <h4 className="font-orbital text-sm sm:text-base font-bold text-slate-900 dark:text-nox-high">
          {s.notes ||
            `${s.type.charAt(0).toUpperCase() + s.type.slice(1)} Session`}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-nox-mid pt-1">
          <div className="flex items-center gap-1.5">
            <CalendarCheck size={13} className="text-core-500 shrink-0" />
            <span>
              {new Date((s.date || "") + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono font-medium text-slate-900 dark:text-white">
            <Clock size={13} className="text-core-500 shrink-0" />
            <span>{s.startTime} - {s.endTime}</span>
          </div>
          {s.coachName && (
            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <User size={13} className="text-core-500 shrink-0" />
              <span>Coach: {s.coachName}</span>
            </div>
          )}
          {s.location && (
            <div className="flex items-center gap-1.5 sm:col-span-2">
              <MapPin size={13} className="text-core-500 shrink-0" />
              <span>
                {s.location} {s.fieldNumber ? `(Field ${s.fieldNumber})` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {(() => {
        const mapsUrl = getMapsLink({
          googleMapsUrl: s.googleMapsUrl,
          latitude: s.latitude,
          longitude: s.longitude,
          location: s.location,
          fieldNumber: s.fieldNumber,
        });
        return mapsUrl ? (
          <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06]">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-volt-800 dark:text-volt-300 hover:underline px-3 py-1.5 rounded-xl bg-volt-400/15 border border-volt-400/30 transition-all cursor-pointer"
              title="Open venue in Google Maps"
            >
              <MapPin size={12} className="text-volt-600 dark:text-volt-400" />
              <span>Open in Google Maps</span>
              <ExternalLink size={10} />
            </a>
          </div>
        ) : null;
      })()}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Sub-view switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] p-2 rounded-xl border border-pitch-200/50 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveView("upcoming");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeView === "upcoming"
                ? "bg-pitch-900 text-white dark:bg-white dark:text-pitch-950 font-semibold shadow-sm"
                : "text-nox-mid hover:text-nox-high"
            }`}
          >
            <Clock size={13} />
            <span>Upcoming Sessions</span>
            <span className="text-2xs font-mono px-1.5 py-0.2 rounded-full bg-white/10 font-bold">
              {upcomingSessions.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView("past");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeView === "past"
                ? "bg-pitch-900 text-white dark:bg-white dark:text-pitch-950 font-semibold shadow-sm"
                : "text-nox-mid hover:text-nox-high"
            }`}
          >
            <CalendarCheck size={13} />
            <span>Sessions Attended</span>
            <span className="text-2xs font-mono px-1.5 py-0.2 rounded-full bg-white/10 font-bold">
              {pastSessions.length}
            </span>
          </button>
        </div>
        <span className="text-2xs font-mono text-nox-low px-2">
          {activeList.length} total
        </span>
      </div>

      {activeList.length === 0 ? (
        <NoxEmptyState
          title={activeView === "upcoming" ? "No upcoming sessions" : "No sessions attended yet"}
          body={
            activeView === "upcoming"
              ? "All upcoming sessions scheduled by coaches will appear here."
              : "Past attended sessions will show here once coaches mark attendance."
          }
        />
      ) : (
        <div className="space-y-3">
          {pagedList.map(renderSessionCard)}
        </div>
      )}

      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={activeList.length}
        itemName="sessions"
      />
    </div>
  );
};

const FeesTab: React.FC<{ studentId: string; studentName?: string }> = ({
  studentId,
  studentName,
}) => {
  const { data, isLoading, refetch } = useGetChildFeesQuery(studentId);
  const [filter, setFilter] = useState<"all" | "action_required" | "paid">("all");
  const [selectedFeeForPayment, setSelectedFeeForPayment] = useState<{
    feeId: string;
    installmentNumber: number;
    amount: number;
    dueDate: string;
    feeType: string;
    currency?: string;
  } | null>(null);

  const [receiptToView, setReceiptToView] = useState<{
    fee: any;
    installment: any;
  } | null>(null);

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!data || data.length === 0) {
    return (
      <NoxEmptyState
        title="No fee records yet"
        body="Fee plans set up by your academy will appear here."
      />
    );
  }

  // Weight function to prioritize overdue and pending verification on top
  const getInstUrgencyWeight = (inst: any) => {
    const isOverdue =
      inst.status === "overdue" ||
      (inst.status !== "paid" &&
        inst.status !== "refunded" &&
        inst.amount > inst.paidAmount &&
        new Date(inst.dueDate).getTime() < Date.now());

    if (isOverdue) return 1;
    if (inst.status === "pending_verification") return 2;
    if (inst.status === "pending") return 3;
    if (inst.status === "paid") return 4;
    return 5;
  };

  // Sort and process fee plans
  const sortedAndFilteredFees = data
    .map((fee) => {
      // Sort installments within plan: overdue & pending verification on top!
      const sortedInstallments = [...fee.installments].sort((a, b) => {
        const weightA = getInstUrgencyWeight(a);
        const weightB = getInstUrgencyWeight(b);
        if (weightA !== weightB) return weightA - weightB;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      return {
        ...fee,
        installments: sortedInstallments,
      };
    })
    .sort((feeA, feeB) => {
      // Prioritize fee plans that have overdue or pending_verification installments
      const minWeightA = Math.min(...feeA.installments.map(getInstUrgencyWeight));
      const minWeightB = Math.min(...feeB.installments.map(getInstUrgencyWeight));
      return minWeightA - minWeightB;
    })
    .filter((fee) => {
      if (filter === "all") return true;
      if (filter === "action_required") {
        return fee.installments.some((i) => getInstUrgencyWeight(i) <= 3);
      }
      if (filter === "paid") {
        return fee.installments.some((i) => i.status === "paid");
      }
      return true;
    });

  return (
    <div className="space-y-6">
      {/* Filter and sorting pill bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] p-2 rounded-xl border border-pitch-200/50 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === "all"
                ? "bg-pitch-900 text-white dark:bg-white dark:text-pitch-950 font-semibold shadow-sm"
                : "text-nox-mid hover:text-nox-high"
            }`}
          >
            All Fee Plans ({data.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("action_required")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              filter === "action_required"
                ? "bg-pitch-900 text-white dark:bg-white dark:text-pitch-950 font-semibold shadow-sm"
                : "text-nox-mid hover:text-nox-high"
            }`}
          >
            <AlertTriangle size={12} className="text-amber-400" />
            <span>Overdue &amp; Pending First</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("paid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === "paid"
                ? "bg-pitch-900 text-white dark:bg-white dark:text-pitch-950 font-semibold shadow-sm"
                : "text-nox-mid hover:text-nox-high"
            }`}
          >
            Paid / Cleared
          </button>
        </div>
        <span className="text-2xs font-mono text-core-400 font-semibold">
          Sorted: Overdue &amp; Pending on top
        </span>
      </div>

      {sortedAndFilteredFees.length === 0 ? (
        <div className="py-8 text-center nox-card">
          <p className="text-sm text-nox-mid">No fee plans match the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedAndFilteredFees.map((fee) => {
            const feeCurrency = (fee as any).currency || "INR";
            return (
              <div
                key={fee._id}
                id={`entity-${fee._id}`}
                data-highlight-id={fee._id}
                className="nox-card p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-pitch-200/50 dark:border-white/[0.06] pb-3">
                  <div>
                    <div className="font-orbital text-sm font-semibold text-nox-high capitalize">
                      {fee.feeType.replace("_", " ")}
                    </div>
                    <div className="text-xs text-nox-low font-mono mt-0.5">
                      {formatCurrency(fee.finalAmount, feeCurrency)} total ·{" "}
                      {fee.installments.length} installment{fee.installments.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <NoxStatusBadge status={fee.overallStatus} />
                </div>

                <div className="space-y-2">
                  {fee.installments.map((inst) => {
                    const remaining = inst.amount - inst.paidAmount;
                    const isPendingVerif = inst.status === "pending_verification";
                    const isPaid = inst.status === "paid" || remaining <= 0;
                    const isOverdue =
                      inst.status === "overdue" ||
                      (!isPaid &&
                        !isPendingVerif &&
                        new Date(inst.dueDate).getTime() < Date.now());

                    const canPay = !isPaid && !isPendingVerif && remaining > 0;

                    return (
                      <div
                        key={inst.installmentNumber}
                        id={`entity-${fee._id}-${inst.installmentNumber}`}
                        data-highlight-id={`${fee._id}-${inst.installmentNumber}`}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between text-sm rounded-xl p-3.5 sm:p-4 gap-3 border transition-all ${
                          isOverdue
                            ? "bg-rose-500/[0.05] border-rose-500/40 dark:bg-rose-950/[0.15]"
                            : isPendingVerif
                              ? "bg-blue-500/[0.05] border-blue-500/40 dark:bg-blue-950/[0.15]"
                              : isPaid
                                ? "bg-slate-50 border-slate-200/80 dark:bg-white/[0.02] dark:border-white/[0.05]"
                                : "bg-amber-500/[0.05] border-amber-500/30 dark:bg-amber-950/[0.12]"
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-nox-high text-xs">
                              Installment #{inst.installmentNumber}
                            </span>
                            {isOverdue && (
                              <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold">
                                Overdue
                              </span>
                            )}
                            {isPendingVerif && (
                              <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">
                                Under Verification
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-nox-mid font-mono">
                            Due {new Date(inst.dueDate).toLocaleDateString()}
                            {inst.paidAt && (
                              <span className="text-field-500 dark:text-field-400 ml-2">
                                · Paid on {new Date(inst.paidAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-nox-high font-mono text-sm font-semibold">
                              {formatCurrency(inst.paidAmount, feeCurrency)} / {formatCurrency(inst.amount, feeCurrency)}
                            </span>
                          </div>

                          {isPendingVerif && (
                            <div className="text-2xs text-blue-400 font-mono px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                              Proof Under Review
                            </div>
                          )}

                          {isPaid && (
                            <button
                              type="button"
                              onClick={() =>
                                setReceiptToView({
                                  fee,
                                  installment: inst,
                                })
                              }
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-pitch-100 hover:bg-pitch-200 dark:bg-white/10 dark:hover:bg-white/15 text-nox-high border border-pitch-200 dark:border-white/10 transition-colors"
                              title="View official digital receipt"
                            >
                              <Receipt size={13} className="text-core-400" />
                              <span>Receipt</span>
                            </button>
                          )}

                          {canPay && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedFeeForPayment({
                                  feeId: fee._id,
                                  installmentNumber: inst.installmentNumber,
                                  amount: remaining,
                                  dueDate: inst.dueDate,
                                  feeType: fee.feeType,
                                  currency: feeCurrency,
                                })
                              }
                              className={`nox-btn-primary !py-1 !px-3 text-xs flex items-center gap-1.5 shadow-sm font-bold ${
                                isOverdue
                                  ? "!bg-volt-400 hover:!bg-volt-300 !text-pitch-950 dark:!text-pitch-950"
                                  : "!bg-volt-400 hover:!bg-volt-300 !text-pitch-950 dark:!text-pitch-950"
                              }`}
                            >
                              <CreditCard size={13} className="text-pitch-950" />
                              <span className="text-pitch-950 font-bold">
                                {isOverdue ? "Pay Overdue Fee" : "Pay Fee"}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedFeeForPayment && (
        <PayFeeModal
          feeId={selectedFeeForPayment.feeId}
          installmentNumber={selectedFeeForPayment.installmentNumber}
          studentId={studentId}
          studentName={studentName}
          feeType={selectedFeeForPayment.feeType}
          amount={selectedFeeForPayment.amount}
          dueDate={selectedFeeForPayment.dueDate}
          currency={selectedFeeForPayment.currency}
          onClose={() => setSelectedFeeForPayment(null)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}

      {receiptToView && (
        <FeeReceiptModal
          studentName={studentName || "Academy Student"}
          feeType={receiptToView.fee.feeType}
          installmentNumber={receiptToView.installment.installmentNumber}
          amountPaid={receiptToView.installment.paidAmount}
          totalAmount={receiptToView.installment.amount}
          currency={receiptToView.fee.currency || "INR"}
          paymentMethod={receiptToView.installment.paymentMethod}
          transactionId={receiptToView.installment.receiptNumber}
          paidAt={receiptToView.installment.paidAt}
          receiptNumber={receiptToView.installment.receiptNumber}
          receiptUrl={`/api/fees/${receiptToView.fee._id}/receipt`}
          onClose={() => setReceiptToView(null)}
        />
      )}
    </div>
  );
};

const PerformanceTab: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { data: performanceRecords, isLoading: loadingPerformance } =
    useGetChildPerformanceQuery(studentId);
  const { data: remarks, isLoading: loadingRemarks } =
    useGetChildRemarksQuery(studentId);

  const [remarksPage, setRemarksPage] = useState(1);
  const [perfPage, setPerfPage] = useState(1);

  const REMARKS_PER_PAGE = 4;
  const PERF_PER_PAGE = 3;

  if (loadingPerformance || loadingRemarks)
    return <NoxSkeleton className="h-64" />;

  const totalRemarksPages = Math.ceil((remarks?.length ?? 0) / REMARKS_PER_PAGE);
  const pagedRemarks = (remarks ?? []).slice(
    (remarksPage - 1) * REMARKS_PER_PAGE,
    remarksPage * REMARKS_PER_PAGE,
  );

  const totalPerfPages = Math.ceil(
    (performanceRecords?.length ?? 0) / PERF_PER_PAGE,
  );
  const pagedPerformance = (performanceRecords ?? []).slice(
    (perfPage - 1) * PERF_PER_PAGE,
    perfPage * PERF_PER_PAGE,
  );

  const { majorSkills } = useMemo(
    () => computeMajorAndSubmetricSkills(performanceRecords ?? []),
    [performanceRecords],
  );

  return (
    <div className="space-y-6">
      {/* Major Athletic & Skill Profile (Major Categories Rollup) */}
      {majorSkills.length > 0 && (
        <div className="nox-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-pitch-200/50 dark:border-white/[0.06] pb-3">
            <div>
              <h3 className="font-orbital text-sm font-semibold text-nox-high flex items-center gap-2">
                <Award size={16} className="text-core-400" />
                Athletic &amp; Skill Profile
              </h3>
              <p className="text-xs text-nox-mid mt-0.5">
                Core performance categories aggregated across all completed evaluations.
              </p>
            </div>
            <span className="text-xs font-mono text-nox-low uppercase">
              {majorSkills.length} Major Skills
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {majorSkills.map((cat) => (
              <div
                key={cat.category}
                className="bg-white/[0.02] border border-pitch-200/50 dark:border-white/[0.06] rounded-xl p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-nox-high text-sm">
                    {cat.category}
                  </span>
                  <span className="font-orbital font-bold text-core-400 text-sm">
                    {cat.score.toFixed(1)}{" "}
                    <span className="text-nox-low text-2xs font-normal">/ 10</span>
                  </span>
                </div>
                <div className="h-2 w-full bg-pitch-200/50 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-core-400 transition-all duration-500 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, (cat.score / 10) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center text-3xs font-mono text-nox-low">
                  <span>Proficiency Rating</span>
                  <span>{cat.count} Evaluations</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coach Feedback & Notes Space */}
      <div className="nox-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-pitch-200/50 dark:border-white/[0.06] pb-3">
          <div>
            <h3 className="font-orbital text-sm font-semibold text-nox-high flex items-center gap-2">
              <FileText size={16} className="text-core-400" />
              Coach Remarks &amp; Developmental Notes
            </h3>
            <p className="text-xs text-nox-mid mt-0.5">
              Personalized developmental guidance and progress updates from your
              child's coaches.
            </p>
          </div>
          <span className="text-xs font-mono text-nox-low">
            {remarks?.length ?? 0} note{(remarks?.length ?? 0) === 1 ? "" : "s"}
          </span>
        </div>

        {!remarks || remarks.length === 0 ? (
          <p className="text-xs text-nox-mid italic py-2">
            No coach remarks or notes added yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {pagedRemarks.map((r) => {
              const coachName =
                r.coachId && typeof r.coachId === "object"
                  ? `${r.coachId.firstName} ${r.coachId.lastName}`
                  : "Squad Coach";
              return (
                <div
                  key={r._id}
                  className="bg-white/[0.02] border-l-2 border-core-400 border-t border-r border-b border-pitch-200/50 dark:border-white/[0.06] rounded-r-lg p-3.5 space-y-1"
                >
                  <div className="flex items-center justify-between text-2xs">
                    <span className="text-core-400 font-semibold">
                      {coachName}
                    </span>
                    <span className="text-nox-low font-mono">
                      {new Date(r.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-nox-high italic leading-relaxed">
                    "{r.text}"
                  </p>
                </div>
              );
            })}

            <PaginationControls
              currentPage={remarksPage}
              totalPages={totalRemarksPages}
              onPageChange={setRemarksPage}
              totalItems={remarks.length}
              itemName="remarks"
            />
          </div>
        )}
      </div>

      {/* Detailed Session Performance Log */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-orbital text-sm font-semibold text-nox-high flex items-center gap-2">
              <TrendingUp size={16} className="text-core-400" />
              Session Performance Breakdown
            </h3>
            <p className="text-xs text-nox-mid mt-0.5">
              Individual technical scores and coach assessments for each
              attended session.
            </p>
          </div>
          <span className="text-xs font-mono text-nox-low">
            {performanceRecords?.length ?? 0} session
            {(performanceRecords?.length ?? 0) === 1 ? "" : "s"} logged
          </span>
        </div>

        {!performanceRecords || performanceRecords.length === 0 ? (
          <NoxEmptyState
            title="No session performance records yet"
            body="Scores and technical assessments will appear here as coaches evaluate your child during training sessions and matches."
          />
        ) : (
          <div className="space-y-4">
            {pagedPerformance.map((p) => {
              const sessionObj =
                typeof p.sessionId === "object" ? p.sessionId : null;
              const sessionTitle =
                sessionObj?.title ||
                `${sessionObj?.type ? sessionObj.type.toUpperCase() : "Training"} Session`;
              const sessionDate = p.sessionDate || p.createdAt;
              const coachName =
                p.coachId && typeof p.coachId === "object"
                  ? `${p.coachId.firstName} ${p.coachId.lastName}`
                  : null;
              const score =
                typeof p.overallScore === "number"
                  ? p.overallScore
                  : p.overallRating;

              return (
                <div
                  key={p._id}
                  className="nox-card p-5 space-y-4 hover:border-core-400/30 transition-colors"
                >
                  {/* Session Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pitch-200/50 dark:border-white/[0.06] pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-orbital text-sm font-semibold text-nox-high">
                          {sessionTitle}
                        </h4>
                        {sessionObj?.type && (
                          <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-core-400/10 text-core-400 border border-core-400/20 font-semibold">
                            {sessionObj.type}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-nox-mid">
                        <span className="flex items-center gap-1">
                          <CalendarCheck size={12} className="text-core-400" />
                          {new Date(sessionDate).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {sessionObj?.startTime && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-core-400" />
                            {sessionObj.startTime} - {sessionObj.endTime}
                          </span>
                        )}
                        {sessionObj?.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-core-400" />
                            {sessionObj.location}
                          </span>
                        )}
                        {coachName && (
                          <span>
                            Evaluated by:{" "}
                            <strong className="text-nox-high font-medium">
                              {coachName}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {typeof score === "number" && (
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-2xs text-nox-low uppercase tracking-widest font-bold block">
                            Rating
                          </span>
                          <span className="font-orbital text-xl font-bold text-core-400">
                            {score.toFixed(1)}{" "}
                            <span className="text-xs text-nox-mid font-normal">
                              / 10
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Session Focus Category Assessment */}
                  {(p.sessionType || sessionObj?.type) && (
                    <div className="p-3 bg-white/[0.02] border border-pitch-200/50 dark:border-white/[0.06] rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-2xs font-mono uppercase tracking-widest text-core-400 font-semibold block">
                          Major Category Focus
                        </span>
                        <span className="text-xs font-semibold text-nox-high">
                          {String(p.sessionType || sessionObj?.type || "Training")} Training
                        </span>
                      </div>
                      {typeof score === "number" && (
                        <div className="text-right">
                          <span className="font-orbital font-bold text-core-400 text-sm">
                            {score.toFixed(1)} / 10
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Evaluator Remarks / Session Notes */}
                  {(p.remarks || p.notes) && (
                    <div className="p-3 bg-white/[0.02] border border-pitch-200/50 dark:border-white/[0.06] rounded-lg space-y-1">
                      <span className="text-2xs font-mono uppercase tracking-widest text-core-400 font-semibold block">
                        Coach's Session Notes:
                      </span>
                      <p className="text-xs text-nox-high italic leading-relaxed">
                        "{String(p.remarks || p.notes)}"
                      </p>
                    </div>
                  )}

                  {p.videoUrl && (
                    <div>
                      <a
                        href={String(p.videoUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-core-400 hover:underline inline-flex items-center gap-1.5"
                      >
                        <ExternalLink size={12} /> View Attached Session Video
                      </a>
                    </div>
                  )}
                </div>
              );
            })}

            <PaginationControls
              currentPage={perfPage}
              totalPages={totalPerfPages}
              onPageChange={setPerfPage}
              totalItems={performanceRecords.length}
              itemName="evaluations"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GuardianChildDetailPage;
