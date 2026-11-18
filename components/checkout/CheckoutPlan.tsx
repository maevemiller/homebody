"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RoomSpec } from "@/lib/scan/spec";
import { KINDS, KIND_LABEL, money, type Kind, type Product } from "@/lib/play/catalog";
import {
  LISTING_CREDIT, briefBits, cheaperTwin, closestListing, dimsText, planFor, productDims, readLookalikes,
  roomsWithLayouts, searchUrl, writeLookalikes, type BriefBits, type Listing, type NewLine, type RoomPlan,
} from "@/lib/checkout/plan";

// Transaction: review a room's new pieces and buy them at each retailer. No payments here.
// One room at /checkout/<id>, every room with a layout at /checkout/all.

const ALL = "all";
const BUDGET_KEY = "homebody-checkout-budget";

interface RoomBody {
  spec: RoomSpec | null;
  build: { seconds: number; renders?: string[] } | null;
}

async function loadPlan(id: string): Promise<RoomPlan | null> {
  const body: RoomBody | null = await fetch(`/api/rooms/${id}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!body?.spec) return null;
  const b = body.build;
  const hero = b && (!b.renders || b.renders.includes("render_dollhouse.png"))
    ? `/api/rooms/${id}/files/build/render_dollhouse.png?v=${b.seconds}`
    : undefined;
  return planFor(id, body.spec, hero);
}

function readBudget(): number | undefined {
  try {
    const n = Number(localStorage.getItem(BUDGET_KEY));
    return n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

/** What a line costs as chosen: the piece, or its cheaper lookalike. */
function chosen(l: NewLine, swapped: string[]): { product: Product; saving: number } {
  const twin = cheaperTwin(l);
  return twin && swapped.includes(l.key) ? { product: twin, saving: l.product.price - twin.price } : { product: l.product, saving: 0 };
}

function totals(plans: RoomPlan[], swaps: Record<string, string[]>) {
  let full = 0, saving = 0, count = 0, own = 0;
  for (const p of plans) {
    own += p.own.length;
    for (const l of p.lines) {
      const c = chosen(l, swaps[p.id] ?? []);
      full += l.product.price;
      saving += c.saving;
      count++;
    }
  }
  return { full, saving, total: full - saving, count, own };
}

export default function CheckoutPlan({ id }: { id: string }) {
  const all = id === ALL;
  const [plans, setPlans] = useState<RoomPlan[] | null>(null);
  const [failed, setFailed] = useState(false);
  // every room with a layout in this browser, for "room by room"
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [swaps, setSwaps] = useState<Record<string, string[]>>({});
  const [brief, setBrief] = useState<BriefBits>({});
  const [ownBudget, setOwnBudget] = useState<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = roomsWithLayouts();
      const wanted = all ? ids : [id];
      const loaded = (await Promise.all(wanted.map(loadPlan))).filter((p): p is RoomPlan => !!p);
      // the other rooms' names, for the room switcher (the ones already loaded don't need fetching again)
      const others = await Promise.all(
        ids.filter((r) => !loaded.some((p) => p.id === r)).map(async (r) => {
          const p = await loadPlan(r);
          return p && p.lines.length ? { id: r, name: p.name } : null;
        }),
      );
      if (!alive) return;
      if (!all && !loaded.length) return setFailed(true);
      setPlans(loaded);
      setRooms(
        [...loaded.filter((p) => p.lines.length || p.id === id).map((p) => ({ id: p.id, name: p.name })), ...others.filter((o): o is { id: string; name: string } => !!o)]
          .sort((a, b) => a.id.localeCompare(b.id)),
      );
      setSwaps(Object.fromEntries(loaded.map((p) => [p.id, readLookalikes(p.id)])));
      setBrief(briefBits(all ? "" : id));
      setOwnBudget(readBudget());
    })();
    return () => {
      alive = false;
    };
  }, [id, all]);

  const toggle = useCallback((room: string, key: string) => {
    setSwaps((s) => {
      const cur = s[room] ?? [];
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      writeLookalikes(room, next);
      return { ...s, [room]: next };
    });
  }, []);

  const saveBudget = useCallback((n: number | undefined) => {
    setOwnBudget(n);
    try {
      if (n) localStorage.setItem(BUDGET_KEY, String(n));
      else localStorage.removeItem(BUDGET_KEY);
    } catch {}
  }, []);

  const sum = useMemo(() => totals(plans ?? [], swaps), [plans, swaps]);

  if (failed) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 flex flex-col gap-4">
        <h1 className="text-title">We couldn&apos;t find that room</h1>
        <p className="text-ink-soft">It may have been made in another browser. Your rooms are listed here.</p>
        <Link href="/rooms" className="btn btn-primary self-start">Your rooms</Link>
      </div>
    );
  }
  if (!plans) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10" aria-busy="true">
        <p className="eyebrow text-ink-faint">Review and buy</p>
        <div className="mt-4 h-10 w-2/3 rounded-lg bg-surface-2 animate-pulse" />
        <div className="mt-8 aspect-[16/9] rounded-2xl bg-surface-2 animate-pulse" />
      </div>
    );
  }

  const single = !all ? plans[0] : undefined;
  const budget = brief.budget ?? ownBudget;
  const playHref = `/play/${single?.id ?? plans[0]?.id ?? ""}`;
  const title = all ? "All rooms" : brief.title || single?.name || "Your room";

  return (
    <div data-print-plan className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16 sm:pt-10 print:px-0 print:pt-0">
      {/* top bar: back to Play, print */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={playHref} className="link link-quiet text-sm min-h-11 inline-flex items-center gap-1.5">
          <span aria-hidden>←</span> Back to Plug &amp; Play
        </Link>
        <button className="btn btn-line btn-sm" onClick={() => window.print()}>Print the plan</button>
      </div>

      <header className="mt-6 sm:mt-8 flex flex-col gap-3 max-w-3xl">
        <p className="eyebrow text-ink-soft">Review and buy{single && brief.title ? ` · ${single.name}` : ""}</p>
        <h1 className="text-title sm:text-[2.75rem]">{title}</h1>
        {brief.idea && !all && <p className="text-lg text-ink-soft leading-relaxed">{brief.idea}</p>}
      </header>

      {rooms.length > 1 && <RoomSwitch rooms={rooms} current={id} />}

      {single?.hero && <Hero src={single.hero} name={single.name} />}

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14 print:block">
        <div className="flex flex-col gap-14 min-w-0">
          {plans.length === 0 && <Empty />}
          {plans.map((p) => (
            <RoomSection key={p.id} plan={p} heading={all} swapped={swaps[p.id] ?? []} onToggle={(k) => toggle(p.id, k)} />
          ))}
        </div>

        <aside className="min-w-0 flex flex-col gap-8 lg:sticky lg:top-20 lg:self-start print:mt-10">
          <Totals sum={sum} budget={budget} fromBrief={brief.budget !== undefined} label={brief.budgetLabel} onBudget={saveBudget} />
          <CartLinks plans={plans} swaps={swaps} />
        </aside>
      </div>

      <footer className="mt-16 pt-6 border-t flex flex-col gap-2 text-xs text-ink-faint leading-relaxed">
        <p>Prices marked &ldquo;est.&rdquo; are estimates from Homebody&apos;s sample catalog, not quotes. Check the price and size on the retailer&apos;s page before you buy.</p>
        <p>{LISTING_CREDIT}</p>
        <p className="hidden print:block">Printed from Homebody · {typeof window !== "undefined" ? window.location.origin : ""}/checkout/{id}</p>
      </footer>
    </div>
  );
}

function RoomSwitch({ rooms, current }: { rooms: { id: string; name: string }[]; current: string }) {
  const tabs = [...rooms, { id: ALL, name: "All rooms" }];
  return (
    <nav aria-label="Room by room" className="mt-6 -mx-4 px-4 overflow-x-auto print:hidden">
      <div className="flex gap-2 w-max">
        {tabs.map((r) => (
          <Link key={r.id} href={`/checkout/${r.id}`} className="chip" aria-pressed={r.id === current} aria-current={r.id === current ? "page" : undefined}>
            {r.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Hero({ src, name }: { src: string; name: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <figure className="mt-8 overflow-hidden rounded-2xl border bg-surface-2 print:rounded-none print:border-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${name}, as captured`} onError={() => setGone(true)} className="w-full aspect-[16/9] object-cover print:aspect-auto print:max-h-[9cm] print:object-contain" />
    </figure>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl bg-surface-2 p-8 flex flex-col gap-3 items-start">
      <h2 className="text-[1.5rem]">Nothing new yet</h2>
      <p className="text-ink-soft">Add pieces in Plug &amp; Play and they&apos;ll be listed here, with where to buy them.</p>
      <Link href="/rooms" className="btn btn-primary btn-sm">Your rooms</Link>
    </div>
  );
}

function RoomSection({ plan, heading, swapped, onToggle }: { plan: RoomPlan; heading: boolean; swapped: string[]; onToggle: (key: string) => void }) {
  const byKind = useMemo(() => {
    const m = new Map<Kind, NewLine[]>();
    for (const l of plan.lines) m.set(l.product.category, [...(m.get(l.product.category) ?? []), l]);
    return KINDS.filter((k) => m.has(k)).map((k) => [k, m.get(k)!] as const);
  }, [plan.lines]);
  const sub = totals([plan], { [plan.id]: swapped });

  return (
    <section className="flex flex-col gap-8 print:break-inside-auto" aria-labelledby={`room-${plan.id}`}>
      {heading ? (
        <div className="flex items-baseline justify-between gap-4 border-b pb-3">
          <h2 id={`room-${plan.id}`} className="text-[1.75rem]">
            <Link href={`/checkout/${plan.id}`} className="link">{plan.name}</Link>
          </h2>
          <span className="num text-sm text-ink-soft">{sub.count ? `${money(sub.total)} est.` : "Nothing new"}</span>
        </div>
      ) : (
        <h2 id={`room-${plan.id}`} className="sr-only">{plan.name}</h2>
      )}

      {plan.lines.length === 0 && !heading && <Empty />}

      {byKind.map(([kind, lines]) => (
        <div key={kind} className="flex flex-col">
          <h3 className="eyebrow text-ink-soft pb-2 border-b">
            {KIND_LABEL[kind]} <span className="num text-ink-faint">· {lines.length}</span>
          </h3>
          <ul className="divide-y">
            {lines.map((l) => (
              <LineCard key={l.key} line={l} on={swapped.includes(l.key)} onToggle={() => onToggle(l.key)} />
            ))}
          </ul>
        </div>
      ))}

      {plan.own.length > 0 && <OwnPieces plan={plan} />}
    </section>
  );
}

function LineCard({ line, on, onToggle }: { line: NewLine; on: boolean; onToggle: () => void }) {
  const twin = cheaperTwin(line);
  const { product, saving } = chosen(line, on ? [line.key] : []);
  const listing = useMemo(() => closestListing(product), [product]);
  const id = `look-${line.key}`;

  return (
    <li className="py-6 flex flex-col gap-4 print:break-inside-avoid">
      <div className="flex gap-4">
        <Swatch product={product} />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-[1.25rem] leading-tight">{product.name}</p>
            <p className="num shrink-0 text-right">
              {money(product.price)} <span className="text-xs text-ink-faint">est.</span>
            </p>
          </div>
          <p className="text-sm text-ink-soft">
            {product.maker} · <span className="num">{productDims(product)}</span>
          </p>
          {(line.replaces || !line.placed) && (
            <p className="text-sm text-ink-faint">
              {line.replaces ? `In place of your ${line.replaces.toLowerCase()}` : ""}
              {line.replaces && !line.placed ? " · " : ""}
              {!line.placed ? "Not placed yet" : ""}
            </p>
          )}
        </div>
      </div>

      {twin && (
        <div className="sm:ml-20 flex items-center justify-between gap-4 rounded-xl bg-surface-2 px-4 py-3 print:bg-transparent print:px-0 print:py-0">
          <label htmlFor={id} className="flex-1 min-w-0 text-sm cursor-pointer">
            <span className="block font-medium">Cheaper lookalike</span>
            <span className="block text-ink-soft">
              {on ? `Using ${twin.name} instead of ${line.product.name}, ` : `${twin.name}, ${money(twin.price)}: `}
              <span className="num text-ink">saves {money(line.product.price - twin.price)}</span>
            </span>
          </label>
          <Switch id={id} on={on} onToggle={onToggle} />
        </div>
      )}
      {saving > 0 && <span className="sr-only">Saving {money(saving)}</span>}

      <BuyRow listing={listing} product={product} />
    </li>
  );
}

function Switch({ id, on, onToggle }: { id: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative shrink-0 h-8 w-[3.25rem] rounded-full transition-colors duration-200 print:hidden ${on ? "bg-clay" : "bg-line-strong"}`}
    >
      <span
        aria-hidden
        className={`absolute top-1 left-1 h-6 w-6 rounded-full shadow transition-transform duration-200 ${on ? "translate-x-5 bg-[var(--on-clay)]" : "bg-white"}`}
      />
    </button>
  );
}

function BuyRow({ listing, product }: { listing?: Listing; product: Product }) {
  if (!listing) {
    return (
      <div className="sm:ml-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span className="text-ink-soft">No real listing for this one yet.</span>
        <a href={searchUrl(product)} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 min-h-11 print-url">
          Search on Amazon <span aria-hidden>↗</span>
        </a>
      </div>
    );
  }
  return (
    <div className="sm:ml-20 flex gap-3 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={listing.image} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg border bg-white object-contain" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="text-ink-faint text-xs">Closest real listing</p>
        <p className="truncate">{listing.name}</p>
        <p className="text-ink-soft">
          {listing.brand} · {listing.retailer} · <span className="num">{dimsText(listing.dims, product.category)}</span>
        </p>
        <p className="text-ink-faint text-xs">Price on {listing.retailer}</p>
      </div>
      <a href={listing.url} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-sm shrink-0 print-url" aria-label={`View ${listing.name} on ${listing.retailer}`}>
        View <span aria-hidden>↗</span>
      </a>
    </div>
  );
}

function OwnPieces({ plan }: { plan: RoomPlan }) {
  const [open, setOpen] = useState(false);
  const body = `own-${plan.id}`;
  return (
    <div className="rounded-2xl border">
      <button
        className="w-full flex items-center justify-between gap-4 min-h-14 px-5 py-3 text-left print:hidden"
        aria-expanded={open}
        aria-controls={body}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          <span className="font-medium">Your pieces stay</span>
          <span className="text-ink-soft"> · {plan.own.length}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="num">$0</span>
          <span aria-hidden className={`text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
        </span>
      </button>
      <p className="hidden print:block px-5 pt-3 font-medium">Your pieces stay · $0</p>
      <ul id={body} className={`${open ? "" : "hidden"} print:block border-t print:border-0 divide-y px-5`}>
        {plan.own.map((o) => (
          <li key={o.key} className="flex items-center justify-between gap-4 py-3 text-sm">
            <span>
              {o.name}
              {o.brought && <span className="text-ink-faint"> · bringing</span>}
            </span>
            <span className="num text-ink-soft">$0</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Totals({
  sum, budget, fromBrief, label, onBudget,
}: {
  sum: ReturnType<typeof totals>;
  budget?: number;
  fromBrief: boolean;
  label?: string;
  onBudget: (n: number | undefined) => void;
}) {
  const share = budget ? sum.total / budget : 0;
  const over = budget !== undefined && sum.total > budget;
  return (
    <section aria-labelledby="totals" className="rounded-2xl bg-surface-2 p-6 flex flex-col gap-5 print:bg-transparent print:border print:break-inside-avoid">
      <h2 id="totals" className="text-[1.5rem]">The total</h2>
      <dl className="flex flex-col gap-2 text-sm">
        <Row label={`New pieces · ${sum.count}`} value={`${money(sum.full)}`} />
        {sum.saving > 0 && <Row label="Lookalike savings" value={`−${money(sum.saving)}`} />}
        <Row label={`Your pieces · ${sum.own}`} value="$0" />
        <div className="border-t border-line-strong mt-2 pt-3 flex items-baseline justify-between gap-4">
          <dt className="font-medium">Estimated total</dt>
          <dd className="num font-display text-[1.75rem] leading-none">{money(sum.total)}</dd>
        </div>
      </dl>

      {budget !== undefined ? (
        <div className="flex flex-col gap-2">
          <div
            role="meter"
            aria-label="Spent against your budget"
            aria-valuemin={0}
            aria-valuemax={budget}
            aria-valuenow={Math.round(sum.total)}
            aria-valuetext={`${money(sum.total)} of ${money(budget)}`}
            className="relative h-2 rounded-full bg-line-strong overflow-hidden print:border"
          >
            <div className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-rust" : "bg-clay"}`} style={{ width: `${Math.min(100, share * 100)}%` }} />
          </div>
          <p className="text-sm flex justify-between gap-3">
            <span className="text-ink-soft">Budget {money(budget)}{fromBrief ? ", from your brief" : ""}</span>
            <span className={`num ${over ? "text-rust" : ""}`}>{over ? `${money(sum.total - budget)} over` : `${money(budget - sum.total)} left`}</span>
          </p>
          {!fromBrief && (
            <button className="link link-quiet text-xs self-start min-h-8 print:hidden" onClick={() => onBudget(undefined)}>Change the budget</button>
          )}
        </div>
      ) : (
        <BudgetField label={label} onBudget={onBudget} />
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

function BudgetField({ label, onBudget }: { label?: string; onBudget: (n: number) => void }) {
  const [text, setText] = useState("");
  const n = Number(text.replace(/[^\d.]/g, ""));
  return (
    <form
      className="flex flex-col gap-2 print:hidden"
      onSubmit={(e) => {
        e.preventDefault();
        if (n > 0) onBudget(n);
      }}
    >
      <label htmlFor="budget" className="text-sm text-ink-soft">
        {label ? `Your brief says "${label.toLowerCase()}". ` : ""}What figure should this stay under?
      </label>
      <div className="flex gap-2">
        <input id="budget" inputMode="numeric" placeholder="$3,000" value={text} onChange={(e) => setText(e.target.value)} className="field flex-1 min-w-0" />
        <button className="btn btn-primary" disabled={!(n > 0)}>Set</button>
      </div>
    </form>
  );
}

function CartLinks({ plans, swaps }: { plans: RoomPlan[]; swaps: Record<string, string[]> }) {
  // one group per retailer, each listing once; pieces with no real listing get a search
  const { groups, searches } = useMemo(() => {
    const g = new Map<string, Map<string, Listing>>();
    const s: Product[] = [];
    for (const p of plans) {
      for (const l of p.lines) {
        const { product } = chosen(l, swaps[p.id] ?? []);
        const listing = closestListing(product);
        if (!listing) {
          if (!s.some((x) => x.id === product.id)) s.push(product);
          continue;
        }
        const m = g.get(listing.retailer) ?? new Map<string, Listing>();
        m.set(listing.id, listing);
        g.set(listing.retailer, m);
      }
    }
    return { groups: [...g].map(([retailer, m]) => ({ retailer, listings: [...m.values()] })), searches: s };
  }, [plans, swaps]);

  if (!groups.length && !searches.length) return null;
  const openAll = (urls: string[]) => urls.forEach((u) => window.open(u, "_blank", "noopener"));

  return (
    <section aria-labelledby="cart-links" className="flex flex-col gap-5 print:break-inside-avoid">
      <div className="flex flex-col gap-1">
        <h2 id="cart-links" className="text-[1.5rem]">Open cart links</h2>
        <p className="text-sm text-ink-soft leading-relaxed">
          Checkout happens at each retailer for now. Homebody doesn&apos;t take payment; each link opens the piece on the store&apos;s own page.
        </p>
      </div>
      {groups.map((g) => (
        <div key={g.retailer} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">{g.retailer} <span className="num text-ink-faint font-normal">· {g.listings.length}</span></h3>
            {g.listings.length > 1 && (
              <button className="btn btn-primary btn-sm print:hidden" onClick={() => openAll(g.listings.map((l) => l.url))}>
                Open all {g.listings.length}
              </button>
            )}
          </div>
          <ul className="flex flex-col divide-y border-y text-sm">
            {g.listings.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-3 min-h-11 py-2 print-url">
                  <span className="truncate min-w-0">{l.name}</span>
                  <span aria-hidden className="text-ink-faint group-hover:text-ink">↗</span>
                </a>
              </li>
            ))}
          </ul>
          {g.listings.length > 1 && <p className="text-xs text-ink-faint print:hidden">If only one opens, allow pop-ups for this site.</p>}
        </div>
      ))}
      {searches.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">To find <span className="num text-ink-faint font-normal">· {searches.length}</span></h3>
          <ul className="flex flex-col divide-y border-y text-sm">
            {searches.map((p) => (
              <li key={p.id}>
                <a href={searchUrl(p)} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-3 min-h-11 py-2 print-url">
                  <span className="truncate min-w-0">Search: {p.name}</span>
                  <span aria-hidden className="text-ink-faint group-hover:text-ink">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* TODO(affiliate): replace with the real FTC disclosure once links are affiliate links (docs/reference/sourcing/README.md) */}
      <p className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-xs text-ink-soft leading-relaxed">
        <span className="eyebrow text-ink">TODO · Affiliate disclosure</span>
        <br />
        These are plain links today. When they become affiliate links, this says so here: Homebody may earn a commission when you buy through them, at no cost to you.
      </p>
    </section>
  );
}

// ---- A small drawing of each piece, in its own colors (the sample catalog has no photos) ----

function Swatch({ product: p }: { product: Product }) {
  const c = p.color, a = p.accent;
  const line = "var(--line-strong)";
  const shapes: Record<Kind, React.ReactNode> = {
    sofa: (
      <>
        <rect x="10" y="22" width="44" height="14" rx="4" fill={c} stroke={line} />
        <rect x="8" y="32" width="48" height="12" rx="3" fill={c} stroke={line} />
        <path d="M14 44 V49 M50 44 V49" stroke={a} strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
    chair: (
      <>
        <rect x="18" y="18" width="28" height="18" rx="6" fill={c} stroke={line} />
        <rect x="16" y="32" width="32" height="11" rx="3" fill={c} stroke={line} />
        <path d="M20 43 V50 M44 43 V50" stroke={a} strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
    rug: (
      <>
        <rect x="8" y="18" width="48" height="28" rx="1.5" fill={c} stroke={line} />
        <rect x="13" y="23" width="38" height="18" rx="1" fill="none" stroke={a} strokeOpacity="0.6" />
      </>
    ),
    lamp: (
      <>
        <path d="M22 14 H42 L46 28 H18 Z" fill={c} stroke={line} />
        <path d="M32 28 V48" stroke={a} strokeWidth="2" />
        <rect x="24" y="48" width="16" height="3" rx="1.5" fill={a} />
      </>
    ),
    table: (
      <>
        <rect x="10" y="26" width="44" height="6" rx="2" fill={c} stroke={line} />
        <path d="M16 32 V46 M48 32 V46" stroke={a} strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    shelf: (
      <>
        <rect x="18" y="10" width="28" height="44" rx="1" fill="none" stroke={c} strokeWidth="3" />
        <path d="M19 21 H45 M19 32 H45 M19 43 H45" stroke={c} strokeWidth="2" />
        <rect x="23" y="14" width="4" height="7" fill={a} />
        <rect x="36" y="36" width="6" height="7" fill={a} />
      </>
    ),
    art: (
      <>
        <rect x="14" y="10" width="36" height="44" rx="1" fill="#fff" stroke={a} strokeWidth="2" />
        {(p.art?.length ? p.art : [c, a]).slice(0, 3).map((col, i) => (
          <rect key={i} x={20 + i * 6} y={18 + i * 9} width={18 - i * 2} height={14 - i * 2} fill={col} opacity="0.9" />
        ))}
      </>
    ),
  };
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="h-16 w-16 shrink-0 rounded-xl bg-surface-2 print:border print:bg-transparent">
      {shapes[p.category]}
    </svg>
  );
}
