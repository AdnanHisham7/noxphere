// src/features/public-player/PublicPlayerPage.tsx
import React from "react";
import { useParams } from "react-router-dom";
import { Star, Shirt, ShieldCheck, Compass } from "lucide-react";
import { useGetPublicPlayerProfileQuery } from "../../store/api/publicPlayerApi";
import { PlayerPlaceholder } from "@/components/ui/PlayerPlaceholder";
import { ThemeToggle } from "../../components/common/ThemeToggle";
import mannequinPng from "../../assets/players/mannequin.png";

// No auth, no layout shell — this is the page a stadium/ID-card NFC tap
// or QR scan opens. Only ever shows the small, hand-picked field set
// PublicPlayerUseCases.getByToken returns. Respects granular privacy toggles.
const PublicPlayerPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { data: player, isLoading, isError } = useGetPublicPlayerProfileQuery(token ?? "", { skip: !token });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-pitch-950 p-4 transition-colors duration-200">
        <div className="w-8 h-8 rounded-full border-2 border-volt-400 border-t-transparent animate-spin mb-3" />
        <p className="text-slate-500 dark:text-slate-400 text-xs font-mono uppercase tracking-wider">Loading Player Card…</p>
      </div>
    );
  }

  if (isError || !player) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-pitch-950 px-6 relative transition-colors duration-200">
        <div className="absolute top-5 right-6">
          <ThemeToggle size="md" />
        </div>
        <div className="text-center max-w-sm w-full bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-2xl p-8 shadow-xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <ShieldCheck size={24} />
          </div>
          <p className="text-slate-900 dark:text-white font-display font-extrabold text-xl uppercase tracking-tight">Player Page Not Found</p>
          <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
            This player card may be private, expired, or not yet published by the player's guardian.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-pitch-950 flex flex-col items-center justify-center px-4 py-12 relative transition-colors duration-200">
      {/* Floating theme toggle */}
      <div className="absolute top-5 right-6 z-30">
        <ThemeToggle size="md" />
      </div>

      <div className="max-w-sm w-full bg-white dark:bg-pitch-900 border border-slate-200/80 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl transition-all duration-200">
        {/* Card Top / Visual Banner */}
        <div className="relative h-72 bg-gradient-to-b from-slate-200 via-slate-100 to-white dark:from-pitch-800 dark:to-pitch-900 flex items-end justify-center overflow-hidden border-b border-slate-200/60 dark:border-white/10">
          <PlayerPlaceholder
            image={player.photo || mannequinPng}
            name={`${player.firstName} ${player.lastName}`}
            number={player.jerseyNumber ?? 0}
            className="h-full w-full px-6 pb-4"
            nameTop="6%"
            numberTop="10%"
            nameSize="12px"
            numberSize="70px"
            nameWidth="80%"
          />
          {player.jerseyNumber !== undefined && (
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-900/80 dark:bg-pitch-950/80 text-white border border-white/20 text-xs font-mono font-bold tracking-wider backdrop-blur-xs">
              #{player.jerseyNumber}
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h1 className="font-display font-black text-slate-900 dark:text-white text-2xl uppercase tracking-tight leading-tight">
                {player.firstName} {player.lastName}
              </h1>
              {player.isFreeAgent && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-volt-400/20 text-slate-900 dark:text-volt-400 border border-volt-400/40">
                  Free Agent
                </span>
              )}
            </div>

            {player.isFreeAgent ? (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                <Compass size={13} className="text-volt-500 dark:text-volt-400" />
                Unattached Player · Open for Recruitment
              </p>
            ) : (
              (player.franchiseName || player.academyName) && (
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  {[player.franchiseName, player.academyName].filter(Boolean).join(" · ")}
                </p>
              )
            )}
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 py-3 px-2 rounded-2xl bg-slate-50 dark:bg-pitch-950/60 border border-slate-200/80 dark:border-white/5">
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Position</p>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{player.position || "—"}</p>
            </div>
            <div className="text-center border-x border-slate-200 dark:border-white/5">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Category</p>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{player.ageGroup || "—"}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
                <Star size={10} className="text-amber-500 fill-amber-500" /> Rating
              </p>
              <p className="text-xs sm:text-sm font-bold text-volt-600 dark:text-volt-400 mt-0.5">
                {player.overallRating !== undefined ? player.overallRating.toFixed(1) : "—"}
              </p>
            </div>
          </div>

          {/* Additional details: Preferred foot & Squad */}
          {(player.preferredFoot || player.teamName) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {player.preferredFoot && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 text-xs font-semibold">
                  <span>Foot:</span>
                  <span className="capitalize text-slate-900 dark:text-white font-bold">{player.preferredFoot}</span>
                </span>
              )}
              {player.teamName && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 text-xs font-semibold">
                  <Shirt size={13} className="text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-900 dark:text-white font-bold">{player.teamName}</span>
                </span>
              )}
            </div>
          )}

          {/* Bio statement */}
          {player.bio && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-pitch-950/40 border border-slate-200/70 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
              "{player.bio}"
            </div>
          )}

          {/* Verified Player Badge */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-white/10 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={14} />
              Verified Player Profile
            </span>
            <span className="font-mono text-[10px]">Noxphere ID</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicPlayerPage;