import Link from "next/link";

export function RoomNav({
  code,
  active,
  isAdmin = false,
  showTrade = false,
  tradeCount = 0,
}: {
  code: string;
  active: "room" | "results" | "standings" | "admin" | "trade";
  isAdmin?: boolean;
  showTrade?: boolean;
  tradeCount?: number;
}) {
  const tabs: { key: typeof active; label: string; href: string }[] = [
    { key: "room", label: "Room", href: `/room/${code}` },
    { key: "results", label: "Draw", href: `/room/${code}/results` },
    { key: "standings", label: "Standings", href: `/room/${code}/standings` },
  ];
  if (showTrade) {
    tabs.push({ key: "trade", label: "Trade", href: `/room/${code}/trade` });
  }
  if (isAdmin) {
    tabs.push({ key: "admin", label: "Admin", href: `/room/${code}/admin` });
  }

  return (
    <nav className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`relative flex-1 rounded-lg px-3 py-2 text-center transition ${
            active === t.key
              ? "bg-white text-pitch-700 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {t.label}
          {t.key === "trade" && tradeCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white"
              aria-label={`${tradeCount} incoming trade${tradeCount === 1 ? "" : "s"}`}
            >
              {tradeCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
