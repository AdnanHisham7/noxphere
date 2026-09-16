// src/application/dto/platformTicket.dto.ts
import { z } from "zod";

export const CreatePlatformTicketSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
  category: z.enum([
    "bug_technical",
    "billing_subscription",
    "feature_request",
    "account_access",
    "other",
  ]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  description: z.string().min(10, "Description must be at least 10 characters").max(5000),
});

export type CreatePlatformTicketDTO = z.infer<typeof CreatePlatformTicketSchema>;

export const AddPlatformTicketReplySchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(5000),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
});

export type AddPlatformTicketReplyDTO = z.infer<typeof AddPlatformTicketReplySchema>;

export const UpdatePlatformTicketStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

export type UpdatePlatformTicketStatusDTO = z.infer<typeof UpdatePlatformTicketStatusSchema>;
