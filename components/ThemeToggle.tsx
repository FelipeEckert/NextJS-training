"use client";

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="shrink-0 rounded-md border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-100 hover:text-foreground dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
    >
      {/* The server cannot know the theme, so CSS picks the icon */}
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 dark:hidden"
      >
        <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9z" />
      </svg>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden size-4 dark:block"
      >
        <circle cx="10" cy="10" r="3.5" />
        <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6L16 16M4 16l1.4-1.4M14.6 5.4L16 4" />
      </svg>
    </button>
  );
}
