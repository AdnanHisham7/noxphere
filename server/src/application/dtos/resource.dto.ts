// src/application/dtos/resource.dto.ts
import { z } from "zod";

export const UploadResourceSchema = z.object({
  franchiseId: z.string().min(1),
  title: z.string().trim().max(150, "Title is too long").optional(),
  notes: z.string().trim().max(2000, "Notes are too long").optional(),
});

export type UploadResourceDto = z.infer<typeof UploadResourceSchema>;