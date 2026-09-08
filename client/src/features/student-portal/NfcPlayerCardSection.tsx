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
} from "lucide-react";
import { toast } from "react-hot-toast";
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShippingAddress((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !shippingAddress.recipientName.trim() ||
      !shippingAddress.phone.trim() ||
      !shippingAddress.addressLine1.trim() ||
      !shippingAddress.city.trim() ||
      !shippingAddress.state.trim() ||
      !shippingAddress.postalCode.trim()
    ) {
      toast.error("Please fill in all required shipping address fields");
      return;
    }

    try {
      await createRequest({ shippingAddress }).unwrap();
      toast.success("NFC Card request submitted! Admin will review shortly.");
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to submit NFC card request");
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
      toast.error(err?.data?.message || "Could not initiate Stripe checkout");
    }
  };

  const cardPrice = pricing?.cardPrice ?? 299;

  return (
    <div className="relative rounded-2xl p-6 border border-slate-200/90 dark:border-volt-400/20 bg-gradient-to-br from-white via-slate-50 to-slate-100/90 dark:from-pitch-900 dark:via-pitch-950 dark:to-black overflow-hidden shadow-panel dark:shadow-2xl mb-8 transition-colors duration-200">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-volt-400/10 dark:bg-volt-400/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-core-400/10 dark:bg-core-400/5 blur-3xl pointer-events-none rounded-full" />

      <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10">
        {/* Left column: Realistic NFC Card Mockup */}
        <div className="lg:col-span-5 flex justify-center">
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

          {/* Status Display or Request CTA */}
          {activeRequest ? (
            <div className="p-4 rounded-xl bg-white/80 dark:bg-pitch-900/80 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Order Status:
                  </span>
                  {activeRequest.status === "pending" && (
                    <Badge
                      variant="yellow"
                      className="uppercase font-mono text-2xs"
                    >
                      <Clock size={12} className="mr-1 inline" /> Under Review
                    </Badge>
                  )}
                  {activeRequest.status === "approved" && (
                    <Badge
                      variant="green"
                      className="uppercase font-mono text-2xs"
                    >
                      <CheckCircle2 size={12} className="mr-1 inline" />{" "}
                      Approved — Payment Ready
                    </Badge>
                  )}
                  {activeRequest.status === "paid" && (
                    <Badge
                      variant="green"
                      className="uppercase font-mono text-2xs"
                    >
                      <Package size={12} className="mr-1 inline" /> Paid &bull;
                      In Production
                    </Badge>
                  )}
                  {activeRequest.status === "dispatched" && (
                    <Badge
                      variant="blue"
                      className="uppercase font-mono text-2xs"
                    >
                      <Truck size={12} className="mr-1 inline" /> Dispatched
                    </Badge>
                  )}
                  {activeRequest.status === "delivered" && (
                    <Badge
                      variant="green"
                      className="uppercase font-mono text-2xs"
                    >
                      <CheckCircle2 size={12} className="mr-1 inline" />{" "}
                      Delivered
                    </Badge>
                  )}
                  {activeRequest.status === "rejected" && (
                    <Badge
                      variant="red"
                      className="uppercase font-mono text-2xs"
                    >
                      <AlertCircle size={12} className="mr-1 inline" /> Request
                      Declined
                    </Badge>
                  )}
                </div>

                <span className="text-2xs font-mono text-slate-500 dark:text-slate-400">
                  Placed:{" "}
                  {new Date(activeRequest.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Specific message by status */}
              {activeRequest.status === "pending" && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-300 text-xs">
                  Your request is awaiting Super Admin verification. You will be
                  notified once approved to complete payment via Stripe.
                </div>
              )}

              {activeRequest.status === "approved" && (
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 dark:bg-field-400/10 dark:border-field-400/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Your Request is Approved!
                    </p>
                    <p className="text-2xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Pay ₹{activeRequest.totalAmount} via Stripe to initiate
                      chip encoding and shipping.
                    </p>
                  </div>
                  <Button
                    onClick={handlePayNow}
                    loading={isCheckingOut}
                    className="!bg-emerald-600 hover:!bg-emerald-500 !text-white dark:!bg-field-400 dark:hover:!bg-field-300 dark:!text-pitch-950 font-bold text-xs"
                  >
                    Pay ₹{activeRequest.totalAmount} with Stripe
                  </Button>
                </div>
              )}

              {activeRequest.status === "paid" && (
                <div className="p-3 rounded-lg bg-volt-500/10 border border-volt-500/25 dark:bg-volt-400/10 dark:border-volt-400/20 text-volt-900 dark:text-volt-300 text-xs flex items-center gap-2">
                  <Package
                    size={16}
                    className="text-volt-600 dark:text-volt-400 shrink-0"
                  />
                  <span>
                    Payment confirmed. Your card is currently being manufactured
                    and programmed with your digital player ID.
                  </span>
                </div>
              )}

              {activeRequest.status === "dispatched" && (
                <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/25 dark:bg-ice-400/10 dark:border-ice-400/20 text-sky-950 dark:text-ice-200 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    <Truck
                      size={16}
                      className="text-sky-600 dark:text-ice-400"
                    />
                    <span>Package In Transit</span>
                  </div>
                  <p className="text-2xs text-slate-600 dark:text-slate-300">
                    Courier:{" "}
                    {activeRequest.dispatchDetails?.courierName ||
                      "Standard Courier"}{" "}
                    {activeRequest.dispatchDetails?.trackingNumber && (
                      <>
                        • Tracking #
                        {activeRequest.dispatchDetails.trackingNumber}
                      </>
                    )}
                  </p>
                  {activeRequest.dispatchDetails?.trackingUrl && (
                    <a
                      href={activeRequest.dispatchDetails.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 dark:text-volt-400 hover:underline text-2xs inline-block mt-1 font-medium"
                    >
                      Track Shipment &rarr;
                    </a>
                  )}
                </div>
              )}

              {activeRequest.status === "rejected" && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-900 dark:text-red-300 text-xs space-y-2">
                  <p>
                    <strong>Reason:</strong>{" "}
                    {activeRequest.rejectionReason || "Requirements not met."}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsModalOpen(true)}
                    className="border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-white/15 dark:text-slate-300 dark:hover:border-white/30 dark:hover:text-white dark:hover:bg-white/5"
                  >
                    Submit New Request
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-2">
              <Button
                onClick={() => setIsModalOpen(true)}
                className="!bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold shadow-sm"
              >
                Request NFC Player Card (₹{cardPrice}){" "}
                <ArrowRight size={16} className="ml-1.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

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
