// src/components/ui/Avatar.tsx
import { clsx } from "clsx";

interface AvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = "md", className }) => {
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-xl",
  };
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return src ? (
    <img
      src={src}
      alt={name}
      className={clsx(
        "rounded-full object-cover ring-1 ring-white/10",
        sizes[size],
        className,
      )}
    />
  ) : (
    <div
      className={clsx(
        "rounded-full bg-pitch-600 border border-white/10 flex items-center justify-center font-display font-bold text-volt-400",
        sizes[size],
        className,
      )}
    >
      {initials}
    </div>
  );
};
