const STEPS = [
  { n: "01", label: "Intake" },
  { n: "02", label: "Preview" },
  { n: "03", label: "Functional" },
  { n: "04", label: "Style" },
  { n: "05", label: "Results" },
];

export default function ProgressRail({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 mb-10">
      {STEPS.map((s, i) => {
        const idx = i + 1;
        const active = idx === current;
        const done = idx < current;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={`mono text-[11px] ${
                active ? "text-clay" : done ? "text-sage" : "text-ink-faint"
              }`}
            >
              {s.n}
            </span>
            <span
              className={`text-[13px] ${
                active ? "text-ink font-medium" : "text-ink-faint"
              }`}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
