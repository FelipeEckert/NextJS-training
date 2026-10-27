"use client"; // error boundaries must be Client Components (the button needs a click)

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-2xl font-bold">Couldn&apos;t load exchange rates</h1>
      <p className="mt-2 text-zinc-500">
        The data source didn&apos;t respond. Please try again in a moment.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 rounded-lg bg-brand shadow-md shadow-indigo-500/20 px-4 py-2 text-white hover:brightness-110"
      >
        Try again
      </button>
    </main>
  );
}
