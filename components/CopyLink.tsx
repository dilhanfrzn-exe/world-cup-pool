"use client";

import { useState } from "react";

export function CopyLink({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context) — ignore.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg bg-slate-900/90 px-3 py-2 font-mono text-sm text-pitch-200">
        {label ?? value}
      </code>
      <button
        onClick={copy}
        className="shrink-0 rounded-lg bg-pitch-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-pitch-700"
        type="button"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
