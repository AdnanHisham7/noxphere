// src/features/registration/AcademyRegistrationPage.tsx
import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useGetAcademyPublicInfoQuery,
  useSendRegistrationOtpMutation,
  useVerifyRegistrationOtpMutation,
  useSubmitRegistrationRequestMutation,
} from "@/store/api/registrationApi";
import { useLazyCheckAvailabilityQuery } from "@/store/api/authApi";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { ImageUploadField } from "@/components/ui";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Send,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Phone,
  Mail,
  User,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { calculateAgeCategory, ALL_AGE_GROUPS } from "@/utils/ageCategory";

const AGE_GROUPS = ALL_AGE_GROUPS;
const POSITIONS = [
  "Forward",
  "Winger",
  "Midfielder",
  "Defensive Midfielder",
  "Defender",
  "Full Back",
  "Goalkeeper",
];

export const AcademyRegistrationPage: React.FC = () => {
  const { academyId } = useParams<{ academyId: string }>();

  const {
    data: academyInfo,
    isLoading: loadingInfo,
    error: infoError,
  } = useGetAcademyPublicInfoQuery(academyId || "", { skip: !academyId });

  const [sendOtp, { isLoading: sendingOtp }] = useSendRegistrationOtpMutation();
  const [verifyOtp, { isLoading: verifyingOtp }] =
    useVerifyRegistrationOtpMutation();
  const [submitRequest, { isLoading: submitting }] =
    useSubmitRegistrationRequestMutation();
  const [checkAvailability, { isFetching: checkingAvailability }] =
    useLazyCheckAvailabilityQuery();

  // Wizard Step: 1 = Player & Branch, 2 = Guardian & Medical, 3 = Review & Submit
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Mode: "new" or "existing"
  const [hasExistingProfile, setHasExistingProfile] = useState(false);

  // OTP Verification state
  const [otpPhone, setOtpPhone] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState<any | null>(null);

  // Form details
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [studentDetails, setStudentDetails] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "male",
    ageGroup: "U-15",
    position: "Midfielder",
    jerseyNumber: "",
    jerseySize: "M",
    photo: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    medicalNotes: "",
  });

  const [guardianDetails, setGuardianDetails] = useState({
    name: "",
    phone: "",
    email: "",
    relation: "Parent",
  });

  const [dpdpConsent, setDpdpConsent] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const validateStep1 = () => {
    if (!selectedFranchiseId && academyInfo?.franchises?.length) {
      toast.error("Please select a preferred training branch/franchise");
      return false;
    }
    if (!studentDetails.firstName.trim() || !studentDetails.lastName.trim()) {
      toast.error("Please enter the player's first and last name");
      return false;
    }
    if (!studentDetails.dateOfBirth) {
      toast.error("Please select the player's date of birth");
      return false;
    }
    const dob = new Date(studentDetails.dateOfBirth);
    if (isNaN(dob.getTime()) || dob >= new Date()) {
      toast.error("Please select a valid past date of birth");
      return false;
    }
    if (studentDetails.jerseyNumber) {
      const jNum = Number(studentDetails.jerseyNumber);
      if (isNaN(jNum) || jNum < 1 || jNum > 99) {
        toast.error("Jersey number must be between 1 and 99");
        return false;
      }
    }
    return true;
  };

  const validateStep2 = async () => {
    if (!guardianDetails.name.trim()) {
      toast.error("Please enter the guardian's full name");
      return false;
    }
    if (!guardianDetails.email.trim()) {
      toast.error("Please enter the guardian's email for portal access");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guardianDetails.email.trim())) {
      toast.error("Please enter a valid guardian email address");
      return false;
    }
    if (!guardianDetails.phone.trim()) {
      toast.error("Please enter the guardian's contact phone number");
      return false;
    }
    const cleanPhone = guardianDetails.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Guardian phone number must have at least 10 digits");
      return false;
    }
    if (studentDetails.emergencyContactPhone.trim()) {
      const cleanEmergency = studentDetails.emergencyContactPhone.replace(/\D/g, "");
      if (cleanEmergency.length < 10) {
        toast.error("Emergency contact phone number must have at least 10 digits");
        return false;
      }
    }

    if (!hasExistingProfile) {
      try {
        const checkRes = await checkAvailability({
          email: guardianDetails.email.trim().toLowerCase(),
          phone: guardianDetails.phone.trim(),
          purpose: "guardian",
        }).unwrap();

        if (checkRes && !checkRes.available) {
          toast.error(
            checkRes.message ||
              "Guardian email or phone number is already registered under another account.",
          );
          return false;
        }
      } catch (err: any) {
        const msg = err?.data?.message || err?.message;
        if (msg) {
          toast.error(msg);
          return false;
        }
      }
    }
    return true;
  };


  const handleSendOtp = async () => {
    if (!otpPhone.trim() && !otpEmail.trim()) {
      toast.error("Please enter your registered phone or email");
      return;
    }
    if (!academyId) return;

    try {
      const res = await sendOtp({
        phone: otpPhone.trim(),
        email: otpEmail.trim().toLowerCase(),
        academyId,
      }).unwrap();
      toast.success(res.message || "OTP sent successfully!");
      setOtpSent(true);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to send verification OTP");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit OTP code");
      return;
    }

    try {
      const res = await verifyOtp({
        phone: otpPhone.trim(),
        email: otpEmail.trim().toLowerCase(),
        otp: otpCode.trim(),
      }).unwrap();

      if (res.verified && res.student) {
        toast.success(
          `Verified: ${res.student.firstName} ${res.student.lastName}`,
        );
        setVerifiedStudent({
          ...res.student,
          id: (res as any).studentId || res.student.id,
        });
        // Pre-fill student info
        const prefillDob = res.student.dateOfBirth
          ? res.student.dateOfBirth.split("T")[0]
          : "";
        setStudentDetails((prev) => ({
          ...prev,
          firstName: res.student.firstName || prev.firstName,
          lastName: res.student.lastName || prev.lastName,
          dateOfBirth: prefillDob || prev.dateOfBirth,
          ageGroup:
            res.student.ageGroup ||
            (prefillDob ? calculateAgeCategory(prefillDob) : prev.ageGroup),
          position: res.student.position || prev.position,
          photo: res.student.photo || prev.photo,
        }));
        if (res.student.guardian) {
          setGuardianDetails((prev) => ({
            ...prev,
            name: res.student.guardian.name || prev.name,
            phone: res.student.guardian.phone || prev.phone,
            email: res.student.guardian.email || prev.email,
          }));
        }
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Invalid or expired OTP code");
    }
  };

  const handleDobChange = (value: string) => {
    setStudentDetails((prev) => ({
      ...prev,
      dateOfBirth: value,
      ageGroup: value ? calculateAgeCategory(value) : prev.ageGroup,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFranchiseId) {
      toast.error("Please choose your preferred training branch / franchise");
      document.getElementById("franchise-select")?.focus();
      return;
    }
    if (!studentDetails.firstName.trim() || !studentDetails.lastName.trim()) {
      toast.error("Student name is required");
      return;
    }
    if (!studentDetails.dateOfBirth) {
      toast.error("Student date of birth is required");
      return;
    }
    if (
      !guardianDetails.name.trim() ||
      !guardianDetails.phone.trim() ||
      !guardianDetails.email.trim()
    ) {
      toast.error("Guardian contact name, phone, and email are required");
      return;
    }

    if (hasExistingProfile && !verifiedStudent) {
      toast.error(
        "Please verify your existing student profile OTP before submitting",
      );
      return;
    }

    if (!dpdpConsent) {
      toast.error(
        "Parental/guardian consent under the Digital Personal Data Protection (DPDP) Act is mandatory for enrollment",
      );
      document.getElementById("dpdp-consent-checkbox")?.focus();
      return;
    }

    try {
      await submitRequest({
        academyId: academyId!,
        franchiseId: selectedFranchiseId,
        existingStudentId: verifiedStudent?.id,
        dpdpConsent: true,
        studentDetails: {
          firstName: studentDetails.firstName.trim(),
          lastName: studentDetails.lastName.trim(),
          dateOfBirth: studentDetails.dateOfBirth,
          gender: studentDetails.gender,
          ageGroup: studentDetails.ageGroup,
          position: studentDetails.position,
          jerseyNumber: studentDetails.jerseyNumber
            ? Number(studentDetails.jerseyNumber)
            : undefined,
          jerseySize: studentDetails.jerseySize,
          photo: studentDetails.photo ? studentDetails.photo : undefined,
          medicalInfo: {
            emergencyContactName:
              studentDetails.emergencyContactName.trim() ||
              guardianDetails.name,
            emergencyContactPhone:
              studentDetails.emergencyContactPhone.trim() ||
              guardianDetails.phone,
            medicalNotes: studentDetails.medicalNotes.trim(),
          },
        },
        guardianDetails: {
          name: guardianDetails.name.trim(),
          phone: guardianDetails.phone.trim(),
          email: guardianDetails.email.trim().toLowerCase(),
          relation: guardianDetails.relation,
        },
      }).unwrap();

      setSubmittedSuccess(true);
      toast.success("Application submitted successfully!");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to submit application");
    }
  };

  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-pitch-950 text-slate-500">
        <div className="animate-pulse flex items-center gap-2">
          <Building2 size={24} className="text-volt-400" />
          <span>Loading academy enrollment portal…</span>
        </div>
      </div>
    );
  }

  if (infoError || !academyInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-pitch-950 text-center">
        <ShieldAlert size={48} className="text-ember-500 mb-4" />
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
          Academy Registration Link Invalid
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          This registration link appears to be invalid, closed, or the academy
          could not be found. Please check the URL with your academy
          administrator.
        </p>
        <Link to="/" className="btn-primary mt-6 text-xs">
          Return to Noxphere Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-pitch-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top bar */}
      <header className="px-6 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-pitch-900/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-volt-400 flex items-center justify-center font-bold text-pitch-900 text-sm">
            N
          </span>
          <div>
            <div className="font-display font-bold text-base leading-tight text-slate-900 dark:text-white">
              {academyInfo.academy.name}
            </div>
            <div className="text-2xs font-mono uppercase tracking-wider text-slate-500">
              Official Academy Enrollment
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle size="sm" />
          <Link
            to="/login"
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Portal Login
          </Link>
        </div>
      </header>

      {/* Main container */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {submittedSuccess ? (
          /* Application Submitted Success */
          <div className="card p-8 text-center space-y-6 shadow-xl border-volt-400/20 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-field-400/20 text-field-500 mx-auto flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                Application Received!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Thank you for applying to{" "}
                <strong>{academyInfo.academy.name}</strong>. Your registration
                request has been submitted to the academy management team.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 text-left text-xs space-y-2 max-w-lg mx-auto">
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles size={14} className="text-volt-500" /> What happens
                next?
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                <li>
                  The academy manager will review your application, age
                  category, and squad placement.
                </li>
                <li>
                  Upon approval, a confirmation alert and portal login
                  credentials will be dispatched to{" "}
                  <strong>{guardianDetails.email}</strong>.
                </li>
                <li>
                  If you linked an existing player profile, your previous match
                  history and ratings will transfer into the academy squad
                  automatically.
                </li>
              </ul>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3">
              <Link to="/" className="btn-primary">
                Return to Home <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        ) : (
          /* Application Form */
          <div className="card p-6 sm:p-8 space-y-6 shadow-lg border-slate-200 dark:border-white/10">
            {/* Header banner */}
            <div className="space-y-2 border-b border-slate-200 dark:border-white/10 pb-6">
              <span className="pill pill-yellow text-2xs">Admissions Open</span>
              <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                Player Registration & Enrollment
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enroll under <strong>{academyInfo.academy.name}</strong> in 3 simple steps.
              </p>
            </div>

            {/* Step Progress Tracker */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { s: 1, label: "Player & Branch", icon: User },
                { s: 2, label: "Guardian & Medical", icon: Phone },
                { s: 3, label: "Review & Submit", icon: ShieldCheck },
              ].map((item) => (
                <div
                  key={item.s}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs transition-colors ${
                    step === item.s
                      ? "border-volt-500 bg-volt-500/10 text-slate-900 dark:text-white font-bold shadow-xs"
                      : step > item.s
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : "border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-500"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold ${
                      step === item.s
                        ? "bg-volt-400 text-pitch-950"
                        : step > item.s
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 dark:bg-pitch-800 text-slate-500"
                    }`}
                  >
                    {step > item.s ? "✓" : item.s}
                  </div>
                  <span className="truncate hidden sm:inline">{item.label}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* STEP 1: Branch Selection & Player Info */}
              {step === 1 && (
                <div className="space-y-6 animate-fade-in">
                  {/* Existing Student Toggle */}
                  <div className="p-4 rounded-xl bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                          Already registered as a free agent or public player?
                        </span>
                        <span className="text-2xs text-slate-500">
                          Connect your existing Noxphere profile to retain match stats and player card.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setHasExistingProfile(!hasExistingProfile);
                          setVerifiedStudent(null);
                          setOtpSent(false);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                          hasExistingProfile
                            ? "bg-volt-400 text-pitch-900"
                            : "bg-slate-200 dark:bg-pitch-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {hasExistingProfile ? "Connecting Profile" : "Connect Profile"}
                      </button>
                    </div>

                    {hasExistingProfile && !verifiedStudent && (
                      <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-3">
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          Verify account ownership via 6-digit OTP sent to your registered phone or email:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="tel"
                            placeholder="Registered phone (+91...)"
                            value={otpPhone}
                            onChange={(e) => setOtpPhone(e.target.value)}
                            className="input text-xs"
                          />
                          <input
                            type="email"
                            placeholder="Registered email"
                            value={otpEmail}
                            onChange={(e) => setOtpEmail(e.target.value)}
                            className="input text-xs"
                          />
                        </div>

                        {!otpSent ? (
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={sendingOtp}
                            className="btn-secondary text-xs !py-1.5 !px-3"
                          >
                            <Send size={13} /> {sendingOtp ? "Sending OTP…" : "Send Verification OTP"}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="6-digit OTP"
                              value={otpCode}
                              onChange={(e) => setOtpCode(e.target.value)}
                              className="input text-xs font-mono tracking-widest text-center w-36"
                            />
                            <button
                              type="button"
                              onClick={handleVerifyOtp}
                              disabled={verifyingOtp}
                              className="btn-primary text-xs !py-1.5 !px-3"
                            >
                              <KeyRound size={13} /> {verifyingOtp ? "Verifying…" : "Verify OTP"}
                            </button>
                            <button
                              type="button"
                              onClick={handleSendOtp}
                              className="text-2xs text-volt-500 hover:underline ml-2"
                            >
                              Resend
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {verifiedStudent && (
                      <div className="p-3 rounded-lg bg-field-400/15 border border-field-400/30 flex items-center justify-between text-xs text-field-600 dark:text-field-400">
                        <div className="flex items-center gap-2">
                          <UserCheck size={16} />
                          <span>
                            Verified profile linked: <strong>{verifiedStudent.firstName} {verifiedStudent.lastName}</strong> ({verifiedStudent.ageGroup})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVerifiedStudent(null)}
                          className="text-2xs underline hover:text-slate-900 dark:hover:text-white"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Franchise selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="label" htmlFor="franchise-select">
                        Select Preferred Branch / Franchise *
                      </label>
                      <span className="text-2xs font-semibold text-amber-500 uppercase tracking-wide">
                        Required
                      </span>
                    </div>
                    <select
                      id="franchise-select"
                      value={selectedFranchiseId}
                      onChange={(e) => setSelectedFranchiseId(e.target.value)}
                      className="input"
                      required
                    >
                      <option value="" disabled>
                        -- Choose your preferred training center / branch * --
                      </option>
                      {academyInfo.franchises.map((f) => {
                        const locationLabel =
                          typeof f.location === "object"
                            ? f.location?.name || f.location?.address
                            : f.location;
                        return (
                          <option key={f.id} value={f.id}>
                            {f.name} {locationLabel ? `— ${locationLabel}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Player Details */}
                  <div className="space-y-4">
                    <div className="border-b border-slate-200 dark:border-white/10 pb-2">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                        Player Information
                      </h3>
                    </div>

                    <ImageUploadField
                      label="Player Photo (optional)"
                      category="player_photo"
                      value={studentDetails.photo}
                      onChange={(url) =>
                        setStudentDetails((prev) => ({ ...prev, photo: url || "" }))
                      }
                      shape="circle"
                      helperText="Official player headshot shown on rosters and NFC ID cards."
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">First Name *</label>
                        <input
                          type="text"
                          required
                          value={studentDetails.firstName}
                          onChange={(e) =>
                            setStudentDetails({
                              ...studentDetails,
                              firstName: e.target.value,
                            })
                          }
                          placeholder="Player first name"
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label">Last Name *</label>
                        <input
                          type="text"
                          required
                          value={studentDetails.lastName}
                          onChange={(e) =>
                            setStudentDetails({
                              ...studentDetails,
                              lastName: e.target.value,
                            })
                          }
                          placeholder="Player last name"
                          className="input"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="label">Date of Birth *</label>
                        <input
                          type="date"
                          required
                          value={studentDetails.dateOfBirth}
                          onChange={(e) => handleDobChange(e.target.value)}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label">Gender</label>
                        <select
                          value={studentDetails.gender}
                          onChange={(e) =>
                            setStudentDetails({
                              ...studentDetails,
                              gender: e.target.value,
                            })
                          }
                          className="input"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Age Group *</label>
                        <select
                          value={studentDetails.ageGroup}
                          onChange={(e) =>
                            setStudentDetails({
                              ...studentDetails,
                              ageGroup: e.target.value,
                            })
                          }
                          className="input"
                        >
                          {AGE_GROUPS.map((ag) => (
                            <option key={ag} value={ag}>
                              {ag}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="label">Preferred Position</label>
                        <select
                          value={studentDetails.position}
                          onChange={(e) =>
                            setStudentDetails({
                              ...studentDetails,
                              position: e.target.value,
                            })
                          }
                          className="input"
                        >
                          {POSITIONS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Preferred Jersey #</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={studentDetails.jerseyNumber}
                          onChange={(e) =>
                            setStudentDetails({
                              ...studentDetails,
                              jerseyNumber: e.target.value,
                            })
                          }
                          placeholder="e.g. 10"
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label">Jersey Size</label>
                        <select
                          value={studentDetails.jerseySize}
                          onChange={(e) =>
                            setStudentDetails({
                              ...studentDetails,
                              jerseySize: e.target.value,
                            })
                          }
                          className="input"
                        >
                          <option value="XS">XS</option>
                          <option value="S">S</option>
                          <option value="M">M</option>
                          <option value="L">L</option>
                          <option value="XL">XL</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        if (validateStep1()) setStep(2);
                      }}
                      className="btn-primary px-6 py-2.5 text-xs font-bold flex items-center gap-2"
                    >
                      <span>Continue to Guardian & Medical</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Guardian & Medical Details */}
              {step === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-4">
                    <div className="border-b border-slate-200 dark:border-white/10 pb-2">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                        Parent / Guardian Contact Details
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Guardian Full Name *</label>
                        <input
                          type="text"
                          required
                          value={guardianDetails.name}
                          onChange={(e) =>
                            setGuardianDetails({
                              ...guardianDetails,
                              name: e.target.value,
                            })
                          }
                          placeholder="Full name"
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label">Relation to Player</label>
                        <select
                          value={guardianDetails.relation}
                          onChange={(e) =>
                            setGuardianDetails({
                              ...guardianDetails,
                              relation: e.target.value,
                            })
                          }
                          className="input"
                        >
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Guardian">Legal Guardian</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">
                          Email Address (for portal alerts) *
                        </label>
                        <input
                          type="email"
                          required
                          value={guardianDetails.email}
                          onChange={(e) =>
                            setGuardianDetails({
                              ...guardianDetails,
                              email: e.target.value,
                            })
                          }
                          placeholder="guardian@example.com"
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label">Phone / WhatsApp Number *</label>
                        <input
                          type="tel"
                          required
                          value={guardianDetails.phone}
                          onChange={(e) =>
                            setGuardianDetails({
                              ...guardianDetails,
                              phone: e.target.value,
                            })
                          }
                          placeholder="+91 9876543210"
                          className="input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Emergency & Medical details */}
                  <div className="space-y-4 pt-2">
                    <div className="border-b border-slate-200 dark:border-white/10 pb-2">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                        Emergency & Medical Info
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Emergency Contact Name (Optional)</label>
                        <input
                          type="text"
                          value={studentDetails.emergencyContactName}
                          onChange={(e) =>
                            setStudentDetails({
                              ...studentDetails,
                              emergencyContactName: e.target.value,
                            })
                          }
                          placeholder="Defaults to Guardian name if blank"
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label">Emergency Contact Phone (Optional)</label>
                        <input
                          type="tel"
                          value={studentDetails.emergencyContactPhone}
                          onChange={(e) =>
                            setStudentDetails({
                              ...studentDetails,
                              emergencyContactPhone: e.target.value,
                            })
                          }
                          placeholder="Defaults to Guardian phone if blank"
                          className="input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">
                        Medical Notes / Allergies / Pre-existing Conditions (Optional)
                      </label>
                      <textarea
                        value={studentDetails.medicalNotes}
                        onChange={(e) =>
                          setStudentDetails({
                            ...studentDetails,
                            medicalNotes: e.target.value,
                          })
                        }
                        placeholder="Describe any food allergies, asthma, previous sports injuries, etc."
                        className="input min-h-[70px] py-2"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="btn-secondary px-5 py-2.5 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <ChevronLeft size={15} />
                      <span>Back</span>
                    </button>
                    <button
                      type="button"
                      disabled={checkingAvailability}
                      onClick={async () => {
                        if (await validateStep2()) setStep(3);
                      }}
                      className="btn-primary px-6 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                      <span>{checkingAvailability ? "Checking..." : "Continue to Review & Submit"}</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Review & DPDP Consent */}
              {step === 3 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-200 dark:border-white/10 pb-2">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                      Review Enrollment Details
                    </h3>
                  </div>

                  {/* Summary Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 font-mono text-2xs block uppercase">Training Branch</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {academyInfo.franchises.find((f) => f.id === selectedFranchiseId)?.name || "Selected Branch"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono text-2xs block uppercase">Player Name</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {studentDetails.firstName} {studentDetails.lastName}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-white/5">
                      <div>
                        <span className="text-slate-400 font-mono text-2xs block">DOB / Age</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {studentDetails.dateOfBirth} ({studentDetails.ageGroup})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono text-2xs block">Position</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {studentDetails.position}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono text-2xs block">Jersey #</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {studentDetails.jerseyNumber ? `#${studentDetails.jerseyNumber}` : "Not set"} ({studentDetails.jerseySize})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono text-2xs block">Gender</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium capitalize">
                          {studentDetails.gender}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 font-mono text-2xs block">Parent / Guardian</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {guardianDetails.name} ({guardianDetails.relation}) &bull; {guardianDetails.phone}
                        </span>
                        <span className="text-2xs text-slate-500 block">{guardianDetails.email}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono text-2xs block">Medical Notes</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {studentDetails.medicalNotes || "None reported"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Statutory DPDP Act Consent */}
                  <div className="card p-4 sm:p-5 border border-sky-500/30 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-500/20 rounded-xl space-y-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 dark:bg-sky-400/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                        <ShieldCheck className="text-sky-600 dark:text-sky-400" size={18} />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-tight">
                          Digital Personal Data Protection (DPDP) Act Consent *
                        </h3>
                        <p className="text-2xs text-slate-500 dark:text-slate-400">
                          Statutory Notice under DPDP Act, 2023 & Rule 3 Data Protection Guidelines
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 bg-white/60 dark:bg-pitch-800/60 p-3.5 rounded-lg border border-slate-200/80 dark:border-white/5">
                      <p className="leading-relaxed">
                        Under India&apos;s Digital Personal Data Protection Act, 2023, <strong>{academyInfo.academy.name}</strong> and <strong>Noxphere</strong> require explicit parental/guardian consent to collect, process, and retain the player&apos;s personal, athletic, and emergency medical records.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-2xs text-slate-500 dark:text-slate-400">
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Data Collected:</span> Name, DOB, contact, photo, emergency medical notes, attendance & evaluation records.
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Purpose:</span> Academy squad enrollment, safety, emergency contact, training evaluation & fee administration.
                        </div>
                      </div>
                      <p className="text-2xs text-slate-400 pt-1">
                        Consent may be reviewed or withdrawn at any time through your Guardian Portal account.
                      </p>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer pt-1 group select-none">
                      <input
                        type="checkbox"
                        id="dpdp-consent-checkbox"
                        checked={dpdpConsent}
                        onChange={(e) => setDpdpConsent(e.target.checked)}
                        required
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-volt-500 focus:ring-volt-400 dark:border-white/20 dark:bg-pitch-800 cursor-pointer"
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-200 leading-snug">
                        <strong className="font-medium text-slate-900 dark:text-white">
                          I declare that I am the parent or legal guardian of {studentDetails.firstName.trim() || "the applicant"} and provide mandatory consent under the DPDP Act for the processing of player and guardian data as described above. *
                        </strong>
                      </span>
                    </label>
                  </div>

                  {/* Wizard Step 3 Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="btn-secondary px-5 py-2.5 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <ChevronLeft size={15} />
                      <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary px-8 py-3 text-sm font-bold flex items-center gap-2"
                    >
                      {submitting ? "Submitting Application…" : "Submit Registration Application"}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <p className="text-2xs text-center text-slate-500 mt-2">
                    Upon submission, academy management will evaluate squad capacity and finalize your registration.
                  </p>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademyRegistrationPage;
