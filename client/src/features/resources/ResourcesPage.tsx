// src/features/resources/ResourcesPage.tsx
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import {
  FileText,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  Clock,
  Trash2,
  ExternalLink,
  HardDrive,
  Search,
  Filter,
} from "lucide-react";
import { Button, Card, Badge, Skeleton, EmptyState, PageHeader, Input } from "../../components/ui";
import { RootState } from "../../store";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import {
  useGetResourcesQuery,
  useVerifyResourceMutation,
  useDeleteResourceMutation,
  type Resource,
} from "../../store/api/resourcesApi";
import { useConfirm } from "../../hooks/useConfirm";
import { UploadResourceModal } from "./components/UploadResourceModal";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

type FilterStatus = "all" | "verified" | "pending";

const ResourcesPage: React.FC = () => {
  const franchiseId = useCurrentFranchiseId();
  const { user } = useSelector((s: RootState) => s.auth);
  const isManager =
    user?.role === "manager" || user?.role === "operational_manager" || user?.role === "super_admin";

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const { data, isLoading, isError } = useGetResourcesQuery(
    { franchiseId: franchiseId ?? "" },
    { skip: !franchiseId },
  );
  const [verifyResource] = useVerifyResourceMutation();
  const [deleteResource] = useDeleteResourceMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleVerify = async (id: string) => {
    try {
      await verifyResource(id).unwrap();
      toast.success("Resource verified — now visible to every coach");
    } catch {
      toast.error("Couldn't verify — try again");
    }
  };

  const { confirm, ConfirmDialog } = useConfirm();

  const handleDelete = async (id: string, fileName?: string) => {
    const ok = await confirm({
      title: "Remove Resource",
      message: `Are you sure you want to delete ${fileName ? `"${fileName}"` : "this resource"}? This action cannot be undone.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;

    setDeletingId(id);
    try {
      await deleteResource(id).unwrap();
      toast.success("Resource removed");
    } catch {
      toast.error("Couldn't remove — try again");
    } finally {
      setDeletingId(null);
    }
  };

  const storagePercent = data?.storage
    ? Math.min(100, Math.round((data.storage.usedBytes / data.storage.limitBytes) * 100))
    : 0;
  const storageNearFull = storagePercent >= 90;

  const rawResources = data?.data ?? [];

  const filteredResources = rawResources.filter((resource) => {
    // Status filter
    if (filterStatus === "verified" && !resource.verified) return false;
    if (filterStatus === "pending" && resource.verified) return false;

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = (resource.title || "").toLowerCase().includes(q);
    const fileNameMatch = resource.fileName.toLowerCase().includes(q);
    const notesMatch = (resource.notes || "").toLowerCase().includes(q);
    const uploaderMatch = (resource.uploadedByName || "").toLowerCase().includes(q);
    return titleMatch || fileNameMatch || notesMatch || uploaderMatch;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Media & Documents"
        title="Resources"
        subtitle={
          isManager
            ? "Every document, tactical playbook, and resource uploaded for your academy, with review controls."
            : "Your uploaded resources, plus verified training materials from the academy coaching staff."
        }
        actions={
          <Button
            icon={<Upload size={16} />}
            onClick={() => {
              if (!franchiseId) {
                toast.error("Please select a franchise first");
                return;
              }
              setIsUploadModalOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            Upload resource
          </Button>
        }
      />

      {/* Storage bar — manager/super_admin only */}
      {isManager && data?.storage && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-white font-semibold">
              <HardDrive size={15} className="text-volt-400" />
              Academy storage
            </div>
            <span className={`text-xs font-mono ${storageNearFull ? "text-ember-400" : "text-slate-400"}`}>
              {formatBytes(data.storage.usedBytes)} of {formatBytes(data.storage.limitBytes)} used
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                storageNearFull ? "bg-ember-500" : "bg-volt-400"
              }`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          {storageNearFull && (
            <p className="text-2xs text-ember-400 mt-2">
              Storage is almost full — remove old resources to free up space for new uploads.
            </p>
          )}
        </Card>
      )}

      {/* Search & Filter Controls */}
      {!isLoading && !isError && rawResources.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Input
              icon={<Search size={15} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, notes, or filename..."
              className="text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-white/[0.04] p-1 rounded-lg border border-slate-200 dark:border-white/5 text-xs">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterStatus === "all"
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All ({rawResources.length})
            </button>
            <button
              onClick={() => setFilterStatus("verified")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                filterStatus === "verified"
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <CheckCircle2 size={12} className="text-emerald-500" />
              Verified ({rawResources.filter((r) => r.verified).length})
            </button>
            <button
              onClick={() => setFilterStatus("pending")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                filterStatus === "pending"
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Clock size={12} className="text-amber-500" />
              Pending ({rawResources.filter((r) => !r.verified).length})
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {isError && <EmptyState title="Couldn't load resources" description="Try refreshing the page." />}

      {!isLoading && !isError && rawResources.length === 0 && (
        <EmptyState
          icon={<Upload size={28} />}
          title="No resources yet"
          description={
            isManager
              ? "Once coaches upload documents with title and notes, they'll show up here for review."
              : "Upload session plans, drills, or reference documents with notes — they'll stay visible to just you until a manager verifies them."
          }
        />
      )}

      {!isLoading && !isError && rawResources.length > 0 && filteredResources.length === 0 && (
        <EmptyState
          icon={<Search size={24} />}
          title="No matching resources"
          description="Try adjusting your search query or status filter."
        />
      )}

      <div className="space-y-3">
        {filteredResources.map((resource) => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            isManager={isManager}
            isOwner={resource.uploadedBy === user?.id}
            deleting={deletingId === resource.id}
            onVerify={() => handleVerify(resource.id)}
            onDelete={() => handleDelete(resource.id, resource.title || resource.fileName)}
          />
        ))}
      </div>

      <UploadResourceModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        franchiseId={franchiseId ?? ""}
        isManager={isManager}
        remainingBytes={
          data?.storage ? Math.max(0, data.storage.limitBytes - data.storage.usedBytes) : undefined
        }
      />

      {ConfirmDialog}
    </div>
  );
};

const ResourceRow: React.FC<{
  resource: Resource;
  isManager: boolean;
  isOwner: boolean;
  deleting: boolean;
  onVerify: () => void;
  onDelete: () => void;
}> = ({ resource, isManager, isOwner, deleting, onVerify, onDelete }) => {
  const isPdf = resource.mimeType === "application/pdf";
  const isDoc = resource.mimeType.includes("word") || resource.mimeType === "application/msword";
  const canDelete = isManager || isOwner;

  const displayName = resource.title?.trim() || resource.fileName;
  const hasCustomTitle = Boolean(resource.title?.trim() && resource.title.trim() !== resource.fileName);

  return (
    <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-white/10">
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-volt-400/10 text-volt-500 flex items-center justify-center shrink-0 mt-0.5">
          {isPdf || isDoc ? <FileText size={20} /> : <ImageIcon size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={resource.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-slate-900 dark:text-white hover:text-volt-600 dark:hover:text-volt-400 transition-colors truncate max-w-full inline-flex items-center gap-1.5 group"
            >
              <span className="truncate">{displayName}</span>
              <ExternalLink size={12} className="text-slate-400 group-hover:text-volt-500 shrink-0" />
            </a>
            {hasCustomTitle && (
              <span className="text-2xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.04] px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/5 truncate max-w-[220px]">
                {resource.fileName}
              </span>
            )}
          </div>

          {resource.notes && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 rounded-md px-3 py-1.5 line-clamp-3 leading-relaxed">
              {resource.notes}
            </p>
          )}

          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            Uploaded by {resource.uploadedByName ?? "Unknown"} · {formatBytes(resource.fileSizeBytes)} ·{" "}
            {new Date(resource.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-white/5">
        {resource.verified ? (
          <Badge variant="green" size="sm">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={11} /> Verified
            </span>
          </Badge>
        ) : (
          <Badge variant="yellow" size="sm">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> Pending review
            </span>
          </Badge>
        )}
        {isManager && !resource.verified && (
          <Button size="sm" variant="secondary" onClick={onVerify}>
            Verify
          </Button>
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-slate-400 hover:text-ember-400 transition-colors p-1.5 rounded-lg disabled:opacity-50"
            aria-label="Remove resource"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </Card>
  );
};

export default ResourcesPage;