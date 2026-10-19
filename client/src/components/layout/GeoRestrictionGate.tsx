// src/components/layout/GeoRestrictionGate.tsx
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Globe, MapPin, ShieldAlert, X } from "lucide-react";
import { Button, Modal } from "../ui";
import { setGeoRestriction, type GeoRestrictionStatus } from "../../store/slices/authSlice";
import { RootState } from "../../store";

interface GeoMutationBlockedInfo {
  message: string;
  detectedCountry?: string;
  requiredCountry?: string;
  currency?: string;
}

export const GeoRestrictionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const geo = useSelector((s: RootState) => s.auth.geoRestriction);
  const [mutationBlockedInfo, setMutationBlockedInfo] = useState<GeoMutationBlockedInfo | null>(null);

  useEffect(() => {
    const handleMutationBlocked = (e: Event) => {
      const customEvent = e as CustomEvent<GeoMutationBlockedInfo>;
      if (customEvent.detail) {
        setMutationBlockedInfo(customEvent.detail);
        dispatch(
          setGeoRestriction({
            isRestricted: true,
            detectedCountry: customEvent.detail.detectedCountry,
            requiredCountry: customEvent.detail.requiredCountry,
            currency: customEvent.detail.currency,
          })
        );
      }
    };

    const handleGeoStatus = (e: Event) => {
      const customEvent = e as CustomEvent<GeoRestrictionStatus>;
      if (customEvent.detail) {
        dispatch(setGeoRestriction(customEvent.detail));
      }
    };

    window.addEventListener("nox_geo_mutation_blocked", handleMutationBlocked);
    window.addEventListener("nox_geo_status", handleGeoStatus);
    return () => {
      window.removeEventListener("nox_geo_mutation_blocked", handleMutationBlocked);
      window.removeEventListener("nox_geo_status", handleGeoStatus);
    };
  }, [dispatch]);

  return (
    <>
      {/* Non-blocking: Children are always rendered so user can view data and present in meetings */}
      {children}

      {/* Warning modal triggered only when an active mutation (POST/PUT/PATCH/DELETE) was attempted and blocked */}
      <Modal
        isOpen={!!mutationBlockedInfo}
        onClose={() => setMutationBlockedInfo(null)}
        title="Operation Restricted"
        size="md"
      >
        <div className="space-y-4 py-1 text-xs text-slate-600 dark:text-slate-300">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert size={18} />
            </div>
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                Read-Only Travel Mode Active
              </p>
              <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                {mutationBlockedInfo?.message ||
                  "You are connected from outside the academy's registered country. You have full read access to view records and show dashboards in meetings, but saving changes or creating new data is restricted."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-pitch-900 border border-slate-200 dark:border-white/5">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Your Detected Country
              </span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm mt-0.5 flex items-center gap-1">
                <MapPin size={13} /> {mutationBlockedInfo?.detectedCountry || geo?.detectedCountry || "—"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Academy Jurisdiction
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 flex items-center gap-1">
                <MapPin size={13} /> {mutationBlockedInfo?.requiredCountry || geo?.requiredCountry || "—"}
              </span>
            </div>
          </div>

          <p className="text-2xs text-slate-500 dark:text-slate-400">
            To make updates, fee recordings, or roster changes, access must originate within the registered country jurisdiction.
          </p>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setMutationBlockedInfo(null)}>
              Got it, continue in Read-Only
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
