"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  FunctionalInfo,
  HomebodyState,
  IntakeAnswers,
  InventoryItem,
  RoomFunctionalInfo,
  RoomId,
  StyleAnswers,
} from "./types";

const STORAGE_KEY = "homebody-state-v2";

const EMPTY_STATE: HomebodyState = {
  step: 0,
  intake: { rooms: [], mode: null, priorities: [], timeline: null, photos: [] },
  style: { aesthetics: [], palette: null, story: "" },
  functional: {},
  inventory: [],
  swaps: {},
};

interface Ctx {
  state: HomebodyState;
  hydrated: boolean;
  setIntake: (patch: Partial<IntakeAnswers>) => void;
  setStyle: (patch: Partial<StyleAnswers>) => void;
  setFunctionalRoom: (room: RoomId, info: RoomFunctionalInfo) => void;
  setSwap: (room: RoomId, category: string, itemId: string) => void;
  addInventoryItem: (item: InventoryItem) => void;
  removeInventoryItem: (id: string) => void;
  reset: () => void;
}

const HomebodyContext = createContext<Ctx | null>(null);

export function HomebodyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HomebodyState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-shot sync from localStorage, an external system unavailable
    // during SSR — this is the documented pattern for it, not state we
    // could derive during render.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState({ ...EMPTY_STATE, ...JSON.parse(raw) });
    } catch {
      // ignore — start from empty state
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — proceed with in-memory state only
    }
  }, [state, hydrated]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      hydrated,
      setIntake: (patch) =>
        setState((s) => ({ ...s, intake: { ...s.intake, ...patch } })),
      setStyle: (patch) =>
        setState((s) => ({ ...s, style: { ...s.style, ...patch } })),
      setFunctionalRoom: (room, info) =>
        setState((s) => ({
          ...s,
          functional: { ...s.functional, [room]: info } as FunctionalInfo,
        })),
      setSwap: (room, category, itemId) =>
        setState((s) => ({
          ...s,
          swaps: { ...s.swaps, [`${room}::${category}`]: itemId },
        })),
      addInventoryItem: (item) =>
        setState((s) => ({ ...s, inventory: [...s.inventory, item] })),
      removeInventoryItem: (id) =>
        setState((s) => ({
          ...s,
          inventory: s.inventory.filter((i) => i.id !== id),
        })),
      reset: () => setState(EMPTY_STATE),
    }),
    [state, hydrated]
  );

  return (
    <HomebodyContext.Provider value={value}>{children}</HomebodyContext.Provider>
  );
}

export function useHomebody() {
  const ctx = useContext(HomebodyContext);
  if (!ctx) throw new Error("useHomebody must be used within HomebodyProvider");
  return ctx;
}
