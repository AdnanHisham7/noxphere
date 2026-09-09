import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logoSrc from "@/assets/logo.png";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Menu, X, UserPlus, LogIn, Sparkles } from "lucide-react";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#roles", label: "Roles" },
  { href: "#faq", label: "FAQ" },
];

export const LandingNavbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-close mobile menu on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled || mobileMenuOpen
          ? "bg-white/95 dark:bg-ink-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.06] shadow-sm dark:shadow-none"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4">
        <a href="#top" className="flex items-center gap-2">
          <img
            src={logoSrc}
            alt="Noxphere Logo"
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
          />
          <span className="font-orbital font-semibold text-base sm:text-lg tracking-tight text-nox-high">
            Noxphere
          </span>
        </a>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-nox-mid hover:text-nox-high transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle size="sm" />

          {/* Desktop Player Sign Up */}
          <Link
            to="/signup/student"
            className="hidden lg:inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-core-400 dark:hover:text-core-300 transition-colors uppercase tracking-wider px-2 py-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Player Sign Up
          </Link>

          {/* Sign in - Visible on all viewports */}
          <Link
            to="/login"
            className="text-xs sm:text-sm font-medium text-nox-mid hover:text-nox-high px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            Sign in
          </Link>

          {/* Book a demo - sm+ screens */}
          <a
            href="#final-cta"
            className="hidden sm:inline-flex nox-btn-primary !px-3 sm:!px-4 !py-1.5 sm:!py-2 text-xs"
          >
            Book a demo
          </a>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg text-nox-mid hover:text-nox-high hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors focus:outline-none focus:ring-2 focus:ring-core-400/30"
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-nox-high" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer / Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 dark:border-white/[0.06] bg-white/95 dark:bg-ink-950/95 backdrop-blur-xl px-4 py-5 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-3.5">
            {/* Quick Actions (Player Signup & Sign In) */}
            <div className="grid grid-cols-1 gap-2.5 pb-3 border-b border-slate-200/60 dark:border-white/[0.06]">
              <Link
                to="/signup/student"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500/15 to-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-core-300 font-semibold text-xs tracking-wider uppercase shadow-xs active:scale-[0.98] transition-all"
              >
                <UserPlus className="w-4 h-4 text-emerald-600 dark:text-core-400" />
                Player Sign Up
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/10 text-nox-high font-medium text-xs active:scale-[0.98] transition-all"
                >
                  <LogIn className="w-3.5 h-3.5 text-nox-mid" />
                  Sign In
                </Link>
                <a
                  href="#final-cta"
                  onClick={() => setMobileMenuOpen(false)}
                  className="nox-btn-primary flex items-center justify-center !text-xs !py-2"
                >
                  Book a demo
                </a>
              </div>
            </div>

            {/* Navigation Anchor Links */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-nox-low px-2 mb-0.5">
                Explore Noxphere
              </span>
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm text-nox-mid hover:text-nox-high hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default LandingNavbar;
