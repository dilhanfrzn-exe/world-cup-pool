"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const styles: Record<string, string> = {
    primary: "bg-pitch-600 text-white hover:bg-pitch-700",
    secondary:
      "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
  };
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
    >
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}
