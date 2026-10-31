// src/features/super-admin/PlatformSettingsPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import {
  Sliders,
  Globe2,
  Clock,
  ShieldCheck,
  CreditCard,
  Building2,
  Info,
  ExternalLink,
} from "lucide-react";
import { PageHeader, Button, Badge } from "../../components/ui";
import { PlatformBillingCard } from "../academies/PlatformBillingCard";
import {
  useGetPlatformCurrenciesQuery,
  useGetPlatformTrialDefaultsQuery,
} from "../../store/api/academySubscriptionApi";

export const PlatformSettingsPage: React.FC = () => {
  const { data: currencies = [] } = useGetPlatformCurrenciesQuery();
  const { data: trialDefaults } = useGetPlatformTrialDefaultsQuery();

  const activeCurrenciesCount = currencies.filter((c) => c.isActive !== false).length;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        eyebrow="Global System Engine • Super Admin Control"
        title="Platform Licensing & Currency Engine"
        subtitle="Configure multi-currency SaaS billing rates, the automated free trial engine, and player transfer wall rules."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/academies">
              <Button size="sm" variant="secondary" icon={<Building2 size={14} />}>
                Academy Directory
              </Button>
            </Link>
            <Link to="/finance">
              <Button size="sm" variant="secondary" icon={<CreditCard size={14} />}>
                Finance Ledger
              </Button>
            </Link>
          </div>
        }
      />

      {/* Info Notice Banner */}
      <div className="card p-4 bg-slate-900/60 dark:bg-pitch-900/40 border border-slate-700/50 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-lg bg-volt-400/10 text-volt-400 shrink-0">
            <Sliders size={18} />
          </div>
          <div>
            <p className="font-semibold text-slate-100">
              System-Wide Pricing & Automated License Policy
            </p>
            <p className="text-slate-400 mt-0.5">
              Settings configured here apply globally to all newly onboarded academies. Individual academies can still receive custom rate overrides from the Academies Management console.
            </p>
          </div>
        </div>
        <Badge variant="blue" className="shrink-0">
          Engine Version 2.4 Active
        </Badge>
      </div>

      {/* Quick Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="card p-4 border border-slate-200 dark:border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Active Currencies
            </span>
            <Globe2 size={16} className="text-sky-500" />
          </div>
          <p className="text-2xl font-display font-extrabold text-slate-900 dark:text-white">
            {activeCurrenciesCount} Currencies
          </p>
          <p className="text-2xs text-slate-500">
            Multi-currency geolocated SaaS &amp; NFC pricing active
          </p>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Default Free Trial
            </span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-display font-extrabold text-slate-900 dark:text-white">
            {trialDefaults?.defaultTrialDays ?? 14} Days
          </p>
          <p className="text-2xs text-slate-500">
            {trialDefaults?.defaultTrialCapacity ?? 50} players · {trialDefaults?.defaultTrialStaffCapacity ?? 5} staff capacity
          </p>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Licensing Engine
            </span>
            <ShieldCheck size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-display font-extrabold text-slate-900 dark:text-white">
            Registered Currency
          </p>
          <p className="text-2xs text-slate-500">
            Billing &amp; NFC card orders inherit academy local currency
          </p>
        </div>
      </div>

      {/* Main Multi-Currency, Trial Engine, and Transfer Wall Controller */}
      <PlatformBillingCard />
    </div>
  );
};

export default PlatformSettingsPage;
