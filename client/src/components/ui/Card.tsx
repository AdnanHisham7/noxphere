import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  hover,
  onClick,
}) => (
  <div
    className={cn(hover ? "card-hover cursor-pointer" : "card p-4", className)}
    onClick={onClick}
  >
    {children}
  </div>
);

