// src/features/coach-portal/CoachDashboardPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { Users, CalendarCheck, CalendarClock, Clock3 } from "lucide-react";
import { RootState } from "../../store";
import { useGetCoachDashboardQuery, useGetMyAvailabilityQuery } from "../../store/api/coachPortalApi";
import { NoxPageHeader, NoxStatCard, NoxSkeleton, NoxEmptyState } from "../../components/portal-ui";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CoachDashboardPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const { data, isLoading, isError } = useGetCoachDashboardQuery();
  const { data: availability, isLoading: availabilityLoading } = useGetMyAvailabilityQuery();

  return (
    <div>
      <NoxPageHeader
        eyebrow="Coach portal"
        title={`Hey${user?.firstName ? `, ${user.firstName}` : ""}`}
        subtitle="Mark attendance and log performance from today's scheduled sessions."
      />

      {isLoading && (
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <NoxSkeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {isError && (
        <NoxEmptyState title="Couldn't load your dashboard" body="Please refresh the page, or try again shortly." />
      )}

      {data && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <NoxStatCard label="Assigned players" value={data.roster.length} icon={<Users size={18} />} accent="ion" />
            <NoxStatCard
              label="Today's sessions"
              value={data.todaySessions.length}
              icon={<CalendarCheck size={18} />}
              accent={data.todaySessions.length ? "core" : "ion"}
            />
            <NoxStatCard
              label="Upcoming this week"
              value={data.upcomingSessions.length}
              icon={<CalendarClock size={18} />}
              accent="ion"
            />
          </div>

          {data.todaySessions.length > 0 && (
            <div className="mb-10">
              <h2 className="font-orbital text-lg font-medium text-nox-high mb-4">Today's sessions</h2>
              <div className="nox-card divide-y divide-white/[0.06]">
                {data.todaySessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-nox-high font-medium">{s.teamName}</span>
                        <span className="text-2xs uppercase tracking-wide text-nox-low">{s.type}</span>
                      </div>
                      <p className="text-2xs text-nox-mid font-mono mt-0.5">
                        {s.startTime}–{s.endTime} · {s.location}
                      </p>
                    </div>
                    <Link to={`/schedule/${s.id}/roster`} className="nox-btn-primary text-xs px-4 py-2">
                      Mark session →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-10">
            <h2 className="font-orbital text-lg font-medium text-nox-high mb-4">Your availability</h2>
            {availabilityLoading ? (
              <NoxSkeleton className="h-24" />
            ) : !availability?.weeklyAvailability.length && !availability?.customUnavailableDates.length ? (
              <NoxEmptyState
                title="No availability set"
                body="Your manager hasn't set your weekly availability yet — you'll be shown as available every day until they do."
                icon={<Clock3 size={28} />}
              />
            ) : (
              <div className="nox-card p-5 space-y-4">
                <div className="grid grid-cols-7 gap-2">
                  {DAY_LABELS.map((label, i) => {
                    const slot = availability?.weeklyAvailability.find((wa) => wa.dayOfWeek === i);
                    return (
                      <div
                        key={label}
                        className={`rounded-lg border px-2 py-3 text-center ${
                          slot ? "border-core-400/30 bg-core-400/[0.08]" : "border-white/[0.06] bg-white/[0.02]"
                        }`}
                      >
                        <p className={`text-2xs uppercase tracking-wide font-semibold ${slot ? "text-core-300" : "text-nox-low"}`}>
                          {label}
                        </p>
                        <p className="text-[10px] font-mono mt-1 text-nox-mid">
                          {slot ? `${slot.startTime}–${slot.endTime}` : "Off"}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {availability && availability.customUnavailableDates.length > 0 && (
                  <div>
                    <p className="text-2xs uppercase tracking-wide text-nox-low mb-2">Marked unavailable on</p>
                    <div className="flex flex-wrap gap-2">
                      {availability.customUnavailableDates.map((d) => (
                        <span key={d} className="text-2xs font-mono px-2 py-1 rounded bg-white/[0.04] text-nox-mid">
                          {new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-orbital text-lg font-medium text-nox-high mb-4">
              {data.todaySessions.length === 0 ? "Upcoming sessions" : "Later this week"}
            </h2>
            {data.upcomingSessions.length === 0 ? (
              <NoxEmptyState
                title="No sessions scheduled"
                body="Sessions assigned to you will show up here once your academy schedules them."
                icon={<CalendarClock size={28} />}
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.upcomingSessions.map((s) => (
                  <Link
                    key={s.id}
                    to={`/schedule/${s.id}/roster`}
                    className="nox-card p-5 block hover:border-core-400/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-nox-high font-medium">{s.teamName}</span>
                      <span className="text-2xs uppercase tracking-wide text-nox-low">{s.type}</span>
                    </div>
                    <p className="text-2xs text-nox-mid font-mono mt-1">
                      {new Date(s.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                      {" · "}{s.startTime}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {data.roster.length > 0 && (
            <div className="mt-10">
              <h2 className="font-orbital text-lg font-medium text-nox-high mb-4">Your players</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.roster.map((s) => (
                  <Link
                    key={s.id}
                    to={`/coach/students/${s.id}`}
                    className="nox-card p-5 block hover:border-core-400/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-10 h-10 rounded-full bg-ion-400/[0.12] text-ion-300 font-orbital text-xs font-semibold">
                        {s.firstName.charAt(0)}
                        {s.lastName.charAt(0)}
                      </span>
                      <div>
                        <div className="text-sm text-nox-high">
                          {s.firstName} {s.lastName}
                        </div>
                        <div className="text-[11px] text-nox-low font-mono">
                          {s.attendancePercentage}% attendance
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CoachDashboardPage;
