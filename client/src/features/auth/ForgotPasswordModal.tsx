import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';
import { Button, Input } from '../../components/ui';
import {
  useSendForgotPasswordOtpMutation,
  useResetForgotPasswordMutation,
} from '../../store/api/authApi';
import { Mail, KeyRound, CheckCircle2, ArrowLeft, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
  onSuccess?: (email: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  defaultEmail = '',
  onSuccess,
}) => {
  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [sendOtp, { isLoading: isSendingOtp }] = useSendForgotPasswordOtpMutation();
  const [resetPassword, { isLoading: isResetting }] = useResetForgotPasswordMutation();

  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail);
      setStep('email');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setResendCooldown(0);
    }
  }, [isOpen, defaultEmail]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      const res = await sendOtp({ email: cleanEmail }).unwrap();
      toast.success(res?.message || 'Verification code sent to your email');
      setStep('otp');
      setResendCooldown(60);
    } catch (err: any) {
      toast.error(err?.data?.message || 'Could not send verification code');
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    try {
      const res = await sendOtp({ email: email.trim().toLowerCase() }).unwrap();
      toast.success(res?.message || 'New code sent to your email');
      setResendCooldown(60);
    } catch (err: any) {
      toast.error(err?.data?.message || 'Could not resend verification code');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.error('Please enter the 6-digit verification code');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      const res = await resetPassword({
        email: email.trim().toLowerCase(),
        otp: cleanOtp,
        newPassword,
      }).unwrap();

      toast.success(res?.message || 'Password reset successfully');
      setStep('success');
      if (onSuccess) {
        onSuccess(email.trim().toLowerCase());
      }
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to reset password. Please check your code.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === 'email'
          ? 'Reset Password'
          : step === 'otp'
          ? 'Verify Code & Set Password'
          : 'Password Reset Complete'
      }
      size="sm"
    >
      <div className="p-1">
        {step === 'email' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-volt-500/10 border border-volt-500/20 text-xs text-slate-700 dark:text-slate-300">
              <Mail className="w-5 h-5 text-volt-500 shrink-0" />
              <p>
                Enter your registered email address and we'll send you a 6-digit verification code to reset your password.
              </p>
            </div>

            <Input
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            <Button
              type="submit"
              loading={isSendingOtp}
              className="w-full py-2.5 text-sm font-bold shadow-md"
            >
              Send Verification Code
            </Button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="flex items-center justify-between text-xs px-1 text-slate-600 dark:text-slate-400">
              <span>
                Code sent to: <strong className="text-slate-900 dark:text-white">{email}</strong>
              </span>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-volt-600 dark:text-volt-400 font-semibold hover:underline"
              >
                Change
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="label">6-Digit Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="input text-center font-mono text-xl tracking-[0.5em] font-bold py-2.5"
                required
                autoFocus
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-2xs text-slate-500">Valid for 10 minutes</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isSendingOtp}
                  className="text-xs font-semibold text-volt-600 dark:text-volt-400 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isSendingOtp ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 relative">
              <label className="label">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="input pr-10 text-xs"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="input text-xs"
                required
                minLength={8}
              />
            </div>

            <div className="pt-2 space-y-2">
              <Button
                type="submit"
                loading={isResetting}
                className="w-full py-2.5 text-sm font-bold shadow-md"
              >
                Reset Password
              </Button>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center gap-1 py-1"
              >
                <ArrowLeft size={13} />
                Back to email entry
              </button>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-500">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Password Successfully Reset!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                Your account password has been updated. You can now sign in with your new credentials.
              </p>
            </div>

            <Button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-sm font-bold"
            >
              Back to Sign In
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
