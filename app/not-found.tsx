import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <div className="text-5xl">🔍⚽️</div>
      <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
        Pool not found
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        That room code doesn&apos;t match any pool. Double-check the link or
        create a new one.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <LinkButton href="/">Home</LinkButton>
        <LinkButton href="/create" variant="secondary">
          Create a pool
        </LinkButton>
      </div>
    </div>
  );
}
