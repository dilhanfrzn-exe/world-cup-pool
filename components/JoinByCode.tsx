"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "./forms";

export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean) router.push(`/room/${clean}`);
  }

  return (
    <form onSubmit={go} className="flex gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABC123"
        maxLength={8}
        className={`${inputClass} font-mono tracking-widest`}
      />
      <button
        type="submit"
        className="shrink-0 rounded-xl bg-pitch-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pitch-700"
      >
        Go
      </button>
    </form>
  );
}
