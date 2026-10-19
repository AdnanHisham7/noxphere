// src/components/layout/GeoRestrictionBanner.tsx
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Globe, ShieldAlert, X, ChevronRight, Info, MapPin } from "lucide-react";
import { RootState } from "../../store";
import { Modal, Button } from "../ui";

export const GeoRestrictionBanner: React.FC = () => {
  const geo = useSelector((s: RootState) => s.auth.geoRestriction);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [simulatedCountry, setSimulatedCountry] = useState<string>(
    () => localStorage.getItem("nox_simulated_country") || ""
  );

  if (!geo?.isRestricted) {
    return null;
  }

  const handleSetSimulatedCountry = (country: string) => {
    if (country) {
      localStorage.setItem("nox_simulated_country", country);
    } else {
      localStorage.removeItem("nox_simulated_country");
    }
    setSimulatedCountry(country);
    window.location.reload();
  };

  const detectedName = geo.detectedCountryName || geo.detectedCountry || "Foreign Location";
  const requiredName = geo.allowedCountryName || geo.requiredCountry || "Registered Jurisdiction";

  return (
    <>
      {/* Top Notification Banner */}
      {!dismissed && (
        <div className="relative bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 border-b border-amber-500/30 text-amber-950 dark:text-amber-200 px-3 sm:px-4 py-2 transition-all duration-200 animate-fade-in shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Globe size={13} className="animate-pulse" />
              </div>

              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/25 border border-amber-500/40 text-amber-900 dark:text-amber-300 shrink-0">
                  Read-Only Mode
                </span>
                <p className="text-slate-800 dark:text-amber-100 font-medium truncate">
                  Viewing from <strong className="text-slate-900 dark:text-white">{detectedName}</strong> ({geo.detectedCountry}). All academy dashboards and reports are accessible for review and meetings. Modifications are restricted to <strong className="text-slate-900 dark:text-white">{requiredName}</strong> ({geo.requiredCountry}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/80 dark:bg-pitch-800/80 border border-amber-500/30 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/50 transition-colors shadow-2xs"
              >
                <span>Details & QA</span>
                <ChevronRight size={11} />
              </button>

              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="p-1 rounded-md text-amber-800 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                title="Dismiss banner (Badge stays in topbar)"
                aria-label="Dismiss banner"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details & QA Simulation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Travel & Read-Only Access Mode"
        size="md"
      >
        <div className="space-y-4 py-1 text-xs text-slate-600 dark:text-slate-300">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-sm">
              <Globe size={16} />
              <span>Cross-Border Read-Only Policy</span>
            </div>
            <p className="leading-relaxed">
              When managers, coaches, or staff travel abroad to attend meetings or tournaments, Noxphere provides unrestricted read access to inspect student profiles, review match performance, and present academy reports. However, creating records, processing fees, or updating accounts is locked to protect legal compliance.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-pitch-900/60 border border-slate-200 dark:border-white/5">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                Detected Location
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 text-sm mt-0.5 flex items-center gap-1">
                <MapPin size={13} /> {detectedName} ({geo.detectedCountry || "—"})
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                Academy Jurisdiction
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 flex items-center gap-1">
                <MapPin size={13} /> {requiredName} ({geo.requiredCountry || "—"})
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-white/5">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
              <span>Developer & QA Simulation Tool</span>
              {simulatedCountry && (
                <span className="text-volt-500 font-bold">Active: {simulatedCountry}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleSetSimulatedCountry("IN")}
                className={`text-2xs px-2.5 py-1 rounded border transition-colors ${
                  simulatedCountry === "IN"
                    ? "bg-volt-400 text-black font-bold border-volt-400"
                    : "bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                }`}
              >
                Simulate India (IN)
              </button>
              <button
                type="button"
                onClick={() => handleSetSimulatedCountry("SA")}
                className={`text-2xs px-2.5 py-1 rounded border transition-colors ${
                  simulatedCountry === "SA"
                    ? "bg-volt-400 text-black font-bold border-volt-400"
                    : "bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                }`}
              >
                Simulate Saudi Arabia (SA)
              </button>
              <button
                type="button"
                onClick={() => handleSetSimulatedCountry("OM")}
                className={`text-2xs px-2.5 py-1 rounded border transition-colors ${
                  simulatedCountry === "OM"
                    ? "bg-volt-400 text-black font-bold border-volt-400"
                    : "bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                }`}
              >
                Simulate Oman (OM)
              </button>
              <button
                type="button"
                onClick={() => handleSetSimulatedCountry("US")}
                className={`text-2xs px-2.5 py-1 rounded border transition-colors ${
                  simulatedCountry === "US"
                    ? "bg-volt-400 text-black font-bold border-volt-400"
                    : "bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                }`}
              >
                Simulate USA (US)
              </button>
              {simulatedCountry && (
                <button
                  type="button"
                  onClick={() => handleSetSimulatedCountry("")}
                  className="text-2xs px-2.5 py-1 rounded border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  Reset Simulation
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
