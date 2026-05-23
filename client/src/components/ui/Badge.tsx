// src/components/ui/Badge.tsx
type BadgeVariant = "green" | "red" | "blue" | "yellow" | "gray";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = "gray", children }) => {
  const variants: Record<BadgeVariant, string> = {
    green: "pill-green",
    red: "pill-red",
    blue: "pill-blue",
    yellow: "pill-yellow",
    gray: "pill-gray",
  };
  return <span className={variants[variant]}>{children}</span>;
};
