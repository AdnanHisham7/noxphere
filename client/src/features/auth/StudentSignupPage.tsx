// src/features/auth/StudentSignupPage.tsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoSrc from "@/assets/logo.png";
import { useRegisterPublicStudentMutation } from "@/store/api/studentsApi";
import { useDispatch } from "react-redux";
import { setCredentials } from "@/store/slices/authSlice";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import {
  User,
  Mail,
  Lock,
  Phone,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  Shield,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";

const AGE_GROUPS = ["U-7", "U-9", "U-11", "U-13", "U-15", "U-17", "U-19", "Senior"];
const POSITIONS = ["Forward", "Winger", "Midfielder", "Defensive Midfielder", "Defender", "Full Back", "Goalkeeper"];

export const StudentSignupPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [registerPublicStudent, { isLoading }] = useRegisterPublicStudentMutation();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "male",
    ageGroup: "U-15",
    position: "Midfielder",
    guardianName: "",
    guardianEmail: "",
    guardianPhone: "",
    password: "",
    confirmPassword: "",
  });

  const [createdStudent, setCreatedStudent] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error("Please enter student name");
      return;
    }
    if (!formData.dateOfBirth) {
      toast.error("Please enter date of birth");
      return;
    }
    if (!formData.guardianEmail.trim() || !formData.guardianPhone.trim()) {
      toast.error("Guardian email and phone are required for login and communication");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      const res = await registerPublicStudent({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.guardianEmail.trim().toLowerCase(),
        phone: formData.guardianPhone.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        ageGroup: formData.ageGroup,
        position: formData.position,
        guardianName: formData.guardianName.trim() || `${formData.firstName} Guardian`,
        guardianEmail: formData.guardianEmail.trim().toLowerCase(),
        guardianPhone: formData.guardianPhone.trim(),
        password: formData.password,
      }).unwrap();

      toast.success("Player account created successfully!");
      setCreatedStudent(res.student);
      if (res.token) {
        // Auto-login if auth payload is provided
        dispatch(
          setCredentials({
            user: {
              id: res.student.userId,
              email: formData.guardianEmail.trim().toLowerCase(),
              role: "student",
              firstName: formData.firstName,
              lastName: formData.lastName,
            },
            accessToken: res.token,
          } as any)
        );
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to create player account");
    }
  };

  const publicProfileUrl = createdStudent?.publicProfileToken
    ? `${window.location.origin}/players/${createdStudent.publicProfileToken}`
    : "";

  const handleCopyLink = () => {
    if (!publicProfileUrl) return;
    navigator.clipboard.writeText(publicProfileUrl);
    setCopied(true);
    toast.success("Public profile link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-pitch-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top bar */}
      <header className="px-6 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-pitch-900/80 backdrop-blur-sm sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoSrc} alt="Noxphere" className="w-8 h-8 object-contain drop-shadow" />
          <span className="font-display font-bold text-lg tracking-wide text-slate-900 dark:text-white">
            Noxphere <span className="text-xs text-volt-500 font-mono">PLAYER ID</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle size="sm" />
          <Link
            to="/login"
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Already registered? <span className="text-volt-500 underline ml-1">Sign In</span>
          </Link>
        </div>
      </header>

      {/* Main container */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {createdStudent ? (
          /* Success Screen */
          <div className="card p-8 text-center space-y-6 animate-fade-in shadow-xl border-volt-400/20">
            <div className="w-16 h-16 rounded-full bg-field-400/20 text-field-500 mx-auto flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                Player Account Created!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Welcome to Noxphere, <strong>{createdStudent.firstName}</strong>. Your independent player profile is active and can now be shared publicly or linked to any football academy.
              </p>
            </div>

            {/* Public Link Card */}
            {publicProfileUrl && (
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                    Your Public Profile Link
                  </span>
                  <span className="text-2xs font-semibold text-volt-500 bg-volt-400/10 px-2 py-0.5 rounded">
                    Free Agent Active
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicProfileUrl}
                    className="input text-xs font-mono py-2 bg-white dark:bg-pitch-800"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="btn-primary !py-2 !px-4 text-xs whitespace-nowrap"
                  >
                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Scouts, coaches, and academy managers can view your stats, player card, and verify your credentials using this secure link.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate("/student/dashboard")}
                className="btn-primary w-full sm:w-auto"
              >
                Go to Player Portal <ArrowRight size={15} />
              </button>
              {publicProfileUrl && (
                <a
                  href={publicProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary w-full sm:w-auto text-xs"
                >
                  Preview Public Profile <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        ) : (
          /* Signup Form */
          <div className="card p-6 sm:p-8 space-y-6 shadow-lg border-slate-200 dark:border-white/10">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-volt-400/15 text-volt-600 dark:text-volt-400 text-xs font-mono uppercase tracking-wider mb-2 font-semibold">
                <Sparkles size={13} /> Independent Player Signup
              </div>
              <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                Create Your Player Account
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Join without academy affiliation. Generate your public player card, showcase your stats, and connect to academies anytime.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1: Player Information */}
              <div className="space-y-4">
                <div className="border-b border-slate-200 dark:border-white/10 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                    1. Player Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name *</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="firstName"
                        required
                        value={formData.firstName}
                        onChange={handleChange}
                        placeholder="e.g. Leo"
                        className="input pl-9"
                      />
                      <User size={15} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="label">Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="e.g. Messi"
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Date of Birth *</label>
                    <div className="relative">
                      <input
                        type="date"
                        name="dateOfBirth"
                        required
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                        className="input pl-9"
                      />
                      <Calendar size={15} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="label">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
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
                      name="ageGroup"
                      value={formData.ageGroup}
                      onChange={handleChange}
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

                <div>
                  <label className="label">Preferred Position</label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    className="input"
                  >
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section 2: Guardian / Contact Information */}
              <div className="space-y-4">
                <div className="border-b border-slate-200 dark:border-white/10 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                    2. Guardian & Account Credentials
                  </h3>
                </div>

                <div>
                  <label className="label">Guardian / Manager Name *</label>
                  <input
                    type="text"
                    name="guardianName"
                    required
                    value={formData.guardianName}
                    onChange={handleChange}
                    placeholder="Parent or guardian full name"
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Email Address (Login ID) *</label>
                    <div className="relative">
                      <input
                        type="email"
                        name="guardianEmail"
                        required
                        value={formData.guardianEmail}
                        onChange={handleChange}
                        placeholder="guardian@example.com"
                        className="input pl-9"
                      />
                      <Mail size={15} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="label">Phone / WhatsApp *</label>
                    <div className="relative">
                      <input
                        type="tel"
                        name="guardianPhone"
                        required
                        value={formData.guardianPhone}
                        onChange={handleChange}
                        placeholder="+91 9876543210"
                        className="input pl-9"
                      />
                      <Phone size={15} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Password (Min 6 chars) *</label>
                    <div className="relative">
                      <input
                        type="password"
                        name="password"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="input pl-9"
                      />
                      <Lock size={15} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="label">Confirm Password *</label>
                    <div className="relative">
                      <input
                        type="password"
                        name="confirmPassword"
                        required
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="input pl-9"
                      />
                      <Shield size={15} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full py-3 text-sm font-semibold"
                >
                  {isLoading ? "Creating Account…" : "Create Free Player Account"}
                </button>
                <p className="text-2xs text-center text-slate-500 mt-3">
                  By signing up, you agree to Noxphere's Terms of Service and Privacy Policy. A single account allows the student and guardian to manage progress collaboratively.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentSignupPage;
