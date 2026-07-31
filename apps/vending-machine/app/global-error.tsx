"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="text-4xl font-semibold">Critical Error</h1>
          <p className="mt-4 text-zinc-400">
            The application encountered a critical error. Please try again.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-xs text-zinc-600">Error ID: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
          >
            Reload application
          </button>
        </main>
      </body>
    </html>
  );
}
