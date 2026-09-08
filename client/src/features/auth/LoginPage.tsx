// src/features/auth/LoginPage.tsx
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import logoSrc from '../../assets/logo.png';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { useLoginMutation } from '../../store/api/authApi';
import { setCredentials } from '../../store/slices/authSlice';
import { setActiveFranchise, clearActiveFranchise } from '../../store/slices/uiSlice';
import { clearNotifications } from '../../store/slices/notificationSlice';
import { baseApi } from '../../store/api/baseApi';
import { RootState } from '../../store';
import { Button, Input } from '../../components/ui';
import { ThemeToggle } from '../../components/common/ThemeToggle';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type LoginForm = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((s: RootState) => s.auth);
  const [login, { isLoading }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = async (data: LoginForm) => {
    try {
      const result = await login(data).unwrap();
      const loadedUser = result.data.user;
      dispatch(clearNotifications());
      dispatch(baseApi.util.resetApiState());
      dispatch(
        setCredentials({
          user: loadedUser,
          tokens: {
            accessToken: result.data.tokens.accessToken,
            refreshToken: result.data.tokens.refreshToken,
          },
        })
      );
      if (loadedUser.franchiseId) {
        dispatch(setActiveFranchise(loadedUser.franchiseId));
      } else if (loadedUser.role === 'manager') {
        dispatch(clearActiveFranchise());
      }
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-pitch-950 flex flex-col lg:flex-row relative transition-colors duration-200">
      {/* Top right theme switcher */}
      <div className="absolute top-5 right-6 z-30">
        <ThemeToggle size="md" />
      </div>

      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12 bg-gradient-to-br from-slate-100 via-white to-slate-200/90 dark:from-pitch-950 dark:via-pitch-900 dark:to-pitch-950 border-r border-slate-200 dark:border-white/10">
        {/* Background tactical lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-5"
            style={{
              backgroundImage: `
                repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(204,255,0,0.4) 60px, rgba(204,255,0,0.4) 61px),
                repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(204,255,0,0.4) 60px, rgba(204,255,0,0.4) 61px)
              `,
            }}
          />
          <div className="absolute inset-0 bg-volt-glow opacity-10 dark:opacity-30" />
        </div>

        {/* Diagonal accent bar */}
        <div
          className="absolute left-0 top-0 w-1.5 h-full bg-volt-500 dark:bg-volt-400"
          style={{ boxShadow: '0 0 35px rgba(204,255,0,0.5)' }}
        />

        {/* Top logo */}
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-pitch-800 p-1.5 shadow-sm border border-slate-200 dark:border-white/10 flex items-center justify-center">
              <img src={logoSrc} alt="Noxphere" className="w-full h-full object-contain drop-shadow" />
            </div>
            <div>
              <p className="font-display font-black text-slate-900 dark:text-white uppercase text-2xl tracking-wide leading-none">Noxphere</p>
              <p className="font-display font-bold text-volt-600 dark:text-volt-400 uppercase text-[10px] tracking-[0.3em] mt-0.5">Academy Operating System</p>
            </div>
          </Link>
        </div>

        {/* Center stats display */}
        <div className="relative z-10 space-y-6 my-auto py-10">
          <div>
            <p className="font-display font-900 text-slate-900 dark:text-white text-5xl uppercase leading-none tracking-tight">
              Manage Your<br />
              <span className="text-volt-500 dark:text-volt-400">Franchise.</span><br />
              Elevate Your<br />
              <span className="text-blue-600 dark:text-ice-400">Game.</span>
            </p>
          </div>

          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-sm">
            A unified tactical platform for live attendance, performance evaluations, fee management, squad coordination, and verified player profiles.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-1">
            {['Real-time Attendance', 'Performance Cards', 'Transfer Wall', 'Fee Tracking', 'Verified Profiles'].map((f) => (
              <span
                key={f}
                className="px-3 py-1 text-xs font-semibold rounded-full bg-white/90 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 shadow-xs"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom stat bar */}
        <div className="relative z-10 grid grid-cols-3 gap-4 border-t border-slate-200 dark:border-white/10 pt-6">
          {[
            { val: '5', label: 'User Roles' },
            { val: '∞', label: 'Players Tracked' },
            { val: '100%', label: 'Offline Ready' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display font-900 text-2xl text-slate-900 dark:text-volt-400">{s.val}</p>
              <p className="text-2xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white dark:bg-pitch-900/90 rounded-2xl border border-slate-200/90 dark:border-white/10 p-8 sm:p-10 shadow-xl dark:shadow-2xl space-y-6">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-3 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-pitch-800 p-1.5 shadow-sm border border-slate-200 dark:border-white/10 flex items-center justify-center">
              <img src={logoSrc} alt="Noxphere" className="w-full h-full object-contain drop-shadow" />
            </div>
            <div>
              <p className="font-display font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-base">Noxphere</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold">Access Portal</p>
            </div>
          </Link>

          {/* Header */}
          <div>
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-volt-400/20 text-slate-900 dark:text-volt-400 border border-volt-400/30 mb-2">
              Access Portal
            </span>
            <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-3xl uppercase tracking-tight">
              Sign In
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="user@noxphere.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-end">
              <button type="button" className="text-xs font-semibold text-volt-600 dark:text-volt-400 hover:underline">
                Forgot password?
              </button>
            </div>

            <Button type="submit" loading={isLoading} className="w-full py-3 text-sm font-bold shadow-md">
              Sign In
            </Button>
          </form>

          {/* Role indicators */}
          <div className="pt-4 border-t border-slate-200 dark:border-white/10">
            <p className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Platform Roles
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { role: 'Super Admin', color: 'bg-volt-500 dark:bg-volt-400' },
                { role: 'Manager', color: 'bg-blue-500 dark:bg-ice-400' },
                { role: 'Coach', color: 'bg-emerald-500 dark:bg-field-400' },
                { role: 'Guardian / Student', color: 'bg-amber-500 dark:bg-ember-400' },
              ].map((r) => (
                <div key={r.role} className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.color}`} />
                  <span className="truncate">{r.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transfer Wall public link */}
          <div className="text-center pt-2">
            <a
              href="/transfer-wall"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-ice-400 hover:underline"
            >
              <span>Explore Public Transfer Wall</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
