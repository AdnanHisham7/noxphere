// src/components/common/ThemeToggle.tsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Sun, Moon } from 'lucide-react';
import { RootState } from '../../store';
import { toggleTheme } from '../../store/slices/uiSlice';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', size = 'md' }) => {
  const dispatch = useDispatch();
  const theme = useSelector((s: RootState) => s.ui.theme);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => dispatch(toggleTheme())}
      title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
      aria-label="Toggle theme mode"
      className={`relative inline-flex items-center justify-center rounded-lg transition-all duration-200 border ${
        size === 'sm' ? 'w-8 h-8 p-1' : 'w-9 h-9 p-1.5'
      } ${
        isDark
          ? 'bg-pitch-800 border-white/10 text-volt-400 hover:text-white hover:border-white/20 hover:bg-pitch-700 shadow-sm'
          : 'bg-white border-slate-200 text-amber-500 hover:text-amber-600 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
      } ${className}`}
    >
      {isDark ? (
        <Sun
          size={size === 'sm' ? 14 : 16}
          className="transition-transform duration-300 rotate-0 hover:rotate-45"
        />
      ) : (
        <Moon
          size={size === 'sm' ? 14 : 16}
          className="transition-transform duration-300 -rotate-12 hover:rotate-0"
        />
      )}
    </button>
  );
};

export default ThemeToggle;
