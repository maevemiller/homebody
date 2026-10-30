export default function Chip({
  active,
  onClick,
  children,
  accent = "clay",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: "clay" | "sage";
}) {
  const activeClasses =
    accent === "clay"
      ? "border-clay bg-clay-tint text-ink"
      : "border-sage bg-sage-tint text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-4 py-2 rounded-full border text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-clay focus-visible:outline-offset-2 ${
        active
          ? activeClasses
          : "border-line text-ink-soft bg-surface hover:border-line-strong"
      }`}
    >
      {children}
    </button>
  );
}
