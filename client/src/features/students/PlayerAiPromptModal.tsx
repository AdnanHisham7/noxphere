// src/features/students/PlayerAiPromptModal.tsx
import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Camera,
  Shirt,
  Wand2,
  Info,
} from "lucide-react";
import { Modal, Button } from "../../components/ui";
import { useGetPlatformAiPromptQuery } from "../../store/api/academySubscriptionApi";
import { toast } from "react-hot-toast";

interface PlayerAiPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName?: string;
  ageGroup?: string;
  position?: string;
  teamName?: string;
  jerseyNumber?: number | string;
  jerseyImageUrl?: string;
  playerPhotoUrl?: string;
}

const FALLBACK_PROMPT =
  "Professional athletic sports photography portrait of youth football player [PlayerName], age category [AgeCategory], playing as [Position] for [TeamName]. Match face and hair details from the player reference photo, and kit details from the jersey reference image [JerseyRef]. Dramatic stadium rim lighting, athletic stance, crisp textures, highly detailed authentic skin, 8k resolution, cinematic trading card aesthetics.";

export const PlayerAiPromptModal: React.FC<PlayerAiPromptModalProps> = ({
  isOpen,
  onClose,
  playerName,
  ageGroup,
  position,
  teamName,
  jerseyNumber,
}) => {
  const { data: rawTemplate } = useGetPlatformAiPromptQuery();
  const [copied, setCopied] = useState(false);

  const template = rawTemplate || FALLBACK_PROMPT;

  const resolvedPrompt = useMemo(() => {
    let p = template;
    const cleanName = playerName?.trim() || "[Player Name]";
    const cleanAge = ageGroup?.trim() || "Youth";
    const cleanPos = position?.trim() || "Player";
    const cleanTeam = teamName?.trim() || "Team";
    const jerseyNote = jerseyNumber
      ? `(Official jersey #${jerseyNumber} reference image attached)`
      : "(Official team jersey reference image attached)";

    p = p.replace(/\[PlayerName\]/gi, cleanName);
    p = p.replace(/\[AgeCategory\]/gi, cleanAge);
    p = p.replace(/\[Position\]/gi, cleanPos);
    p = p.replace(/\[TeamName\]/gi, cleanTeam);
    p = p.replace(/\[JerseyRef\]/gi, jerseyNote);
    return p;
  }, [template, playerName, ageGroup, position, teamName, jerseyNumber]);

  const handleCopy = () => {
    navigator.clipboard.writeText(resolvedPrompt);
    setCopied(true);
    toast.success("AI Prompt copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Player Avatar with AI"
      size="lg"
    >
      <div className="space-y-5 animate-fade-in">
        {/* Dynamic Prompt Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
              Formulated Prompt for {playerName?.trim() || "Player"}
            </span>
            <Button
              size="sm"
              variant={copied ? "primary" : "secondary"}
              onClick={handleCopy}
              icon={copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              className="text-xs font-semibold"
            >
              {copied ? "Copied to Clipboard!" : "Copy Prompt"}
            </Button>
          </div>

          <div className="relative group">
            <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed border border-slate-700/60 dark:border-white/10 select-all shadow-inner">
              {resolvedPrompt}
            </div>
          </div>
        </div>

        {/* 3-Step Workflow Guide */}
        <div className="space-y-2.5">
          <p className="text-2xs font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
            How to Generate the Image (3 Quick Steps)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-pitch-900/40 border border-slate-200/80 dark:border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-volt-600 dark:text-volt-400 font-semibold text-xs">
                <Camera size={14} />
                <span>1. Face Photo</span>
              </div>
              <p className="text-3xs text-slate-500 dark:text-slate-400 leading-normal">
                Attach a clear photo of the player&apos;s face so the AI matches their facial likeness.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-pitch-900/40 border border-slate-200/80 dark:border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-sky-500 dark:text-ice-400 font-semibold text-xs">
                <Shirt size={14} />
                <span>2. Team Jersey</span>
              </div>
              <p className="text-3xs text-slate-500 dark:text-slate-400 leading-normal">
                Attach a photo of your squad&apos;s official jersey/kit so the AI recreates the right colors & styling.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-pitch-900/40 border border-slate-200/80 dark:border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-500 dark:text-field-400 font-semibold text-xs">
                <Wand2 size={14} />
                <span>3. Paste & Generate</span>
              </div>
              <p className="text-3xs text-slate-500 dark:text-slate-400 leading-normal">
                Paste the copied prompt along with the two reference photos into Midjourney, ChatGPT, or your favorite AI tool.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Launch Links & Footer */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Info size={14} className="shrink-0" />
            <span>Open in AI Image Generator:</span>
            <a
              href="https://chatgpt.com"
              target="_blank"
              rel="noreferrer"
              className="text-volt-600 dark:text-volt-400 font-semibold hover:underline inline-flex items-center gap-0.5 ml-1"
            >
              <span>ChatGPT</span>
              <ExternalLink size={11} />
            </a>
            <span>·</span>
            <a
              href="https://www.midjourney.com"
              target="_blank"
              rel="noreferrer"
              className="text-volt-600 dark:text-volt-400 font-semibold hover:underline inline-flex items-center gap-0.5"
            >
              <span>Midjourney</span>
              <ExternalLink size={11} />
            </a>
          </div>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
export default PlayerAiPromptModal;
