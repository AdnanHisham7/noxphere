import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams, Link } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  useGetTransferListingsQuery,
  useGetListingByIdQuery,
  useRequestTransferMutation,
  useGetIncomingRequestsQuery,
  useGetOutgoingRequestsQuery,
  useRespondToTransferMutation,
  useGetMyListingsQuery,
  useRemoveListingMutation,
  type TransferListing,
  type TransferRequest,
} from '../../store/api/transferApi';
import { Badge, Button, Input, Modal, Skeleton, EmptyState, Avatar } from '../../components/ui';
import { RootState } from '../../store';
import { toast } from 'react-hot-toast';
import {
  Search,
  Check,
  Eye,
  X,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Sparkles,
  Shield,
  Trash2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import logoSrc from '../../assets/logo.png';
import { ThemeToggle } from '../../components/common/ThemeToggle';

const getRatingColor = (r: number) =>
  r >= 9 ? 'text-volt-400' : r >= 8 ? 'text-field-400' : r >= 7 ? 'text-ice-500 dark:text-ice-400' : 'text-slate-400';

const formatCurrency = (amount: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const getStudentFromReq = (r: TransferRequest) => {
  if (r.student && typeof r.student === 'object') return r.student;
  if (r.studentId && typeof r.studentId === 'object') return r.studentId as any;
  return null;
};

const getManagerFromReq = (r: TransferRequest, field: 'fromManagerId' | 'toManagerId') => {
  const m = r[field];
  if (m && typeof m === 'object') return m as any;
  return null;
};

const TransferWallPage: React.FC = () => {
  const { isAuthenticated, user } = useSelector((s: RootState) => s.auth);
  const [searchParams, setSearchParams] = useSearchParams();
  const targetListingId = searchParams.get('listingId');

  const [activeTab, setActiveTab] = useState<'market' | 'incoming' | 'outgoing' | 'my_listings'>('market');
  const [selectedListing, setSelectedListing] = useState<TransferListing | null>(null);
  const [requestModal, setRequestModal] = useState(false);
  const [offeredPrice, setOfferedPrice] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [filterAge, setFilterAge] = useState('');

  // Queries
  const { data, isLoading, isError } = useGetTransferListingsQuery({
    search: search || undefined,
    position: filterPosition || undefined,
    ageGroup: filterAge || undefined,
    limit: 30,
  });
  const listings = data?.data ?? [];

  // Directly fetch listing if specified in query params (e.g., returning from login)
  const { data: directListing } = useGetListingByIdQuery(targetListingId!, {
    skip: !targetListingId,
  });

  useEffect(() => {
    if (targetListingId) {
      if (directListing && (!selectedListing || selectedListing.id !== directListing.id)) {
        setSelectedListing(directListing);
      } else if (!selectedListing && listings.length > 0) {
        const found = listings.find((l) => l.id === targetListingId);
        if (found) setSelectedListing(found);
      }
    }
  }, [targetListingId, directListing, listings, selectedListing]);

  const handleSelectListing = (listing: TransferListing | null) => {
    setSelectedListing(listing);
    const newParams = new URLSearchParams(searchParams);
    if (listing) {
      newParams.set('listingId', listing.id);
    } else {
      newParams.delete('listingId');
    }
    setSearchParams(newParams, { replace: true });
  };

  const { data: incomingRequests, isLoading: loadingIncoming } = useGetIncomingRequestsQuery(undefined, {
    skip: !isAuthenticated,
  });
  const { data: outgoingRequests, isLoading: loadingOutgoing } = useGetOutgoingRequestsQuery(undefined, {
    skip: !isAuthenticated,
  });
  const { data: myListingsResult, isLoading: loadingMyListings } = useGetMyListingsQuery(undefined, {
    skip: !isAuthenticated,
  });
  const myListings = myListingsResult?.data ?? [];

  // Mutations
  const [requestTransfer, { isLoading: submitting }] = useRequestTransferMutation();
  const [respondToTransfer, { isLoading: responding }] = useRespondToTransferMutation();
  const [removeListing, { isLoading: removing }] = useRemoveListingMutation();

  // Response Modal State (for Incoming Offers)
  const [responseModal, setResponseModal] = useState<{
    request: TransferRequest;
    action: 'accept' | 'reject';
  } | null>(null);
  const [responseNote, setResponseNote] = useState('');

  const pendingIncomingCount = incomingRequests?.filter((r) => r.status === 'pending').length ?? 0;

  const handleRequestTransfer = () => {
    if (!isAuthenticated) {
      toast.error('Please log in as a Manager to submit transfer requests');
      return;
    }
    setOfferedPrice(selectedListing?.price.toString() ?? '');
    setMessage('');
    setRequestModal(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedListing) return;
    const price = parseFloat(offeredPrice);
    if (!price || price <= 0) {
      toast.error('Enter a valid offer amount');
      return;
    }
    try {
      await requestTransfer({ listingId: selectedListing.id, offeredPrice: price, message: message || undefined }).unwrap();
      toast.success('Transfer request submitted to the listing academy!');
      setRequestModal(false);
      handleSelectListing(null);
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't submit request — try again");
    }
  };

  const handleOpenResponse = (req: TransferRequest, action: 'accept' | 'reject') => {
    setResponseModal({ request: req, action });
    setResponseNote(
      action === 'accept'
        ? 'Terms accepted. Player transfer approved.'
        : 'Offer declined. Thank you for your interest.'
    );
  };

  const handleConfirmResponse = async () => {
    if (!responseModal) return;
    try {
      await respondToTransfer({
        requestId: responseModal.request.id,
        action: responseModal.action,
        responseNote: responseNote.trim() || undefined,
      }).unwrap();
      toast.success(
        responseModal.action === 'accept'
          ? 'Transfer accepted! Player has been transferred.'
          : 'Transfer offer declined.'
      );
      setResponseModal(null);
      setResponseNote('');
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to submit response');
    }
  };

  const handleRemoveListing = async (listingId: string) => {
    try {
      await removeListing(listingId).unwrap();
      toast.success('Player delisted from transfer wall');
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to delist player');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-pitch-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Header */}
      <header className="bg-white/90 dark:bg-pitch-900/90 border-b border-slate-200 dark:border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-sm transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="Noxphere" className="h-8 w-8 object-contain drop-shadow" />
            <span className="font-display font-black text-slate-900 dark:text-white uppercase tracking-wider text-base hidden sm:block">
              Noxphere
            </span>
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-ice-500 dark:text-ice-400">↔</span>
            <span className="font-display font-bold text-slate-900 dark:text-white uppercase tracking-wide text-sm">
              Transfer Wall
            </span>
            <span className="pill-blue text-2xs ml-1">OFFICIAL MARKET</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xs text-slate-500 hidden md:block">{data?.meta?.total ?? listings.length} players listed</span>
          <ThemeToggle size="sm" />
          {isAuthenticated ? (
            <a href="/dashboard" className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
              <ArrowLeft size={13} /> Dashboard
            </a>
          ) : (
            <a href="/login" className="btn-primary text-xs py-1.5 px-4">
              Manager Login
            </a>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-pitch-800 border border-slate-200 dark:border-ice-400/15 p-6 sm:p-8 shadow-sm dark:shadow-none transition-colors">
          <div className="absolute inset-0 bg-ice-glow opacity-30 dark:opacity-50 pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="section-title text-ice-600 dark:text-ice-400 mb-2">Verified Athlete Exchange</p>
              <h1 className="font-display font-900 text-slate-900 dark:text-white text-3xl sm:text-4xl uppercase tracking-tight leading-none">
                Transfer Wall &amp; Bids
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-2 max-w-xl">
                Browse verified talents available for inter-academy transfers. Managers can make acquisition offers, review incoming club bids, and accept or decline transfer contracts.
              </p>
            </div>
            {isAuthenticated && pendingIncomingCount > 0 && (
              <div className="p-3.5 rounded-xl bg-volt-400/10 border border-volt-400/30 text-volt-700 dark:text-volt-300 flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 rounded-full bg-volt-400 text-pitch-950 flex items-center justify-center font-bold text-xs">
                  {pendingIncomingCount}
                </div>
                <div className="text-xs">
                  <p className="font-bold">Pending Transfer Offers</p>
                  <button
                    onClick={() => setActiveTab('incoming')}
                    className="text-2xs underline font-semibold text-volt-600 dark:text-volt-400 hover:text-pitch-900 dark:hover:text-white"
                  >
                    View &amp; respond now &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation (for authenticated users) */}
        {isAuthenticated && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-white/10 pb-2">
            <button
              onClick={() => setActiveTab('market')}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-display font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap',
                activeTab === 'market'
                  ? 'bg-volt-400 text-pitch-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/5'
              )}
            >
              <span>Transfer Market</span>
              <span className="text-2xs font-mono font-bold bg-pitch-950/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
                {listings.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('incoming')}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-display font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap',
                activeTab === 'incoming'
                  ? 'bg-volt-400 text-pitch-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/5'
              )}
            >
              <ArrowDownLeft size={14} />
              <span>Incoming Offers</span>
              {pendingIncomingCount > 0 ? (
                <span className="text-2xs font-mono font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  {pendingIncomingCount} pending
                </span>
              ) : (
                <span className="text-2xs font-mono bg-pitch-950/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
                  {incomingRequests?.length ?? 0}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('outgoing')}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-display font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap',
                activeTab === 'outgoing'
                  ? 'bg-volt-400 text-pitch-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/5'
              )}
            >
              <ArrowUpRight size={14} />
              <span>My Sent Offers</span>
              <span className="text-2xs font-mono bg-pitch-950/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
                {outgoingRequests?.length ?? 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('my_listings')}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-display font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap',
                activeTab === 'my_listings'
                  ? 'bg-volt-400 text-pitch-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/5'
              )}
            >
              <span>My Listed Players</span>
              <span className="text-2xs font-mono bg-pitch-950/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
                {myListings.length}
              </span>
            </button>
          </div>
        )}

        {/* -------------------- TAB 1: TRANSFER MARKETPLACE -------------------- */}
        {activeTab === 'market' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="card p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48">
                <Input
                  label="Search Player"
                  placeholder="Player name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<Search size={14} className="text-slate-400" />}
                />
              </div>
              <div className="min-w-36">
                <label className="label">Position</label>
                <select className="input" value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)}>
                  <option value="">All Positions</option>
                  {['Forward', 'Midfielder', 'Defender', 'Goalkeeper'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-36">
                <label className="label">Age Group</label>
                <select className="input" value={filterAge} onChange={(e) => setFilterAge(e.target.value)}>
                  <option value="">All Ages</option>
                  {['U-13', 'U-15', 'U-17', 'U-19', 'U-21'].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setFilterPosition('');
                  setFilterAge('');
                }}
              >
                Clear
              </Button>
            </div>

            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
              </div>
            )}

            {isError && (
              <EmptyState icon="↔" title="Couldn't load the transfer wall" description="Please try again shortly." />
            )}

            {/* Listings grid */}
            {!isLoading && listings.length === 0 && (
              <EmptyState
                icon="↔"
                title="No players found"
                description="Try adjusting your filters, or check back later for new transfer listings."
              />
            )}

            {!isLoading && listings.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {listings.map((listing) => (
                  <div
                    key={listing.id}
                    className="card border border-slate-200/90 dark:border-white/5 hover:border-ice-400/40 dark:hover:border-ice-400/25 transition-all duration-200 cursor-pointer overflow-hidden group shadow-sm hover:shadow-md"
                    onClick={() => handleSelectListing(listing)}
                  >
                    {/* Card header */}
                    <div className="p-5 border-b border-slate-100 dark:border-white/5">
                      <div className="flex items-start gap-3">
                        <Avatar
                          name={`${listing.student?.firstName} ${listing.student?.lastName}`}
                          src={listing.student?.photo}
                          size="lg"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-bold text-slate-900 dark:text-white uppercase truncate text-base group-hover:text-volt-500 transition-colors">
                            {listing.student?.firstName} {listing.student?.lastName}
                          </p>
                          <p className="text-2xs text-slate-400 mt-0.5 truncate">
                            {listing.fromFranchise?.name ?? 'Academy Squad'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span className="pill-blue text-2xs">{listing.student?.position ?? 'Player'}</span>
                            <span className="pill-yellow text-2xs">{listing.student?.ageGroup}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={clsx(
                              'font-display font-900 text-2xl',
                              getRatingColor(listing.student?.overallRating ?? listing.overallRating),
                            )}
                          >
                            {(listing.student?.overallRating ?? listing.overallRating).toFixed(1)}
                          </span>
                          <span className="block text-3xs font-mono text-slate-400 uppercase">OVR</span>
                        </div>
                      </div>
                    </div>

                    {/* Card footer */}
                    <div className="px-5 py-3 bg-slate-50/50 dark:bg-pitch-800/40 flex items-center justify-between">
                      <div>
                        <span className="text-3xs font-mono text-slate-400 uppercase block">Asking Fee</span>
                        <span className="font-display font-bold text-sm text-slate-800 dark:text-white">
                          {formatCurrency(listing.price, listing.currency)}
                        </span>
                      </div>
                      <span className="text-xs text-volt-500 font-semibold group-hover:underline flex items-center gap-1">
                        View Dossier &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------- TAB 2: INCOMING TRANSFER REQUESTS -------------------- */}
        {activeTab === 'incoming' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                  Incoming Transfer Bids
                </h2>
                <p className="text-xs text-slate-500">
                  Offers received from other academy managers for your listed players. Accept to finalize the transfer or decline with feedback.
                </p>
              </div>
            </div>

            {loadingIncoming ? (
              <div className="space-y-3">
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
              </div>
            ) : incomingRequests && incomingRequests.length > 0 ? (
              <div className="grid gap-3">
                {incomingRequests.map((req) => {
                  const student = getStudentFromReq(req);
                  const buyer = getManagerFromReq(req, 'toManagerId');

                  return (
                    <div
                      key={req.id}
                      className={clsx(
                        'card p-5 border transition-all duration-150 space-y-4',
                        req.status === 'pending'
                          ? 'border-amber-400/40 bg-amber-50/10 dark:bg-amber-950/10 shadow-sm'
                          : req.status === 'accepted'
                            ? 'border-emerald-400/30 bg-emerald-50/10 dark:bg-emerald-950/10'
                            : 'border-slate-200 dark:border-white/5 opacity-80'
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={student ? `${student.firstName} ${student.lastName}` : 'Player'}
                            src={student?.photo}
                            size="md"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                                {student ? `${student.firstName} ${student.lastName}` : 'Target Player'}
                              </h3>
                              <span className="pill pill-blue text-2xs">
                                {student?.position || 'Player'}
                              </span>
                              <span className="pill pill-yellow text-2xs">
                                {student?.ageGroup}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Offered by: <strong className="text-slate-700 dark:text-slate-300">{buyer?.firstName ? `${buyer.firstName} ${buyer.lastName}` : buyer?.email || 'Academy Manager'}</strong>
                              {buyer?.email && <span className="font-mono text-2xs text-slate-400 ml-1">({buyer.email})</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 self-start sm:self-center">
                          <div className="text-right">
                            <span className="text-2xs font-mono uppercase text-slate-400 block">Offer Amount</span>
                            <span className="font-display font-black text-xl text-volt-500 dark:text-volt-400">
                              {formatCurrency(req.offeredPrice, req.currency)}
                            </span>
                          </div>

                          <div className="text-right">
                            <Badge
                              variant={
                                req.status === 'accepted'
                                  ? 'green'
                                  : req.status === 'rejected'
                                    ? 'red'
                                    : req.status === 'pending'
                                      ? 'yellow'
                                      : 'gray'
                              }
                              size="sm"
                            >
                              {req.status === 'pending' ? 'Pending Review' : req.status.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Offer Message */}
                      {req.message && (
                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-pitch-900/60 border border-slate-200/80 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300">
                          <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                            <MessageSquare size={13} className="text-ice-500" /> Buyer&apos;s Proposal:
                          </span>
                          <p className="italic leading-relaxed">&ldquo;{req.message}&rdquo;</p>
                        </div>
                      )}

                      {/* Response note (if already resolved) */}
                      {req.responseNote && (
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-pitch-950/60 border border-slate-200 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">Your Response Note:</span>{' '}
                          {req.responseNote}
                          {req.respondedAt && (
                            <span className="text-2xs font-mono text-slate-400 block mt-1">
                              Responded {new Date(req.respondedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions: Accept or Decline buttons (only when status is pending) */}
                      {req.status === 'pending' && (
                        <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="!border-rose-400/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            onClick={() => handleOpenResponse(req, 'reject')}
                          >
                            <XCircle size={14} /> Decline Offer
                          </Button>
                          <Button
                            size="sm"
                            className="!bg-emerald-500 hover:!bg-emerald-600 !text-white shadow-sm"
                            onClick={() => handleOpenResponse(req, 'accept')}
                          >
                            <CheckCircle2 size={14} /> Accept Offer
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<ArrowDownLeft size={28} />}
                title="No incoming transfer bids"
                description="When another academy requests to acquire one of your listed players, their bid and proposal will appear here."
              />
            )}
          </div>
        )}

        {/* -------------------- TAB 3: OUTGOING (SENT) TRANSFER REQUESTS -------------------- */}
        {activeTab === 'outgoing' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                My Outgoing Offers
              </h2>
              <p className="text-xs text-slate-500">
                Track status of acquisition requests you have submitted to other academies.
              </p>
            </div>

            {loadingOutgoing ? (
              <div className="space-y-3">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            ) : outgoingRequests && outgoingRequests.length > 0 ? (
              <div className="grid gap-3">
                {outgoingRequests.map((req) => {
                  const student = getStudentFromReq(req);
                  const seller = getManagerFromReq(req, 'fromManagerId');

                  return (
                    <div
                      key={req.id}
                      className="card p-5 border border-slate-200 dark:border-white/5 space-y-3 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={student ? `${student.firstName} ${student.lastName}` : 'Player'}
                            src={student?.photo}
                            size="md"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                                {student ? `${student.firstName} ${student.lastName}` : 'Target Player'}
                              </h3>
                              <span className="pill pill-blue text-2xs">{student?.position || 'Player'}</span>
                              <span className="pill pill-yellow text-2xs">{student?.ageGroup}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Submitted to: <strong className="text-slate-700 dark:text-slate-300">{seller?.firstName ? `${seller.firstName} ${seller.lastName}` : seller?.email || 'Listing Club'}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-2xs font-mono uppercase text-slate-400 block">Your Bid</span>
                            <span className="font-display font-black text-xl text-volt-500 dark:text-volt-400">
                              {formatCurrency(req.offeredPrice, req.currency)}
                            </span>
                          </div>

                          <Badge
                            variant={
                              req.status === 'accepted'
                                ? 'green'
                                : req.status === 'rejected'
                                  ? 'red'
                                  : req.status === 'pending'
                                    ? 'yellow'
                                    : 'gray'
                            }
                            size="sm"
                          >
                            {req.status === 'pending' ? 'Pending Review' : req.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      {req.message && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-pitch-900/40 p-2.5 rounded-lg border border-slate-200/60 dark:border-white/5">
                          &ldquo;{req.message}&rdquo;
                        </p>
                      )}

                      {req.responseNote && (
                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 text-xs">
                          <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Seller Response:</span>
                          <p className="text-slate-700 dark:text-slate-300 italic">{req.responseNote}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<ArrowUpRight size={28} />}
                title="No offers submitted yet"
                description="Browse the Transfer Market tab and click on any listed player to make an acquisition offer."
              />
            )}
          </div>
        )}

        {/* -------------------- TAB 4: MY LISTED PLAYERS -------------------- */}
        {activeTab === 'my_listings' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                My Listed Players
              </h2>
              <p className="text-xs text-slate-500">
                Players from your academy currently active on the public transfer wall.
              </p>
            </div>

            {loadingMyListings ? (
              <div className="space-y-3">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            ) : myListings.length > 0 ? (
              <div className="grid gap-3">
                {myListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-200 dark:border-white/5 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={`${listing.student?.firstName} ${listing.student?.lastName}`}
                        src={listing.student?.photo}
                        size="md"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                            {listing.student?.firstName} {listing.student?.lastName}
                          </h3>
                          <span className="pill-blue text-2xs">{listing.student?.position || 'Player'}</span>
                          <span className="pill-yellow text-2xs">{listing.student?.ageGroup}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Rating: <strong className="text-volt-500">{listing.student?.overallRating ?? listing.overallRating} OVR</strong> · {listing.viewCount} views
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-2xs font-mono uppercase text-slate-400 block">Asking Price</span>
                        <span className="font-display font-bold text-lg text-slate-900 dark:text-white">
                          {formatCurrency(listing.price, listing.currency)}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="danger"
                        disabled={removing}
                        onClick={() => handleRemoveListing(listing.id)}
                      >
                        <Trash2 size={13} /> Delist
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="↔"
                title="No players listed"
                description="To list a player on the transfer wall, visit the player's detail profile page and click 'List on Transfer'."
              />
            )}
          </div>
        )}
      </div>

      {/* -------------------- DOSSIER DRAWER MODAL -------------------- */}
      {selectedListing && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => handleSelectListing(null)}
        >
          <div
            className="bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar
                  name={`${selectedListing.student?.firstName} ${selectedListing.student?.lastName}`}
                  src={selectedListing.student?.photo}
                  size="xl"
                />
                <div>
                  <h2 className="font-display font-900 text-slate-900 dark:text-white text-xl uppercase">
                    {selectedListing.student?.firstName} {selectedListing.student?.lastName}
                  </h2>
                  <p className="text-xs text-slate-500">{selectedListing.fromFranchise?.name ?? 'Academy Squad'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="pill-blue">{selectedListing.student?.position ?? 'Player'}</span>
                    <span className="pill-yellow">{selectedListing.student?.ageGroup}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleSelectListing(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-4 text-center bg-slate-50 dark:bg-pitch-700/50 border border-slate-200/80 dark:border-white/5">
                  <p className={clsx('font-display font-900 text-3xl', getRatingColor(selectedListing.student?.overallRating ?? selectedListing.overallRating))}>
                    {(selectedListing.student?.overallRating ?? selectedListing.overallRating).toFixed(1)}
                  </p>
                  <p className="text-2xs text-slate-500 mt-1 uppercase tracking-wide">Overall</p>
                </div>
                <div className="card p-4 text-center bg-slate-50 dark:bg-pitch-700/50 border border-slate-200/80 dark:border-white/5">
                  <p className="font-display font-900 text-3xl text-field-500 dark:text-field-400">
                    {selectedListing.student?.attendancePercentage !== undefined ? `${selectedListing.student.attendancePercentage}%` : '—'}
                  </p>
                  <p className="text-2xs text-slate-500 mt-1 uppercase tracking-wide">Attendance</p>
                </div>
                <div className="card p-4 text-center bg-slate-50 dark:bg-pitch-700/50 border border-slate-200/80 dark:border-white/5">
                  <p className="font-display font-900 text-3xl text-volt-500">{formatCurrency(selectedListing.price, selectedListing.currency)}</p>
                  <p className="text-2xs text-slate-500 mt-1 uppercase tracking-wide">Asking Price</p>
                </div>
              </div>

              {/* Skills */}
              {selectedListing.skills.length > 0 && (
                <div>
                  <p className="section-title mb-2">Key Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedListing.skills.map((s) => (
                      <span key={s} className="pill-blue">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Note */}
              {selectedListing.note && (
                <div>
                  <p className="section-title mb-2">Coach Note</p>
                  <div className="bg-slate-50 dark:bg-pitch-700 border border-slate-200 dark:border-white/5 rounded-lg p-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">&ldquo;{selectedListing.note}&rdquo;</p>
                  </div>
                </div>
              )}

              {/* Highlights */}
              {selectedListing.highlights.length > 0 && (
                <div>
                  <p className="section-title mb-2">Highlights</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedListing.highlights.map((h) => (
                      <span key={h} className="pill-yellow">{h}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {user?.role === 'manager' || user?.role === 'super_admin' ? (
                  <Button className="flex-1" onClick={handleRequestTransfer}>
                    Make Acquisition Offer
                  </Button>
                ) : (
                  <div className="flex-1 card p-3.5 bg-slate-50 dark:bg-pitch-700/40 border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {isAuthenticated ? 'Manager Role Required' : 'Manager Access Required'}
                      </p>
                      <p className="text-3xs text-slate-500">
                        {isAuthenticated
                          ? 'Your account cannot submit bids. Log in with a Manager account.'
                          : 'Sign in as a Manager to submit acquisition offers.'}
                      </p>
                    </div>
                    <Link
                      to={`/login?redirect=${encodeURIComponent(`/transfer-wall?listingId=${selectedListing.id}`)}`}
                      className="btn btn-primary text-xs py-2 px-3.5 whitespace-nowrap font-display font-bold uppercase tracking-wider shadow-xs"
                    >
                      Login as Manager
                    </Link>
                  </div>
                )}
                <Button variant="secondary" onClick={() => handleSelectListing(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- SUBMIT BID MODAL -------------------- */}
      <Modal isOpen={requestModal} onClose={() => setRequestModal(false)} title="Submit Transfer Bid" size="md">
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-pitch-700 border border-slate-200 dark:border-white/5 rounded-lg p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Target Player:</p>
            <p className="font-display font-bold text-slate-900 dark:text-white mt-1 text-base">
              {selectedListing?.student?.firstName} {selectedListing?.student?.lastName}
            </p>
            <p className="text-xs text-slate-500">Listing Asking Price: {selectedListing ? formatCurrency(selectedListing.price, selectedListing.currency) : '—'}</p>
          </div>
          <Input
            label="Your Offer Amount (₹)"
            type="number"
            value={offeredPrice}
            onChange={(e) => setOfferedPrice(e.target.value)}
            placeholder={selectedListing?.price?.toString()}
            required
          />
          <div className="space-y-1.5">
            <label className="label">Pitch Message to Seller</label>
            <textarea
              className="input min-h-24 resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Introduce your squad plans, role for the athlete, or tournament targets..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" loading={submitting} onClick={handleSubmitRequest}>
              Send Transfer Offer
            </Button>
            <Button variant="secondary" onClick={() => setRequestModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* -------------------- RESPOND TO TRANSFER MODAL -------------------- */}
      {responseModal && (
        <Modal
          isOpen
          onClose={() => setResponseModal(null)}
          title={responseModal.action === 'accept' ? 'Accept Transfer Bid' : 'Decline Transfer Bid'}
          size="md"
        >
          <div className="space-y-4">
            <div className={clsx(
              'p-4 rounded-xl border space-y-1',
              responseModal.action === 'accept'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-400/30 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-400/30 text-rose-900 dark:text-rose-200'
            )}>
              <div className="flex items-center gap-2 font-display font-bold text-sm">
                {responseModal.action === 'accept' ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <XCircle size={16} className="text-rose-500" />
                )}
                <span>
                  {responseModal.action === 'accept' ? 'Confirm Acceptance' : 'Confirm Decline'}
                </span>
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                {responseModal.action === 'accept'
                  ? 'Accepting this offer will transfer the player out of your squad to the purchasing academy. All other pending bids for this player will be closed.'
                  : 'Declining this offer will notify the requesting manager that their proposal was not accepted.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="label">Response Note to Purchasing Manager (Optional)</label>
              <textarea
                className="input min-h-24 resize-none"
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                placeholder="Include payment clearance terms, squad notes, or reason for decision..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                className={clsx(
                  'flex-1',
                  responseModal.action === 'accept'
                    ? '!bg-emerald-500 hover:!bg-emerald-600 !text-white'
                    : '!bg-rose-600 hover:!bg-rose-700 !text-white'
                )}
                loading={responding}
                onClick={handleConfirmResponse}
              >
                {responseModal.action === 'accept' ? 'Confirm & Accept Transfer' : 'Confirm Decline'}
              </Button>
              <Button variant="secondary" onClick={() => setResponseModal(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-white/5 mt-12 py-6 px-6 text-center">
        <p className="text-2xs text-slate-500">
          Noxphere Platform · Transfer Wall is a secure verified exchange · All transfers are processed franchise-to-franchise
        </p>
      </footer>
    </div>
  );
};

export default TransferWallPage;
