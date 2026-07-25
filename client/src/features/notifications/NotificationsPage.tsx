// src/features/notifications/NotificationsPage.tsx
import React, { useState } from "react";
import { Bell, Plus, FileText } from "lucide-react";
import { toast } from "react-hot-toast";
import { Card, Badge, Button, Input, Modal, Skeleton, EmptyState, ImageUploadField, DocumentUploadField } from "../../components/ui";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useListTeamsQuery } from "../../store/api/teamsApi";
import {
  useListNotificationsQuery,
  useCreateNotificationMutation,
  AdminNotification,
} from "../../store/api/adminNotificationsApi";

const AUDIENCE_LABEL: Record<AdminNotification["audience"], string> = {
  both: "Coaches + Guardians",
  guardians: "Guardians",
  coaches: "Coaches",
  team: "One team",
};

const NotificationsPage: React.FC = () => {
  const franchiseId = useCurrentFranchiseId();
  const { data, isLoading, isError } = useListNotificationsQuery(
    { franchiseId: franchiseId ?? "" },
    { skip: !franchiseId },
  );
  const [showCompose, setShowCompose] = useState(false);

  if (!franchiseId) {
    return <EmptyState icon={<Bell size={28} />} title="No franchise selected" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white uppercase tracking-wide">Notifications</h1>
          <p className="text-sm text-slate-400 mt-1">Updates sent to guardians and coaches</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowCompose(true)}>
          Compose
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {isError && <EmptyState title="Couldn't load notifications" description="Please try again shortly." />}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={<Bell size={28} />}
          title="No notifications sent yet"
          description="Compose your first update to guardians, coaches, or both."
          action={<Button onClick={() => setShowCompose(true)}>Compose</Button>}
        />
      )}

      <div className="space-y-3">
        {(data?.items ?? []).map((n) => (
          <Card key={n.id} className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-display font-semibold text-white">{n.title}</h3>
              <Badge variant="blue">{AUDIENCE_LABEL[n.audience]}</Badge>
            </div>
            <p className="text-sm text-slate-400 mt-2">{n.body}</p>
            {n.imageUrl && (
              <img src={n.imageUrl} alt="" className="mt-3 max-h-40 rounded-lg border border-white/10" />
            )}
            {n.documentUrl && (
              <a
                href={n.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-volt-400 hover:underline"
              >
                <FileText size={13} /> {n.documentFilename ?? "Attached document"}
              </a>
            )}
            <p className="text-xs text-slate-600 font-mono mt-3">
              {new Date(n.createdAt).toLocaleString()} · {n.readBy.length} read
            </p>
          </Card>
        ))}
      </div>

      {franchiseId && (
        <ComposeModal isOpen={showCompose} onClose={() => setShowCompose(false)} franchiseId={franchiseId} />
      )}
    </div>
  );
};

const ComposeModal: React.FC<{ isOpen: boolean; onClose: () => void; franchiseId: string }> = ({
  isOpen,
  onClose,
  franchiseId,
}) => {
  const [createNotification, { isLoading }] = useCreateNotificationMutation();
  const { data: teams } = useListTeamsQuery({ franchiseId }, { skip: !franchiseId });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AdminNotification["audience"]>("both");
  const [teamId, setTeamId] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [document, setDocument] = useState<{ url: string; filename: string } | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;
    if (audience === "team" && !teamId) {
      toast.error("Select a team");
      return;
    }
    try {
      await createNotification({
        franchiseId,
        title,
        body,
        audience,
        teamId: audience === "team" ? teamId : undefined,
        imageUrl,
        documentUrl: document?.url,
        documentFilename: document?.filename,
      }).unwrap();
      toast.success("Notification sent");
      onClose();
      setTitle("");
      setBody("");
      setImageUrl(undefined);
      setDocument(undefined);
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't send notification — try again");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose notification" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="space-y-1.5">
          <label className="label">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="input resize-none"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="label">Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as AdminNotification["audience"])}
            className="input"
          >
            <option value="both">Coaches + Guardians</option>
            <option value="guardians">Guardians only</option>
            <option value="coaches">Coaches only</option>
            <option value="team">One team (its coach + its players' guardians)</option>
          </select>
        </div>
        {audience === "team" && (
          <div className="space-y-1.5">
            <label className="label">Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="input" required>
              <option value="" disabled>
                Select a team
              </option>
              {(teams ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.ageGroup})
                </option>
              ))}
            </select>
          </div>
        )}
        <ImageUploadField
          label="Image (optional)"
          category="notification_image"
          value={imageUrl}
          onChange={setImageUrl}
          shape="wide"
          helperText="Sent as part of the WhatsApp message, and shown here in-app."
        />
        <DocumentUploadField
          label="Document (optional)"
          category="notification_document"
          value={document}
          onChange={setDocument}
          helperText="Sent as a WhatsApp document attachment, and linked here in-app."
        />
        <Button type="submit" loading={isLoading} className="w-full">
          Send
        </Button>
      </form>
    </Modal>
  );
};

export default NotificationsPage;
