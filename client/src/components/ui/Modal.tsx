// src/components/ui/Modal.tsx
import { clsx } from "clsx";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}) => {
  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={clsx(
          "relative card shadow-panel w-full animate-slide-up",
          sizes[size],
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="font-display font-bold text-white uppercase tracking-wide">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="btn-ghost text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};
