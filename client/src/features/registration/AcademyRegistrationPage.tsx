// src/features/registration/AcademyRegistrationPage.tsx
import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useGetAcademyPublicInfoQuery,
  useSendRegistrationOtpMutation,
  useVerifyRegistrationOtpMutation,
  useSubmitRegistrationRequestMutation,
} from "@/store/api/registrationApi";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { ImageUploadField } from "@/components/ui";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Send,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Phone,
  Mail,
  User,
  Calendar,
  Sparkles,
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

  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Auto-select first franchise when loaded
  React.useEffect(() => {
    if (academyInfo?.franchises?.length && !selectedFranchiseId) {
      setSelectedFranchiseId(academyInfo.franchises[0].id);
    }
  }, [academyInfo, selectedFranchiseId]);

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
      toast.error("Please select a training franchise / branch");
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

    try {
      await submitRequest({
        academyId: academyId!,
        franchiseId: selectedFranchiseId,
        existingStudentId: verifiedStudent?.id,
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
                Player Registration & Enrollment Form
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Fill out the player details below to request enrollment under{" "}
                <strong>{academyInfo.academy.name}</strong>.
              </p>
            </div>

            {/* Existing Student Toggle */}
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    Already registered as a free agent or public player?
                  </span>
                  <span className="text-2xs text-slate-500">
                    Connect your existing Noxphere profile to retain match stats
                    and player card.
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
                  {hasExistingProfile
                    ? "Connecting Profile"
                    : "Connect Profile"}
                </button>
              </div>

              {hasExistingProfile && !verifiedStudent && (
                <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Verify account ownership via 6-digit OTP sent to your
                    registered phone or email:
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
                      <Send size={13} />{" "}
                      {sendingOtp ? "Sending OTP…" : "Send Verification OTP"}
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
                        <KeyRound size={13} />{" "}
                        {verifyingOtp ? "Verifying…" : "Verify OTP"}
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
                      Verified profile linked:{" "}
                      <strong>
                        {verifiedStudent.firstName} {verifiedStudent.lastName}
                      </strong>{" "}
                      ({verifiedStudent.ageGroup})
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

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Franchise selection */}
              <div className="space-y-2">
                <label className="label">
                  Select Preferred Branch / Franchise *
                </label>
                <select
                  value={selectedFranchiseId}
                  onChange={(e) => setSelectedFranchiseId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="" disabled>
                    Choose training center…
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

              {/* Student Details */}
              <div className="space-y-4">
                <div className="border-b border-slate-200 dark:border-white/10 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                    Player Details
                  </h3>
                </div>

                <ImageUploadField
                  label="Player Card Photo (optional)"
                  category="player_photo"
                  value={studentDetails.photo}
                  onChange={(url) =>
                    setStudentDetails((prev) => ({ ...prev, photo: url || "" }))
                  }
                  shape="circle"
                  helperText="Official player headshot shown on public player cards, rosters, and NFC ID passes."
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
                      placeholder="First name"
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
                      placeholder="Last name"
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

              {/* Guardian Contact Details */}
              <div className="space-y-4">
                <div className="border-b border-slate-200 dark:border-white/10 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                    Guardian & Communication Details
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
                      placeholder="Guardian name"
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

                <div>
                  <label className="label">
                    Emergency Medical Notes / Allergies (Optional)
                  </label>
                  <input
                    type="text"
                    value={studentDetails.medicalNotes}
                    onChange={(e) =>
                      setStudentDetails({
                        ...studentDetails,
                        medicalNotes: e.target.value,
                      })
                    }
                    placeholder="Any health notes, allergies, or emergency details"
                    className="input"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full py-3 text-sm font-semibold"
                >
                  {submitting
                    ? "Submitting Application…"
                    : "Submit Registration Application"}
                </button>
                <p className="text-2xs text-center text-slate-500 mt-2">
                  Upon submission, academy management will evaluate squad
                  capacity and finalize your registration.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademyRegistrationPage;
