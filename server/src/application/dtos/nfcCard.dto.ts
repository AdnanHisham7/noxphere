// src/application/dtos/nfcCard.dto.ts
import { z } from "zod";

export const NfcShippingAddressSchema = z.object({
  recipientName: z.string().min(2, "Recipient name is required"),
  phone: z.string().min(7, "Valid contact phone is required"),
  addressLine1: z.string().min(5, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().min(4, "Postal/PIN code is required"),
  country: z.string().default("India"),
});

export const CreatePlayerNfcRequestSchema = z.object({
  shippingAddress: NfcShippingAddressSchema,
});

export const CreateAcademyNfcRequestSchema = z.object({
  studentIds: z
    .array(z.string().min(1))
    .min(1, "Please select at least one student for NFC card order"),
  cardType: z.enum(["official", "custom"]).default("official"),
  customDesignUrl: z.string().url("Valid artwork URL is required").optional().or(z.literal("")),
  customDesignFileName: z.string().optional(),
  shippingAddress: NfcShippingAddressSchema,
});

export const ApproveNfcRequestSchema = z.object({
  unitPrice: z.number().min(0, "Unit price must be non-negative").optional(),
});

export const RejectNfcRequestSchema = z.object({
  reason: z.string().min(3, "Rejection reason must be at least 3 characters"),
});

export const UpdateNfcFulfillmentSchema = z.object({
  status: z.enum(["paid", "dispatched", "delivered"]),
  courierName: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
});

export const UpdateNfcPricingSchema = z.object({
  cardPrice: z.number().min(0, "Standard card price must be at least 0"),
  customCardPrice: z.number().min(0, "Custom card price must be at least 0"),
});

export const ListNfcRequestsQuerySchema = z.object({
  status: z
    .enum(["all", "pending", "approved", "rejected", "paid", "dispatched", "delivered"])
    .optional(),
  requesterType: z.enum(["all", "independent_player", "academy"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreatePlayerNfcRequestDto = z.infer<typeof CreatePlayerNfcRequestSchema>;
export type CreateAcademyNfcRequestDto = z.infer<typeof CreateAcademyNfcRequestSchema>;
export type ApproveNfcRequestDto = z.infer<typeof ApproveNfcRequestSchema>;
export type RejectNfcRequestDto = z.infer<typeof RejectNfcRequestSchema>;
export type UpdateNfcFulfillmentDto = z.infer<typeof UpdateNfcFulfillmentSchema>;
export type UpdateNfcPricingDto = z.infer<typeof UpdateNfcPricingSchema>;
export type ListNfcRequestsQueryDto = z.infer<typeof ListNfcRequestsQuerySchema>;
