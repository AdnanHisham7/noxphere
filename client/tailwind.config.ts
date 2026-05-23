// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Primary dark surfaces
        pitch: {
          950: "#050508",
          900: "#0a0a0f",
          800: "#111118",
          700: "#1a1a24",
          600: "#22222f",
          500: "#2d2d3d",
        },
        // Brand accent - electric green (like eFootball score panels)
        volt: {
          400: "#ccff00",
          500: "#b3e600",
          600: "#99cc00",
        },
        // Secondary accent - cool cyan
        ice: {
          400: "#00d4ff",
          500: "#00b8e0",
          600: "#009cbf",
        },
        // Warning/alert
        ember: {
          400: "#ff6b35",
          500: "#e55a25",
          600: "#cc4a15",
        },
        // Success
        field: {
          400: "#00e676",
          500: "#00c853",
        },
        // Muted text
        slate: {
          350: "#94a3b8",
        },
      },
      fontFamily: {
        display: ["Barlow Condensed", "Impact", "sans-serif"],
        body: ["Barlow", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "2xs": "0.625rem",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      backgroundImage: {
        "pitch-gradient":
          "linear-gradient(135deg, #050508 0%, #0a0f1a 50%, #050508 100%)",
        "card-gradient": "linear-gradient(145deg, #1a1a24 0%, #111118 100%)",
        "volt-glow":
          "radial-gradient(circle at center, rgba(204,255,0,0.15) 0%, transparent 70%)",
        "ice-glow":
          "radial-gradient(circle at center, rgba(0,212,255,0.1) 0%, transparent 70%)",
      },
      boxShadow: {
        volt: "0 0 20px rgba(204,255,0,0.2), 0 0 40px rgba(204,255,0,0.05)",
        ice: "0 0 20px rgba(0,212,255,0.2), 0 0 40px rgba(0,212,255,0.05)",
        card: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        panel: "0 8px 32px rgba(0,0,0,0.6)",
      },
      borderColor: {
        DEFAULT: "rgba(255,255,255,0.06)",
      },
      animation: {
        "pulse-volt": "pulseVolt 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-right": "slideRight 0.25s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        "score-pop": "scorePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        pulseVolt: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        scorePop: {
          from: { opacity: "0", transform: "scale(0.8)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
