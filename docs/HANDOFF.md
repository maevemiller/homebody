# Homebody: handoff (read this first)

This file lets any new session, editor or person pick up with no prior context. Keep it current: every session ends
by updating this file, `docs/SESSION-HISTORY.md` and `docs/BACKLOG.md`, then commits and pushes (see "The
self-preserving loop").

## What Homebody is

An AI interior designer. The north star is to democratize the experience of hiring a polished, warm, thoughtful
interior designer. Owner: Maeve Miller (GitHub `maevemiller`). Repo: https://github.com/maevemiller/homebody (public;
the working branch is `homebody-build`).

It has four pieces, with code names:

1. **Space Capture** (`/`, `components/CaptureFlow.tsx`, `lib/scan/*`, `blender/`). Photos, video, measurements → Claude
   reads the room into a spec → Blender builds a to-scale room (glb + renders) → Keep / Move / Remove sorting → review.
2. **Taste Builder** (`/taste`, `components/taste/*`, `lib/taste/*`). A live designer interview run by Claude Sonnet,
   with the ElevenLabs voice "Lily":
   - three sections (Who you are / Space and style / Extras);
   - a 2, 5 or 15 minute length choice;
   - visual sets with "I'm not sure" exploration;
   - a notes sheet;
   - a design brief (program, constraints, direction, key decisions with "Why", nevers, open questions);
   - corrections applied as line edits.
3. **Plug & Play** (`/play/[id]`, `components/play/*`, `lib/play/*`). A game-like 3D editor:
   - placement by function;
   - built-ins fixed;
   - Swap with cheaper twins;
   - a cost pill;
   - a tray.
4. **Transaction** (`/checkout/[id]`, `/checkout/all`, `components/checkout/*`, `lib/checkout/*`). Review and buy room by room, with retailer links; no payments yet.

Other pages:
- `/demo`: a guided tour for Maeve.
- `/demo/type`: type specimens.
- `/rooms`, `/rooms/[id]`: the room list and room view (`?dev=1` shows dev tools).
- `/taste?dev=1`: the hidden "What Homebody assumes about me" panel. Dev only, never in production.

## How to run

```
npm install
npm run fonts      # Fontshare fonts (license forbids committing them)
npm run assets     # Poly Haven CC0 textures/HDRIs into blender/assets
npx next dev -p 3100
```

- **Blender:** 5.2.3 at `/Applications/Blender.app`. Override with `BLENDER_PATH`.
- **`.env.local`** (never commit, never print):
  - `ANTHROPIC_API_KEY`
  - `ELEVENLABS_API_KEY`
  - `ELEVENLABS_VOICE_ID`: currently Lily, `pFZP5JQG7iQjIQuC4Bku`
  - optional: `CAPTURE_BUDGET_USD`, `TASTE_DAILY_CALLS`
- **Free test room:** `/?sample=1` builds the sample room for free. Good test rooms:
  - `202610271128-dzjy` (sample);
  - `202610291233-9swx` (cabin, from CC BY photos).
- **Checks:** `npx tsc --noEmit`, `npx eslint <files>`.

## Where things are written down

| File | What it holds |
|---|---|
| `docs/product-vision.md` | Product direction and every decision Maeve made, with dates. The source of truth. |
| `docs/BACKLOG.md` | Prioritized open work. |
| `docs/SESSION-HISTORY.md` | Chronological history of every session: what was asked, built and decided. |
| `docs/autoloop/log.md` | Detailed step-by-step loop log, with Maeve's feedback verbatim-ish. |
| `docs/autoloop/critique.md` | Every design-critic review, with verdicts. |
| `docs/taste-builder.md`, `docs/voice-plan.md` | Taste Builder and voice design notes. |
| `docs/reference/interior-design/` | Intake research, question bank, styles, palettes, learning taste, dossier, craft standards. |
| `docs/reference/design-principles/` | Design canon: 15 rules, color (with Wada Sanzō data), space, materials, lighting, people, coherence (ripple engine), storage plan. |
| `docs/reference/sourcing/` | Real-product sourcing plan and seed catalog (Amazon Berkeley Objects, CC BY 4.0). |
| `docs/reference/capture/` | Photoreal capture research and plan. |
| `docs/social/` | Build-in-public settings (`project.md`), workflow notes, and dated digests (drafts; Maeve signs off before posting). |
| `.claude/agents/design-critic.md`, `next-step.md` | The loop's reviewer and planner agents. |
| `~/.claude/skills/build-in-public/`, `~/.claude/agents/social-media-manager.md` | Reusable build-in-public skill and agent (user-level, outside the repo). |

## Maeve's standing preferences (follow these)

- **Taste and craft:**
  - Interior design craft, never fluff. Every note or brief line is a decision with its reason; no AI filler words.
  - Look: monochrome minimal (white and near-black, neutral greys) with an elegant serif (Gambetta) and a refined sans
    (Switzer). Not SF or "tech startup", and no green or cream.
  - Never ask "what's your style?". Show images and infer; designer-style intake.
- **Interaction:**
  - Feedback must be effortless (like/dislike, short nudges), never a burden.
  - One question at a time in flows; voice-first with typing available.
- **The hidden profile:** it stays hidden from users (dev panel only).
- **Hard rules:**
  - No installs without asking.
  - No paid photo reads beyond what she approved: $10 cap, about $8.70 left.
  - No long high-quality renders without OK.
  - Never read or print `.env.local`.
  - Never post publicly without sign-off on that specific post.
  - Don't browse her private Desktop folder (journal).
- **Backups:** commit and push to `homebody-build` at each checkpoint. Never commit `.env*`, `data/`,
  `blender/assets/` or Fontshare font files. Keep unapproved social drafts out of commits; ask her about `docs/social`
  visibility.

## Current state (2026-10-30)

| Piece | State |
|---|---|
| Space Capture | Critic YES before the latest fixes. Since then: real-room-only builds, photo coverage checks asking for more photos, sort gating, "Change something" on the review, video upload. Not re-reviewed. |
| Taste Builder | Live designer works; corrections are line edits. Done 2026-11-18: "which could you live in" shows **her own room restyled 9 ways** (`lib/taste/styleviews.ts` presets, rendered offscreen by `lib/taste/styleviews-render.ts` from the room's glb at an eye-level corner view, cached per build in localStorage; stock photos when there's no room or no WebGL); the **"How you shop" sheet** in Extras (5 one-tap steps, structured `taste.shopping` per `lib/taste/shopping.ts`, part of the Extras minimum, a **Sourcing** row in the brief with "Change"); after confirming, **"Furnish my room"** goes to `/play/<roomId>?from=brief`. Verified offline (503 stub) at 390×844 and desktop, with WebGL off, and in one live Standard conversation (13 calls). Last critic verdict NO predates all this; not re-reviewed. |
| Plug & Play | v2 built (2026-11-18). **Design engine** `lib/design/`: `rules.ts` (the 15 rules as validators: a 10 cm walkway grid joining every door, focal facing, conversation and lamp reach, coffee table 1/2–2/3 and 14–18", rug legs, storage clearance, color roles, accent repetition, undertone, wood and metal counts, light sources, art height, balance, pets and kids fabrics, kept pieces and stated reasons), `color.ts` (Lab, ΔE2000, LRV, undertone, Wada matches by Lab distance from an anchor), `ripple.ts` (roles, `DesignState`, ripple proposals capped at 3, never touching locks, her picks or large anchors). **The room starts furnished**: `lib/play/proposal.ts` reads the program from the room type, size and brief, places her "move it" pieces and fills the gaps in designer order with `placement.ts`, and rejects any piece that adds a hard rule failure (or a coffee table out of reach); every piece carries a reason, shown when tapped. Kept pieces stay, removed ones are gone. `?from=brief` shows a 3-step skippable walkthrough. **Real products**: the ABO seed is merged into the catalog (26 pieces; beds, pendants, table lamps and planters have no slot yet) as parametric models at their real sizes, with listing photos, "Amazon.com, CC BY 4.0", a "View listing" link and estimates labelled "Est." / "≈"; ranked by `taste.shopping` (brands liked and avoided, Amazon weight, tier, splurge), taste picks, her taps and Wada fit with the kept colors (`lib/play/rank.ts`). **Feedback**: like and dislike on any piece; "Change this" (chips for budget, color, style, material, size and shape, plus typed or spoken words via Web Speech) gives 3–5 alternatives and says when nothing fully matches; words are read locally first, and only the rest goes to `app/api/play/interpret` (Sonnet, its own daily cap `PLAY_DAILY_CALLS`, default 60; log in `data/usage/play.jsonl`). A nudge appears after 3 dislikes. The ripple toggle ("Just this piece" / "Let the room follow") applies up to 3 follow-on swaps with reasons in a Keep / Undo bar. The swipe deck "Teach me your taste" updates `homebody-play-prefs` and re-furnishes only the unchosen proposal pieces. "Ask your designer" links to `/taste?section=…&topic=…&from=play&room=…&back=…`, and "Add to my brief" saves to `homebody-brief-additions`. "Review and buy" goes to `/checkout/<id>`; the layout is still saved to `homebody-layout-<id>` (now with `proposedAt`, `proposed`, `why`, `chosen`). Verified headless at 390×844 and 1440 on both test rooms; one live interpret call. Not critic-reviewed. **Open:** `/taste` doesn't read `section`/`topic`/`back` or `homebody-brief-additions` yet (Taste Builder's side). Estimates are typical-price guesses per type. No dining group or bedroom furniture is proposed. Product names are long listing titles. |
| Transaction | First cut built (2026-11-14): `/checkout/<id>` and `/checkout/all` (`components/checkout/CheckoutPlan.tsx`, `lib/checkout/plan.ts`). Reads the Plug & Play layout (`homebody-layout-<id>`, reconciled the way Play opens it). Shows: the dollhouse render and the brief's idea line; new pieces by category, each with a drawn swatch, sample price as a labelled "est.", a "Cheaper lookalike" switch (catalog twins, savings shown, kept in `homebody-checkout-<id>`) and the closest real ABO listing (photo, brand, Amazon, inches, "Price on Amazon", link; art gets a labelled search link); "Your pieces stay" collapsed at $0; totals with a budget meter (a $ figure parsed from the brief, else a field saved to `homebody-checkout-budget`); room chips plus All rooms; "Open cart links" grouped by retailer, a no-payments note and a TODO affiliate disclosure; a print stylesheet (in `app/globals.css`). Verified headless at 390 and 1440, light and dark. Not critic-reviewed. Open: real prices need the Creators API; the sample-to-real match is by kind, material, color and width, so a lookalike and its original can map to the same listing. |
| Real capture | Three CC BY test rooms rebuilt, with matched-view scores. Needs Maeve's own photos. |
| Social | Day 4 (10-29) and Day 5 (10-30) digests drafted; awaiting her sign-off. The Day 4 draft is visible in the public repo; Day 5 is held out. |

## The self-preserving loop

- **How it ran:** a session timer (CronCreate, session-only, expires after 7 days) fired every 20 minutes with the
  "Homebody autoloop tick" prompt (see `docs/autoloop/log.md` and the agents in `.claude/agents/`). Each tick:
  1. do the logged next step;
  2. verify (tsc, lint, browser at 390×844 and desktop);
  3. design-critic review → make its changes;
  4. next-step agent → checkpoint (`scripts/checkpoint.sh`) and decide.
- **In a new session,** recreate the timer only if Maeve wants the loop running.
- **Every session must end by:**
  1. updating `docs/HANDOFF.md` (current state), `docs/BACKLOG.md` and `docs/SESSION-HISTORY.md` (a dated entry);
  2. running `npx tsc --noEmit`;
  3. committing to `homebody-build` and running `git push origin homebody-build`.

  When usage is running low, do this before anything else.
- **Usage limits:** agents stop when the session limit hits. Resume them afterward by messaging them, or by starting
  fresh from this file.

## Open questions for Maeve

1. Approve or adjust the Day 4 and Day 5 threads. Should `docs/social` drafts be visible in the public repo?
2. Typeface: confirm Gambetta + Switzer, or choose another at `/demo/type`.
3. Send her own room photos or a walkthrough video for real capture.
4. Real products: sign up for affiliate programs (Impact.com first; see `docs/reference/sourcing/README.md`).
5. Storage for the design canon: see `docs/reference/design-principles/storage-plan.md`. The recommendation is a
   cached prompt canon plus code validators plus keyed JSON, with no vector store yet.
6. GitHub: turn on "Include private contributions" (Settings → Public profile). Approve deleting the scratch repo
   clones.
