// src/components/ui/DocumentUploadField.tsx
import React, { useRef, useState } from "react";
import { FileText, Loader2, X, Upload } from "lucide-react";
import { toast } from "react-hot-toast";
import { useUploadImageMutation, type UploadCategory } from "../../store/api/uploadApi";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface DocumentUploadFieldProps {
  label: string;
  category: UploadCategory;
  value?: { url: string; filename: string };
  onChange: (value: { url: string; filename: string } | undefined) => void;
  helperText?: string;
}

export const DocumentUploadField: React.FC<DocumentUploadFieldProps> = ({
  label,
  category,
  value,
  onChange,
  helperText,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadImage, { isLoading }] = useUploadImageMutation();
  const [pendingName, setPendingName] = useState<string | undefined>(undefined);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only PDF or Word documents are allowed");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File is too large — the limit is 20MB");
      return;
    }
    setPendingName(file.name);
    try {
      const result = await uploadImage({ file, category }).unwrap();
      onChange({ url: result.url, filename: file.name });
    } catch (err: any) {
      toast.error(err?.data?.message || "Upload failed — try again");
    } finally {
      setPendingName(undefined);
    }
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{label}</label>
      {value ? (
        <div className="flex items-center gap-2 border border-white/10 bg-white/[0.03] rounded-lg px-3 py-2.5">
          <FileText size={16} className="text-volt-400 shrink-0" />
          <span className="text-sm text-slate-300 truncate flex-1">{value.filename}</span>
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-slate-500 hover:text-ember-400 transition-colors shrink-0"
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-white/15 bg-white/[0.03] rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:border-volt-400/50 hover:text-slate-400 transition-colors disabled:opacity-60"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {isLoading ? `Uploading ${pendingName ?? ""}…` : "Click to upload a PDF or Word document"}
        </button>
      )}
      {helperText && <p className="text-2xs text-slate-500 mt-1.5">{helperText}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
};
