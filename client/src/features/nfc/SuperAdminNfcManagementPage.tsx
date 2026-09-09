// src/features/nfc/SuperAdminNfcManagementPage.tsx
import React, { useState } from "react";
import {
  CreditCard,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Package,
  Eye,
  Check,
  X,
  Search,
  ExternalLink,
  Download,
  Palette,
  Sparkles,
  Users,
  User,
  Building2,
  Send,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  useGetNfcPricingQuery,
  useUpdateNfcPricingMutation,
  useListNfcRequestsQuery,
  useApproveNfcRequestMutation,
  useRejectNfcRequestMutation,
  useUpdateNfcFulfillmentMutation,
  NfcCardRequest,
} from "../../store/api/nfcCardApi";
import { Button, Input, Modal, Badge, StatCard, EmptyState, Skeleton } from "../../components/ui";

export const SuperAdminNfcManagementPage: React.FC = () => {
  const { data: pricing, isLoading: pricingLoading } = useGetNfcPricingQuery();
  const [updatePricing, { isLoading: isUpdatingPricing }] = useUpdateNfcPricingMutation();

  const [standardPriceInput, setStandardPriceInput] = useState<string>("");
  const [customPriceInput, setCustomPriceInput] = useState<string>("");

  // Populate pricing inputs when pricing is loaded
  React.useEffect(() => {
    if (pricing) {
      setStandardPriceInput(String(pricing.cardPrice));
      setCustomPriceInput(String(pricing.customCardPrice));
    }
  }, [pricing]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: requestsData, isLoading: requestsLoading, refetch } = useListNfcRequestsQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    requesterType: typeFilter !== "all" ? typeFilter : undefined,
    search: searchQuery || undefined,
  });

  const [approveRequest, { isLoading: isApproving }] = useApproveNfcRequestMutation();
  const [rejectRequest, { isLoading: isRejecting }] = useRejectNfcRequestMutation();
  const [updateFulfillment, { isLoading: isUpdatingFulfillment }] =
    useUpdateNfcFulfillmentMutation();

  // Modals
  const [selectedRequest, setSelectedRequest] = useState<NfcCardRequest | null>(null);
  const [rejectModalReq, setRejectModalReq] = useState<NfcCardRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [dispatchModalReq, setDispatchModalReq] = useState<NfcCardRequest | null>(null);
  const [courierDetails, setCourierDetails] = useState({
    courierName: "Blue Dart",
    trackingNumber: "",
    trackingUrl: "",
  });

  const requests = requestsData?.requests ?? [];

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    const cardPrice = parseFloat(standardPriceInput);
    const customCardPrice = parseFloat(customPriceInput);

    if (isNaN(cardPrice) || cardPrice < 0 || isNaN(customCardPrice) || customCardPrice < 0) {
      toast.error("Please enter valid prices");
      return;
    }

    try {
      await updatePricing({ cardPrice, customCardPrice }).unwrap();
      toast.success("NFC Card pricing updated globally!");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update pricing");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveRequest({ requestId: id }).unwrap();
      toast.success("NFC Card request approved! Purchaser has been notified to complete payment.");
      if (selectedRequest?.id === id) setSelectedRequest(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to approve request");
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalReq) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      await rejectRequest({
        requestId: rejectModalReq.id,
        reason: rejectionReason.trim(),
      }).unwrap();
      toast.success("Request rejected and purchaser notified.");
      setRejectModalReq(null);
      setRejectionReason("");
      if (selectedRequest?.id === rejectModalReq.id) setSelectedRequest(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to reject request");
    }
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchModalReq) return;
    try {
      await updateFulfillment({
        requestId: dispatchModalReq.id,
        status: "dispatched",
        courierName: courierDetails.courierName,
        trackingNumber: courierDetails.trackingNumber,
        trackingUrl: courierDetails.trackingUrl,
      }).unwrap();
      toast.success("Order marked as dispatched! Purchaser notified with tracking details.");
      setDispatchModalReq(null);
      setCourierDetails({ courierName: "Blue Dart", trackingNumber: "", trackingUrl: "" });
      if (selectedRequest?.id === dispatchModalReq.id) setSelectedRequest(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update dispatch status");
    }
  };

  const handleMarkDelivered = async (id: string) => {
    try {
      await updateFulfillment({
        requestId: id,
        status: "delivered",
      }).unwrap();
      toast.success("Order marked as delivered!");
      if (selectedRequest?.id === id) setSelectedRequest(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to mark as delivered");
    }
  };

  // Metrics
  const totalRevenue = requests.reduce(
    (acc, r) => (["paid", "dispatched", "delivered"].includes(r.status) ? acc + r.totalAmount : acc),
    0,
  );
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const inProductionCount = requests.filter((r) => r.status === "paid").length;
  const inTransitCount = requests.filter((r) => r.status === "dispatched").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <p className="section-title mb-1">Global Platform Operations</p>
        <h1 className="font-display font-black text-white text-2xl uppercase tracking-tight">
          NFC Card Management
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Configure dynamic pricing, review incoming card requests, and oversee order fulfillment
        </p>
      </div>

      {/* Dynamic Pricing Configuration Card */}
      <div className="card p-5 border-volt-400/20 bg-gradient-to-r from-pitch-900 via-pitch-950 to-pitch-900 shadow-xl">
        <form onSubmit={handleSavePricing}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-volt-400/10 border border-volt-400/30 flex items-center justify-center text-volt-400 shrink-0">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-sm">
                  Global Dynamic NFC Pricing (₹ INR)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set dynamic card prices charged at Stripe checkout for independent players and academy bulk batches.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-3 w-full lg:w-auto">
              <div className="w-full sm:w-36">
                <Input
                  label="Official Card (₹)"
                  type="number"
                  step="1"
                  min="0"
                  value={standardPriceInput}
                  onChange={(e) => setStandardPriceInput(e.target.value)}
                  disabled={pricingLoading}
                  required
                />
              </div>

              <div className="w-full sm:w-36">
                <Input
                  label="Custom Card (₹)"
                  type="number"
                  step="1"
                  min="0"
                  value={customPriceInput}
                  onChange={(e) => setCustomPriceInput(e.target.value)}
                  disabled={pricingLoading}
                  required
                />
              </div>

              <div className="pt-1 sm:pt-0">
                <Button
                  type="submit"
                  size="md"
                  loading={isUpdatingPricing}
                  className="!bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold w-full sm:w-auto justify-center"
                >
                  Save Pricing
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          label="Total NFC Revenue"
          value={`₹${totalRevenue.toLocaleString("en-IN")}`}
          icon={<DollarSign size={18} />}
          accent="volt"
        />
        <StatCard
          label="Pending Review"
          value={pendingCount}
          icon={<Clock size={18} />}
          accent="ember"
        />
        <StatCard
          label="Awaiting Payment"
          value={approvedCount}
          icon={<CheckCircle2 size={18} />}
          accent="field"
        />
        <StatCard
          label="In Production (Paid)"
          value={inProductionCount}
          icon={<Package size={18} />}
          accent="volt"
        />
        <StatCard
          label="In Transit (Dispatched)"
          value={inTransitCount}
          icon={<Truck size={18} />}
          accent="ice"
        />
      </div>

      {/* Requests Management Panel */}
      <div className="card overflow-hidden">
        {/* Filters bar */}
        <div className="p-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs">
            {[
              { id: "all", label: "All" },
              { id: "pending", label: "Pending" },
              { id: "approved", label: "Approved" },
              { id: "paid", label: "Paid / Production" },
              { id: "dispatched", label: "Dispatched" },
              { id: "delivered", label: "Delivered" },
              { id: "rejected", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  statusFilter === tab.id
                    ? "bg-volt-400 text-pitch-950 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters right side: Type filter + Search bar */}
          <div className="flex items-center gap-3">
            <select
              className="input text-xs !w-auto"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Purchasers</option>
              <option value="independent_player">Independent Players</option>
              <option value="academy">Academies (Bulk)</option>
            </select>

            <div className="relative min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                className="input w-full pl-9 text-xs"
                placeholder="Search academy, student, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Requests Table */}
        {requestsLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            title="No NFC Card Requests Found"
            description="No requests match the selected filters or search query."
            icon={<CreditCard size={36} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-white/[0.02] text-2xs font-mono uppercase tracking-wider text-slate-400 border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">Request</th>
                  <th className="py-3 px-4">Purchaser</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Cards</th>
                  <th className="py-3 px-4">Design Style</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requests.map((req) => {
                  const reqId = String(req.id || (req as any)._id || "");
                  return (
                    <tr key={reqId || Math.random()} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-volt-400">
                          #{reqId ? reqId.slice(-6).toUpperCase() : "NFC"}
                        </span>
                        <span className="block text-2xs text-slate-500">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                    <td className="py-3 px-4">
                      {req.requesterType === "academy" && req.academyId ? (
                        <div>
                          <p className="font-semibold text-white flex items-center gap-1 text-xs">
                            <Building2 size={13} className="text-volt-400" />
                            {req.academyId.name}
                          </p>
                          <p className="text-2xs text-slate-400">
                            {req.requesterId.firstName} {req.requesterId.lastName}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-white flex items-center gap-1 text-xs">
                            <User size={13} className="text-core-400" />
                            {req.requesterId.firstName} {req.requesterId.lastName}
                          </p>
                          <p className="text-2xs text-slate-500 font-mono">
                            {req.shippingAddress.city}, {req.shippingAddress.state}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {req.requesterType === "academy" ? (
                        <span className="px-2 py-0.5 rounded text-2xs font-mono uppercase bg-field-400/10 text-field-400 border border-field-400/20">
                          Academy
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-2xs font-mono uppercase bg-core-400/10 text-core-400 border border-core-400/20">
                          Independent
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-bold text-white">
                      {req.quantity} card{req.quantity > 1 ? "s" : ""}
                    </td>
                    <td className="py-3 px-4">
                      {req.cardType === "custom" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <Palette size={11} /> Custom Artwork
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-volt-400/10 text-volt-400 border border-volt-400/20">
                          <Sparkles size={11} /> Official
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      ₹{req.totalAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4">
                      {req.status === "pending" && (
                        <Badge variant="yellow">
                          <Clock size={11} className="mr-1 inline" /> Pending
                        </Badge>
                      )}
                      {req.status === "approved" && (
                        <Badge variant="green" className="bg-field-400/20 text-field-400 border-field-400/30">
                          <CheckCircle2 size={11} className="mr-1 inline" /> Approved
                        </Badge>
                      )}
                      {req.status === "paid" && (
                        <Badge variant="blue" className="bg-volt-400/20 text-volt-400 border-volt-400/30">
                          <Package size={11} className="mr-1 inline" /> Paid
                        </Badge>
                      )}
                      {req.status === "dispatched" && (
                        <Badge variant="blue">
                          <Truck size={11} className="mr-1 inline" /> Dispatched
                        </Badge>
                      )}
                      {req.status === "delivered" && (
                        <Badge variant="green">
                          <CheckCircle2 size={11} className="mr-1 inline" /> Delivered
                        </Badge>
                      )}
                      {req.status === "rejected" && (
                        <Badge variant="red">
                          <AlertCircle size={11} className="mr-1 inline" /> Rejected
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedRequest(req)}
                        title="View Details"
                      >
                        <Eye size={13} className="mr-1" /> View
                      </Button>

                      {/* Approval Actions */}
                      {req.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(req.id)}
                            loading={isApproving}
                            className="!bg-field-400 hover:!bg-field-300 !text-pitch-950 font-bold"
                          >
                            <Check size={13} className="mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setRejectModalReq(req);
                              setRejectionReason("");
                            }}
                            className="text-red-400 hover:text-red-300 border-red-500/20"
                          >
                            <X size={13} className="mr-1" /> Reject
                          </Button>
                        </>
                      )}

                      {/* Fulfillment Actions */}
                      {req.status === "paid" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setDispatchModalReq(req);
                            setCourierDetails({
                              courierName: "Blue Dart",
                              trackingNumber: "",
                              trackingUrl: "",
                            });
                          }}
                          className="!bg-ice-400 hover:!bg-ice-300 !text-pitch-950 font-bold"
                        >
                          <Truck size={13} className="mr-1" /> Dispatch
                        </Button>
                      )}

                      {req.status === "dispatched" && (
                        <Button
                          size="sm"
                          onClick={() => handleMarkDelivered(reqId)}
                          loading={isUpdatingFulfillment}
                          className="!bg-field-400 hover:!bg-field-300 !text-pitch-950 font-bold"
                        >
                          <CheckCircle2 size={13} className="mr-1" /> Mark Delivered
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <Modal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          title={`Order #${String(selectedRequest.id || (selectedRequest as any)._id || "").slice(-6).toUpperCase()}`}
          size="lg"
        >
          <div className="space-y-5 text-sm">
            {/* Requester info banner */}
            <div className="p-4 rounded-xl bg-pitch-900 border border-white/10 grid sm:grid-cols-2 gap-3">
              <div>
                <p className="text-2xs font-mono uppercase text-slate-400 font-semibold">
                  Requester Details
                </p>
                <p className="font-bold text-white mt-1">
                  {selectedRequest.requesterId.firstName} {selectedRequest.requesterId.lastName}
                </p>
                <p className="text-xs text-slate-400">{selectedRequest.requesterId.email}</p>
                {selectedRequest.requesterId.phone && (
                  <p className="text-xs text-slate-400">Phone: {selectedRequest.requesterId.phone}</p>
                )}
                {selectedRequest.academyId && (
                  <p className="text-xs text-volt-400 mt-1 font-semibold">
                    Academy: {selectedRequest.academyId.name}
                  </p>
                )}
              </div>

              <div>
                <p className="text-2xs font-mono uppercase text-slate-400 font-semibold">
                  Order Summary
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Quantity: <strong className="text-white">{selectedRequest.quantity} cards</strong>
                </p>
                <p className="text-xs text-slate-300">
                  Rate: <strong>₹{selectedRequest.unitPrice} / card</strong>
                </p>
                <p className="text-sm font-mono font-bold text-volt-400 mt-1">
                  Total: ₹{selectedRequest.totalAmount.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {/* Custom Artwork preview if available */}
            {selectedRequest.cardType === "custom" && selectedRequest.customDesignUrl && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300 flex items-center gap-2 text-xs">
                    <Palette size={15} /> Uploaded Custom Design Artwork
                  </span>
                  <a
                    href={selectedRequest.customDesignUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="nox-btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1.5"
                  >
                    <Download size={13} /> Download File
                  </a>
                </div>

                {/* If image, display inline thumbnail */}
                {selectedRequest.customDesignUrl.match(/\.(jpeg|jpg|png|webp|gif)/i) && (
                  <div className="relative rounded-lg overflow-hidden border border-white/10 max-h-56 bg-pitch-950 flex items-center justify-center">
                    <img
                      src={selectedRequest.customDesignUrl}
                      alt="Custom Design"
                      className="max-h-56 object-contain"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Shipping Address */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 text-xs">
              <p className="font-mono text-2xs uppercase text-slate-400 font-bold tracking-wider">
                Shipping &amp; Delivery Destination
              </p>
              <p className="font-bold text-white">{selectedRequest.shippingAddress.recipientName}</p>
              <p className="text-slate-400">Contact: {selectedRequest.shippingAddress.phone}</p>
              <p className="text-slate-300">
                {selectedRequest.shippingAddress.addressLine1}
                {selectedRequest.shippingAddress.addressLine2 ? `, ${selectedRequest.shippingAddress.addressLine2}` : ""}
              </p>
              <p className="text-slate-300">
                {selectedRequest.shippingAddress.city}, {selectedRequest.shippingAddress.state} -{" "}
                {selectedRequest.shippingAddress.postalCode}, {selectedRequest.shippingAddress.country}
              </p>
            </div>

            {/* Students List */}
            <div>
              <p className="font-mono text-2xs uppercase text-slate-400 font-bold tracking-wider mb-2">
                Card Players ({selectedRequest.students.length})
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-white/5 rounded-xl p-2 bg-pitch-950">
                {selectedRequest.students.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-pitch-900 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-volt-400/20 text-volt-400 font-mono text-2xs flex items-center justify-center font-bold">
                        {st.jerseyNumber ?? idx + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-white">{st.studentName}</span>
                        {st.ageGroup && (
                          <span className="text-2xs text-slate-400 ml-1.5">({st.ageGroup})</span>
                        )}
                      </div>
                    </div>
                    {st.publicProfileToken && (
                      <a
                        href={`/players/${st.publicProfileToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-2xs font-mono text-volt-400 hover:underline flex items-center gap-1"
                      >
                        Scouting Card <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Dispatch details if present */}
            {selectedRequest.dispatchDetails?.dispatchedAt && (
              <div className="p-3.5 rounded-xl bg-ice-500/10 border border-ice-500/20 text-xs space-y-1">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <Truck size={15} className="text-ice-400" /> Dispatch Record
                </p>
                <p className="text-slate-300">
                  Courier: <strong>{selectedRequest.dispatchDetails.courierName || "Standard"}</strong>{" "}
                  {selectedRequest.dispatchDetails.trackingNumber && (
                    <>• Tracking Code: <strong>{selectedRequest.dispatchDetails.trackingNumber}</strong></>
                  )}
                </p>
              </div>
            )}

            {/* Actions footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button variant="secondary" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>

              {selectedRequest.status === "pending" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRejectModalReq(selectedRequest);
                      setRejectionReason("");
                    }}
                    className="text-red-400 hover:text-red-300 border-red-500/20"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApprove(selectedRequest.id)}
                    loading={isApproving}
                    className="!bg-field-400 hover:!bg-field-300 !text-pitch-950 font-bold"
                  >
                    Approve Request
                  </Button>
                </>
              )}

              {selectedRequest.status === "paid" && (
                <Button
                  onClick={() => {
                    setDispatchModalReq(selectedRequest);
                    setCourierDetails({ courierName: "Blue Dart", trackingNumber: "", trackingUrl: "" });
                  }}
                  className="!bg-ice-400 hover:!bg-ice-300 !text-pitch-950 font-bold"
                >
                  <Truck size={14} className="mr-1.5" /> Dispatch Order
                </Button>
              )}

              {selectedRequest.status === "dispatched" && (
                <Button
                  onClick={() => handleMarkDelivered(selectedRequest.id)}
                  loading={isUpdatingFulfillment}
                  className="!bg-field-400 hover:!bg-field-300 !text-pitch-950 font-bold"
                >
                  <CheckCircle2 size={14} className="mr-1.5" /> Mark Delivered
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectModalReq && (
        <Modal
          isOpen={!!rejectModalReq}
          onClose={() => setRejectModalReq(null)}
          title="Decline NFC Card Request"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Please provide an explanation for declining this request. The applicant will be
              notified via in-app alert.
            </p>
            <div>
              <label className="block text-2xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                Reason for Rejection
              </label>
              <textarea
                rows={3}
                className="input w-full text-xs"
                placeholder="e.g. Unclear custom artwork resolution, duplicate order, invalid address..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button variant="secondary" onClick={() => setRejectModalReq(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={handleConfirmReject}
                loading={isRejecting}
                className="!bg-red-500/20 !text-red-300 border-red-500/30 hover:!bg-red-500/30 font-bold"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Dispatch Modal */}
      {dispatchModalReq && (
        <Modal
          isOpen={!!dispatchModalReq}
          onClose={() => setDispatchModalReq(null)}
          title="Mark Order as Dispatched"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Enter the courier provider and shipment tracking number to notify the purchaser.
            </p>
            <div className="space-y-3">
              <Input
                label="Courier Partner"
                placeholder="e.g. Blue Dart, Delhivery, DTDC, India Post"
                value={courierDetails.courierName}
                onChange={(e) =>
                  setCourierDetails({ ...courierDetails, courierName: e.target.value })
                }
                required
              />
              <Input
                label="Tracking Number / AWB"
                placeholder="e.g. BLD123456789"
                value={courierDetails.trackingNumber}
                onChange={(e) =>
                  setCourierDetails({ ...courierDetails, trackingNumber: e.target.value })
                }
              />
              <Input
                label="Direct Tracking URL (Optional)"
                placeholder="https://..."
                value={courierDetails.trackingUrl}
                onChange={(e) =>
                  setCourierDetails({ ...courierDetails, trackingUrl: e.target.value })
                }
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button variant="secondary" onClick={() => setDispatchModalReq(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDispatch}
                loading={isUpdatingFulfillment}
                className="!bg-ice-400 hover:!bg-ice-300 !text-pitch-950 font-bold"
              >
                Confirm Dispatch &amp; Notify
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SuperAdminNfcManagementPage;
