"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold text-zinc-100">Something went wrong</h1>
      <p className="mt-4 text-zinc-400">
        An error occurred while loading this page. If the problem persists, try again later or
        contact support.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-zinc-600">Error ID: {error.digest}</p>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-900"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
