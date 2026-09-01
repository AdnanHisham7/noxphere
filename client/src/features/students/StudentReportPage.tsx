// src/features/students/StudentReportPage.tsx
import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Printer, ArrowLeft } from "lucide-react";
import { Button, Skeleton } from "../../components/ui";
import { useGetStudentReportQuery } from "../../store/api/studentsApi";

// A report is variable-length, multi-page, tabular content — the wrong
// shape for the html2canvas+jsPDF approach used for the fixed-size ID
// card elsewhere in this feature (StudentDetailPage). Native browser
// print handles real pagination across pages correctly; canvas
// screenshotting a single DOM node does not. Print-specific CSS below
// hides the app chrome and gives clean page breaks.
const StudentReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: report, isLoading, isError } = useGetStudentReportQuery(id ?? "", { skip: !id });

  useEffect(() => {
    document.title = report ? `${report.student.firstName} ${report.student.lastName} — Report` : "Player Report";
  }, [report]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-8 space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <p className="text-white font-semibold">Couldn't load this report</p>
        <p className="text-slate-500 text-sm mt-1">You may not have access, or this player doesn't exist.</p>
      </div>
    );
  }

  const { student, performances, attendance, remarks, fees, summary } = report;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .report-section { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-pitch-950 border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
          <ArrowLeft size={14} /> Back
        </button>
        <Button size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>

      <div className="max-w-3xl mx-auto p-8 space-y-8">
        <div className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold">{student.firstName} {student.lastName}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {student.position ?? "—"} · {student.ageGroup} · Jersey #{student.jerseyNumber ?? "—"}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Generated {new Date(summary.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 report-section">
          <div className="border border-slate-200 rounded-lg p-4 text-center">
            <p className="text-2xs text-slate-500 uppercase">Attendance</p>
            <p className="text-xl font-bold mt-1">{summary.attendanceRate}%</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 text-center">
            <p className="text-2xs text-slate-500 uppercase">Sessions</p>
            <p className="text-xl font-bold mt-1">{summary.totalSessions}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 text-center">
            <p className="text-2xs text-slate-500 uppercase">Total Paid</p>
            <p className="text-xl font-bold mt-1">₹{summary.totalPaid.toLocaleString("en-IN")}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 text-center">
            <p className="text-2xs text-slate-500 uppercase">Outstanding</p>
            <p className={`text-xl font-bold mt-1 ${summary.totalOutstanding > 0 ? "text-red-600" : ""}`}>
              ₹{summary.totalOutstanding.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <section className="report-section">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Performance History</h2>
          {performances.length === 0 ? (
            <p className="text-sm text-slate-400">No performance records yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-2xs uppercase text-slate-500">
                  <th className="py-2">Date</th>
                  <th className="py-2">Overall Score</th>
                  <th className="py-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {performances.slice(0, 30).map((p, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2">{new Date(p.sessionDate).toLocaleDateString("en-IN")}</td>
                    <td className="py-2">{p.overallScore.toFixed(1)}</td>
                    <td className="py-2 text-slate-500">{p.remarks ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="report-section">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Attendance Log</h2>
          {attendance.length === 0 ? (
            <p className="text-sm text-slate-400">No attendance records yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-2xs uppercase text-slate-500">
                  <th className="py-2">Date</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.slice(0, 60).map((a, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2">{new Date(a.sessionDate).toLocaleDateString("en-IN")}</td>
                    <td className="py-2 capitalize">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="report-section">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Fee Records</h2>
          {fees.length === 0 ? (
            <p className="text-sm text-slate-400">No fee records yet.</p>
          ) : (
            <div className="space-y-3">
              {fees.map((fee) => (
                <div key={fee._id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold capitalize">{fee.feeType.replace("_", " ")}</p>
                    <span className="text-xs text-slate-500 capitalize">{fee.overallStatus}</span>
                  </div>
                  {fee.installments.map((inst) => (
                    <div key={inst.installmentNumber} className="flex justify-between text-xs text-slate-600 py-1">
                      <span>Installment {inst.installmentNumber} · due {new Date(inst.dueDate).toLocaleDateString("en-IN")}</span>
                      <span>₹{inst.paidAmount.toLocaleString("en-IN")} / ₹{inst.amount.toLocaleString("en-IN")} · {inst.status}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {remarks.length > 0 && (
          <section className="report-section">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Coach Remarks</h2>
            <div className="space-y-2">
              {remarks.slice(0, 20).map((r) => (
                <div key={r._id} className="text-sm border-l-2 border-slate-200 pl-3">
                  <p className="text-slate-700">{r.text}</p>
                  <p className="text-2xs text-slate-400 mt-0.5">
                    {new Date(r.date).toLocaleDateString("en-IN")}
                    {r.coachId ? ` · ${r.coachId.firstName} ${r.coachId.lastName}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default StudentReportPage;