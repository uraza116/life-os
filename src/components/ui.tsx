"use client";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Dialog } from "radix-ui";
import {
  BookOpen, Briefcase, Code, Dumbbell, Folder, FolderKanban, GraduationCap, HeartPulse, House, Lightbulb, Plane,
  Presentation, Rocket, ShoppingCart, Star, Users, Wallet, X, type LucideIcon,
} from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { COLOR_HEX } from "@/lib/constants";

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

const ICONS: Record<string, LucideIcon> = {
  Briefcase, GraduationCap, Presentation, Rocket, Lightbulb, Home: House, House, Wallet, HeartPulse, BookOpen, Folder,
  Star, Users, Plane, Code, ShoppingCart, Dumbbell, FolderKanban,
};
export function NamedIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Folder;
  return <I className={className} aria-hidden />;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "secondary", size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer whitespace-nowrap",
        size === "sm" && "h-7 px-2.5 text-xs",
        size === "md" && "h-8 px-3 text-sm",
        size === "icon" && "h-8 w-8 text-sm",
        variant === "primary" && "bg-accent text-accent-fg hover:opacity-90",
        variant === "secondary" && "border border-border bg-panel text-fg hover:bg-panel-2",
        variant === "ghost" && "text-muted hover:bg-panel-2 hover:text-fg",
        variant === "danger" && "border border-border bg-panel text-danger hover:bg-danger hover:text-white",
        className,
      )}
      {...props}
    />
  );
});

const field =
  "w-full rounded-md border border-border bg-panel px-2.5 text-sm text-fg placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(field, "h-8", className)} {...p} />;
});
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-20 py-2", className)} {...p} />;
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(field, "h-8 pr-7", className)} {...p}>
      {children}
    </select>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-1 text-xs font-medium text-muted", className)}>{children}</div>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-panel", className)}>{children}</div>;
}

export function Badge({ children, className, color }: { children: ReactNode; className?: string; color?: string }) {
  const hex = color ? COLOR_HEX[color] ?? color : undefined;
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted", className)}
      style={hex ? { color: hex, borderColor: `${hex}55`, background: `${hex}14` } : undefined}
    >
      {children}
    </span>
  );
}

export function Dot({ color, className }: { color?: string | null; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: COLOR_HEX[color ?? "slate"] ?? color ?? "#64748b" }} />;
}

export function Progress({ value, color }: { value: number; color?: string | null }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ? COLOR_HEX[color] ?? color : "var(--accent)" }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          {icon}
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-sm text-muted">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  className,
  side,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  side?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 border border-border bg-panel text-fg shadow-2xl focus:outline-none",
            side
              ? "inset-y-0 right-0 flex w-full max-w-xl flex-col"
              : "left-1/2 top-[12vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 rounded-xl",
            className,
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** 1–5 segmented picker used for importance / urgency / impact. */
export function LevelPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={cn(
              "h-7 flex-1 rounded-md border text-xs font-medium cursor-pointer",
              value === n ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-panel-2",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
