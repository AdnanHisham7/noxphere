// src/features/students/StudentDetailPage.tsx
import React, { useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { clsx } from "clsx";
import { Button, Badge, Avatar, Modal } from "../../components/ui";
import { toast } from "react-hot-toast";
import player1 from "../../assets/players/player1.png";
import { PlayerPlaceholder } from "@/components/ui/PlayerPlaceholder";
import mannequinPng from "../../assets/players/mannequin.png";
// import { useGetTransferListingsQuery } from '../../store/api/authApi';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "react-qr-code";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

const STUDENT = {
  id: "1",
  firstName: "Lionel",
  lastName: "Messi",
  position: "Forward",
  ageGroup: "U-17",
  jerseyNumber: 10,
  team: "Team A",
  coach: "Ali Hassan",
  photo: player1,
  overallRating: 9.2,
  attendancePercentage: 96,
  attendanceStreak: 12,
  selectionStatus: "selected",
  transferStatus: "not_listed",
  dateOfBirth: "2008-03-15",
  enrollmentDate: "2025-04-01",
  guardian: {
    name: "Rakesh Mehta",
    phone: "+91 9876543210",
    email: "rakesh@email.com",
  },
  medical: {
    bloodGroup: "O+",
    allergies: [],
    emergencyContact: "Rakesh Mehta — 9876543210",
  },
  skillScores: [
    { parameter: "Dribbling", score: 9.1 },
    { parameter: "Passing", score: 7.8 },
    { parameter: "Shooting", score: 9.4 },
    { parameter: "Speed", score: 9.0 },
    { parameter: "Tactical", score: 8.2 },
    { parameter: "Attitude", score: 9.5 },
  ],
  sessionHistory: [
    { session: "May 5", score: 8.6 },
    { session: "May 7", score: 8.9 },
    { session: "May 10", score: 9.1 },
    { session: "May 12", score: 8.8 },
    { session: "May 14", score: 9.4 },
    { session: "May 16", score: 9.2 },
  ],
  attendanceHistory: [
    { date: "May 16", status: "present" },
    { date: "May 14", status: "present" },
    { date: "May 12", status: "late" },
    { date: "May 10", status: "present" },
    { date: "May 7", status: "present" },
    { date: "May 5", status: "absent" },
  ],
  coachRemarks: [
    {
      date: "May 16",
      text: "Outstanding finishing. Should be considered for final XI.",
      coach: "Ali Hassan",
    },
    {
      date: "May 12",
      text: "Great pace. Needs to work on hold-up play.",
      coach: "Ali Hassan",
    },
  ],
};

const getRatingColor = (r: number) =>
  r >= 9
    ? "text-volt-400"
    : r >= 8
      ? "text-field-400"
      : r >= 7
        ? "text-ice-400"
        : "text-slate-400";

const attendanceColors: Record<string, string> = {
  present: "bg-field-400",
  absent: "bg-ember-400",
  late: "bg-volt-400",
  excused: "bg-ice-400",
};

const StudentDetailPage: React.FC = () => {
  const { id } = useParams();
  const { user } = useSelector((s: RootState) => s.auth);
  const [activeTab, setActiveTab] = useState<
    "overview" | "attendance" | "performance" | "info"
  >("overview");
  const [transferModal, setTransferModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const tabs = ["overview", "attendance", "performance", "info"] as const;

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    const toastId = toast.loading("Generating High-Res Card...");

    try {
      const pdf = new jsPDF("p", "px", [800, 1130]);
      const sections = cardRef.current.querySelectorAll(".card-page");

      for (let i = 0; i < sections.length; i++) {
        const canvas = await html2canvas(sections[i] as HTMLElement, {
          scale: 3, // High resolution
          useCORS: true,
          backgroundColor: "#0f172a", // Match your pitch-900
        });

        const imgData = canvas.toDataURL("image/png");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save(`${STUDENT.firstName}_${STUDENT.lastName}_Card.pdf`);
      toast.success("Card Downloaded!", { id: toastId });
    } catch (error) {
      toast.error("Failed to generate PDF", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const profileUrl = `${window.location.origin}/public-scout/player/${STUDENT.id}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to={`/${user?.role}/students`} className="hover:text-volt-400 transition-colors">
          Squad
        </Link>
        <span>›</span>
        <span className="text-white">
          {STUDENT.firstName} {STUDENT.lastName}
        </span>
      </div>

      {/* Hero section */}
      <div className="card overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 bg-volt-400" />

        <div className="px-6 pt-6 pb-6 md:pt-0 md:pb-0">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* LEFT SIDE */}
            <div className="flex-1 min-w-0 order-2 lg:order-1">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="font-display font-900 text-white text-3xl uppercase leading-tight tracking-tight">
                    {STUDENT.firstName} {STUDENT.lastName}
                  </h1>

                  <p className="text-slate-400 text-sm mt-0.5">
                    {STUDENT.position} · {STUDENT.ageGroup} · #
                    {STUDENT.jerseyNumber} · {STUDENT.team}
                  </p>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="green">Selected</Badge>
                    <Badge variant="gray">Team A</Badge>

                    {STUDENT.transferStatus === "listed" && (
                      <Badge variant="blue">↔ On Transfer</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick stat chips */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <span className="stat-badge text-field-400">
                  ✓ {STUDENT.attendancePercentage}% attendance
                </span>

                <span className="stat-badge text-volt-400">
                  🔥 {STUDENT.attendanceStreak}d streak
                </span>

                <span className="stat-badge text-slate-400">
                  Coach: {STUDENT.coach}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-white/5">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={
                    isDownloading ? (
                      <span className="animate-spin">🌀</span>
                    ) : (
                      <span>📄</span>
                    )
                  }
                  onClick={handleDownloadCard}
                  disabled={isDownloading}
                >
                  {isDownloading ? "Generating..." : "Download Card PDF"}
                </Button>

                {/* HIDDEN CARD TEMPLATE FOR PDF */}
                <div className="fixed left-[-9999px] top-0 bg-black">
                  <div ref={cardRef} className="w-[800px] font-display">
                    {/* FRONT OF CARD: ELITE PERFORMANCE VIEW */}
                    <div
                      className="card-page bg-[#050505] w-[800px] h-[1130px] relative overflow-hidden flex flex-col items-center border-[20px] border-volt-400 p-12"
                      style={{ pageBreakAfter: "always", breakAfter: "page" }}
                    >
                      <div
                        className="absolute inset-0 opacity-10"
                        style={{
                          backgroundImage:
                            "radial-gradient(#ccff00 0.5px, transparent 0.5px)",
                          backgroundSize: "24px 24px",
                        }}
                      />
                      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-volt-400/20 rounded-full blur-[120px]" />

                      {/* Header Info */}
                      <div className="z-20 w-full flex justify-between items-start mb-6">
                        <div className="bg-volt-400 h-12 px-6 flex items-center justify-center">
                          <span className="text-black font-black italic text-2xl leading-none relative top-[1px]">
                            ELITE SERIES
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-volt-400 font-black text-6xl leading-none">
                            {STUDENT.overallRating}
                          </p>
                          <p className="text-white/50 text-lg uppercase tracking-widest font-thin mt-1">
                            OVR Rating
                          </p>
                        </div>
                      </div>

                      {/* Main Image Section with New Border */}
                      <div className="relative flex-1 flex items-center justify-center w-full">
                        {/* Large Background Number */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[420px] font-900 text-white/[0.03] italic leading-none select-none">
                            {STUDENT.jerseyNumber}
                          </span>
                        </div>

                        {/* Photo Border & Frame */}
                        <div className="relative z-10 p-2">
                          <div className="absolute inset-0 border-2 border-volt-400/30 skew-x-[-3deg] scale-105" />
                          <div className="absolute inset-0 border border-volt-400 skew-x-[3deg] scale-100" />

                          <div className="relative bg-gradient-to-b from-white/5 to-transparent p-1 backdrop-blur-sm overflow-hidden">
                            <img
                              src={STUDENT.photo}
                              className="h-[550px] relative z-10 drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)] object-contain"
                              alt="Player"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bottom Name Plate */}
                      <div className="w-full z-20 text-center pb-10">
                        <h1 className="text-8xl font-900 text-white uppercase tracking-tighter leading-none mb-2">
                          {STUDENT.lastName}
                        </h1>
                        <p className="text-volt-400 font-900 text-3xl uppercase italic tracking-widest mb-6">
                          {STUDENT.firstName}
                        </p>

                        <div className="flex justify-center gap-16">
                          <div className="text-center">
                            <p className="text-white font-900 text-2xl uppercase italic">
                              {STUDENT.position}
                            </p>
                            <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.3em]">
                              Position
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-white font-900 text-2xl uppercase italic">
                              #{STUDENT.jerseyNumber}
                            </p>
                            <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.3em]">
                              Squad No
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BACK OF CARD: ANALYTICS VIEW */}
                    <div
                      className="card-page bg-[#0a0a0a] w-[800px] h-[1130px] relative overflow-hidden flex flex-col border-[20px] border-white/10 p-12"
                      style={{ pageBreakBefore: "always", breakBefore: "page" }}
                    >
                      {/* Top Header */}
                      <div className="flex justify-between items-end border-b-2 border-white/10 pb-8">
                        <div>
                          <h3 className="text-5xl text-white font-900 uppercase tracking-tighter leading-none">
                            Technical{" "}
                            <span className="text-volt-400">Breakdown</span>
                          </h3>
                          <p className="text-white/30 font-bold uppercase tracking-[0.4em] mt-2 text-[10px]">
                            Verified Academy Data • {new Date().getFullYear()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-volt-400 font-mono text-xl">
                            ID-{STUDENT.id}X99
                          </p>
                        </div>
                      </div>

                      {/* Skills Profile - Linear Bars Style */}
                      <div className="mt-12 space-y-8">
                        {STUDENT.skillScores.map((skill) => (
                          <div key={skill.parameter} className="group">
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-white font-900 uppercase tracking-widest text-lg">
                                {skill.parameter}
                              </span>
                              <span className="text-volt-400 font-900 text-2xl italic">
                                {Math.round(skill.score * 10)}
                              </span>
                            </div>
                            <div className="h-4 bg-white/5 rounded-full overflow-hidden flex">
                              <div
                                className="h-full bg-volt-400 shadow-[0_0_15px_rgba(204,255,0,0.5)]"
                                style={{ width: `${skill.score * 10}%` }}
                              />
                              <div className="h-full bg-white/10 flex-1" />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer Section: QR + Bio Data */}
                      <div className="mt-auto grid grid-cols-12 gap-8 pt-12 border-t border-white/10">
                        <div className="col-span-8 grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-white/20 text-[10px] uppercase font-black tracking-widest mb-1">
                              Guardian
                            </p>
                            <p className="text-white font-bold text-lg">
                              {STUDENT.guardian.name}
                            </p>
                            <p className="text-volt-400 font-mono text-sm">
                              {STUDENT.guardian.phone}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/20 text-[10px] uppercase font-black tracking-widest mb-1">
                              Bio Metrics
                            </p>
                            <p className="text-white font-bold text-lg">
                              Group: {STUDENT.medical.bloodGroup}
                            </p>
                            <p className="text-white/40 text-sm italic">
                              {STUDENT.ageGroup} Division
                            </p>
                          </div>
                        </div>

                        <div className="col-span-4 flex flex-col items-end">
                          <div className="bg-white p-2 rounded-xl">
                            <QRCode
                              value={profileUrl}
                              size={110}
                              level="H"
                              bgColor="#FFFFFF"
                              fgColor="#000000"
                            />
                          </div>
                          <p className="text-white/30 text-[9px] uppercase font-black mt-3 tracking-tighter text-right">
                            Scan for full digital history
                            <br />
                            and video highlights
                          </p>
                        </div>
                      </div>

                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-10">
                        <p className="text-[8px] font-black uppercase tracking-[1em] text-white whitespace-nowrap">
                          AUTHENTIC SCOUT CARD • PROPERTY OF{" "}
                          {STUDENT.team.toUpperCase()} ACADEMY
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  icon={<span>↔</span>}
                  onClick={() => setTransferModal(true)}
                >
                  List on Transfer Wall
                </Button>

                <Button size="sm" variant="secondary" icon={<span>📨</span>}>
                  Message Guardian
                </Button>
              </div>
            </div>

            {/* CENTER IMAGE */}
            <div className="flex justify-center items-center order-1 lg:order-2 py-6">
              <div className="relative flex items-end justify-center w-40 h-52 sm:w-48 sm:h-60">
                {/* Jersey number backdrop */}
                <span className="absolute top-3 font-display font-900 text-[120px] leading-none text-white/5 select-none z-0">
                  {/* {STUDENT.jerseyNumber} */}
                </span>

                {STUDENT.photo ? (
                  <img
                    src={STUDENT.photo}
                    alt={`${STUDENT.firstName} ${STUDENT.lastName}`}
                    className="h-full w-auto object-contain object-bottom relative z-10 select-none pointer-events-none border border-volt-400/20 rounded"
                  />
                ) : (
                  <PlayerPlaceholder
                    image={mannequinPng}
                    name={`${STUDENT.firstName} ${STUDENT.lastName}`}
                    number={STUDENT.jerseyNumber}
                    // Easy positioning controls
                    nameTop="25%"
                    numberTop="35%"
                    // Easy sizing controls
                    nameSize="14px"
                    numberSize="80px"
                    // Optional width control
                    nameWidth="72%"
                  />
                )}
              </div>
            </div>

            {/* RIGHT SIDE RATING */}
            <div className="flex flex-col items-center lg:items-end justify-center order-3 text-center lg:text-right">
              <p
                className={clsx(
                  "font-display font-900 text-5xl sm:text-6xl tabular-nums",
                  getRatingColor(STUDENT.overallRating),
                )}
              >
                {STUDENT.overallRating.toFixed(1)}
              </p>

              <p className="text-2xs text-slate-500 mt-1 uppercase tracking-wide">
                Overall Rating
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-pitch-800 p-1 rounded border border-white/5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-4 py-1.5 rounded text-xs font-display font-bold uppercase tracking-wide transition-all duration-150",
              activeTab === tab
                ? "bg-volt-400 text-pitch-900"
                : "text-slate-500 hover:text-white",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Radar chart */}
          <div className="card p-5">
            <p className="section-title mb-4">Skill Profile</p>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={STUDENT.skillScores}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis
                  dataKey="parameter"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <Radar
                  dataKey="score"
                  stroke="#ccff00"
                  fill="#ccff00"
                  fillOpacity={0.08}
                  strokeWidth={2}
                  dot={{ fill: "#ccff00", r: 3, strokeWidth: 0 }}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-4">
              {STUDENT.skillScores.map((s) => (
                <div key={s.parameter} className="flex items-center gap-2">
                  <span className="text-2xs text-slate-500 w-24">
                    {s.parameter}
                  </span>
                  <div className="flex-1 h-1.5 bg-pitch-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-volt-400 transition-all duration-500"
                      style={{ width: `${s.score * 10}%` }}
                    />
                  </div>
                  <span className="font-display font-bold text-xs text-volt-400 w-6 text-right">
                    {s.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance trend */}
          <div className="card p-5">
            <p className="section-title mb-4">Performance Trend</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={STUDENT.sessionHistory}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="session"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[7, 10]}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1a24",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#ccff00"
                  strokeWidth={2}
                  dot={{ fill: "#ccff00", r: 4, strokeWidth: 0 }}
                  activeDot={{ fill: "#ccff00", r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Coach remarks */}
            <div className="mt-4 space-y-2">
              <p className="section-title">Recent Remarks</p>
              {STUDENT.coachRemarks.map((r, i) => (
                <div
                  key={i}
                  className="bg-pitch-700 rounded p-3 border-l-2 border-volt-400"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xs text-volt-400 font-semibold">
                      {r.coach}
                    </span>
                    <span className="text-2xs text-slate-600">{r.date}</span>
                  </div>
                  <p className="text-xs text-slate-400 italic">"{r.text}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Attendance tab */}
      {activeTab === "attendance" && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-title">Attendance History</p>
            <span className="font-display font-extrabold text-field-400 text-2xl">
              {STUDENT.attendancePercentage}%
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            {[
              { label: "Present", value: 18, color: "text-field-400" },
              { label: "Late", value: 2, color: "text-volt-400" },
              { label: "Absent", value: 1, color: "text-ember-400" },
              { label: "Excused", value: 0, color: "text-ice-400" },
            ].map((s) => (
              <div key={s.label} className="card p-3 text-center">
                <p className={clsx("font-display font-900 text-2xl", s.color)}>
                  {s.value}
                </p>
                <p className="text-2xs text-slate-500 uppercase tracking-wide mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {STUDENT.attendanceHistory.map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2 border-b border-white/4"
              >
                <div
                  className={clsx(
                    "w-2 h-2 rounded-full",
                    attendanceColors[entry.status],
                  )}
                />
                <span className="text-sm text-slate-300 flex-1">
                  {entry.date}
                </span>
                <span
                  className={clsx(
                    "text-xs font-semibold uppercase",
                    entry.status === "present"
                      ? "text-field-400"
                      : entry.status === "absent"
                        ? "text-ember-400"
                        : entry.status === "late"
                          ? "text-volt-400"
                          : "text-ice-400",
                  )}
                >
                  {entry.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance tab */}
      {activeTab === "performance" && (
        <div className="space-y-4">
          {STUDENT.sessionHistory.map((session, i) => (
            <div key={i} className="card p-4 flex items-center justify-between">
              <span className="text-sm text-slate-300">{session.session}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-1.5 bg-pitch-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-volt-400"
                    style={{ width: `${(session.score / 10) * 100}%` }}
                  />
                </div>
                <span className="font-display font-extrabold text-volt-400 text-lg w-8 text-right">
                  {session.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info tab */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Date of Birth", value: STUDENT.dateOfBirth },
            { label: "Enrolled", value: STUDENT.enrollmentDate },
            { label: "Blood Group", value: STUDENT.medical.bloodGroup },
            {
              label: "Emergency Contact",
              value: STUDENT.medical.emergencyContact,
            },
            { label: "Guardian", value: STUDENT.guardian.name },
            { label: "Guardian Phone", value: STUDENT.guardian.phone },
            { label: "Guardian Email", value: STUDENT.guardian.email },
            {
              label: "Allergies",
              value: STUDENT.medical.allergies.length
                ? STUDENT.medical.allergies.join(", ")
                : "None",
            },
          ].map((item) => (
            <div key={item.label} className="card p-4">
              <p className="section-title mb-1">{item.label}</p>
              <p className="text-sm text-slate-200">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Transfer Wall modal */}
      <Modal
        isOpen={transferModal}
        onClose={() => setTransferModal(false)}
        title="List on Transfer Wall"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-pitch-700 rounded p-3">
            <Avatar
              name={`${STUDENT.firstName} ${STUDENT.lastName}`}
              size="md"
            />
            <div>
              <p className="font-display font-bold text-white">
                {STUDENT.firstName} {STUDENT.lastName}
              </p>
              <p className="text-xs text-slate-500">
                {STUDENT.position} · Rating {STUDENT.overallRating}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Transfer Price (₹)</label>
              <input type="number" className="input" placeholder="15000" />
            </div>
            <div>
              <label className="label">Listing Expires</label>
              <input type="date" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Coach Note (for buyers)</label>
            <textarea
              className="input min-h-20 resize-none"
              placeholder="Describe the player's strengths and achievements..."
            />
          </div>
          <div className="flex items-center gap-2 p-3 bg-ice-400/5 border border-ice-400/15 rounded">
            <span className="text-ice-400 text-sm">↔</span>
            <p className="text-xs text-ice-400">
              This player will be visible on the public Transfer Wall portal
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => {
                toast.success("Player listed on Transfer Wall!");
                setTransferModal(false);
              }}
            >
              List on Transfer Wall
            </Button>
            <Button variant="secondary" onClick={() => setTransferModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudentDetailPage;
