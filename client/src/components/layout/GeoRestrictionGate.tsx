// src/components/layout/GeoRestrictionGate.tsx
import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Globe, MapPin, ShieldAlert, LogOut, RefreshCw } from "lucide-react";
import { Button } from "../ui";
import { clearCredentials } from "../../store/slices/authSlice";
import { clearActiveFranchise } from "../../store/slices/uiSlice";
import { clearNotifications } from "../../store/slices/notificationSlice";
import { baseApi } from "../../store/api/baseApi";

interface GeoBlockInfo {
  message: string;
  detectedCountry?: string;
  requiredCountry?: string;
  currency?: string;
}

export const GeoRestrictionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const [geoBlock, setGeoBlock] = useState<GeoBlockInfo | null>(null);
  const [simulatedCountry, setSimulatedCountry] = useState<string>(
    () => localStorage.getItem("nox_simulated_country") || ""
  );

  useEffect(() => {
    const handleGeoEvent = (e: Event) => {
      const customEvent = e as CustomEvent<GeoBlockInfo>;
      if (customEvent.detail) {
        setGeoBlock(customEvent.detail);
      }
    };

    window.addEventListener("nox_geo_restriction", handleGeoEvent);
    return () => {
      window.removeEventListener("nox_geo_restriction", handleGeoEvent);
    };
  }, []);

  const handleLogout = () => {
    dispatch(clearCredentials());
    dispatch(clearActiveFranchise());
    dispatch(clearNotifications());
    dispatch(baseApi.util.resetApiState());
    setGeoBlock(null);
  };

  const handleSetSimulatedCountry = (country: string) => {
    if (country) {
      localStorage.setItem("nox_simulated_country", country);
    } else {
      localStorage.removeItem("nox_simulated_country");
    }
    setSimulatedCountry(country);
    setGeoBlock(null);
    window.location.reload();
  };

  if (!geoBlock) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pitch-950/95 backdrop-blur-md text-white p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-lg w-full bg-pitch-900 border border-ember-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-2xl shadow-ember-500/10 space-y-5">
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-ember-500/20 animate-ping opacity-25" />
          <div className="relative w-16 h-16 rounded-full bg-ember-500/10 border border-ember-500/40 flex items-center justify-center text-ember-400">
            <Globe size={32} />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-pitch-900 border border-rose-500 flex items-center justify-center text-rose-400">
            <ShieldAlert size={16} />
          </div>
        </div>

        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase px-2.5 py-1 rounded bg-ember-500/15 text-ember-400 border border-ember-500/30">
            Geographic Boundary Policy
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-3 uppercase tracking-tight">
            Operation Geo-Restricted
          </h2>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            {geoBlock.message || "This academy's operations are legally restricted to its registered country."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-pitch-950/70 border border-white/5 text-left text-xs">
          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
              Registered Currency
            </span>
            <span className="font-bold text-volt-400 text-sm mt-0.5 block">
              {geoBlock.currency || "N/A"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
              Required Country
            </span>
            <span className="font-bold text-emerald-400 text-sm mt-0.5 flex items-center gap-1">
              <MapPin size={13} /> {geoBlock.requiredCountry || "N/A"}
            </span>
          </div>
          <div className="col-span-2 pt-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
              Your Detected Location
            </span>
            <span className="font-mono font-bold text-rose-400">
              {geoBlock.detectedCountry || "Unknown"}
            </span>
          </div>
        </div>

        <p className="text-2xs text-slate-400 leading-normal">
          In accordance with platform security and national licensing, all accounts (managers, coaches, staff, guardians, and players) under this academy can only operate within the registered country jurisdiction.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full sm:w-auto text-slate-400 hover:text-rose-400"
          >
            <LogOut size={14} className="mr-1.5" /> Sign Out
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto"
          >
            <RefreshCw size={14} className="mr-1.5" /> Retry Connection
          </Button>
        </div>

        {/* Development / Testing Simulation Panel */}
        <div className="pt-4 border-t border-white/5 text-left">
          <p className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
            <span>Dev & QA Testing Simulation</span>
            {simulatedCountry && (
              <span className="text-volt-400">Active: {simulatedCountry}</span>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleSetSimulatedCountry("IN")}
              className={`text-2xs px-2 py-1 rounded border transition-colors ${
                simulatedCountry === "IN"
                  ? "bg-volt-400 text-black font-bold border-volt-400"
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              Simulate India (IN)
            </button>
            <button
              onClick={() => handleSetSimulatedCountry("SA")}
              className={`text-2xs px-2 py-1 rounded border transition-colors ${
                simulatedCountry === "SA"
                  ? "bg-volt-400 text-black font-bold border-volt-400"
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              Simulate Saudi Arabia (SA)
            </button>
            <button
              onClick={() => handleSetSimulatedCountry("OM")}
              className={`text-2xs px-2 py-1 rounded border transition-colors ${
                simulatedCountry === "OM"
                  ? "bg-volt-400 text-black font-bold border-volt-400"
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              Simulate Oman (OM)
            </button>
            <button
              onClick={() => handleSetSimulatedCountry("US")}
              className={`text-2xs px-2 py-1 rounded border transition-colors ${
                simulatedCountry === "US"
                  ? "bg-volt-400 text-black font-bold border-volt-400"
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              Simulate USA (US)
            </button>
            {simulatedCountry && (
              <button
                onClick={() => handleSetSimulatedCountry("")}
                className="text-2xs px-2 py-1 rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
