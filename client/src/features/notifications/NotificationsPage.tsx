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
  players: "Players Only",
  guardians: "Guardians Only",
  coaches: "Coaches Only",
  managers: "Managers Only",
  franchise: "Entire Franchise",
  academy: "Entire Academy",
  team: "One Team",
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
              <div className="flex items-center gap-2">
                {n.channels && n.channels.map((ch) => (
                  <Badge key={ch} variant="gray" className="text-[9px] uppercase">{ch}</Badge>
                ))}
                <Badge variant="blue">{AUDIENCE_LABEL[n.audience]}</Badge>
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-2">{n.body}</p>
            {n.imageUrl && (
              <img src={n.imageUrl} alt="" className="mt-3 max-h-40 rounded-lg border border-white/10" />
            )}
            
            {/* Render Multiple Attachments */}
            {n.attachments && n.attachments.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {n.attachments.map((at, idx) => (
                  <a
                    key={idx}
                    href={at.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-volt-400 hover:underline bg-white/5 border border-white/5 px-2.5 py-1 rounded-md"
                  >
                    <FileText size={12} /> {at.name}
                  </a>
                ))}
              </div>
            ) : n.documentUrl ? (
              <a
                href={n.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-volt-400 hover:underline"
              >
                <FileText size={13} /> {n.documentFilename ?? "Attached document"}
              </a>
            ) : null}

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
  const [audience, setAudience] = useState<AdminNotification["audience"]>("franchise");
  const [teamId, setTeamId] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<string[]>(["push", "whatsapp"]);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;
    if (audience === "team" && !teamId) {
      toast.error("Select a team");
      return;
    }
    if (channels.length === 0) {
      toast.error("Select at least one communication channel");
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
        documentUrl: attachments[0]?.url,
        documentFilename: attachments[0]?.name,
        attachments,
        channels,
      }).unwrap();
      toast.success("Notification sent");
      onClose();
      setTitle("");
      setBody("");
      setImageUrl(undefined);
      setChannels(["push", "whatsapp"]);
      setAttachments([]);
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't send notification — try again");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose notification" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 no-scrollbar">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="space-y-1.5">
          <label className="label">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="input resize-none text-xs"
            placeholder="Write announcement details..."
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="label font-bold text-slate-400">Communication Channels (Select all that apply)</label>
          <div className="flex gap-4 bg-pitch-900 border border-white/5 rounded-lg p-2.5 w-fit">
            {(["push", "whatsapp", "email", "sms"] as const).map((ch) => (
              <label key={ch} className="flex items-center gap-2 cursor-pointer text-xs text-white">
                <input
                  type="checkbox"
                  checked={channels.includes(ch)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setChannels([...channels, ch]);
                    } else {
                      setChannels(channels.filter((c) => c !== ch));
                    }
                  }}
                  className="rounded bg-pitch-950 border-white/10 text-volt-400 focus:ring-volt-400"
                />
                <span className="capitalize">{ch}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="label">Target Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as AdminNotification["audience"])}
            className="input text-xs"
          >
            <option value="franchise">Entire Franchise (Guardians + Players + Coaches + Managers)</option>
            <option value="academy">Entire Academy (All Sibling Franchises)</option>
            <option value="players">Players Only</option>
            <option value="guardians">Guardians Only</option>
            <option value="coaches">Coaches Only</option>
            <option value="managers">Managers Only</option>
            <option value="team">One specific team roster</option>
          </select>
        </div>

        {audience === "team" && (
          <div className="space-y-1.5">
            <label className="label">Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="input text-xs" required>
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
          label="Banner Image (optional)"
          category="notification_image"
          value={imageUrl}
          onChange={setImageUrl}
          shape="wide"
          helperText="Shown in-app and sent as part of the WhatsApp message."
        />

        <div className="space-y-2">
          <label className="label">Documents & Attachments (Optional)</label>
          <DocumentUploadField
            label="Add attachment (PDF/Word)"
            category="notification_document"
            onChange={(file) => {
              if (file) {
                setAttachments([...attachments, { name: file.filename || "Attachment File", url: file.url }]);
              }
            }}
          />
          {attachments.length > 0 && (
            <div className="space-y-1.5 mt-2 bg-pitch-900/50 p-2 border border-white/5 rounded-lg max-h-24 overflow-y-auto">
              {attachments.map((at, idx) => (
                <div key={idx} className="flex items-center justify-between text-2xs text-slate-300">
                  <span className="truncate max-w-[80%] font-mono">{at.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-ember-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" loading={isLoading} className="w-full bg-volt-400 hover:bg-volt-300 text-pitch-900 font-bold uppercase py-2.5">
          Broadcast Announcement
        </Button>
      </form>
    </Modal>
  );
};

export default NotificationsPage;
