// src/features/nfc/AcademyNfcManagementPage.tsx
import React, { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import {
  CreditCard,
  Plus,
  UploadCloud,
  CheckCircle2,
  Clock,
  Truck,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Eye,
  ExternalLink,
  Package,
  Layers,
  Sparkles,
  Palette,
  X,
  Building2,
  Users,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { RootState } from "../../store";
import {
  useGetNfcPricingQuery,
  useListNfcRequestsQuery,
  useCreateAcademyNfcRequestMutation,
  useCreateNfcCheckoutSessionMutation,
  NfcCardRequest,
  NfcShippingAddress,
} from "../../store/api/nfcCardApi";
import { useGetStudentsQuery, Student } from "../../store/api/studentsApi";
import { useGetFranchisesQuery } from "../../store/api/franchiseApi";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useUploadImageMutation } from "../../store/api/uploadApi";
import { Button, Input, Modal, Badge, StatCard, EmptyState, Skeleton } from "../../components/ui";

export const AcademyNfcManagementPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const academyId = user?.academyId;
  const currentFranchiseId = useCurrentFranchiseId();

  const { data: pricing } = useGetNfcPricingQuery();
  const { data: requestsData, isLoading: requestsLoading, refetch } = useListNfcRequestsQuery();
  const { data: franchises } = useGetFranchisesQuery(
    { academyId: academyId || undefined },
    { skip: !academyId },
  );

  const [createAcademyRequest, { isLoading: isCreating }] = useCreateAcademyNfcRequestMutation();
  const [createCheckoutSession, { isLoading: isCheckingOut }] = useCreateNfcCheckoutSessionMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadImageMutation();

  // Modal states
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [viewRequest, setViewRequest] = useState<NfcCardRequest | null>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("all");
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const effectiveFranchiseId =
    selectedFranchiseId !== "all"
      ? selectedFranchiseId
      : currentFranchiseId || (franchises && franchises[0]?.id) || "";

  const { data: studentsData, isLoading: studentsLoading } = useGetStudentsQuery(
    { franchiseId: effectiveFranchiseId, limit: 200 },
    { skip: !effectiveFranchiseId },
  );

  // Design state
  const [cardType, setCardType] = useState<"official" | "custom">("official");
  const [customDesignUrl, setCustomDesignUrl] = useState<string>("");
  const [customDesignFileName, setCustomDesignFileName] = useState<string>("");

  // Shipping state
  const [shippingAddress, setShippingAddress] = useState<NfcShippingAddress>({
    recipientName: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
    phone: (user as any)?.phone || "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  });

  const allStudents = studentsData?.items ?? [];

  // Filtered students for selection
  const filteredStudents = useMemo(() => {
    return allStudents.filter((s: Student) => {
      const matchFranchise =
        selectedFranchiseId === "all" || s.franchiseId === selectedFranchiseId;
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
      const matchSearch =
        !studentSearch.trim() ||
        fullName.includes(studentSearch.toLowerCase()) ||
        String(s.jerseyNumber || "").includes(studentSearch.trim());
      return matchFranchise && matchSearch;
    });
  }, [allStudents, selectedFranchiseId, studentSearch]);

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredStudents.map((s) => s.id);
    const newSelected = Array.from(new Set([...selectedStudentIds, ...filteredIds]));
    setSelectedStudentIds(newSelected);
  };

  const handleClearSelection = () => {
    setSelectedStudentIds([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadImage({
        file,
        category: "notification_document",
      }).unwrap();
      setCustomDesignUrl(result.url);
      setCustomDesignFileName(file.name);
      toast.success("Custom design artwork uploaded!");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to upload design artwork");
    }
  };

  const unitPrice =
    cardType === "custom"
      ? pricing?.customCardPrice ?? 399
      : pricing?.cardPrice ?? 299;
  const totalAmount = selectedStudentIds.length * unitPrice;

  const handleSubmitBulkOrder = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error("Please select at least one student");
      return;
    }
    if (cardType === "custom" && !customDesignUrl) {
      toast.error("Please upload your custom card design artwork");
      return;
    }
    if (
      !shippingAddress.recipientName.trim() ||
      !shippingAddress.phone.trim() ||
      !shippingAddress.addressLine1.trim() ||
      !shippingAddress.city.trim() ||
      !shippingAddress.state.trim() ||
      !shippingAddress.postalCode.trim()
    ) {
      toast.error("Please fill in complete delivery address details");
      return;
    }

    try {
      await createAcademyRequest({
        academyId,
        studentIds: selectedStudentIds,
        cardType,
        customDesignUrl: customDesignUrl || undefined,
        customDesignFileName: customDesignFileName || undefined,
        shippingAddress,
      }).unwrap();

      toast.success("Bulk NFC card request submitted! Awaiting Super Admin review.");
      setIsWizardOpen(false);
      // Reset wizard
      setStep(1);
      setSelectedStudentIds([]);
      setCardType("official");
      setCustomDesignUrl("");
      setCustomDesignFileName("");
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to submit request");
    }
  };

  const handlePay = async (requestId: string) => {
    try {
      const res = await createCheckoutSession(requestId).unwrap();
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to open Stripe checkout");
    }
  };

  const requests = requestsData?.requests ?? [];

  // Summary counts
  const totalCardsOrdered = requests.reduce(
    (acc, r) => (["paid", "dispatched", "delivered"].includes(r.status) ? acc + r.quantity : acc),
    0,
  );
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const approvedAwaitingPayment = requests.filter((r) => r.status === "approved").length;
  const dispatchedOrders = requests.filter((r) => r.status === "dispatched").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-title mb-1">Squad Gear &amp; Tech</p>
          <h1 className="font-display font-black text-white text-xl sm:text-2xl uppercase tracking-tight">
            NFC Smart Cards
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Order physical contactless NFC player cards for your academy squad
          </p>
        </div>

        <Button
          onClick={() => {
            setIsWizardOpen(true);
            setStep(1);
          }}
          className="!bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold w-full sm:w-auto justify-center"
        >
          <Plus size={16} className="mr-1.5" /> Order NFC Cards
        </Button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Cards Delivered / Paid"
          value={totalCardsOrdered}
          icon={<CreditCard size={18} />}
          accent="volt"
        />
        <StatCard
          label="Pending Admin Review"
          value={pendingRequests}
          icon={<Clock size={18} />}
          accent="ember"
        />
        <StatCard
          label="Approved (Ready to Pay)"
          value={approvedAwaitingPayment}
          icon={<CheckCircle2 size={18} />}
          accent="field"
        />
        <StatCard
          label="Orders In Transit"
          value={dispatchedOrders}
          icon={<Truck size={18} />}
          accent="ice"
        />
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-display font-bold text-white text-base">NFC Card Order Batches</h2>
          <span className="text-xs font-mono text-slate-400">{requests.length} total orders</span>
        </div>

        {requestsLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            title="No NFC Card Requests Yet"
            description="Equip your players with contactless digital scouting cards. Click 'Order NFC Cards' to select players and customize designs."
            icon={<CreditCard size={36} />}
            action={
              <Button
                onClick={() => {
                  setIsWizardOpen(true);
                  setStep(1);
                }}
                className="!bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold"
              >
                <Plus size={16} className="mr-1.5" /> Order NFC Cards
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-white/[0.02] text-2xs font-mono uppercase tracking-wider text-slate-400 border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">Batch ID</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Card Style</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requests.map((req) => {
                  const reqId = String(req.id || (req as any)._id || "");
                  return (
                    <tr key={reqId || Math.random()} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-volt-400 font-semibold">
                        #{reqId ? reqId.slice(-6).toUpperCase() : "NFC"}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-white">
                          <Users size={14} className="text-slate-400" />
                          {req.quantity} player{req.quantity > 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {req.cardType === "custom" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <Palette size={11} /> Custom Artwork
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-volt-400/10 text-volt-400 border border-volt-400/20">
                            <Sparkles size={11} /> Official Noxphere
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        ₹{req.totalAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        {req.status === "pending" && (
                          <Badge variant="yellow">
                            <Clock size={11} className="mr-1 inline" /> Pending Review
                          </Badge>
                        )}
                        {req.status === "approved" && (
                          <Badge variant="green" className="bg-field-400/20 text-field-400 border-field-400/30">
                            <CheckCircle2 size={11} className="mr-1 inline" /> Approved
                          </Badge>
                        )}
                        {req.status === "paid" && (
                          <Badge variant="blue" className="bg-volt-400/20 text-volt-400 border-volt-400/30">
                            <Package size={11} className="mr-1 inline" /> In Production
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
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setViewRequest(req)}
                          title="View Details"
                        >
                          <Eye size={13} className="mr-1" /> Details
                        </Button>

                        {req.status === "approved" && (
                          <Button
                            size="sm"
                            onClick={() => handlePay(reqId)}
                            loading={isCheckingOut}
                            className="!bg-field-400 hover:!bg-field-300 !text-pitch-950 font-bold"
                          >
                            Pay ₹{req.totalAmount}
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
      {viewRequest && (
        <Modal
          isOpen={!!viewRequest}
          onClose={() => setViewRequest(null)}
          title={`Order Batch #${String(viewRequest.id || (viewRequest as any)._id || "").slice(-6).toUpperCase()}`}
          size="lg"
        >
          <div className="space-y-5 text-sm">
            {/* Status Alert */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-pitch-900 border border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Current Status:</span>
                <span className="font-bold text-white uppercase text-xs">
                  {viewRequest.status.replace("_", " ")}
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-volt-400">
                ₹{viewRequest.totalAmount.toLocaleString("en-IN")} ({viewRequest.quantity} cards)
              </span>
            </div>

            {/* Custom Artwork preview if available */}
            {viewRequest.cardType === "custom" && viewRequest.customDesignUrl && (
              <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Palette size={14} /> Custom Design File
                  </span>
                  <a
                    href={viewRequest.customDesignUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-volt-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    View / Download <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-2xs text-slate-400">
                  Attached file: {viewRequest.customDesignFileName || "custom-card-design"}
                </p>
              </div>
            )}

            {/* Dispatch Tracking if available */}
            {viewRequest.dispatchDetails?.dispatchedAt && (
              <div className="p-3.5 rounded-xl bg-ice-500/10 border border-ice-500/20 text-xs space-y-1">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <Truck size={15} className="text-ice-400" /> Shipping &amp; Courier Details
                </p>
                <p className="text-slate-300">
                  Courier: <strong>{viewRequest.dispatchDetails.courierName || "Standard"}</strong>{" "}
                  {viewRequest.dispatchDetails.trackingNumber && (
                    <>• Tracking Number: <strong>{viewRequest.dispatchDetails.trackingNumber}</strong></>
                  )}
                </p>
                {viewRequest.dispatchDetails.trackingUrl && (
                  <a
                    href={viewRequest.dispatchDetails.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-volt-400 hover:underline text-2xs inline-block mt-1"
                  >
                    Track Package Directly &rarr;
                  </a>
                )}
              </div>
            )}

            {/* Shipping Address */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs space-y-1">
              <p className="font-bold text-white uppercase font-mono text-2xs tracking-wider text-slate-400">
                Delivery Address
              </p>
              <p className="font-semibold text-white">{viewRequest.shippingAddress.recipientName}</p>
              <p className="text-slate-400">Phone: {viewRequest.shippingAddress.phone}</p>
              <p className="text-slate-400">
                {viewRequest.shippingAddress.addressLine1}
                {viewRequest.shippingAddress.addressLine2 ? `, ${viewRequest.shippingAddress.addressLine2}` : ""}
              </p>
              <p className="text-slate-400">
                {viewRequest.shippingAddress.city}, {viewRequest.shippingAddress.state} -{" "}
                {viewRequest.shippingAddress.postalCode}
              </p>
            </div>

            {/* Students list */}
            <div>
              <p className="text-2xs font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
                Included Players ({viewRequest.students.length})
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {viewRequest.students.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-pitch-900 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-volt-400/20 text-volt-400 font-mono text-2xs flex items-center justify-center font-bold">
                        {st.jerseyNumber ?? idx + 1}
                      </span>
                      <span className="font-semibold text-white">{st.studentName}</span>
                      {st.franchiseName && (
                        <span className="text-2xs text-slate-400">({st.franchiseName})</span>
                      )}
                    </div>
                    {st.publicProfileToken && (
                      <a
                        href={`/players/${st.publicProfileToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-2xs font-mono text-volt-400 hover:underline flex items-center gap-1"
                      >
                        Preview Card <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rejection notice if any */}
            {viewRequest.status === "rejected" && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                <strong>Rejection Reason:</strong> {viewRequest.rejectionReason || "Requirements not met."}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button variant="secondary" onClick={() => setViewRequest(null)}>
                Close
              </Button>
              {viewRequest.status === "approved" && (
                <Button
                  onClick={() => handlePay(viewRequest.id || (viewRequest as any)._id)}
                  loading={isCheckingOut}
                  className="!bg-field-400 hover:!bg-field-300 !text-pitch-950 font-bold"
                >
                  Pay ₹{viewRequest.totalAmount} Now
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Multi-step Request Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Order Bulk NFC Cards for Academy"
        size="lg"
      >
        <div className="space-y-5">
          {/* Stepper Indicator */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs overflow-x-auto no-scrollbar gap-2">
            <span
              className={`font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                step === 1 ? "text-volt-400" : "text-slate-400"
              }`}
            >
              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center font-mono text-2xs">
                1
              </span>
              <span className="hidden sm:inline">Select Players</span> ({selectedStudentIds.length})
            </span>
            <span
              className={`font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                step === 2 ? "text-volt-400" : "text-slate-400"
              }`}
            >
              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center font-mono text-2xs">
                2
              </span>
              <span className="hidden sm:inline">Card </span>Style
            </span>
            <span
              className={`font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                step === 3 ? "text-volt-400" : "text-slate-400"
              }`}
            >
              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center font-mono text-2xs">
                3
              </span>
              Shipping
            </span>
            <span
              className={`font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                step === 4 ? "text-volt-400" : "text-slate-400"
              }`}
            >
              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center font-mono text-2xs">
                4
              </span>
              Summary
            </span>
          </div>

          {/* Step 1: Select Students */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Franchise and search filters */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                    Filter by Franchise / Branch
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={selectedFranchiseId}
                    onChange={(e) => setSelectedFranchiseId(e.target.value)}
                  >
                    <option value="all">All Franchises</option>
                    {franchises?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                    Search Player
                  </label>
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type="text"
                      className="input w-full pl-9 text-xs"
                      placeholder="Search player name or jersey #..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Selection actions & counter */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-mono text-slate-400">
                  Showing <strong>{filteredStudents.length}</strong> players &bull;{" "}
                  <strong className="text-volt-400">{selectedStudentIds.length}</strong> selected
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={handleSelectAllFiltered}>
                    Select Filtered ({filteredStudents.length})
                  </Button>
                  {selectedStudentIds.length > 0 && (
                    <Button size="sm" variant="secondary" onClick={handleClearSelection}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Student list */}
              <div className="max-h-64 overflow-y-auto space-y-2 border border-white/5 rounded-xl p-2 bg-pitch-950/60">
                {studentsLoading ? (
                  <p className="text-center text-xs text-slate-500 py-6">Loading players...</p>
                ) : filteredStudents.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-6">No players match the criteria.</p>
                ) : (
                  filteredStudents.map((st) => {
                    const isSelected = selectedStudentIds.includes(st.id);
                    return (
                      <div
                        key={st.id}
                        onClick={() => toggleSelectStudent(st.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-volt-400/10 border-volt-400/40 text-white"
                            : "bg-pitch-900 border-white/5 text-slate-300 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by div click
                            className="rounded border-slate-700 text-volt-400 focus:ring-volt-400 cursor-pointer"
                          />
                          <div>
                            <p className="font-semibold text-xs">
                              {st.firstName} {st.lastName}
                            </p>
                            <p className="text-2xs text-slate-500 font-mono">
                              #{st.jerseyNumber ?? "—"} &bull; {st.position || "Player"} &bull; {st.ageGroup}
                            </p>
                          </div>
                        </div>

                        {st.franchiseId && (
                          <span className="text-2xs text-slate-500 font-mono">
                            {franchises?.find((f) => f.id === st.franchiseId)?.name || "Branch"}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Step 2: Card Customization */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Choose whether you want the official tournament-ready Noxphere design or customized
                cards featuring your academy's logo, colors, and branding.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Official Card Option */}
                <div
                  onClick={() => setCardType("official")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 ${
                    cardType === "official"
                      ? "bg-volt-400/10 border-volt-400 text-white shadow-lg"
                      : "bg-pitch-900 border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-1.5">
                      <Sparkles size={16} className="text-volt-400" /> Official Noxphere Card
                    </span>
                    <input
                      type="radio"
                      name="cardType"
                      checked={cardType === "official"}
                      onChange={() => setCardType("official")}
                    />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sleek dark cyberpunk design with high-contrast volt accents, NFC chip, and verified Noxphere ID branding.
                  </p>
                  <span className="font-mono text-xs text-volt-400 font-bold block pt-1">
                    ₹{pricing?.cardPrice ?? 299} / card
                  </span>
                </div>

                {/* Custom Card Option */}
                <div
                  onClick={() => setCardType("custom")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 ${
                    cardType === "custom"
                      ? "bg-purple-500/10 border-purple-500 text-white shadow-lg"
                      : "bg-pitch-900 border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-1.5">
                      <Palette size={16} className="text-purple-400" /> Custom Academy Card
                    </span>
                    <input
                      type="radio"
                      name="cardType"
                      checked={cardType === "custom"}
                      onChange={() => setCardType("custom")}
                    />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Personalized with your academy badge, custom color scheme, and background artwork. Upload your design file below.
                  </p>
                  <span className="font-mono text-xs text-purple-400 font-bold block pt-1">
                    ₹{pricing?.customCardPrice ?? 399} / card
                  </span>
                </div>
              </div>

              {/* Upload field if custom card selected */}
              {cardType === "custom" && (
                <div className="p-4 rounded-xl bg-pitch-950 border border-purple-500/30 space-y-3">
                  <div className="flex items-start gap-2">
                    <UploadCloud size={20} className="text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-white">Upload Custom Card Artwork / Design</p>
                      <p className="text-2xs text-slate-400">
                        Upload your print-ready front/back design (PDF, PNG, or JPG up to 10MB).
                      </p>
                    </div>
                  </div>

                  {customDesignUrl ? (
                    <div className="p-3 rounded-lg bg-pitch-900 border border-purple-500/40 flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText size={18} className="text-purple-400 shrink-0" />
                        <span className="text-xs text-white truncate max-w-xs font-mono">
                          {customDesignFileName || "custom-card-design"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomDesignUrl("");
                          setCustomDesignFileName("");
                        }}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-white/15 hover:border-purple-400/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-pitch-900/40">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <UploadCloud size={24} className="text-purple-400 mb-2" />
                      <span className="text-xs font-semibold text-white">
                        {isUploading ? "Uploading artwork…" : "Click or drag file to upload design"}
                      </span>
                      <span className="text-2xs text-slate-500 mt-1">PNG, JPG, or PDF</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Shipping Address */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Enter the primary shipment address where the bulk card batch will be couriered.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Recipient Full Name / Manager"
                  value={shippingAddress.recipientName}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, recipientName: e.target.value })
                  }
                  required
                />
                <Input
                  label="Contact Phone"
                  value={shippingAddress.phone}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, phone: e.target.value })
                  }
                  required
                />
              </div>

              <Input
                label="Address Line 1"
                placeholder="Academy facility / Branch building, Street"
                value={shippingAddress.addressLine1}
                onChange={(e) =>
                  setShippingAddress({ ...shippingAddress, addressLine1: e.target.value })
                }
                required
              />

              <Input
                label="Address Line 2 (Optional)"
                placeholder="Suite, Landmark, Area"
                value={shippingAddress.addressLine2 || ""}
                onChange={(e) =>
                  setShippingAddress({ ...shippingAddress, addressLine2: e.target.value })
                }
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="City"
                  value={shippingAddress.city}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, city: e.target.value })
                  }
                  required
                />
                <Input
                  label="State"
                  value={shippingAddress.state}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, state: e.target.value })
                  }
                  required
                />
                <Input
                  label="PIN Code"
                  value={shippingAddress.postalCode}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, postalCode: e.target.value })
                  }
                  required
                />
              </div>
            </div>
          )}

          {/* Step 4: Summary & Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-pitch-950 border border-white/10 space-y-3">
                <div className="flex justify-between text-xs pb-2 border-b border-white/5">
                  <span className="text-slate-400">Selected Players:</span>
                  <span className="font-bold text-white">{selectedStudentIds.length} players</span>
                </div>
                <div className="flex justify-between text-xs pb-2 border-b border-white/5">
                  <span className="text-slate-400">Card Design:</span>
                  <span className="font-bold text-white capitalize">{cardType} Card</span>
                </div>
                <div className="flex justify-between text-xs pb-2 border-b border-white/5">
                  <span className="text-slate-400">Price Per Card:</span>
                  <span className="font-mono text-white">₹{unitPrice}</span>
                </div>
                <div className="flex justify-between text-sm pt-1">
                  <span className="font-bold text-white">Total Order Value:</span>
                  <span className="font-mono font-black text-volt-400 text-base">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-volt-400/10 border border-volt-400/20 text-volt-300 text-xs flex items-start gap-2">
                <Sparkles size={16} className="shrink-0 mt-0.5 text-volt-400" />
                <span>
                  <strong>Approval Workflow:</strong> Your order request will be submitted to the
                  Super Admin for verification. Once approved, you can complete payment via Stripe
                  right from this page to commence production and shipping!
                </span>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            {step > 1 ? (
              <Button variant="secondary" onClick={() => setStep((s) => (s - 1) as any)}>
                Back
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setIsWizardOpen(false)}>
                Cancel
              </Button>
            )}

            {step < 4 ? (
              <Button
                onClick={() => {
                  if (step === 1 && selectedStudentIds.length === 0) {
                    toast.error("Please select at least one student");
                    return;
                  }
                  if (step === 2 && cardType === "custom" && !customDesignUrl) {
                    toast.error("Please upload your custom card design file");
                    return;
                  }
                  if (
                    step === 3 &&
                    (!shippingAddress.recipientName ||
                      !shippingAddress.phone ||
                      !shippingAddress.addressLine1 ||
                      !shippingAddress.city ||
                      !shippingAddress.state ||
                      !shippingAddress.postalCode)
                  ) {
                    toast.error("Please fill in required shipping details");
                    return;
                  }
                  setStep((s) => (s + 1) as any);
                }}
                className="!bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold"
              >
                Continue &rarr;
              </Button>
            ) : (
              <Button
                onClick={handleSubmitBulkOrder}
                loading={isCreating}
                className="!bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold"
              >
                Submit Order Request
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AcademyNfcManagementPage;
