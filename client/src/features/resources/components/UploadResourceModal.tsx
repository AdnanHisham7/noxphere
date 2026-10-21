// src/features/resources/components/UploadResourceModal.tsx
import React, { useRef, useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Upload, FileText, Image as ImageIcon, X, AlertCircle } from "lucide-react";
import { Modal, Button, Input } from "../../../components/ui";
import { useUploadResourceMutation } from "../../../store/api/resourcesApi";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

interface UploadResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  franchiseId: string;
  isManager: boolean;
  remainingBytes?: number;
}

export const UploadResourceModal: React.FC<UploadResourceModalProps> = ({
  isOpen,
  onClose,
  franchiseId,
  isManager,
  remainingBytes,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  const [uploadResource, { isLoading: uploading }] = useUploadResourceMutation();

  // Reset form when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setTitle("");
      setNotes("");
      setIsDragging(false);
      setTitleTouched(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [isOpen]);

  const handleFile = (selectedFile: File | undefined) => {
    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      toast.error("Only PDF, Word, JPEG, PNG, WEBP or GIF files are allowed");
      return;
    }
    if (selectedFile.size > MAX_BYTES) {
      toast.error("File is too large — the limit is 20MB per file");
      return;
    }
    if (remainingBytes !== undefined && selectedFile.size > remainingBytes) {
      toast.error("This file exceeds your academy's remaining storage capacity");
      return;
    }

    setFile(selectedFile);

    // If title has not been manually touched by user, prefill with sanitized filename
    if (!titleTouched || !title.trim()) {
      const cleanName = selectedFile.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      setTitle(cleanName);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    handleFile(droppedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a title for the resource");
      return;
    }

    try {
      await uploadResource({
        franchiseId,
        file,
        title: title.trim(),
        notes: notes.trim() || undefined,
      }).unwrap();

      toast.success(
        isManager
          ? "Resource uploaded"
          : "Resource uploaded — visible to you until a manager verifies it",
      );
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Upload failed — try again");
    }
  };

  const isPdf = file?.type === "application/pdf";
  const isDoc = file?.type.includes("word") || file?.type === "application/msword";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Resource" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File Dropzone / Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
            Resource File <span className="text-volt-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 group ${
                isDragging
                  ? "border-volt-400 bg-volt-400/10 scale-[1.01]"
                  : "border-slate-300 dark:border-white/10 hover:border-volt-400/60 dark:hover:border-volt-400/40 bg-slate-50/50 dark:bg-white/[0.02]"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-volt-400/10 flex items-center justify-center text-volt-500 group-hover:scale-110 transition-transform">
                <Upload size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Click to browse <span className="font-normal text-slate-500 dark:text-slate-400">or drag and drop</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  PDF, Word, JPEG, PNG, WEBP or GIF (Max 20MB)
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-volt-400/10 text-volt-500 flex items-center justify-center shrink-0">
                  {isPdf || isDoc ? <FileText size={20} /> : <ImageIcon size={20} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400">
                    {formatBytes(file.size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs"
                >
                  Change
                </Button>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="text-slate-400 hover:text-ember-400 p-1.5 rounded-lg transition-colors"
                  aria-label="Remove selected file"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Title Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
            Resource Title <span className="text-volt-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            placeholder="e.g. U-14 Tactical Pressing Guide"
            maxLength={150}
            required
          />
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
            Give this document a clear descriptive title for quick reference by coaches.
          </p>
        </div>

        {/* Notes Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Notes & Instructions <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <span className="text-2xs font-mono text-slate-400">
              {notes.length}/2000
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            className="input w-full text-sm resize-y custom-scrollbar min-h-[80px]"
            placeholder="Add context, drill objectives, target age groups, or key coaching points..."
          />
        </div>

        {!isManager && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>
              Your upload will remain private to your account until reviewed and verified by an academy manager.
            </span>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={<Upload size={16} />}
            loading={uploading}
            disabled={!file || !title.trim() || uploading}
          >
            Upload Resource
          </Button>
        </div>
      </form>
    </Modal>
  );
};
