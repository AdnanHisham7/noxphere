// src/features/academies/PlatformBillingCard.tsx
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  CircleDollarSign,
  Users2,
  Repeat2,
  Globe2,
  Clock,
  Shield,
  Edit2,
  Check,
  X,
  Plus,
} from "lucide-react";
import { Button, Input, Modal, Badge } from "../../components/ui";
import {
  useGetPlatformDefaultRateQuery,
  useSetPlatformDefaultRateMutation,
  useGetPlatformDefaultStaffRateQuery,
  useSetPlatformDefaultStaffRateMutation,
  useGetPlatformCurrenciesQuery,
  useSetPlatformCurrencyRateMutation,
  useGetPlatformTrialDefaultsQuery,
  useSetPlatformTrialDefaultsMutation,
  useGetPlatformTransferWallQuery,
  useSetPlatformTransferWallMutation,
  type CurrencyPricing,
} from "../../store/api/academySubscriptionApi";

export const PlatformBillingCard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"currencies" | "trials" | "wall">("currencies");

  // Multi-Currency Queries & Mutations
  const { data: currencies = [], isLoading: currenciesLoading } = useGetPlatformCurrenciesQuery();
  const [setCurrencyRate, { isLoading: savingCurrency }] = useSetPlatformCurrencyRateMutation();
  const [editingCurrency, setEditingCurrency] = useState<CurrencyPricing | null>(null);
  const [editStudentRate, setEditStudentRate] = useState("");
  const [editStaffRate, setEditStaffRate] = useState("");

  // Trial Defaults Queries & Mutations
  const { data: trialDefaults, isLoading: trialLoading } = useGetPlatformTrialDefaultsQuery();
  const [setTrialDefaults, { isLoading: savingTrial }] = useSetPlatformTrialDefaultsMutation();
  const [trialDays, setTrialDays] = useState("14");
  const [trialCapacity, setTrialCapacity] = useState("50");
  const [trialStaffCapacity, setTrialStaffCapacity] = useState("5");

  useEffect(() => {
    if (trialDefaults) {
      setTrialDays(String(trialDefaults.defaultTrialDays));
      setTrialCapacity(String(trialDefaults.defaultTrialCapacity));
      setTrialStaffCapacity(String(trialDefaults.defaultTrialStaffCapacity));
    }
  }, [trialDefaults]);

  // Transfer Wall
  const { data: transferWallEnabled, isLoading: transferWallLoading } = useGetPlatformTransferWallQuery();
  const [setPlatformTransferWall, { isLoading: togglingTransferWall }] = useSetPlatformTransferWallMutation();

  const handleEditCurrency = (curr: CurrencyPricing) => {
    setEditingCurrency(curr);
    setEditStudentRate(String(curr.ratePerStudentPerDay));
    setEditStaffRate(String(curr.staffRatePerStaffPerMonth));
  };

  const handleSaveCurrency = async () => {
    if (!editingCurrency) return;
    const sRate = parseFloat(editStudentRate);
    const stRate = parseFloat(editStaffRate);
    if (isNaN(sRate) || sRate < 0 || isNaN(stRate) || stRate < 0) {
      toast.error("Please enter valid positive numbers for rates");
      return;
    }

    try {
      await setCurrencyRate({
        currency: editingCurrency.currency,
        ratePerStudentPerDay: sRate,
        staffRatePerStaffPerMonth: stRate,
        symbol: editingCurrency.symbol,
        countryCode: editingCurrency.countryCode,
        countryName: editingCurrency.countryName,
        isActive: true,
      }).unwrap();
      toast.success(`${editingCurrency.currency} pricing rate updated!`);
      setEditingCurrency(null);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update currency rate");
    }
  };

  const handleSaveTrialDefaults = async () => {
    const days = parseInt(trialDays);
    const capacity = parseInt(trialCapacity);
    const staff = parseInt(trialStaffCapacity);

    if (isNaN(days) || days < 1) {
      toast.error("Trial days must be at least 1");
      return;
    }
    if (isNaN(capacity) || capacity < 1) {
      toast.error("Trial player capacity must be at least 1");
      return;
    }
    if (isNaN(staff) || staff < 0) {
      toast.error("Trial staff capacity cannot be negative");
      return;
    }

    try {
      await setTrialDefaults({
        defaultTrialDays: days,
        defaultTrialCapacity: capacity,
        defaultTrialStaffCapacity: staff,
      }).unwrap();
      toast.success("Platform free trial defaults saved successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update trial defaults");
    }
  };

  const handleToggleTransferWall = async () => {
    const nextState = transferWallEnabled === false ? true : false;
    try {
      await setPlatformTransferWall(nextState).unwrap();
      toast.success(nextState ? "Platform Transfer Wall enabled" : "Platform Transfer Wall disabled globally");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update Transfer Wall setting");
    }
  };

  return (
    <div className="card p-5 space-y-5 border border-white/5 bg-pitch-900/40">
      {/* Header with Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Shield size={16} className="text-volt-400" />
            Platform Licensing, Currency &amp; Trial Engine
          </h2>
          <p className="text-2xs text-slate-500 mt-0.5">
            Configure country-specific currency pricing rates, free trial limits, and global system switches
          </p>
        </div>

        <div className="flex items-center gap-1 bg-pitch-950 p-1 rounded-lg border border-white/5 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("currencies")}
            className={`px-3 py-1 text-2xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === "currencies"
                ? "bg-volt-400 text-pitch-900 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe2 size={13} /> Multi-Currency Rates
          </button>
          <button
            onClick={() => setActiveTab("trials")}
            className={`px-3 py-1 text-2xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === "trials"
                ? "bg-volt-400 text-pitch-900 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Clock size={13} /> Trial Engine
          </button>
          <button
            onClick={() => setActiveTab("wall")}
            className={`px-3 py-1 text-2xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === "wall"
                ? "bg-volt-400 text-pitch-900 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Repeat2 size={13} /> Transfer Wall
          </button>
        </div>
      </div>

      {/* Tab 1: Multi-Currency Pricing Table */}
      {activeTab === "currencies" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 leading-relaxed">
              Each currency is configured separately with independent rates for local markets (no automatic INR exchange conversion). Academies registered under a currency are geo-restricted to their respective country.
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/5 bg-pitch-950/50">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-pitch-800/40 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Currency</th>
                  <th className="py-2.5 px-3">Country &amp; Jurisdiction</th>
                  <th className="py-2.5 px-3">Student Rate (/day)</th>
                  <th className="py-2.5 px-3">Staff Rate (/month)</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {currencies.map((curr) => (
                  <tr key={curr.currency} className="hover:bg-white/2 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded bg-pitch-800 flex items-center justify-center font-bold text-volt-400 text-xs font-mono border border-white/5">
                          {curr.symbol}
                        </span>
                        <div>
                          <span className="font-bold text-white block">{curr.currency}</span>
                          <span className="text-[10px] text-slate-500 font-mono">Geo: {curr.countryCode}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-slate-300 font-medium">{curr.countryName}</span>
                      <span className="text-[10px] text-emerald-400 block font-mono">
                        Enforced in {curr.countryCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-volt-400 text-sm">
                        {curr.symbol} {curr.ratePerStudentPerDay}
                      </span>
                      <span className="text-[10px] text-slate-500 block">/ student / day</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-ice-400 text-sm">
                        {curr.symbol} {curr.staffRatePerStaffPerMonth}
                      </span>
                      <span className="text-[10px] text-slate-500 block">/ staff / mo</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEditCurrency(curr)}
                        className="text-2xs"
                        icon={<Edit2 size={12} />}
                      >
                        Edit Rate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Free Trial Engine Configuration */}
      {activeTab === "trials" && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-volt-400/5 border border-volt-400/15 flex items-start gap-3">
            <Clock size={20} className="text-volt-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <strong className="text-white block font-semibold">Automated Academy Trial Safeguard</strong>
              <p>
                When a new academy registers, they enter a full-featured trial period with the defaults below. During the trial, all core software operations (student rosters, coaching sessions, attendance) are allowed up to the trial capacity. When the trial expires, the software automatically gates operations until a paid subscription is activated.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Default Trial Duration</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={trialLoading ? "" : trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                  className="w-full font-mono font-bold"
                />
                <span className="text-xs text-slate-400 shrink-0 font-medium">Days</span>
              </div>
              <p className="text-[10px] text-slate-500">Days allowed for testing before purchase</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Default Player Capacity</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={trialLoading ? "" : trialCapacity}
                  onChange={(e) => setTrialCapacity(e.target.value)}
                  className="w-full font-mono font-bold"
                />
                <span className="text-xs text-slate-400 shrink-0 font-medium">Students</span>
              </div>
              <p className="text-[10px] text-slate-500">Max students allowed during trial period</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Default Staff Capacity</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={trialLoading ? "" : trialStaffCapacity}
                  onChange={(e) => setTrialStaffCapacity(e.target.value)}
                  className="w-full font-mono font-bold"
                />
                <span className="text-xs text-slate-400 shrink-0 font-medium">Staff Seats</span>
              </div>
              <p className="text-[10px] text-slate-500">Max managing employees allowed in trial</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              variant="primary"
              loading={savingTrial}
              onClick={handleSaveTrialDefaults}
              className="font-bold"
            >
              Save Platform Trial Defaults
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: Platform Transfer Wall */}
      {activeTab === "wall" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 rounded-xl bg-pitch-950/60 border border-white/5">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-ember-500/10 border border-ember-500/20 flex items-center justify-center flex-shrink-0">
              <Repeat2 size={18} className="text-ember-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Platform Transfer Wall</p>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    transferWallEnabled !== false
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {transferWallEnabled !== false ? "ENABLED" : "DISABLED"}
                </span>
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">
                When disabled, all transfer wall pages, player scouting listings, and navigation links are globally restricted.
              </p>
            </div>
          </div>
          <div>
            <Button
              size="sm"
              variant={transferWallEnabled !== false ? "danger" : "primary"}
              loading={togglingTransferWall || transferWallLoading}
              onClick={handleToggleTransferWall}
            >
              {transferWallEnabled !== false ? "Disable Globally" : "Enable Globally"}
            </Button>
          </div>
        </div>
      )}

      {/* Modal: Edit Currency Rate */}
      {editingCurrency && (
        <Modal
          isOpen={true}
          onClose={() => setEditingCurrency(null)}
          title={`Edit Pricing: ${editingCurrency.currency} (${editingCurrency.countryName})`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-pitch-800/60 border border-white/5 text-xs text-slate-300 space-y-1">
              <p>
                <strong>Jurisdiction:</strong> {editingCurrency.countryName} ({editingCurrency.countryCode})
              </p>
              <p>
                <strong>Currency Symbol:</strong> {editingCurrency.symbol}
              </p>
              <p className="text-[11px] text-slate-400">
                Academies subscribing in {editingCurrency.currency} will only be permitted to operate within {editingCurrency.countryName}.
              </p>
            </div>

            <div className="space-y-3">
              <Input
                label={`Student Rate (${editingCurrency.symbol}/student/day)`}
                type="number"
                step="0.01"
                min="0"
                value={editStudentRate}
                onChange={(e) => setEditStudentRate(e.target.value)}
                required
              />

              <Input
                label={`Staff Seat Rate (${editingCurrency.symbol}/staff/month)`}
                type="number"
                step="0.01"
                min="0"
                value={editStaffRate}
                onChange={(e) => setEditStaffRate(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingCurrency(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={savingCurrency}
                onClick={handleSaveCurrency}
                className="font-bold"
              >
                Save {editingCurrency.currency} Rate
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};