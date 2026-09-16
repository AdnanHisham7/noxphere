// src/features/student-portal/NfcPlayerCardSection.tsx
import React, { useState } from "react";
import {
  CreditCard,
  Radio,
  Sparkles,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Package,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { extractErrorMessage } from "../../utils/errorUtils";
import { clsx } from "clsx";
import {
  useGetNfcPricingQuery,
  useListNfcRequestsQuery,
  useCreatePlayerNfcRequestMutation,
  useCreateNfcCheckoutSessionMutation,
  NfcShippingAddress,
} from "../../store/api/nfcCardApi";
import { Button, Input, Modal, Badge } from "../../components/ui";

interface NfcPlayerCardSectionProps {
  player: {
    firstName: string;
    lastName: string;
    position?: string;
    jerseyNumber?: number;
    publicProfileToken?: string;
    guardianPhone?: string;
  };
}

export const NfcPlayerCardSection: React.FC<NfcPlayerCardSectionProps> = ({
  player,
}) => {
  const { data: pricing, isLoading: pricingLoading } = useGetNfcPricingQuery();
  const { data: requestsData, isLoading: requestsLoading } =
    useListNfcRequestsQuery();
  const [createRequest, { isLoading: isSubmitting }] =
    useCreatePlayerNfcRequestMutation();
  const [createCheckoutSession, { isLoading: isCheckingOut }] =
    useCreateNfcCheckoutSessionMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<NfcShippingAddress>({
    recipientName: `${player.firstName} ${player.lastName}`.trim(),
    phone: player.guardianPhone || "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  });

  // Get most recent request
  const requests = requestsData?.requests ?? [];
  const activeRequest = requests[0];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setShippingAddress((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validateShippingAddress = (): string | null => {
    if (!shippingAddress.recipientName.trim() || shippingAddress.recipientName.trim().length < 2) {
      return "Recipient name must be at least 2 characters";
    }
    if (!shippingAddress.phone.trim() || shippingAddress.phone.trim().length < 7) {
      return "Valid contact phone is required (at least 7 digits)";
    }
    if (!shippingAddress.addressLine1.trim() || shippingAddress.addressLine1.trim().length < 5) {
      return "Address line 1 must be at least 5 characters";
    }
    if (!shippingAddress.city.trim() || shippingAddress.city.trim().length < 2) {
      return "City must be at least 2 characters";
    }
    if (!shippingAddress.state.trim() || shippingAddress.state.trim().length < 2) {
      return "State must be at least 2 characters";
    }
    if (!shippingAddress.postalCode.trim() || shippingAddress.postalCode.trim().length < 4) {
      return "PIN / Postal code must be at least 4 digits";
    }
    return null;
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const addressError = validateShippingAddress();
    if (addressError) {
      toast.error(addressError);
      return;
    }

    try {
      await createRequest({ shippingAddress }).unwrap();
      toast.success("NFC Card request submitted! Admin will review shortly.");
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(extractErrorMessage(err, "Failed to submit NFC card request"));
    }
  };

  const handlePayNow = async () => {
    if (!activeRequest) return;
    try {
      const res = await createCheckoutSession(activeRequest.id).unwrap();
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, "Could not initiate Stripe checkout"));
    }
  };

  const cardPrice = pricing?.cardPrice ?? 299;

  // Realistic 3D NFC Card component (shared between hero promo and preview modal)
  const renderCardMockup = () => (
    <div className="relative w-full max-w-[340px] aspect-[1.586/1] rounded-2xl p-5 bg-gradient-to-tr from-slate-950 via-slate-900 to-pitch-900 border border-slate-700/60 dark:border-white/15 shadow-2xl shadow-slate-950/20 dark:shadow-black/60 text-white flex flex-col justify-between overflow-hidden group hover:border-volt-400/50 transition-all duration-300">
      {/* Holographic sheen reflection */}
      <div className="absolute -inset-[150%] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent rotate-45 pointer-events-none group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

      {/* Top row */}
      <div className="flex items-start justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-volt-400/20 border border-volt-400/30 flex items-center justify-center text-volt-400">
            <CreditCard size={15} />
          </div>
          <div>
            <span className="font-display font-black text-xs tracking-wider uppercase text-white block">
              NOXPHERE
            </span>
            <span className="text-[9px] font-mono tracking-widest text-volt-400 uppercase">
              SMART NFC ID
            </span>
          </div>
        </div>

        {/* Contactless Radio Icon */}
        <div className="flex items-center gap-1 text-white/60">
          <Radio size={18} className="text-volt-400 animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            NFC
          </span>
        </div>
      </div>

      {/* Middle: Chip & Waves visual */}
      <div className="my-auto py-2 flex items-center justify-between z-10">
        <div className="w-10 h-8 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 border border-amber-300/40 shadow-inner flex flex-col justify-around">
          <div className="h-0.5 bg-black/30 rounded" />
          <div className="h-0.5 bg-black/30 rounded" />
          <div className="h-0.5 bg-black/30 rounded" />
        </div>

        <div className="text-right">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block">
            POSITION
          </span>
          <span className="font-display font-bold text-sm text-volt-400 uppercase">
            {player.position || "PLAYER"}
          </span>
        </div>
      </div>

      {/* Bottom row: Athlete name & QR preview */}
      <div className="flex items-end justify-between z-10 pt-2 border-t border-white/10">
        <div>
          <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500 block">
            ATHLETE
          </span>
          <span className="font-display font-black text-sm tracking-wide text-white uppercase block leading-tight">
            {player.firstName} {player.lastName}
          </span>
          <span className="text-[9px] font-mono text-slate-400">
            #{player.jerseyNumber ?? "—"} • NOXPHERE VERIFIED
          </span>
        </div>

        <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 p-1 flex items-center justify-center">
          <QrCode size={24} className="text-volt-400/90" />
        </div>
      </div>
    </div>
  );

  // Status progression calculation
  const statusLevels: Record<string, number> = {
    pending: 1,
    approved: 2,
    paid: 3,
    dispatched: 4,
    delivered: 5,
  };
  const currentLevel = activeRequest ? statusLevels[activeRequest.status] || 0 : 0;

  return (
    <div className="mb-8">
      {/* If active request exists, render a clean compact tracker card instead of the big marketing banner */}
      {activeRequest ? (
        <div className="bg-white dark:bg-pitch-900 rounded-2xl p-5 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-volt-500/15 border border-volt-500/30 text-volt-600 dark:text-volt-400 flex items-center justify-center shrink-0">
                <CreditCard size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">
                    Physical NFC Smart Card
                  </h3>
                  <span className="text-2xs font-mono text-slate-500 dark:text-slate-400">
                    Order #{activeRequest.id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Placed on {new Date(activeRequest.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              {activeRequest.status === "pending" && (
                <Badge variant="yellow" className="uppercase font-mono text-2xs">
                  <Clock size={12} className="mr-1 inline" /> Under Review
                </Badge>
              )}
              {activeRequest.status === "approved" && (
                <Badge variant="green" className="uppercase font-mono text-2xs">
                  <CheckCircle2 size={12} className="mr-1 inline" /> Payment Pending
                </Badge>
              )}
              {activeRequest.status === "paid" && (
                <Badge variant="green" className="uppercase font-mono text-2xs">
                  <Package size={12} className="mr-1 inline" /> In Production
                </Badge>
              )}
              {activeRequest.status === "dispatched" && (
                <Badge variant="blue" className="uppercase font-mono text-2xs">
                  <Truck size={12} className="mr-1 inline" /> Dispatched
                </Badge>
              )}
              {activeRequest.status === "delivered" && (
                <Badge variant="green" className="uppercase font-mono text-2xs">
                  <CheckCircle2 size={12} className="mr-1 inline" /> Delivered
                </Badge>
              )}
              {activeRequest.status === "rejected" && (
                <Badge variant="red" className="uppercase font-mono text-2xs">
                  <AlertCircle size={12} className="mr-1 inline" /> Declined
                </Badge>
              )}

              <button
                type="button"
                onClick={() => setShowCardPreview(!showCardPreview)}
                className="text-2xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 font-medium px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-pitch-800 transition-colors"
              >
                {showCardPreview ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                <span>{showCardPreview ? "Hide Preview" : "Card Preview"}</span>
              </button>
            </div>
          </div>

          {/* Stepper Progress Bar (if not rejected) */}
          {activeRequest.status !== "rejected" ? (
            <div className="py-2">
              <div className="grid grid-cols-5 gap-2 text-center relative">
                {/* Connecting lines */}
                <div className="absolute top-3.5 left-[10%] right-[10%] h-0.5 bg-slate-200 dark:bg-pitch-800 -z-0" />
                <div
                  className="absolute top-3.5 left-[10%] h-0.5 bg-emerald-500 transition-all duration-500 -z-0"
                  style={{
                    width: `${Math.max(0, Math.min(100, ((currentLevel - 1) / 4) * 80))}%`,
                  }}
                />

                {[
                  { level: 1, label: "Requested", icon: Clock },
                  { level: 2, label: "Approved", icon: CheckCircle2 },
                  { level: 3, label: "Production", icon: Package },
                  { level: 4, label: "Dispatched", icon: Truck },
                  { level: 5, label: "Delivered", icon: CheckCircle2 },
                ].map((step) => {
                  const isDone = currentLevel >= step.level;
                  const isCurrent = currentLevel === step.level;
                  const IconComponent = step.icon;

                  return (
                    <div key={step.level} className="flex flex-col items-center relative z-10">
                      <div
                        className={clsx(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs",
                          isDone
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-100 dark:bg-pitch-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-white/10",
                          isCurrent && "ring-2 ring-volt-500 ring-offset-2 dark:ring-offset-pitch-900"
                        )}
                      >
                        <IconComponent size={13} />
                      </div>
                      <span
                        className={clsx(
                          "text-2xs mt-1.5 font-medium block truncate max-w-full px-1",
                          isDone
                            ? "text-slate-800 dark:text-white font-semibold"
                            : "text-slate-400 dark:text-slate-500"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Action alerts based on status */}
          {activeRequest.status === "approved" && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 dark:bg-field-400/10 dark:border-field-400/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Order Approved &bull; Ready for Payment
                </p>
                <p className="text-2xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Complete your ₹{activeRequest.totalAmount} payment to send this card into chip engraving and production.
                </p>
              </div>
              <Button
                onClick={handlePayNow}
                loading={isCheckingOut}
                size="sm"
                className="!bg-emerald-600 hover:!bg-emerald-500 !text-white dark:!bg-field-400 dark:hover:!bg-field-300 dark:!text-pitch-950 font-bold text-xs shrink-0"
              >
                Pay ₹{activeRequest.totalAmount} Now
              </Button>
            </div>
          )}

          {activeRequest.status === "dispatched" && activeRequest.dispatchDetails && (
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 dark:bg-ice-400/10 dark:border-ice-400/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-sky-600 dark:text-ice-400 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Dispatched via {activeRequest.dispatchDetails.courierName || "Courier"}
                  </span>
                  {activeRequest.dispatchDetails.trackingNumber && (
                    <span className="text-slate-600 dark:text-slate-300 ml-1.5 font-mono text-2xs">
                      #{activeRequest.dispatchDetails.trackingNumber}
                    </span>
                  )}
                </div>
              </div>
              {activeRequest.dispatchDetails.trackingUrl && (
                <a
                  href={activeRequest.dispatchDetails.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-sky-600 dark:text-volt-400 hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  <span>Track Package</span>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          )}

          {activeRequest.status === "rejected" && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-red-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold">Request Declined</p>
                <p className="text-2xs mt-0.5">{activeRequest.rejectionReason || "Requirements not met."}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsModalOpen(true)}
                className="shrink-0"
              >
                Submit New Request
              </Button>
            </div>
          )}

          {/* Shipping Address Summary */}
          {activeRequest.shippingAddress && (
            <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-slate-400 pt-1">
              <MapPin size={12} className="shrink-0 text-slate-400" />
              <span className="truncate">
                Shipping to: <strong>{activeRequest.shippingAddress.recipientName}</strong> &bull;{" "}
                {activeRequest.shippingAddress.city}, {activeRequest.shippingAddress.state} {activeRequest.shippingAddress.postalCode}
              </span>
            </div>
          )}

          {/* Collapsible Card Preview */}
          {showCardPreview && (
            <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex justify-center animate-fade-in">
              {renderCardMockup()}
            </div>
          )}
        </div>
      ) : (
        /* Full Hero Promo when no active request exists */
        <div className="relative rounded-2xl p-6 border border-slate-200/90 dark:border-volt-400/20 bg-gradient-to-br from-white via-slate-50 to-slate-100/90 dark:from-pitch-900 dark:via-pitch-950 dark:to-black overflow-hidden shadow-panel dark:shadow-2xl transition-colors duration-200">
          {/* Background ambient lighting */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-volt-400/10 dark:bg-volt-400/5 blur-3xl pointer-events-none rounded-full" />
          <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-core-400/10 dark:bg-core-400/5 blur-3xl pointer-events-none rounded-full" />

          <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left column: Realistic NFC Card Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              {renderCardMockup()}
            </div>

            {/* Right column: Details & Status Actions */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-volt-500/15 border border-volt-500/30 text-volt-800 dark:text-volt-400 dark:bg-volt-400/10 dark:border-volt-400/30">
                  <Sparkles size={13} /> Physical Smart NFC Card
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  ₹{cardPrice} Flat Rate
                </span>
              </div>

              <div>
                <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-xl tracking-tight">
                  Tap-to-Scout Physical NFC Player Card
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Carry your football portfolio wherever you go. When coaches,
                  scouts, or club officials tap your physical card with any modern
                  smartphone, your verified Noxphere profile, match stats, and
                  videos open instantly without typing any URL.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="!bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold shadow-sm"
                >
                  Request NFC Player Card (₹{cardPrice}){" "}
                  <ArrowRight size={16} className="ml-1.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Request NFC Player Card"
        size="md"
      >
        <form onSubmit={handleSubmitRequest} className="space-y-4">
          <div className="p-3 rounded-xl bg-volt-500/10 dark:bg-volt-400/10 border border-volt-500/25 dark:border-volt-400/20 flex items-start gap-3">
            <ShieldCheck
              size={20}
              className="text-volt-600 dark:text-volt-400 shrink-0 mt-0.5"
            />
            <div className="text-xs">
              <p className="font-bold text-slate-900 dark:text-white">
                Official Noxphere NFC Player Card
              </p>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                Linked directly to player{" "}
                <strong className="text-slate-900 dark:text-white">
                  {player.firstName} {player.lastName}
                </strong>
                . Fixed rate:{" "}
                <strong className="text-slate-900 dark:text-white">
                  ₹{cardPrice}
                </strong>{" "}
                (paid via Stripe once approved).
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">
              Delivery / Shipping Address
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Recipient Full Name"
                name="recipientName"
                value={shippingAddress.recipientName}
                onChange={handleInputChange}
                required
              />
              <Input
                label="Contact Phone"
                name="phone"
                value={shippingAddress.phone}
                onChange={handleInputChange}
                required
              />
            </div>

            <Input
              label="Address Line 1"
              name="addressLine1"
              placeholder="House/Flat #, Street, Locality"
              value={shippingAddress.addressLine1}
              onChange={handleInputChange}
              required
            />

            <Input
              label="Address Line 2 (Optional)"
              name="addressLine2"
              placeholder="Apartment, Landmark, Floor"
              value={shippingAddress.addressLine2 || ""}
              onChange={handleInputChange}
            />

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="City"
                name="city"
                value={shippingAddress.city}
                onChange={handleInputChange}
                required
              />
              <Input
                label="State"
                name="state"
                value={shippingAddress.state}
                onChange={handleInputChange}
                required
              />
              <Input
                label="PIN / Postal Code"
                name="postalCode"
                value={shippingAddress.postalCode}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-white/15 dark:text-slate-300 dark:hover:border-white/30 dark:hover:text-white dark:hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
