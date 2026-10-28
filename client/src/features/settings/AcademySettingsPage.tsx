// src/features/settings/AcademySettingsPage.tsx
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Settings,
  Save,
  Building2,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Layers,
  Sparkles,
  Navigation,
  ExternalLink,
  Bell,
  Shield,
  Sliders,
  Calendar,
} from "lucide-react";
import {
  Button,
  Input,
  Card,
  Badge,
  Skeleton,
  EmptyState,
  Modal,
  ConfirmModal,
  ImageUploadField,
  PageHeader,
  Select,
  LocationPicker,
  getMapsLink,
  Avatar,
  cn,
} from "../../components/ui";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import { academyApi } from "../../store/api/academyApi";
import type { Location, AcademyPitch, AcademySessionType } from "../academies/types";

const useGetAcademyById = academyApi.useGetAcademyByIdQuery;
const useUpdateAcademyConfig = academyApi.useUpdateAcademyConfigMutation;

const DEFAULT_SESSION_TYPES: AcademySessionType[] = [
  {
    id: "st_technical",
    name: "Technical",
    description: "Ball mastery, passing accuracy, receiving, and finishing technique",
    submetrics: ["Dribbling", "Passing", "Receiving", "Finishing"],
  },
  {
    id: "st_physical",
    name: "Physical",
    description: "Athleticism, stamina, speed, agility, strength, balance, and endurance",
    submetrics: ["Speed", "Agility", "Strength", "Balance", "Endurance"],
  },
  {
    id: "st_tactical",
    name: "Tactical",
    description: "Game awareness, decision making, off-ball movement, and positioning",
    submetrics: ["Game Awareness", "Decision Making", "Off Ball Movement", "Positioning"],
  },
  {
    id: "st_psychological",
    name: "Psychological",
    description: "Discipline, confidence, concentration, and coachability",
    submetrics: ["Discipline", "Confidence", "Concentration", "Coachability"],
  },
  {
    id: "st_social",
    name: "Social",
    description: "Communication, team work, leadership, and mutual respect",
    submetrics: ["Communication", "Team Work", "Leadership", "Respect"],
  },
  {
    id: "st_match",
    name: "Match",
    description: "Competitive matchday execution, tactical impact, effort, and fair play",
    submetrics: ["Impact", "Tactical Execution", "Effort", "Fair Play"],
  },
];

const SURFACE_TYPES = [
  "Artificial Turf",
  "Natural Grass",
  "Indoor Hardwood",
  "Hybrid Turf",
  "Sand / Beach",
  "Concrete / Multi-Sport",
  "Other",
];

type SettingsTab = "profile" | "session-types" | "pitches" | "policies";

const AcademySettingsPage: React.FC = () => {
  const academyId = useCurrentAcademyId();
  const { data: academy, isLoading, isError } = useGetAcademyById(academyId ?? "", { skip: !academyId });
  const [updateConfig] = useUpdateAcademyConfig();

  // Active Category tab (Default: "profile")
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Academy Profile data
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState<Location>({ name: "", address: "", latitude: 0, longitude: 0, fieldNumber: "" });

  // Pitch data
  const [pitches, setPitches] = useState<AcademyPitch[]>([]);

  // Session Types data
  const [sessionTypes, setSessionTypes] = useState<AcademySessionType[]>([]);

  // Alert & Policy data
  const [absentAlertDays, setAbsentAlertDays] = useState(5);
  const [dueDateAlertDays, setDueDateAlertDays] = useState(3);
  const [dataProtectionContactEmail, setDataProtectionContactEmail] = useState("");

  // Section-specific loading states
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingSessionType, setIsSavingSessionType] = useState(false);
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);

  // Edit Academy Profile Modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<{
    name: string;
    logo?: string;
    location: Location;
  }>({
    name: "",
    logo: undefined,
    location: { name: "", address: "", latitude: 0, longitude: 0, fieldNumber: "" },
  });

  // Pitch Add/Edit Modal state
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
  const [editingPitchId, setEditingPitchId] = useState<string | null>(null);
  const [pitchForm, setPitchForm] = useState<{
    name: string;
    fieldNumber: string;
    surfaceType: string;
    address: string;
    googleMapsUrl: string;
    latitude: number;
    longitude: number;
    isActive: boolean;
  }>({
    name: "",
    fieldNumber: "",
    surfaceType: "Artificial Turf",
    address: "",
    googleMapsUrl: "",
    latitude: 0,
    longitude: 0,
    isActive: true,
  });
  const [pitchToDelete, setPitchToDelete] = useState<AcademyPitch | null>(null);

  // Session Type Add/Edit Modal state
  const [isSessionTypeModalOpen, setIsSessionTypeModalOpen] = useState(false);
  const [editingSessionTypeId, setEditingSessionTypeId] = useState<string | null>(null);
  const [sessionTypeForm, setSessionTypeForm] = useState<{
    name: string;
    description: string;
    submetrics: string[];
  }>({
    name: "",
    description: "",
    submetrics: [],
  });
  const [newSubmetricInput, setNewSubmetricInput] = useState("");
  const [sessionTypeToDelete, setSessionTypeToDelete] = useState<AcademySessionType | null>(null);

  // Sync state from fetched academy
  useEffect(() => {
    if (!academy) return;
    setName(academy.name);
    setLogo(academy.logo);
    setLocation(academy.location || { name: "", address: "", latitude: 0, longitude: 0, fieldNumber: "" });
    setPitches(academy.pitches || []);
    setSessionTypes(academy.sessionTypes && academy.sessionTypes.length > 0 ? academy.sessionTypes : DEFAULT_SESSION_TYPES);
    setAbsentAlertDays(academy.absentAlertDays);
    setDueDateAlertDays(academy.dueDateAlertDays);
    setDataProtectionContactEmail(academy.dataProtectionContactEmail ?? "");
  }, [academy]);

  // ----------------------------------------------------
  // SECTION 1: ACADEMY PROFILE HANDLERS
  // ----------------------------------------------------
  const openEditProfile = () => {
    setProfileForm({
      name: name,
      logo: logo,
      location: {
        name: location?.name || "",
        address: location?.address || "",
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        fieldNumber: location?.fieldNumber || "",
      },
    });
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academyId) return;
    if (!profileForm.name.trim()) {
      toast.error("Academy name cannot be empty");
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateConfig({
        id: academyId,
        config: {
          name: profileForm.name.trim(),
          logo: profileForm.logo || undefined,
          location: profileForm.location,
        },
      }).unwrap();

      setName(profileForm.name.trim());
      setLogo(profileForm.logo);
      setLocation(profileForm.location);
      setIsProfileModalOpen(false);
      toast.success("Academy profile updated successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ----------------------------------------------------
  // SECTION 2: SESSION TYPES & PERFORMANCE METRICS HANDLERS
  // (Instant persistence on every action)
  // ----------------------------------------------------
  const openAddSessionType = () => {
    setEditingSessionTypeId(null);
    setSessionTypeForm({
      name: "",
      description: "",
      submetrics: [],
    });
    setNewSubmetricInput("");
    setIsSessionTypeModalOpen(true);
  };

  const openEditSessionType = (st: AcademySessionType) => {
    setEditingSessionTypeId(st.id);
    setSessionTypeForm({
      name: st.name,
      description: st.description || "",
      submetrics: [...st.submetrics],
    });
    setNewSubmetricInput("");
    setIsSessionTypeModalOpen(true);
  };

  const handleSaveSessionType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academyId) return;
    if (!sessionTypeForm.name.trim()) {
      toast.error("Session type name is required");
      return;
    }

    // Auto-capture any skill currently typed in the input box so nothing is lost
    let finalSubmetrics = [...sessionTypeForm.submetrics];
    const pendingSkill = newSubmetricInput.trim();
    if (pendingSkill && !finalSubmetrics.some((s) => s.toLowerCase() === pendingSkill.toLowerCase())) {
      finalSubmetrics.push(pendingSkill);
      setNewSubmetricInput("");
    }

    if (finalSubmetrics.length === 0) {
      toast.error("At least one performance skill/submetric is required");
      return;
    }

    setIsSavingSessionType(true);
    try {
      let updated: AcademySessionType[];
      if (editingSessionTypeId) {
        updated = sessionTypes.map((st) =>
          st.id === editingSessionTypeId
            ? {
                ...st,
                name: sessionTypeForm.name.trim(),
                description: sessionTypeForm.description.trim() || undefined,
                submetrics: finalSubmetrics,
              }
            : st
        );
      } else {
        const newSt: AcademySessionType = {
          id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: sessionTypeForm.name.trim(),
          description: sessionTypeForm.description.trim() || undefined,
          submetrics: finalSubmetrics,
        };
        updated = [...sessionTypes, newSt];
      }

      await updateConfig({
        id: academyId,
        config: { sessionTypes: updated },
      }).unwrap();

      setSessionTypes(updated);
      setIsSessionTypeModalOpen(false);
      toast.success(editingSessionTypeId ? "Session type updated successfully" : "Session type created successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to save session type");
    } finally {
      setIsSavingSessionType(false);
    }
  };

  const handleDeleteSessionType = async () => {
    if (!sessionTypeToDelete || !academyId) return;
    const updated = sessionTypes.filter((st) => st.id !== sessionTypeToDelete.id);
    try {
      await updateConfig({
        id: academyId,
        config: { sessionTypes: updated },
      }).unwrap();
      setSessionTypes(updated);
      setSessionTypeToDelete(null);
      toast.success("Session type deleted successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete session type");
    }
  };

  const handleResetSessionTypes = async () => {
    if (!academyId) return;
    try {
      await updateConfig({
        id: academyId,
        config: { sessionTypes: DEFAULT_SESSION_TYPES },
      }).unwrap();
      setSessionTypes(DEFAULT_SESSION_TYPES);
      toast.success("Reset session types to defaults");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to reset session types");
    }
  };

  const handleAddSubmetric = () => {
    const trimmed = newSubmetricInput.trim();
    if (!trimmed) return;
    if (sessionTypeForm.submetrics.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("This skill metric already exists");
      return;
    }
    setSessionTypeForm((prev) => ({
      ...prev,
      submetrics: [...prev.submetrics, trimmed],
    }));
    setNewSubmetricInput("");
  };

  const handleRemoveSubmetric = (skillToRemove: string) => {
    setSessionTypeForm((prev) => ({
      ...prev,
      submetrics: prev.submetrics.filter((s) => s !== skillToRemove),
    }));
  };

  // ----------------------------------------------------
  // SECTION 3: PITCHES & VENUES HANDLERS
  // ----------------------------------------------------
  const openAddPitch = () => {
    setEditingPitchId(null);
    const initialMapsUrl =
      location?.latitude && location?.longitude
        ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
        : "";
    setPitchForm({
      name: "",
      fieldNumber: "",
      surfaceType: "Artificial Turf",
      address: location?.address || "",
      googleMapsUrl: initialMapsUrl,
      latitude: location?.latitude || 0,
      longitude: location?.longitude || 0,
      isActive: true,
    });
    setIsPitchModalOpen(true);
  };

  const openEditPitch = (pitch: AcademyPitch) => {
    setEditingPitchId(pitch.id);
    const existingMapsUrl =
      pitch.googleMapsUrl ||
      (pitch.latitude && pitch.longitude
        ? `https://www.google.com/maps?q=${pitch.latitude},${pitch.longitude}`
        : "");
    setPitchForm({
      name: pitch.name,
      fieldNumber: pitch.fieldNumber || "",
      surfaceType: pitch.surfaceType || "Artificial Turf",
      address: pitch.address || "",
      googleMapsUrl: existingMapsUrl,
      latitude: pitch.latitude || 0,
      longitude: pitch.longitude || 0,
      isActive: pitch.isActive !== false,
    });
    setIsPitchModalOpen(true);
  };

  const handleSavePitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pitchForm.name.trim()) {
      toast.error("Pitch / Venue name is required");
      return;
    }

    const trimmedMapsUrl = pitchForm.googleMapsUrl.trim();
    const finalMapsUrl =
      trimmedMapsUrl ||
      (pitchForm.latitude && pitchForm.longitude
        ? `https://www.google.com/maps?q=${pitchForm.latitude},${pitchForm.longitude}`
        : undefined);

    let updatedPitches: AcademyPitch[];
    if (editingPitchId) {
      updatedPitches = pitches.map((p) =>
        p.id === editingPitchId
          ? {
              ...p,
              name: pitchForm.name.trim(),
              fieldNumber: pitchForm.fieldNumber.trim() || undefined,
              surfaceType: pitchForm.surfaceType || "Artificial Turf",
              address: pitchForm.address.trim() || undefined,
              googleMapsUrl: finalMapsUrl,
              latitude: pitchForm.latitude || undefined,
              longitude: pitchForm.longitude || undefined,
              isActive: pitchForm.isActive,
            }
          : p
      );
    } else {
      const newPitch: AcademyPitch = {
        id: `pitch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: pitchForm.name.trim(),
        fieldNumber: pitchForm.fieldNumber.trim() || undefined,
        surfaceType: pitchForm.surfaceType || "Artificial Turf",
        address: pitchForm.address.trim() || undefined,
        googleMapsUrl: finalMapsUrl,
        latitude: pitchForm.latitude || undefined,
        longitude: pitchForm.longitude || undefined,
        isActive: pitchForm.isActive,
      };
      updatedPitches = [...pitches, newPitch];
    }

    setPitches(updatedPitches);
    setIsPitchModalOpen(false);

    if (academyId) {
      try {
        await updateConfig({
          id: academyId,
          config: { pitches: updatedPitches },
        }).unwrap();
        toast.success(editingPitchId ? "Pitch updated successfully" : "Pitch added successfully");
      } catch (err: any) {
        toast.error(err?.data?.message || "Failed to persist pitch changes");
      }
    }
  };

  const handleDeletePitch = async () => {
    if (!pitchToDelete || !academyId) return;
    const updatedPitches = pitches.filter((p) => p.id !== pitchToDelete.id);
    setPitches(updatedPitches);
    setPitchToDelete(null);

    try {
      await updateConfig({
        id: academyId,
        config: { pitches: updatedPitches },
      }).unwrap();
      toast.success("Pitch removed successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to remove pitch");
    }
  };

  const handleTogglePitchActive = async (pitch: AcademyPitch) => {
    if (!academyId) return;
    const updatedPitches = pitches.map((p) =>
      p.id === pitch.id ? { ...p, isActive: p.isActive === false ? true : false } : p
    );
    setPitches(updatedPitches);

    try {
      await updateConfig({
        id: academyId,
        config: { pitches: updatedPitches },
      }).unwrap();
      toast.success(pitch.isActive === false ? `${pitch.name} activated` : `${pitch.name} deactivated`);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update pitch status");
    }
  };

  const handleImportPrimaryLocation = async () => {
    if (!academyId) return;
    if (!location?.name?.trim()) {
      toast.error("Please provide a Primary Location Name in your Academy Profile first");
      return;
    }

    const defaultPitch: AcademyPitch = {
      id: `pitch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: location.name.trim(),
      fieldNumber: location.fieldNumber?.trim() || undefined,
      surfaceType: "Artificial Turf",
      address: location.address?.trim() || undefined,
      googleMapsUrl:
        location.latitude && location.longitude
          ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
          : undefined,
      latitude: location.latitude || undefined,
      longitude: location.longitude || undefined,
      isActive: true,
    };

    const updatedPitches = [...pitches, defaultPitch];
    setPitches(updatedPitches);

    try {
      await updateConfig({
        id: academyId,
        config: { pitches: updatedPitches },
      }).unwrap();
      toast.success(`Imported "${location.name}" as an active pitch`);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to import location as pitch");
    }
  };

  // ----------------------------------------------------
  // SECTION 4: ALERT THRESHOLDS & POLICIES HANDLER
  // ----------------------------------------------------
  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academyId) return;
    if (absentAlertDays < 1) {
      toast.error("Absence alert threshold must be at least 1 day");
      return;
    }
    if (dueDateAlertDays < 0) {
      toast.error("Due-date alert threshold cannot be negative");
      return;
    }
    if (dataProtectionContactEmail.trim() && !/^\S+@\S+\.\S+$/.test(dataProtectionContactEmail.trim())) {
      toast.error("Enter a valid data protection contact email, or leave blank");
      return;
    }

    setIsSavingPolicies(true);
    try {
      await updateConfig({
        id: academyId,
        config: {
          absentAlertDays,
          dueDateAlertDays,
          dataProtectionContactEmail: dataProtectionContactEmail.trim() || undefined,
        },
      }).unwrap();
      toast.success("Alert thresholds & policies saved successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to save policies");
    } finally {
      setIsSavingPolicies(false);
    }
  };

  if (!academyId) {
    return (
      <EmptyState
        icon={<Settings size={28} />}
        title="Access Denied"
        description="No academy context resolved. Please log in as an academy manager to configure settings."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !academy) {
    return (
      <EmptyState
        icon={<Settings size={28} />}
        title="Couldn't load settings"
        description="Something went wrong loading your academy settings. Try refreshing."
      />
    );
  }

  const primaryMapsUrl = getMapsLink({
    googleMapsUrl: undefined,
    latitude: location?.latitude,
    longitude: location?.longitude,
    address: location?.address,
    location: location?.name,
    fieldNumber: location?.fieldNumber,
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <PageHeader
        eyebrow="Configuration"
        title="Academy Settings"
        subtitle={`System-wide settings and operational configuration for ${academy.name}.`}
      />

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-pitch-900/80 border border-slate-200 dark:border-white/10 overflow-x-auto no-scrollbar scroll-smooth">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 shrink-0",
            activeTab === "profile"
              ? "bg-volt-400 text-pitch-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Building2 size={13} />
          <span>Profile & Identity</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("session-types")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 shrink-0",
            activeTab === "session-types"
              ? "bg-volt-400 text-pitch-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Layers size={13} />
          <span>Session Types</span>
          <span
            className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
              activeTab === "session-types"
                ? "bg-pitch-900/30 text-pitch-950"
                : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
            )}
          >
            {sessionTypes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pitches")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 shrink-0",
            activeTab === "pitches"
              ? "bg-volt-400 text-pitch-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <MapPin size={13} />
          <span>Pitches & Venues</span>
          <span
            className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
              activeTab === "pitches"
                ? "bg-pitch-900/30 text-pitch-950"
                : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
            )}
          >
            {pitches.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("policies")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 shrink-0",
            activeTab === "policies"
              ? "bg-volt-400 text-pitch-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Bell size={13} />
          <span>Alerts & Policies</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* SECTION 1: ACADEMY PROFILE SUMMARY CARD              */}
      {/* (Clean, crystal-clear header with NO clipping)       */}
      {/* ==================================================== */}
      {activeTab === "profile" && (
        <Card className="border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-sm space-y-6">
          {/* Top Profile Header: Avatar + Name + Badges + Edit Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <Avatar
                  src={logo}
                  name={name || "Academy"}
                  size="xl"
                  className="w-16 h-16 sm:w-20 sm:h-20 text-xl font-bold ring-2 ring-slate-200 dark:ring-white/10 shadow-sm bg-pitch-800 object-cover rounded-2xl"
                />
                <button
                  type="button"
                  onClick={openEditProfile}
                  title="Change Logo"
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-volt-400 text-pitch-900 hover:bg-volt-300 shadow transition-transform hover:scale-105"
                >
                  <Edit2 size={11} />
                </button>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white leading-tight">
                    {name || "Untitled Academy"}
                  </h2>
                  {academy.academyCode && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                      #{academy.academyCode}
                    </span>
                  )}
                  <Badge variant={academy.isActive ? "green" : "gray"} size="sm">
                    {academy.isActive ? "Active Organization" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {location?.name && (
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                      <MapPin size={13} className="text-volt-500" />
                      {location.name}
                    </span>
                  )}
                  {academy.country && (
                    <span>
                      {academy.country} • {academy.currency || "INR"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              icon={<Edit2 size={13} />}
              onClick={openEditProfile}
              className="shrink-0 w-full sm:w-auto justify-center"
            >
              Edit Academy Profile
            </Button>
          </div>

          {/* Primary Facility & Location Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-pitch-900/50 border border-slate-200 dark:border-white/5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-volt-400/10 text-volt-500 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">
                  Primary Ground / Facility
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  {location?.name || "No primary location specified"}
                </p>
                {location?.address && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {location.address}
                  </p>
                )}
                {location?.fieldNumber && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-volt-400/10 text-volt-700 dark:text-volt-300 border border-volt-400/20">
                    Field Number: {location.fieldNumber}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between items-start md:items-end gap-3 border-t md:border-t-0 md:border-l border-slate-200 dark:border-white/5 pt-3 md:pt-0 md:pl-4">
              <div className="text-left md:text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">
                  Map GPS Navigation
                </span>
                {primaryMapsUrl ? (
                  <a
                    href={primaryMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline mt-1"
                  >
                    <Navigation size={13} className="text-emerald-500" />
                    <span>Open in Google Maps</span>
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400 italic mt-1 block">
                    No coordinates linked
                  </span>
                )}
              </div>

              <Button
                size="sm"
                variant="ghost"
                icon={<Edit2 size={12} />}
                onClick={openEditProfile}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Update Location & Coordinates
              </Button>
            </div>
          </div>

          {/* Quick configuration overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-pitch-900/40 border border-slate-200/80 dark:border-white/5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Pitches & Venues
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
                {pitches.length} {pitches.length === 1 ? "venue" : "venues"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-pitch-900/40 border border-slate-200/80 dark:border-white/5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Session Types
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
                {sessionTypes.length} configured
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-pitch-900/40 border border-slate-200/80 dark:border-white/5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Absence Alert
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
                {absentAlertDays} days
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-pitch-900/40 border border-slate-200/80 dark:border-white/5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Fee Due Alert
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
                {dueDateAlertDays} days
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* ==================================================== */}
      {/* SECTION 2: SESSION TYPES & PERFORMANCE METRICS       */}
      {/* (Self-contained, instant saving on every modal)      */}
      {/* ==================================================== */}
      {activeTab === "session-types" && (
        <Card className="border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-volt-400/10 text-volt-500 flex items-center justify-center shrink-0 mt-0.5">
                <Layers size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white tracking-wide">
                    Session Types & Performance Metrics
                  </h2>
                  <Badge variant="gray" size="sm">
                    {sessionTypes.length}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
                  Configure training session classifications (e.g. Technical, Physical, Match) and their evaluation metrics. When coaches assess players in a session, evaluation criteria dynamically matches the session's type.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetSessionTypes}
                title="Reset to recommended standard types"
              >
                Reset Defaults
              </Button>
              <Button
                size="sm"
                icon={<Plus size={14} />}
                onClick={openAddSessionType}
              >
                Add Session Type
              </Button>
            </div>
          </div>

          {sessionTypes.length === 0 ? (
            <div className="py-10 px-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-volt-400/10 text-volt-500 flex items-center justify-center">
                <Layers size={22} />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No session types configured</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Add your academy's session types (e.g. Technical, Physical, Tactical) and assign the skills coaches will score players on.
              </p>
              <Button size="sm" icon={<Plus size={13} />} onClick={handleResetSessionTypes}>
                Load Recommended Default Types
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {sessionTypes.map((st) => (
                <div
                  key={st.id}
                  className="p-4 rounded-xl bg-white dark:bg-pitch-900/60 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-sm transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-volt-400 shrink-0" />
                          <h3 className="font-sans font-bold text-sm text-slate-900 dark:text-white truncate">
                            {st.name}
                          </h3>
                        </div>
                        {st.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-4.5 line-clamp-2">
                            {st.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="blue" size="sm">
                        {st.submetrics.length} {st.submetrics.length === 1 ? "skill" : "skills"}
                      </Badge>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                        Performance Skills:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {st.submetrics.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-volt-400/10 text-volt-700 dark:text-volt-300 border border-volt-400/20"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-100 dark:border-white/5">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit2 size={12} />}
                      onClick={() => openEditSessionType(st)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                      icon={<Trash2 size={12} />}
                      onClick={() => setSessionTypeToDelete(st)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ==================================================== */}
      {/* SECTION 3: PITCHES & VENUES                          */}
      {/* (Self-contained, instant saving on add/edit/delete)  */}
      {/* ==================================================== */}
      {activeTab === "pitches" && (
        <Card className="border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white tracking-wide">
                    Pitches & Venues
                  </h2>
                  <Badge variant="gray" size="sm">
                    {pitches.length}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
                  Manage all operational grounds, turfs, and venues where sessions and fixtures take place. Coaches and administrators select from these venues when scheduling training.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              {pitches.length === 0 && location?.name && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Sparkles size={13} />}
                  onClick={handleImportPrimaryLocation}
                >
                  Import Facility
                </Button>
              )}
              <Button
                size="sm"
                icon={<Plus size={14} />}
                onClick={openAddPitch}
              >
                Add Pitch / Venue
              </Button>
            </div>
          </div>

          {pitches.length === 0 ? (
            <div className="py-10 px-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <MapPin size={22} />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No pitches configured yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Add your grounds or indoor turfs so coaches can pick them from a dropdown when creating training sessions.
              </p>
              <div className="flex justify-center gap-2">
                {location?.name && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Sparkles size={13} />}
                    onClick={handleImportPrimaryLocation}
                  >
                    Import "{location.name}"
                  </Button>
                )}
                <Button size="sm" icon={<Plus size={13} />} onClick={openAddPitch}>
                  Add First Pitch
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {pitches.map((pitch) => {
                const mapsUrl = getMapsLink({
                  googleMapsUrl: pitch.googleMapsUrl,
                  latitude: pitch.latitude,
                  longitude: pitch.longitude,
                  address: pitch.address,
                  location: pitch.name,
                  fieldNumber: pitch.fieldNumber,
                });

                return (
                  <div
                    key={pitch.id}
                    className="p-4 rounded-xl bg-white dark:bg-pitch-900/60 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-sm transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                            <h3 className="font-sans font-bold text-sm text-slate-900 dark:text-white truncate">
                              {pitch.name}
                            </h3>
                          </div>
                          {pitch.address && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-4.5 truncate">
                              {pitch.address}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTogglePitchActive(pitch)}
                          title={pitch.isActive !== false ? "Click to deactivate" : "Click to activate"}
                          className="shrink-0 transition-opacity"
                        >
                          <Badge variant={pitch.isActive !== false ? "green" : "gray"} size="sm">
                            {pitch.isActive !== false ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pl-4.5">
                        {pitch.fieldNumber && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-volt-400/10 text-volt-700 dark:text-volt-300 border border-volt-400/20">
                            Field: {pitch.fieldNumber}
                          </span>
                        )}
                        {pitch.surfaceType && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                            {pitch.surfaceType}
                          </span>
                        )}
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                          >
                            <Navigation size={10} className="text-emerald-500" />
                            <span>Map</span>
                            <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-3 mt-3 border-t border-slate-100 dark:border-white/5">
                      <div>
                        {mapsUrl ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <Navigation size={11} className="text-emerald-500" />
                            <span>Navigate</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">No GPS</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit2 size={12} />}
                          onClick={() => openEditPitch(pitch)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                          icon={<Trash2 size={12} />}
                          onClick={() => setPitchToDelete(pitch)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ==================================================== */}
      {/* SECTION 4: OPERATIONAL ALERTS & POLICIES             */}
      {/* (Self-contained save section with its own button)    */}
      {/* ==================================================== */}
      {activeTab === "policies" && (
        <Card className="border border-slate-200 dark:border-white/10 shadow-sm">
          <form onSubmit={handleSavePolicies}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Bell size={18} />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white tracking-wide">
                    Operational Alerts & Compliance
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Automated guardian reminder dispatching thresholds and data protection compliance information.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                loading={isSavingPolicies}
                icon={<Save size={14} />}
                className="self-start sm:self-auto shrink-0"
              >
                Save Policies
              </Button>
            </div>

            <div className="space-y-6 pt-2">
              <div>
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber-500" />
                  Guardian Notification Thresholds
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-pitch-900/40 border border-slate-200 dark:border-white/5">
                  <Input
                    label="Consecutive absent days before alert"
                    type="number"
                    min={1}
                    max={30}
                    value={absentAlertDays}
                    onChange={(e) => setAbsentAlertDays(parseInt(e.target.value, 10) || 1)}
                    helperText="Fires an automated WhatsApp/system absence alert when a student reaches this many consecutive missed sessions."
                  />
                  <Input
                    label="Days before installment due date to alert"
                    type="number"
                    min={0}
                    max={30}
                    value={dueDateAlertDays}
                    onChange={(e) => setDueDateAlertDays(parseInt(e.target.value, 10) || 0)}
                    helperText="Notifies guardians about an upcoming fee installment this number of days before the scheduled due date."
                  />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Shield size={13} className="text-indigo-400" />
                  Data Protection & Privacy Contact
                </h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-pitch-900/40 border border-slate-200 dark:border-white/5">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 max-w-xl">
                    Shown to guardians on student consent notices as the designated contact for reviewing, correcting, or withdrawing consent for child data, per the DPDP Act. Leave blank to default to your manager account email.
                  </p>
                  <Input
                    label="Privacy contact email"
                    type="email"
                    value={dataProtectionContactEmail}
                    onChange={(e) => setDataProtectionContactEmail(e.target.value)}
                    placeholder="privacy@youracademy.com"
                    className="max-w-md"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <Button
                  type="submit"
                  loading={isSavingPolicies}
                  icon={<Save size={14} />}
                >
                  Save Alert & Policy Settings
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: EDIT ACADEMY PROFILE & IDENTITY             */}
      {/* ==================================================== */}
      {isProfileModalOpen && (
        <Modal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          title="Edit Academy Profile & Location"
          size="lg"
        >
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <ImageUploadField
              label="Academy Logo"
              value={profileForm.logo}
              onChange={(url) => setProfileForm((prev) => ({ ...prev, logo: url || undefined }))}
              category="academy_logo"
              shape="square"
            />

            <Input
              label="Academy Name"
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Nox Elite Football Academy"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input
                label="Primary Facility / Location Name"
                value={profileForm.location?.name || ""}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    location: { ...prev.location, name: e.target.value },
                  }))
                }
                placeholder="e.g. Downtown Training Center"
              />

              <Input
                label="Field / Court Number (Optional)"
                value={profileForm.location?.fieldNumber || ""}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    location: { ...prev.location, fieldNumber: e.target.value },
                  }))
                }
                placeholder="e.g. Field 1, Pitch A"
              />
            </div>

            <Input
              label="Full Facility Address"
              value={profileForm.location?.address || ""}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  location: { ...prev.location, address: e.target.value },
                }))
              }
              placeholder="e.g. 100 Stadium Road, Sector 4"
            />

            <div className="pt-2">
              <LocationPicker
                label="Facility Map Location & Coordinates"
                latitude={profileForm.location?.latitude ?? 0}
                longitude={profileForm.location?.longitude ?? 0}
                onChange={({ latitude, longitude }) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    location: { ...prev.location, latitude, longitude },
                  }))
                }
                helperText="Pinpoint your facility location or click Detect Location to attach accurate GPS coordinates for player directions."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/10">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSavingProfile}>
                Save Profile
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: ADD / EDIT SESSION TYPE                     */}
      {/* ==================================================== */}
      {isSessionTypeModalOpen && (
        <Modal
          isOpen={isSessionTypeModalOpen}
          onClose={() => setIsSessionTypeModalOpen(false)}
          title={editingSessionTypeId ? "Edit Session Type" : "Add Session Type"}
          size="md"
        >
          <form onSubmit={handleSaveSessionType} className="space-y-4">
            <Input
              label="Session Type Name"
              value={sessionTypeForm.name}
              onChange={(e) => setSessionTypeForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Technical, Physical, Match, Tactical"
              required
            />

            <Input
              label="Description (Optional)"
              value={sessionTypeForm.description}
              onChange={(e) => setSessionTypeForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Ball mastery, passing accuracy, receiving, and finishing technique"
            />

            <div>
              <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                Evaluation Skills / Submetrics
              </label>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mb-2">
                Coaches will score player performance on these exact skills during this session type.
              </p>

              <div className="flex gap-2 mb-2.5">
                <input
                  type="text"
                  value={newSubmetricInput}
                  onChange={(e) => setNewSubmetricInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSubmetric();
                    }
                  }}
                  placeholder="e.g. Dribbling, Passing, Speed, Composure"
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-volt-400"
                />
                <Button type="button" size="sm" onClick={handleAddSubmetric}>
                  Add Skill
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-pitch-900/50 min-h-[70px]">
                {sessionTypeForm.submetrics.length === 0 ? (
                  <span className="text-xs text-slate-400 italic p-1">
                    No skills added yet. Type a skill name above and click "Add Skill".
                  </span>
                ) : (
                  sessionTypeForm.submetrics.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-volt-400/10 text-volt-700 dark:text-volt-300 border border-volt-400/20"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSubmetric(skill)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        title="Remove skill"
                      >
                        <XCircle size={13} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setIsSessionTypeModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSavingSessionType}>
                {editingSessionTypeId ? "Save Session Type" : "Create Session Type"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: DELETE SESSION TYPE CONFIRMATION            */}
      {/* ==================================================== */}
      {sessionTypeToDelete && (
        <ConfirmModal
          isOpen={!!sessionTypeToDelete}
          title="Delete Session Type"
          message={`Are you sure you want to delete "${sessionTypeToDelete.name}"? Past session performance records using this type will remain safe.`}
          confirmLabel="Delete Session Type"
          cancelLabel="Cancel"
          danger
          onConfirm={handleDeleteSessionType}
          onCancel={() => setSessionTypeToDelete(null)}
        />
      )}

      {/* ==================================================== */}
      {/* MODAL 4: ADD / EDIT PITCH MODAL                      */}
      {/* ==================================================== */}
      {isPitchModalOpen && (
        <Modal
          isOpen={isPitchModalOpen}
          onClose={() => setIsPitchModalOpen(false)}
          title={editingPitchId ? "Edit Pitch / Venue" : "Add Pitch / Venue"}
          size="md"
        >
          <form onSubmit={handleSavePitch} className="space-y-4">
            <Input
              label="Pitch / Venue Name"
              placeholder="e.g. Main Turf, Arena A, North Field"
              value={pitchForm.name}
              onChange={(e) => setPitchForm({ ...pitchForm, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Field Number / Identifier (Optional)"
                placeholder="e.g. Field 1, Pitch B"
                value={pitchForm.fieldNumber}
                onChange={(e) => setPitchForm({ ...pitchForm, fieldNumber: e.target.value })}
              />

              <Select
                label="Surface Type"
                value={pitchForm.surfaceType}
                onChange={(e) => setPitchForm({ ...pitchForm, surfaceType: e.target.value })}
                className="text-xs"
                options={SURFACE_TYPES}
              />
            </div>

            <Input
              label="Address / Location Details (Optional)"
              placeholder="e.g. Gate 2, Sports Complex Main Road"
              value={pitchForm.address}
              onChange={(e) => setPitchForm({ ...pitchForm, address: e.target.value })}
            />

            <div className="pt-1">
              <LocationPicker
                label="Venue Map Location & Coordinates"
                latitude={pitchForm.latitude}
                longitude={pitchForm.longitude}
                mapsUrl={pitchForm.googleMapsUrl}
                onChange={({ latitude, longitude, mapsUrl }) => {
                  setPitchForm((prev) => ({
                    ...prev,
                    latitude,
                    longitude,
                    googleMapsUrl: mapsUrl || (latitude && longitude ? `https://www.google.com/maps?q=${latitude},${longitude}` : ""),
                  }));
                }}
                helperText="Paste a Google Maps link or enter coordinates so players and coaches can navigate to this pitch directly."
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="pitchIsActive"
                checked={pitchForm.isActive}
                onChange={(e) => setPitchForm({ ...pitchForm, isActive: e.target.checked })}
                className="rounded border-white/10 text-volt-400 focus:ring-volt-400 bg-pitch-900 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="pitchIsActive" className="text-xs text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                Available for session scheduling
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setIsPitchModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingPitchId ? "Update Pitch" : "Add Pitch"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ==================================================== */}
      {/* MODAL 5: DELETE PITCH CONFIRMATION                   */}
      {/* ==================================================== */}
      {pitchToDelete && (
        <ConfirmModal
          isOpen={!!pitchToDelete}
          title="Delete Pitch / Venue"
          message={`Are you sure you want to delete "${pitchToDelete.name}"? Past sessions that used this location will keep their record, but it will no longer appear in the session venue picker.`}
          confirmLabel="Delete Pitch"
          cancelLabel="Cancel"
          danger
          onConfirm={handleDeletePitch}
          onCancel={() => setPitchToDelete(null)}
        />
      )}
    </div>
  );
};

export default AcademySettingsPage;