// src/features/landing/components/HeroSection.tsx
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import OrbitSystem from "./OrbitSystem";
import logoSrc from "@/assets/logo.png";
import { Sparkles, ArrowRight } from "lucide-react";

export const HeroSection: React.FC = () => {
  return (
    <section id="top" className="relative overflow-hidden pt-36 pb-20 md:pt-48 md:pb-32">
      <div className="absolute inset-0 bg-orbit-radial pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="nox-eyebrow">
            <span className="w-1.5 h-1.5 rounded-full bg-core-400 animate-core-pulse" />
            Everything revolves here
          </span>

          <h1 className="mt-5 font-orbital font-semibold text-3xl sm:text-4xl md:text-[3.25rem] leading-[1.12] md:leading-[1.08] text-nox-high tracking-tight">
            The football academy operating system
          </h1>

          <p className="mt-5 sm:mt-6 text-base sm:text-lg text-nox-mid max-w-md leading-relaxed">
            Manage students, fees, attendance, coaches, batches and reports in one place.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <a href="#final-cta" className="nox-btn-primary w-full sm:w-auto text-center">
              Book a demo
            </a>
            <a href="#how-it-works" className="nox-btn-secondary w-full sm:w-auto text-center">
              See how it works
            </a>
          </div>

          {/* Quick Access for Players & Existing Users */}
          <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
            <span className="text-nox-mid font-medium">Looking to join or sign in?</span>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/signup/student"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 dark:bg-core-400/10 border border-emerald-500/25 dark:border-core-400/25 text-emerald-700 dark:text-core-300 font-semibold hover:bg-emerald-500/20 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Player Sign Up
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-nox-high hover:bg-slate-200 dark:hover:bg-white/10 transition-colors font-medium"
              >
                Sign In
              </Link>
            </div>
          </div>

          <p className="mt-6 text-xs text-nox-low font-mono">
            Built for academy owners, associations, admins, coaches and guardians.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="relative"
        >
          <OrbitSystem variant="hero" className="w-full max-w-[520px] mx-auto" logoSrc={logoSrc} />

          <div className="absolute left-1/2 -translate-x-1/2 bottom-2 md:bottom-6 nox-card px-5 py-4 flex items-center gap-5 animate-orbit-float">
            <div>
              <div className="font-orbital text-xl font-semibold text-nox-high">3</div>
              <div className="text-[11px] text-nox-low font-mono uppercase tracking-wide">Centres</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="font-orbital text-xl font-semibold text-nox-high">412</div>
              <div className="text-[11px] text-nox-low font-mono uppercase tracking-wide">Students</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="font-orbital text-xl font-semibold text-core-400">96%</div>
              <div className="text-[11px] text-nox-low font-mono uppercase tracking-wide">Attendance today</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
