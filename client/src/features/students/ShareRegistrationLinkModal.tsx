// src/features/students/ShareRegistrationLinkModal.tsx
import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Modal, Button } from "@/components/ui";
import { Copy, CheckCircle2, ExternalLink, Globe, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

interface ShareRegistrationLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyId: string;
  academyName?: string;
}

export const ShareRegistrationLinkModal: React.FC<ShareRegistrationLinkModalProps> = ({
  isOpen,
  onClose,
  academyId,
  academyName = "Academy",
}) => {
  const [copied, setCopied] = useState(false);
  const registrationUrl = `${window.location.origin}/register/academy/${academyId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(registrationUrl);
    setCopied(true);
    toast.success("Academy registration invite link copied!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Academy Registration Invite Link" size="md">
      <div className="space-y-6 pt-2">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-volt-400/10 text-volt-500 text-xs font-mono font-semibold">
            <Sparkles size={13} /> Public Admissions Link
          </div>
          <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
            Invite Players to {academyName}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Share this link with prospective students and parents. They can fill out details online or connect an existing Noxphere player profile.
          </p>
        </div>

        {/* URL Input & Copy button */}
        <div className="p-3 bg-slate-100 dark:bg-pitch-900 rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={registrationUrl}
              className="input text-xs font-mono py-2 bg-white dark:bg-pitch-800"
            />
            <Button size="sm" onClick={handleCopy} className="whitespace-nowrap">
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {/* QR Code */}
        <div className="text-center space-y-3">
          <p className="text-2xs uppercase tracking-widest text-slate-400 font-mono">
            Scan to Open Registration Form
          </p>
          <div className="p-4 bg-white rounded-2xl inline-block shadow-md mx-auto border border-slate-200">
            <QRCode value={registrationUrl} size={150} level="H" bgColor="#FFFFFF" fgColor="#000000" />
          </div>
        </div>

        {/* Info bullets */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-pitch-800/60 border border-slate-200 dark:border-white/5 text-2xs text-slate-500 space-y-1.5">
          <p className="font-semibold text-slate-700 dark:text-slate-300">Tips for Academy Outreach:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Place this link in your academy&apos;s Instagram bio, WhatsApp announcement groups, or flyers.</li>
            <li>New registrations land under your <strong>Registration Requests</strong> tab for review and one-click approval.</li>
          </ul>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10">
          <a
            href={registrationUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-volt-500 hover:underline inline-flex items-center gap-1 font-medium"
          >
            Preview public page <ExternalLink size={12} />
          </a>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
