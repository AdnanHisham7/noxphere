// src/application/dtos/upload.dto.ts
import { z } from "zod";

export const UploadImageSchema = z.object({
  category: z.enum([
    "player_photo",
    "team_logo",
    "team_banner",
    "fee_qr",
    "notification_image",
    "notification_document",
  ]),
});

export type UploadImageDto = z.infer<typeof UploadImageSchema>;