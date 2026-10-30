// Line icons for the Plug & Play toolbar, drawn on a 24px grid with a 1.8 stroke
const PATHS = {
  back: "M15 5l-7 7 7 7",
  undo: "M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2",
  redo: "M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h2",
  turnLeft: "M4 4v5h5M4.6 9A8 8 0 1 1 6 17.3",
  turnRight: "M20 4v5h-5M19.4 9A8 8 0 1 0 18 17.3",
  nudge: "M12 4a8 8 0 1 1-7.4 5M4 4.5V9h4.5M12 12l3-3",
  swap: "M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7",
  tray: "M4 13l2.5-7h11L20 13M4 13v6h16v-6M4 13h4.5l1 2h5l1-2H20",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  close: "M6 6l12 12M18 6L6 18",
  cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
  plan: "M4 4h16v16H4zM4 11h8v9M12 4v4",
  raise: "M12 19V5M6 11l6-6 6 6",
  lower: "M12 5v14M6 13l6 6 6-6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
