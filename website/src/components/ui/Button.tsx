import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "nav" | "inverse";

type ButtonProps = {
  children: ReactNode;
  variant?: Variant;
  href?: string;
  comingSoon?: boolean;
  comingSoonLabel?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-panel shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_8px_20px_-10px_rgba(22,20,18,0.5)] hover:bg-[#2a2623] active:translate-y-px focus-visible:outline-ink",
  secondary:
    "border border-line bg-panel text-ink shadow-[0_1px_2px_rgba(22,20,18,0.04)] hover:border-ink/30 hover:bg-white active:translate-y-px focus-visible:outline-ink",
  ghost:
    "text-ink/80 hover:bg-ink/5 hover:text-ink active:translate-y-px focus-visible:outline-ink",
  nav: "border border-line bg-panel text-ink hover:border-ink/25 hover:bg-white active:translate-y-px focus-visible:outline-ink",
  inverse:
    "bg-panel text-ink shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_25px_-10px_rgba(0,0,0,0.3)] hover:bg-white active:translate-y-px focus-visible:outline-white",
};

export function Button({
  children,
  variant = "primary",
  href,
  comingSoon = false,
  comingSoonLabel = "Coming soon",
  className = "",
  type = "button",
  onClick,
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium tracking-tight transition-all",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer",
    variants[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href && !comingSoon) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      title={comingSoon ? comingSoonLabel : props.title}
      {...props}
    >
      {children}
    </button>
  );
}
