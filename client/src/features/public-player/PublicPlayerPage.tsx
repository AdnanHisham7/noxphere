// src/features/public-player/PublicPlayerPage.tsx
import React from "react";
import { useParams } from "react-router-dom";
import { Star, Shirt } from "lucide-react";
import { useGetPublicPlayerProfileQuery } from "../../store/api/publicPlayerApi";
import { PlayerPlaceholder } from "@/components/ui/PlayerPlaceholder";
import mannequinPng from "../../assets/players/mannequin.png";

// No auth, no layout shell — this is the page a stadium/ID-card NFC tap
// or QR scan opens. Only ever shows the small, hand-picked field set
// PublicPlayerUseCases.getByToken returns; there's no client-side
// filtering to worry about because the sensitive fields (DOB, guardian
// contact, medical info, fees) are never sent to the browser in the
// first place.
const PublicPlayerPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { data: player, isLoading, isError } = useGetPublicPlayerProfileQuery(token ?? "", { skip: !token });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pitch-950">
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (isError || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pitch-950 px-6">
        <div className="text-center space-y-2">
          <p className="text-white font-display font-bold text-lg">Player page not found</p>
          <p className="text-slate-500 text-sm">This link may have expired or isn't public yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pitch-950 flex items-center justify-center px-4 py-10">
      <div className="max-w-sm w-full bg-pitch-900 border border-white/10 rounded-3xl overflow-hidden">
        <div className="relative h-72 bg-gradient-to-b from-pitch-800 to-pitch-900">
          <PlayerPlaceholder
            image={mannequinPng}
            name={`${player.firstName} ${player.lastName}`}
            number={player.jerseyNumber ?? 0}
            className="h-full w-full px-6 pb-6"
            nameTop="6%"
            numberTop="10%"
            nameSize="12px"
            numberSize="70px"
            nameWidth="80%"
          />
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h1 className="font-display font-extrabold text-white text-xl uppercase tracking-tight">
              {player.firstName} {player.lastName}
            </h1>
            <p className="text-sm text-slate-500">{player.franchiseName} · {player.academyName}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10">
            <div className="text-center">
              <p className="text-2xs text-slate-500 uppercase">Position</p>
              <p className="text-sm font-semibold text-white mt-0.5">{player.position ?? "—"}</p>
            </div>
            <div className="text-center">
              <p className="text-2xs text-slate-500 uppercase">Category</p>
              <p className="text-sm font-semibold text-white mt-0.5">{player.ageGroup}</p>
            </div>
            <div className="text-center">
              <p className="text-2xs text-slate-500 uppercase flex items-center justify-center gap-1">
                <Star size={10} /> Rating
              </p>
              <p className="text-sm font-semibold text-volt-400 mt-0.5">{player.overallRating.toFixed(1)}</p>
            </div>
          </div>
          {player.teamName && (
            <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-white/10">
              <Shirt size={13} />
              {player.teamName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicPlayerPage;