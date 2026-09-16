// src/features/public-player/PublicPlayerPage.tsx
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  ShieldCheck,
  Compass,
  Share2,
  QrCode,
  CheckCircle2,
  Radio,
  Sparkles,
  Zap,
  Activity,
  X,
  Footprints,
  Shirt,
} from "lucide-react";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";
import { useGetPublicPlayerProfileQuery } from "../../store/api/publicPlayerApi";
import { PlayerPlaceholder } from "@/components/ui/PlayerPlaceholder";
import { ThemeToggle } from "../../components/common/ThemeToggle";
import mannequinPng from "../../assets/players/mannequin.png";

// Position to 3-letter abbreviation helper
const getPosAbbr = (pos?: string): string => {
  if (!pos) return "PLY";
  const p = pos.toLowerCase();
  if (p.includes("striker") || p.includes("forward")) return "ST";
  if (p.includes("wing")) return "WG";
  if (p.includes("attacking")) return "CAM";
  if (p.includes("defensive mid")) return "CDM";
  if (p.includes("midfield")) return "MID";
  if (p.includes("center back") || p.includes("centre")) return "CB";
  if (p.includes("full back") || p.includes("back")) return "FB";
  if (p.includes("goal")) return "GK";
  if (p.includes("defend")) return "DEF";
  return pos.slice(0, 3).toUpperCase();
};

// Calculate FUT-style card score (1-99), or null if unrated/free-agent without evaluations
const getCardScore = (rating?: number): number | null => {
  if (rating === undefined || rating === null || rating <= 0) return null;
  if (rating <= 10) {
    return Math.min(99, Math.max(1, Math.round(rating * 10)));
  }
  return Math.min(99, Math.max(1, Math.round(rating)));
};

export const PublicPlayerPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const {
    data: player,
    isLoading,
    isError,
  } = useGetPublicPlayerProfileQuery(token ?? "", { skip: !token });

  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${player?.firstName} ${player?.lastName} - Noxphere Verified Athlete`,
          text: `Check out ${player?.firstName}'s verified player card and match stats on Noxphere!`,
          url,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fallback to copy
      }
    }
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Player card URL copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-pitch-950 p-4 transition-colors duration-200">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-volt-400/20 border-t-volt-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap size={20} className="text-volt-500 animate-pulse" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-xs font-mono uppercase tracking-widest mt-4">
          Loading Athlete Card…
        </p>
      </div>
    );
  }

  if (isError || !player) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-pitch-950 px-6 relative transition-colors duration-200">
        <div className="absolute top-5 right-6">
          <ThemeToggle size="md" />
        </div>
        <div className="text-center max-w-sm w-full bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-slate-900 dark:text-white font-display font-black text-xl uppercase tracking-tight">
            Player Card Not Found
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
            This player card may be private, expired, or not yet approved for
            public recruitment indexing.
          </p>
        </div>
      </div>
    );
  }

  const cardScore = getCardScore(player.overallRating);
  const posAbbr = getPosAbbr(player.position);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-pitch-950 dark:via-pitch-900 dark:to-pitch-950 flex flex-col items-center justify-center px-4 py-10 sm:py-16 relative transition-colors duration-200 overflow-x-hidden">
      {/* Stadium Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-volt-400/15 via-emerald-500/10 to-transparent dark:from-volt-400/20 dark:via-core-400/10 dark:to-transparent blur-3xl pointer-events-none" />

      {/* Top Floating Utility Bar */}
      <div className="w-full max-w-md flex items-center justify-between mb-6 z-20 px-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-pitch-950 text-volt-400 flex items-center justify-center font-display font-black text-sm border border-volt-400/30">
            N
          </div>
          <span className="font-display font-bold text-slate-800 dark:text-white text-xs tracking-wider uppercase">
            Noxphere Athlete Card
          </span>
        </div>
        <ThemeToggle size="md" />
      </div>

      {/* MAIN FUT CARD CONTAINER */}
      <div className="relative w-full max-w-[390px] group transition-transform duration-300">
        <div className="relative rounded-[2.5rem] p-[2px] bg-gradient-to-b from-amber-300 via-volt-400 to-slate-400 dark:from-volt-400/70 dark:via-emerald-400/50 dark:to-pitch-700 shadow-2xl shadow-volt-400/10 dark:shadow-volt-400/20">
          <div className="rounded-[2.4rem] bg-white dark:bg-pitch-900 overflow-hidden border border-slate-200/80 dark:border-white/10 transition-colors">
            {/* CARD TOP: ATHLETE VISUAL & BADGES */}
            <div className="relative h-80 bg-gradient-to-b from-slate-200 via-slate-100 to-white dark:from-pitch-800 dark:via-pitch-850 dark:to-pitch-900 flex items-end justify-center overflow-hidden border-b border-slate-200/80 dark:border-white/10">
              <div className="absolute inset-0 opacity-[0.07] dark:opacity-[0.12] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

              {/* Top Left: FUT Rating & Position Shield */}
              <div className="absolute top-5 left-5 flex flex-col items-center z-10">
                <div className="flex flex-col items-center bg-slate-900/90 dark:bg-pitch-950/90 text-white backdrop-blur-md px-3 py-2 rounded-2xl border border-white/20 shadow-lg">
                  <span className="font-display font-black text-2xl sm:text-3xl text-volt-400 tracking-tighter leading-none">
                    {cardScore !== null ? cardScore : "NR"}
                  </span>
                  <span className="text-[10px] font-mono font-black tracking-widest text-slate-300 uppercase mt-0.5">
                    {posAbbr}
                  </span>
                  <div className="w-full h-px bg-white/20 my-1" />
                  <span className="text-3xs font-mono font-bold text-amber-400 tracking-wider">
                    {cardScore !== null ? "OVR" : "SCOUT"}
                  </span>
                </div>
              </div>

              {/* Top Right: Jersey Number & NFC Chip */}
              <div className="absolute top-5 right-5 flex flex-col items-end gap-2 z-10">
                {player.jerseyNumber !== undefined && (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-pitch-950/90 text-white border border-white/20 backdrop-blur-md shadow-md">
                    <span className="text-3xs font-mono font-bold text-volt-400">
                      #
                    </span>
                    <span className="font-display font-black text-sm">
                      {player.jerseyNumber}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 backdrop-blur-md text-[10px] font-mono font-semibold">
                  <Radio size={10} className="animate-pulse" />
                  <span>NFC ID</span>
                </div>
              </div>

              {/* Athlete Visual */}
              <PlayerPlaceholder
                image={player.photo || mannequinPng}
                name={`${player.firstName} ${player.lastName}`}
                number={player.jerseyNumber ?? 0}
                className="h-full w-full px-6 pb-2 drop-shadow-2xl"
                nameTop="24%"
                numberTop="32%"
                nameSize="12px"
                numberSize="70px"
                nameWidth="80%"
                hideNameAndNumber={Boolean(player.photo)}
              />

              <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white dark:from-pitch-900 to-transparent pointer-events-none" />
            </div>

            {/* CARD BODY: DOSSIER & METRICS */}
            <div className="p-6 space-y-5">
              <div className="text-center space-y-1">
                <h1 className="font-display font-black text-slate-900 dark:text-white text-2xl uppercase tracking-tight leading-tight">
                  {player.firstName} {player.lastName}
                </h1>

                {player.isFreeAgent ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">
                    <Compass size={13} className="text-amber-500" />
                    <span>Free Agent · Unattached</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                    <Shirt size={13} className="text-volt-500" />
                    <span>
                      {[player.franchiseName, player.academyName]
                        .filter(Boolean)
                        .join(" · ") || "Enrolled in Academy"}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-pitch-950/60 border border-slate-200/80 dark:border-white/5">
                <div className="text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                    Position
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate block mt-0.5">
                    {player.position || "—"}
                  </span>
                </div>
                <div className="text-center border-x border-slate-200 dark:border-white/5 px-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                    Category
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate block mt-0.5">
                    {player.ageGroup || "—"}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-center gap-1">
                    <Footprints size={10} className="text-volt-500" /> Foot
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 capitalize truncate block mt-0.5">
                    {player.preferredFoot || "—"}
                  </span>
                </div>
              </div>

              {/* Tactical Attributes or Free Agent / Unassessed Status */}
              {player.attributes ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-pitch-950/40 border border-slate-200/80 dark:border-white/5">
                  <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200/60 dark:border-white/5">
                    <span className="text-2xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                      <Activity size={12} className="text-volt-500" /> Tactical
                      Attributes
                    </span>
                    <span className="text-2xs font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles size={11} /> {player.totalEvaluations ? `${player.totalEvaluations} Sessions Verified` : "Coach Verified"}
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-1 text-center">
                    {[
                      { label: "PAC", val: player.attributes.pace },
                      { label: "SHO", val: player.attributes.shooting },
                      { label: "PAS", val: player.attributes.passing },
                      { label: "DRI", val: player.attributes.dribbling },
                      { label: "DEF", val: player.attributes.defending },
                      { label: "PHY", val: player.attributes.physical },
                    ].map((attr) => (
                      <div
                        key={attr.label}
                        className="p-1 rounded-lg bg-white/60 dark:bg-white/[0.03]"
                      >
                        <span className="text-[10px] font-mono text-slate-400 block font-bold">
                          {attr.label}
                        </span>
                        <span className="font-display font-black text-sm text-slate-900 dark:text-white">
                          {attr.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : player.isFreeAgent ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/20 dark:border-amber-400/15 flex items-start gap-3">
                  <Compass size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-left space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Free Agent Scouting Profile
                    </p>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Tactical attributes (PAC, SHO, PAS, DRI, DEF, PHY) are officially logged and certified by coaches upon academy signing and training session evaluations.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-pitch-950/40 border border-slate-200/80 dark:border-white/5 flex items-start gap-3">
                  <Activity size={18} className="text-volt-500 shrink-0 mt-0.5" />
                  <div className="text-left space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Awaiting Academy Assessments
                    </p>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Tactical attributes will dynamically calibrate as training sessions and match assessments are recorded at {player.academyName || player.franchiseName || "the academy"}.
                    </p>
                  </div>
                </div>
              )}

              {player.bio && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-pitch-950/40 border border-slate-200/70 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed text-center">
                  &ldquo;{player.bio}&rdquo;
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-white/10 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck size={16} />
                  <span>Hardware NFC Authenticated</span>
                </div>
                <span className="text-3xs font-mono text-slate-400 uppercase tracking-wider">
                  Noxphere PASS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="w-full max-w-[390px] flex items-center gap-3 mt-5 px-2">
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-display font-bold text-xs uppercase tracking-wider bg-pitch-950 text-volt-400 hover:bg-pitch-900 border border-volt-400/40 shadow-lg shadow-volt-400/10 transition-all dark:bg-volt-400 dark:text-pitch-950 dark:hover:bg-volt-300"
        >
          {copied ? (
            <CheckCircle2 size={16} className="text-field-400" />
          ) : (
            <Share2 size={16} />
          )}
          <span>{copied ? "Link Copied!" : "Share Athlete Card"}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          className="p-3 rounded-2xl bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-pitch-800 shadow-md transition-all"
          title="Show QR Code"
        >
          <QrCode size={20} />
        </button>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/15 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <span className="text-2xs font-mono uppercase tracking-wider text-volt-600 dark:text-volt-400 font-bold flex items-center gap-1">
                <Radio size={12} /> Scan Athlete Profile
              </span>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <h3 className="font-display font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight">
              {player.firstName} {player.lastName}
            </h3>

            <p className="text-xs text-slate-500">
              Point any camera at this QR code to instantly open this verified
              athlete card on any device.
            </p>

            <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-inner border border-slate-100">
              <QRCode
                value={window.location.href}
                size={180}
                level="H"
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-pitch-800 hover:bg-slate-200 dark:hover:bg-pitch-700 text-slate-800 dark:text-slate-200 text-xs font-bold uppercase tracking-wider transition-colors"
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

export default PublicPlayerPage;
