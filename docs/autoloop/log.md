# Autoloop log

Each entry: date, checkpoint, what was done, the decision, and why. Written by the next-step agent.

---

## 2026-10-26 — checkpoint 08bc16a (previous 1878eb7)

**Done:** Home page (/) replaced with the agreed Space Capture prototype flow
(`components/CaptureFlow.tsx`): four-step welcome, one question per screen, Space/Capture/Inventory/Review
progress bar with time left, scope → room → access → tips/have → upload → measure → build (Claude + Blender via
`/api/rooms`) → 3D sort (`components/RoomSort.tsx`) → bringing → wishlist → review → handoff. Old intake pages
(/start, /plan, /preview) unlinked but still present. /scan redirects to /; new /rooms list. Salesy taglines removed.
`npx tsc --noEmit` passes. Only the welcome screen was checked in a browser.

**Decision:** CONTINUE. Add a free sample-room route through the flow (the upload step posts `sample=1` instead
of photos, e.g. behind a dev-only "Try with the sample room" link or `?sample=1`), then walk every screen from
welcome to handoff in the browser at http://localhost:3100 and fix whatever breaks.

**Why:** Everything after the welcome screen is unverified, and the flow can't currently reach build → sort →
review at all without an API key, because `upload()` always sends photos to the Claude path. The sample room
builds in Blender for free, so it is the only way to verify Space Capture end to end right now. Also worth
checking: `useState` reads localStorage in its initializer, which can cause a hydration mismatch on reload
mid-flow; and the sort step renders nothing if `glbUrl` isn't ready yet.

Consecutive steps without STOP: 1.

---

## 2026-10-26 — checkpoint b9d30e7 (previous 08bc16a)

**Done:** Added sample mode (`/?sample=1` makes the upload step post `sample=1` instead of photos, with a
one-line note on the upload screen). Walked every screen in the browser from welcome to handoff on the sample
room: scope → access → tips → upload → measure → real Blender build with live progress → 3D sort (moved the
armchair; counts updated) → bringing (added "Cedar chest") → wishlist → review (moved armchair hidden; the
to-place-later tray lists the armchair and the cedar chest) → handoff with "Open your room". Ceiling now shows
feet and inches (8′ 6″). `npx tsc --noEmit` passes; eslint passes. The earlier hydration worry doesn't apply:
`app/page.tsx` loads CaptureFlow with `ssr: false`. Not covered: the "Not yet" branch (needs a paid Claude
call), the Back button, and mobile width.

**Decision:** CONTINUE. Walk the sample flow again at phone width (390×844) and press Back on every screen
that allows it, then fix whatever breaks.

**Why:** Space Capture is meant to be easy and seamless, and capture happens on a phone, so a flow that's only
been seen at desktop width isn't verified. Back is part of the one-question-per-screen pattern (and the
inventory sort's undo) and hasn't been touched yet. The "Not yet" branch is left for when Maeve OKs a paid
call.

Consecutive steps without STOP: 2.

---

## 2026-10-26 — checkpoint 0b7eb06 (previous b9d30e7)

**Done:** Walked `/?sample=1` at phone width (390×844, mobile emulation) from welcome to handoff, including a
real sample build. Every screen fits with no horizontal scroll. Back works on every screen where it's enabled:
it returns to the previous question, keeps earlier answers (a typed measurement survived Back → upload →
Continue), and is disabled on build and sort; going forward again works. One fix in `components/RoomSort.tsx`:
on phones, once an item is selected, the Keep / Move / Remove bar docks to the bottom of the screen so tapping
furniture in 3D doesn't need a scroll to sort it. Verified in the browser. `npx tsc --noEmit` passes; eslint
passes. Still untested: the "Not yet" branch (needs a paid Claude call).

**Decision:** CONTINUE. Make Back on the inventory sort undo the last bin assignment (the item returns to
unsorted or its previous bin and fades back into the room), then verify it on the sample room at desktop and
phone width.

**Why:** The vision's inventory sort says "Back undoes the last assignment", but `RoomSort.tsx` has no undo and
the flow disables Back on sort, so a mis-tap (especially on a phone) can only be fixed by re-selecting and
re-sorting. It's the last unbuilt piece of the sort spec that can be checked for free on the sample room.
The "Not yet" branch still waits for Maeve to OK a paid call.

Consecutive steps without STOP: 3.

---

## 2026-10-26 — checkpoint 7940544 (previous 0b7eb06)

**Done:** Back on the inventory sort now undoes the last bin assignment. `components/RoomSort.tsx` keeps a
history of bin states (pushed on every assignment, including "Clear sorting"), shows an "Undo" link while
there's something to undo, and exposes `undoRef` / `onUndoChange`. In `components/CaptureFlow.tsx`, Back on
sort calls that undo and is enabled only while undo steps remain, so it never leaves sort for the build screen.
Verified at 390×844 on `/?sample=1`: moved the armchair and removed the coffee table, Back undid the removal
then the move, then went disabled and stayed on sort; after re-moving the armchair the review tray showed only
"Bouclé armchair" and "10 staying put". `npx tsc --noEmit` passes (re-run on this checkpoint); eslint passes.
Note: undo history is local to the sort screen and resets if the user leaves and comes back, which is fine.

**Decision:** CONTINUE. Make the "Not yet → Just the measurements" branch build a box room locally without
calling Claude: parse the typed size (e.g. "14 × 10 ft, 8 ft ceiling", or metres) into a rectangular RoomSpec
with no items and one default door, build it in Blender the same way the sample room is built, and show a
visible "Approximate: built from measurements only" label on the review and handoff screens; then walk it at
phone width.

**Why:** The vision says "Dimensions only gives a box room with a visible low-accuracy label", but today
`app/api/rooms/route.ts` sends a measurements-only intake to the paid Claude path (and errors without a key),
so the fresh-start mover's simplest route is both unbuilt and unverifiable. A box room needs no model call, so
it can be finished and checked for free, and it completes the last Space Capture branch that doesn't need a
paid call or Maeve's photos.

Consecutive steps without STOP: 4.

---

## 2026-10-26 — checkpoint 7892caf (previous 7940544)

**Done:** "Just the measurements" now builds a box room locally with no Claude call. New `lib/scan/boxRoom.ts`
(`parseMeasurements` reads feet or metres with an optional ceiling and rejects unreadable or implausible sizes;
`boxRoomSpec` makes a rectangular room with no items, a default door and window, confidence 0.3).
`POST /api/rooms` with `mode=measurements` builds it in Blender and flags the room `approximate`; CaptureFlow
sends that mode when there's no upload step and shows "Approximate · Built from measurements only" on review
and handoff. Verified at 390×844: "roughly big" shows a plain error and stays on measure; "14 × 10 ft, 8 ft
ceiling" builds, skips sort, and review/handoff show "14 × 10 ft / 8′ ceiling" with the label; via curl
"4.2 x 3 m" builds and "100 x 2" is rejected. Also fixed a real bug in `lib/scan/store.ts`: overlapping
un-awaited status writes from Blender progress lines could corrupt `status.json` (seen, leaving the build screen
stuck); writes are now serialized per room and written via temp file + rename. `npx tsc --noEmit` passes
(re-run on this checkpoint); eslint passes. Test rooms remain in `data/rooms`; `202610270319-awnj` has the old
corrupted status and is skipped by the list. Minor: the per-room write queue map is never pruned (harmless
locally).

**Decision:** CONTINUE. Add the one-tap scale check to the end of the photo route: when the owner skipped the
measurement and the room has a door, ask one question ("Is this door about 80 inches tall?" with Yes / "No,
it's about ___"), and on a correction scale the whole spec (footprint, ceiling, openings, items) and rebuild it
in Blender; then verify on the sample room at 390×844.

**Why:** The vision says every capture route ends with "Here's what we found" → close-up for uncertain items →
"a one-tap scale check if still needed", and the scale check is the one piece of that ending that doesn't exist
yet and can be built and checked for free on the sample room (quick local Blender build, no Claude call). Scale
is what makes the room "to scale and accurate" when the owner skips the measurement. Box rooms skip it because
they come from typed measurements.

Consecutive steps without STOP: 5.

---

## 2026-10-26 — checkpoint 76c9aab (previous 7892caf)

**Done:** The one-tap scale check. New `lib/scan/scale.ts` (`parseLength` reads ft/in, in, cm, mm, m and bare
numbers; `scaleSpec` scales footprint, ceiling, openings and items and notes the reason in `scale_basis`).
`lib/scan/pipeline.ts` gains `rescaleRoom` (backs up `spec.vN.json`, scales, rebuilds in Blender, sets
`status.scaleChecked`). `POST /api/rooms/[id]` accepts `confirm-scale` and `rescale` with `{doorHeight}`; the
factor is the owner's height over the modeled door's height and anything outside 0.6–1.6 is rejected with a plain
message. CaptureFlow has a "scale" screen after build ("Is this door about 6′ 9″ tall?") shown only for photo
rooms with no typed measurement, a door, not yet checked, and not approximate. Verified at 390×844 on the sample:
Yes → sort with dimensions unchanged; "really tall" → error; "7 ft" → rebuilt ×1.041 (4.27×3.05 → 4.44×3.17 m,
door 2.134 m), question skipped afterwards, review shows "15 × 10 ft / 8′ 11″ ceiling". `npx tsc --noEmit` passes
(re-run on this checkpoint); eslint passes. Not re-run in the browser: box rooms and typed-measurement rooms
skipping the question. Notes from review: if Blender fails mid-rescale the scaled spec is already saved, so a
retry would scale twice (the backup makes it recoverable); Back from the build screen after "Rescale my room"
was not checked.

**Decision:** CONTINUE. Walk all three capture routes end to end at 390×844 — sample photos with no measurement,
sample photos with a typed measurement, and "Just the measurements" — and confirm the scale question appears only
on the first, that Back behaves sensibly around build → scale → sort (including after a rescale), and that a
reload mid-flow resumes on the right screen; fix anything that breaks.

**Why:** Space Capture's ending ("Here's what we found" → scale check) is now built for every free route, so
before moving on the rule is to verify what was just built; two of its three branches and the Back/resume paths
around the new screen are untested, and Space Capture must feel seamless before Taste Builder starts.

Consecutive steps without STOP: 6.

---

## 2026-10-26 — checkpoint 3e7a6b1 (previous 76c9aab)

**Done:** Walked all three capture routes at 390×844 on real built rooms: (A) photos with no measurement →
"Is this door about 6′ 9″ tall?"; (B) photos with a typed measurement on a fresh, never-checked room → straight
to "What's staying?"; (C) "Just the measurements" box room → straight to "Bringing any furniture…", skipping
scale and sort. Reloading on the scale screen and on sort resumes on the same screen (3D view shown on sort).
After a rescale, Back is off on build and undo-only on sort, so the scale question can't come back. Fixed the
issue noted last time: `rescaleRoom` in `lib/scan/pipeline.ts` now copies the backup spec back if Blender fails,
so a retry can't scale twice (diff reviewed). `npx tsc --noEmit` passes (re-run on this checkpoint); eslint
passes. Test rooms `202610270019-otnc` and `202610270319-awnj` still have status files corrupted by the old write
bug; both predate the fix and the list skips them.

**Decision:** CONTINUE. Add the "uncertain items" step of the capture ending without a model call: after scale
(or build, if scale is skipped) and before sort, show one screen, "Are these in your room?", listing only the
items whose spec confidence is below 0.65 (on the sample: the arc lamp, framed print and curtains), each with
"Yes" / "Not there"; "Not there" drops the item from the sort list and hides it in the 3D view; skip the screen
when nothing is uncertain or the room is approximate; verify on the sample room at 390×844, including Back and
reload.

**Why:** The vision says every capture route ends "Here's what we found" → a quick close-up for uncertain items
→ the scale check. Scale is now built and verified, but nothing uses the per-item confidence Claude already
returns, so guessed furniture flows straight into the inventory. Confirming or dropping those items is free to
build and check on the sample; the actual close-up photo re-scan needs a paid Claude call and is left for when
Maeve OKs one. No confidence numbers are shown to the user.

Consecutive steps without STOP: 7.

---

## 2026-10-27 — checkpoint bee744f (previous 3e7a6b1)

**Done:** The "Are these in your room?" screen. `components/CaptureFlow.tsx` adds a `confirm` screen after
build/scale and before sort, listing only items with confidence < 0.65, each with Yes / Not there and no
confidence numbers; it is skipped for approximate rooms and when nothing is uncertain. "Not there" ids are kept in
the flow state and in localStorage `homebody-absent-<roomId>`. `RoomSort` takes an optional `absent` list (falls
back to localStorage, so the room page matches) and `GlbViewer` an optional `hidden` set, so dropped items leave
the sort list, the 3D view and the review counts. From sort, Back returns to confirm once there's nothing to
undo. Verified at 390×844 on the sample room (per the builder): the screen listed exactly the arc lamp, framed
print and linen curtains; lamp "Not there" → sort shows 10 items without it; Back → confirm with the lamp still
marked; reload on confirm resumes there; review shows "10 staying put" and no lamp in 3D. `npx tsc --noEmit`
passes (re-run on this checkpoint); eslint passes. Diff reviewed; nothing broken found. Small notes for later:
`restart` doesn't clear the per-room absent key (harmless, new rooms get new ids); not checked whether a hidden
item can still be tapped in the 3D view.

**Decision:** STOP. Eight steps in a row without a checkpoint for Maeve. Every free part of the capture ending
("Here's what we found" → uncertain items → scale check) is now built and verified on the sample room. The next
real gap is how well the pipeline does on an actual room, which needs her photos and a paid Claude scan.

**Why:** The backlog's Space Capture test ("your room photos → Claude + Blender → glTF, measure accuracy and
time") is the main thing still unknown about Space Capture, which must be "to scale and accurate" before Taste
Builder starts. Running it spends money and needs Maeve's photos, so it needs her OK.

Consecutive steps without STOP: 0.

---

## 2026-10-27 — Maeve's reply (resumes the loop)

**Maeve said:**
- Continue the loop indefinitely, with no time limit; pick up again whenever the usage limit resets.
- Add a design-critic agent that reviews each piece of work and gives feedback, and act on it.
- Go back to the prototype's fonts and colors (done: Newsreader, Figtree and deep green restored in `app/globals.css` and `app/layout.tsx`).
- Polish Space Capture until it could be shown to Steve Jobs and Jony Ive.
- Then build Taste Builder, following the requirements she gave (now in `docs/product-vision.md`).
- Add a dev-only "What Homebody assumes about me" view.

**Not approved:** a paid real-photo scan. She didn't answer, so keep everything free. Old intake pages stay. No commits to branches.

**Decision:** CONTINUE.

**Next step:** have the design critic review Space Capture end to end in the restored prototype look, then make its changes.

---

## 2026-10-27 — checkpoint b963417 (previous bee744f)

**Done:** Restored the prototype look (Newsreader + Figtree, deep green accent, rounded sentence-case buttons) in
`app/globals.css` and `app/layout.tsx`. Added the design critic (`.claude/agents/design-critic.md`); its first
review of Space Capture (`docs/autoloop/critique.md`) said POLISH, not ready to present. All five of its changes
were made and checked at 390×844 (per the builder): the sort screen is trimmed to a one-line subtitle with no count
line, cm sizes, bucket hints or Clear sorting on phones; `/rooms/[id]` shows only the room (name, 3D, toggle,
sorting), and "Fix it with Claude", renders, details, confidence and raw errors are behind `?dev=1` in development
(`app/rooms/[id]/page.tsx`); Back, view toggles, bucket buttons and Yes / Not there are 44 px tall; site header and
footer are hidden on `/` (`components/HideOnFlow.tsx`) and the duplicate section label is gone; review uses the
bucket names "Keep here / Moving / Removing", amber tokens replace the hard-coded yellow, Keep is grass green
(#3f8a2e) apart from the brand green, a failed build says "We couldn't build this room" with Try again (new
`retry` action in `app/api/rooms/[id]/route.ts`, or a rebuild when a spec exists), and `GlbViewer` shows "Loading
your room…" or a failure message. `npx tsc --noEmit` passes (re-run on this checkpoint); eslint passes. Diff
reviewed. Note: `retry` with no spec re-runs `processRoom`, which is a paid Claude read; that's the right behavior
for a real user, but the loop must not trigger it for testing, so the failed-build path was not exercised end to
end.

**Decision:** CONTINUE. Run the design critic again on Space Capture end to end (welcome → handoff → /rooms/[id])
in the new look, and record its verdict.

**Why:** The rule is to stay on Space Capture until the critic says "SPACE CAPTURE READY TO PRESENT: YES". All
five changes from its last review are in, so the next free and necessary step is a second pass that either
clears Space Capture for Taste Builder or names what still falls short.

Consecutive steps without STOP: 1.

---

## 2026-10-27 — checkpoint c96e389 (previous b963417)

**Done:** Design critic pass 2 on Space Capture (`docs/autoloop/critique.md`, second entry): POLISH, not ready. All
five of its changes are made: one set of bucket names, "Keep here / Move it / Remove", in `BINS`
(`components/RoomSort.tsx`), the review chips and the review tray heading; on phones the sort screen drops "Select
all to sort" and the Undo link (Back undoes) and hides the drag hint after the first tap; the build screen has no
disabled status button (a wait line shows until "See your room" appears) and no "Rendering it" step;
`/rooms/[id]` without `?dev=1` gives a failed build a primary "Try again" with one line on what happens (rebuild
if a spec exists, else retry), drops the duplicate "← Your rooms", and says "Loading your room…"; `/rooms` shows
a date, "Building…" or "Couldn't build" with no image counts, and the sample-room button is dev-only; ✕ buttons
are 44 px, readable text moved from ink-faint to ink-soft, and the two "will come with the phone app" sentences
are cut. Checked at 390×844 on the sort screen (per the builder). `npx tsc --noEmit` passes (re-run on this
checkpoint); eslint passes on the changed files. Diff reviewed; no old bucket wording left in components. Note:
`docs/product-vision.md` still describes the yellow bucket as "Keep, move it" and lists "Select all to sort"; the
code now differs on phones by the critic's call. Not exercised: the failed-build "Try again" without a spec (it
triggers a paid Claude read).

**Decision:** CONTINUE. Run the design critic's third pass on Space Capture end to end at 390×844 (welcome →
handoff → /rooms and /rooms/[id]) and record its verdict.

**Why:** Space Capture stays the focus until the critic says "SPACE CAPTURE READY TO PRESENT: YES". All changes
from pass 2 are in, so a fresh pass is the only way to clear it for Taste Builder or find what's left.

Consecutive steps without STOP: 2.

---

## 2026-10-27 — checkpoint 907309a (previous c96e389)

**Done:** Design critic pass 3 on Space Capture (`docs/autoloop/critique.md`, third entry): POLISH, "close". All
five of its changes are made: new `lib/scan/waitLine.ts` maps pipeline stages to plain wait lines (no "Claude",
no "rendering"), used on the build screen (`components/CaptureFlow.tsx`) and on `/rooms/[id]`
(`components/RoomView.tsx`), whose busy panel now uses the flow's 3-step checklist instead of the 4-segment bar;
`RoomSort` shows a 44 px Undo when stacked without an `undoRef`, so `/rooms/[id]` has undo again; untouched
stacked rows no longer show a "To sort" chip; the review tray is headed "To find a spot for (N)"; faint
sentences moved to ink-soft (measure hint, tray hint, `/rooms` dates) and the stray `mt-4` is gone from the
`/rooms/[id]` h1. `npx tsc --noEmit` passes (re-run on this checkpoint); eslint passes per the builder. Diff
reviewed; waitLine covers every message `lib/scan/pipeline.ts` writes during a build. Not yet checked in the
browser this round.

**Decision:** CONTINUE. Run the design critic's fourth pass on Space Capture at 390×844 in the browser against
the sample room, confirming the pass-3 changes on screen, and record its verdict.

**Why:** Space Capture stays the focus until the critic says "SPACE CAPTURE READY TO PRESENT: YES". Pass 3 said
"close" and all its changes are in but unseen on screen, so a browser-checked pass is the step that either
clears Space Capture for Taste Builder or names the last fixes.

Consecutive steps without STOP: 3.

---

## 2026-10-27 — checkpoint 212f30e (previous 907309a)

**Done:** Design critic pass 4 on Space Capture (`docs/autoloop/critique.md`, fourth entry): **SHIP**, "SPACE
CAPTURE READY TO PRESENT: YES". Two of its three optional nitpicks are applied: upcoming build-checklist steps in
`components/CaptureFlow.tsx` use ink-soft (matching `/rooms/[id]`), and the `/rooms` title dropped
`tracking-[-0.03em]` to match `/rooms/[id]`. The third (11 px ink-faint progress-bar labels) was left by the
critic's own call. `npx tsc --noEmit` passes (re-run on this checkpoint); eslint passes per the builder. Diff is two
one-line class changes plus the docs; nothing broken.

**Decision:** CONTINUE. Space Capture is cleared, so start Taste Builder with its question tree, written as typed
data plus a short doc, before any UI. New `lib/taste/questions.ts` (ids, prompt text, answer kind, branch
conditions, `core` vs optional-depth flag, a `skipIf` that reads what's already known, and the profile field each
answer feeds) and `docs/taste-builder.md` (the tree in plain language, why each branch earns its time, and the
source it draws on). Order as the product doc sets it: bucketing questions first (fresh vs refresh, standard vs
customized, the speed / style / budget / customization tradeoff, timeline) → functional for everyone (how many
people, what the space is for, priorities) → functional branches (kids → ages, pets, working from home) →
lifestyle (host, work, relax) → broad style (color, patterns, materials) → specific style branching off earlier
answers → personal story (places lived, e.g. Indian and Copenhagen influences; one meaningful detail like a
grandmother's butterflies, used as one small nod). Skip rules draw on the Space Capture intake (`Answers` in
`CaptureFlow.tsx`: scope, access, contents, bringing, wishlist), the scan's `profile_signals` (style, price_level,
lifestyle in `lib/scan/spec.ts`) and the keep/move/remove choices. Short core path (about 6–8 questions) with
optional depth that people can return to. Prompts are written as spoken lines so the same tree can run as text now
and voice later; no voice capture, paid calls or installs in this step. Planned next, not in this step: the
text-first conversation screen (one question per screen, in the capture flow's look, with a mic slot left for
later), the profile builder that turns answers and signals into assumptions with a cited reason each, and the
dev-only "What Homebody assumes about me" view (behind `?dev=1` in development only, like the room page's
backstage panel), which reads that same profile.

**Why:** Maeve asked for Taste Builder to begin once the critic's bar was met, with "the bucketing questions first"
and "build the decision tree accurately; every branch must earn its time". Settling the tree as data first makes
it reviewable on its own, lets the screen, the profile and the assumptions view all share one source, and keeps
the step free. Maeve should look over the tree once it's written, since the questions are taste and product
choices; that review can happen alongside the next steps rather than blocking them.

Consecutive steps without STOP: 4.

### Progress so far (for Maeve)

- **Space Capture is done and cleared.** One question per screen from welcome to handoff, a real Blender build of
  the sample room, "Here's what we found" with uncertain items and a scale check, the 3D Keep here / Move it /
  Remove sort with undo, a review with a "to find a spot for" tray, and the room page. Four design-critic passes;
  the fourth said SHIP. Everything was verified for free on the sample room at phone width.
- **Still untested:** a real-photo scan of your own room (paid Claude call, needs your OK and photos), and the
  "Try again" path for a failed build without a spec (same reason).
- **Now starting Taste Builder:** the question tree first, then the conversation screen (text-first, voice later),
  then the dev-only "What Homebody assumes about me" view.

---

## 2026-10-27 — checkpoint 4253b32 (previous 212f30e)

**Done:** Taste Builder step 1, the question tree as typed data: `lib/taste/questions.ts` (stages bucketing →
functional → branches → lifestyle → broad style → specific style → personal story; core vs optional; `showIf`;
`known` rules that skip or prefill with a "because"; `feeds`; `walk()`) and `docs/taste-builder.md`. The design
critic's first pass on the tree (`docs/autoloop/critique.md`, fifth entry) said POLISH; all five changes are made
per the builder: only explicit sort taps count as keeps; invented prefills removed (hosting, work_from_home,
inspiration, budget "lean", the materials cap); approach reworded without speed, tradeoff reworded and made
optional, kids moved onto the core path; repeats removed (unwind's choices, anchor and story_piece merged,
priorities reworded); spoken wording fixed (look, budget, pets "No pets" exclusive, hosting frequencies). Now 36
questions: 8 core slots, plus kid_ages as a core branch shown only with kids, and 27 optional. `npx tsc --noEmit`
passes (re-run on this checkpoint); eslint passes per the builder. Diff reviewed. One leftover found: **unwind**
still prefills "Pottering with plants" when the scan has a plant (`scanHas(k, "plant")`, the sample room's
fiddle-leaf fig), which breaks the tree's own "owning isn't loving" rule. Also, `scan.profile_signals.lifestyle` is
inferred from the photos, not said by the person.

**Decision:** CONTINUE. Build the text-first Taste Builder conversation screen, and in the same step remove the
item-based prefill from **unwind**.

**Why:** Maeve asked for Taste Builder as a calm, one-question-at-a-time conversation with a short core path and
optional depth. The tree is settled and checked by the critic, so the screen is the next piece people actually
experience. It's also what the dev-only assumptions view will sit beside, since both need answers to read from.
The unwind fix is a small honesty correction that belongs before any screen shows prefills. Maeve isn't asked
anything now; she can review the wording in `docs/taste-builder.md` whenever she likes.

Consecutive steps without STOP: 5.

---

## 2026-10-27 — checkpoint c632c5e (previous 4253b32)

**Done:** Taste Builder step 2, the text-first conversation screen: `app/taste/page.tsx` (client-only) and
`components/TasteFlow.tsx`, driven by `walk()`; one question per screen in the capture flow's look; core path →
"Want to go a little deeper?" → optional questions → finish screen; answers saved in localStorage
(`homebody-taste`); reads the capture answers, the room's spec from `/api/rooms/<id>` and the sort bins. The
CaptureFlow handoff now leads with "Let's start" → `/taste`; `HideOnFlow` hides site chrome on `/taste`; the
unwind item-based prefill is removed (code and doc). Design critic pass on the screen (`critique.md`, sixth entry):
POLISH; all five changes made per the builder: honest minutes per answer kind and a real count/time on the deeper
screen; the bar is answered ÷ steps (drops once to about 43% on "Go deeper", accepted for now); `/rooms` links
"Tell us more about you", "See your rooms" is primary on the finish screen and "Add more now" hides right after
"I'm done for now"; prefilled screens say "From your room. Tap to keep it, or pick another."; no autoFocus.
`npx tsc --noEmit` passes (re-run on this checkpoint); eslint passes per the builder. Diff reviewed. Checked at
390×844 by the builder, except the prefill sub line, which has never been seen with a captured room. Noticed in
review: on a prefilled multi-choice screen (e.g. **uses**) "Tap to keep it" doesn't match the action, which is
Continue; and the line says "From your room" even when the prefill came from the intake answers.

**Decision:** CONTINUE. Verify the prefill path in the browser with the free sample room, and fix what it shows.

**Why:** The rule is to fix or verify what was just built before moving on, and the prefill line is the one piece
of this screen nobody has seen; it's also the screen's main honesty promise (never assume silently). The dev-only
"What Homebody assumes about me" view comes next and will read the same known/prefill data, so confirming it
works end to end with a real room first saves debugging both at once.

Consecutive steps without STOP: 6.

---

## 2026-10-27 — /taste prefill check with the sample room

**Checked** at 390×844 in an isolated browser context with the free sample room (`202610271128-dzjy`, built with
`sample=1`, reached "done"), the usual living-room intake and a cleared `homebody-taste`. As the doc table says,
budget (somewhere in the middle), uses (relaxing, TV, reading) and look (warm mid-century) come up already
chosen with a sub line. start, approach, timeline, people and kids are asked cold, with no sub line. A single
choice confirms in one tap and saves. Changing a prefill (uses without reading, look → Scandinavian) saves the new
value, and Back and reload both keep it.

**Found and fixed** in `components/TasteFlow.tsx`:
- The sub line now matches the action and the source:
  - single choice: "Tap to keep it, or pick another.";
  - multi choice: "Keep these or change them, then continue.";
  - source: "From your room." only when the prefill rests on the scan or the sort, otherwise "From what you
    told us." (`fromRoom()` reads the question's `from`; for mixed ones it re-runs the rule with intake and
    answers only, and the source counts as intake if the answer comes out the same).
  - Checked with an away/apartment/bringing intake on the same room: start and approach both say "From what you
    told us."
- The chosen option didn't look chosen. `border-ink` never applied, because the unlayered
  `* { border-color: var(--line) }` in `app/globals.css` outranks Tailwind v4's layered utilities. TasteFlow now
  uses `!border-ink`. The same dead `border-ink` is in CaptureFlow, RoomView and RoomSort. The real fix is to
  wrap that rule in `@layer base` in globals.css; it was out of scope for this step, so it's left for the next one.

`npx tsc --noEmit` and `npx eslint components/TasteFlow.tsx lib/taste` pass.

---

## 2026-10-27 — checkpoint 172aeee (previous c632c5e)

**Done:** The /taste prefill path verified at 390×844 with the free sample room (budget, uses, look prefilled and
shown chosen; cold questions have no sub line; one-tap confirm, change, Back and reload all work). Sub line now
matches source and action ("From your room." / "From what you told us." + "Tap to keep it, or pick another." /
"Keep these or change them, then continue.") via `fromRoom()` in `components/TasteFlow.tsx`. The global bug is
fixed at the root: `* { border-color: var(--line) }` in `app/globals.css` is now inside `@layer base`, so
Tailwind v4 utilities such as `border-ink`, `border-transparent` and `hover:border-line-strong` apply everywhere.
`npx tsc --noEmit` passes (re-run on this checkpoint); eslint passes per the builder. Diff reviewed. Leftovers in
TasteFlow: the `!border-ink` / `hover:!border-ink` workarounds are now redundant, and the comment above `Option`
("the unlayered `* { border-color }` ... outranks layered utilities") is now false.

**Decision:** CONTINUE. Check the globals.css fix on screen across the flows it changes, and remove TasteFlow's
now-redundant `!` overrides and stale comment.

**Why:** The rule is to verify what was just built before moving on, and this fix changes borders on every screen
of the already-cleared Space Capture, not just the chosen options: CaptureFlow's "have" checkboxes and build
checklist, RoomSort's selection boxes, RoomView's tabs (inactive tabs use `border-transparent`, which used to be
overridden to the line color and now really is transparent) and every `hover:border-*`. A quick free look keeps
the critic's SHIP verdict honest. The dev-only "What Homebody assumes about me" view is next after this.

Consecutive steps without STOP: 7.

---

## 2026-10-27 — checkpoint bff4980 (previous 172aeee)

**Done:** The `@layer base` border fix in `app/globals.css` checked at 390×844 on every affected screen:
CaptureFlow (have checkboxes, build checklist, choices, confirm toggles), RoomSort (rows; Keep/Move/Remove now show
their sage/amber/rust borders as intended), /taste (single and multi choice) and the `/rooms/[id]?dev=1` tabs. Only
the dev tab underline broke (`-mb-px` plus overflow clipping); `components/RoomView.tsx` now draws the line with an
inset shadow, re-checked. TasteFlow's `!border-ink` / `hover:!border-ink` overrides and the stale comment are
removed. `npx tsc --noEmit` passes (re-run on this checkpoint); eslint passes per the builder. Diff reviewed (3
files). Left as is: at 390px the dev-only tab labels "3D model" and "Your photos" wrap (dev-only, not user-facing).

**Decision:** CONTINUE. Build the profile builder and the dev-only "What Homebody assumes about me" view.

**Why:** Nothing is left broken or unverified, and every critic change on the Taste Builder screen is made, so the
next piece is the one the product doc names alongside Taste Builder. Maeve asked for it explicitly (each assumption
with its why, gated so it never ships), and it makes the invisible AI profile checkable, which is the whole point
of "every answer is a signal". The tree already carries `feeds` and a `because` on every known rule, so a pure
`buildProfile(known, answers)` plus a gated view fits in one sitting. A design-critic pass on the full Taste
Builder path makes more sense after this, when the path and the view can be reviewed together.

Consecutive steps without STOP: 8.

### Progress so far (for Maeve)

- **Space Capture:** done and cleared by the critic (SHIP). Since then, a global border bug was fixed at the root
  (selected options, sort buttons and tabs now show their intended outlines) and re-checked on every screen.
- **Taste Builder:** the question tree is written (`docs/taste-builder.md`, 36 questions, 8 core) and reviewed
  twice by the critic; the text-first conversation screen at `/taste` works with the sample room, including
  prefills that say where they came from ("From your room." / "From what you told us.").
- **Next:** the dev-only "What Homebody assumes about me" view, then a critic pass on the whole Taste Builder path.
- **Still waiting on you, whenever you like:** a look over the question wording in `docs/taste-builder.md`, and
  your OK plus photos for a real-photo scan (a paid call).

---

## 2026-10-27 — checkpoint 0b134e5 (previous bff4980)

**Done:** The dev-only "What Homebody assumes about me" view: `lib/taste/profile.ts` (`buildProfile(known, answers)`,
reading the tree's own rules and `because`s) and `components/AssumptionsPanel.tsx` on `/taste?dev=1`, gated outside
production and loaded as its own chunk. The design critic's third Taste Builder pass (`critique.md`, latest entry:
POLISH, "TASTE BUILDER READY TO PRESENT: NO") asked for five changes, and the builder reports all five made:
assumptions listed first with unknowns folded into one line per group; "Why: …" / "From: …" lines whose reasons name
their evidence (uses, materials, persona), multi answers joined with " · "; an inference resting on an unconfirmed
guess shows as a guess (work_from_home) and scan readings are marked as the scan's reading; the color guess follows
the answered look over the scan's; "That's enough for now" on the optional questions goes to the finish screen and
keeps every answer. `npx tsc --noEmit` passes (re-run on this checkpoint); eslint passes per the builder. Diff
reviewed (6 files; TasteFlow diff read in full). Checked at 390×844 by the builder with sample room
`202610271128-dzjy`. Note: after "That's enough for now", `justStopped` is true because `depth === "all"`, so the
finish screen hides "Add more now" even when optional questions remain; coming back later is via `/rooms` → "Tell us
more about you". The critic should judge whether that's acceptable.

**Decision:** CONTINUE. Run the design critic's fourth pass on Taste Builder (the path plus the panel) for a
ready-to-present verdict.

**Why:** Every change from the latest critique is made, so the next thing is the critic's verdict; the rule is to
stay on the current experience until it says ready. Plug & Play only starts after that, and the Taste Builder summary
in `docs/product-vision.md` is better written once the verdict settles what's in it. Voice is still text-first by
earlier decision; voice capture would need Maeve's OK (install or paid API), so it's not this step.

Consecutive steps without STOP: 9.

---

## 2026-10-27 — checkpoint 7109d82 (previous 0b134e5)

**Done:** All four changes from the design critic's fourth Taste Builder pass (`critique.md`, latest entry: POLISH,
"TASTE BUILDER READY TO PRESENT: NO"). (1) `components/TasteFlow.tsx`: `justStopped` is now an in-memory `useState`
set in `finish()`; a saved `cur: "done"` reopens with `cur: ""` and depth "all", so "Tell us more about you" lands on
the next open question, falling through to "done" only when none are left. (2) `lib/taste/profile.ts`: the Sorting
row counts taps as `tappedKeep + move + remove`. (3) `lib/taste/questions.ts`: new `keptPieces()` so start and
approach say "kept or moved 3 pieces: …" with the names; their `on` and the materials reason say "kept or moved".
(4) "That's enough for now" is underlined like "Nothing comes to mind". `npx tsc --noEmit` passes (re-run on this
checkpoint); eslint passes per the builder. Diff reviewed (3 code files). Builder checked at 390×844 (reopened on the
color question; "That's enough for now" → finish with only "See your rooms"). Not done: desktop check; the critic's
non-blocking note that uses still cites the to-be-removed sofa as evidence for "Relaxing".

**Decision:** CONTINUE. Run the design critic's fifth pass on Taste Builder (path plus panel, including the
come-back-later door) for a ready-to-present verdict.

**Why:** Every change the latest critique asked for is made, so the next step is the critic's verdict; the rule is
to stay on the current experience until it reads ready, and Plug & Play waits on that. The non-blocking sofa note
can ride along if the critic raises it again.

Consecutive steps without STOP: 10.

---

## 2026-10-27 — Maeve redirects Taste Builder to voice

**Done:** The critic's fifth pass (POLISH; the only blocker, the first Back after a reopen, is now fixed in
`TasteFlow.tsx`: Back skips the screen already shown. tsc and eslint pass). Not yet done: the optional ones, which are
the dev-only button covering Continue at 390px and lowercasing piece names mid-sentence.

Maeve (2026-10-27): Taste Builder should be an active conversation like a voice agent (Sierra, Decagon, ElevenLabs),
not a click-through. Voice is the default, typing optional, and the tree is the agent's map with room to be flexible.
Her request: plan the technical logistics. The plan is in `docs/voice-plan.md`.

**Decision:** CONTINUE, on Phase 0 of `docs/voice-plan.md` only (free, no installs).

**Next step:** Phase 0 of the voice plan:
- write `lib/taste/agent.ts`: the agent prompt, spoken lines, prefill confirmations, the tool schemas wrapping
  `walk()`, and test personas;
- rebuild `/taste` as a conversation screen with captions, a question card with chips and a text box, driven by
  scripted agent turns (no AI calls).

The text flow's polish is paused; the critic now judges the conversation, not click-throughs. Phase 1 (an ElevenLabs
account and key, installing `@elevenlabs/react`, a ~$25 testing budget) waits for Maeve's OK.

Consecutive steps without STOP: 0 (reset by Maeve's message).

---

## 2026-10-27 — Voice Phase 0, round 2, and the neural voice

**Done:**
- All 5 changes from the critic's first voice review are made: corrections are honored; acknowledgements say back what
  was heard; loss gets a caring answer; the closing recaps and a return opens with one; talk mode runs as a call (the
  mic opens after the agent speaks, with a presence circle, Mute and End); the opening is warmer; confirmations vary.
  Also: the 1–8 chips sit 4 per row, and the dev pill clears the persona controls.
- Maeve said the browser voice sounds uncanny. `lib/taste/voice.ts` now picks the best installed voice. Maeve approved
  ElevenLabs for a neural voice (tier 2 in `docs/voice-plan.md`):
  - `app/api/voice/speak` (key on the server, disk cache in `data/voice-cache`, 503 with no key);
  - `app/api/voice/voices` (dev-only list);
  - `speak()` uses the neural voice when a key is set and falls back to the browser's voice.
- tsc and eslint pass. Waiting on Maeve's `ELEVENLABS_API_KEY` in `.env.local`. After it arrives: list the voices
  (free), shortlist 3 warm, unhurried ones, and let Maeve pick by ear.

**Maeve's standing request (2026-10-27):** once the critic and the agents agree something is good, prep the entire
demo for her to review: one guided path through Space Capture → Taste Builder (voice) → what exists of what comes
next, with the sample room ready, a short "how to try it" page, and the known limits listed.

**Decision:** CONTINUE. **Next step:** the critic's second voice review (the transcripts from round 2, then the call
screen).

---

## 2026-10-27 — Paused for Maeve's review

**Done:** The critic's third voice review (POLISH: "Call ended" shows while the summary is still spoken; "keep going"
should be offered in minutes) is being finished by the builder, along with prefetching the next line's audio. Maeve
picked **Lily** (ElevenLabs premade, British) as the voice; it's set in `.env.local`. Demo prep: `/demo`.

**Decision:** STOP. Maeve wants to try the demo as it stands and give feedback before any further significant
changes. Do nothing on the ticks until she replies.

**Waiting on:** Maeve's feedback on the demo at http://localhost:3100/demo.

### Maeve's demo notes, round 1 (2026-10-27, mid-walkthrough; she said not to change anything yet)
1. Say "building your room", not "building your living room".
2. Ask for a couple of measurements during capture, each with an "I don't know" option.
3. Remove the door-height scale check after the build. She doesn't see why it's asked.
4. "Are these in your room?" (the low-confidence confirm) should move later in the flow, not right after the build.
5. She likes the Keep / Move experience.
6. The UI should be slicker and more polished, at the level of a top-tier UX/UI designer. Right now it looks
   rudimentary, "like it was just developed by an AI thing". She'll share reference designs.
Still paused: more notes to come.
7. Remove "Already have something in mind?" (the wishlist and link screens) from Space Capture. It belongs in or after
   Taste Builder. Space Capture is only about capturing the space as it is and noting what stays and what goes.
8. Taste Builder: structured sections (the function of the space, then aesthetics, then the personal story) but an
   open conversation, not deterministic questions and fixed answers. Visual choices for style (palettes and so on)
   with an "I'm not sure" path that explores through images. A live graphic dossier drawn as they talk (whiteboard
   style). Research how designers run intakes into `docs/reference/interior-design/`; give the critic
   interior-design expertise (done in `.claude/agents/design-critic.md`).
9. Make real photo/video intake produce a photorealistic model. Then start Plug & Play if there's time.
North star: democratize hiring a polished, warm, thoughtful interior designer. Full text in `docs/product-vision.md`.

---

## 2026-10-27 — Resumed with Maeve's direction

**Decision:** CONTINUE. Maeve said to take the feedback and keep going.

**Plan, in order:**
1. Space Capture fixes, notes 1–4 and 7: "your room"; a couple of measurements with "I don't know"; no door
   check; "Are these in your room?" moved later; no wishlist.
2. Research into `docs/reference/interior-design/`: how designers run intakes, the questions they ask, style
   families, palettes, materials, and how to learn taste from reactions to images.
3. Research into photorealistic capture from photos and video (what's feasible on this Mac with Blender and no
   installs, and what would need Maeve's OK), in `docs/reference/capture/`.
4. Redesign Taste Builder as described above. An open conversation needs a real model: use Claude, which is already
   installed (`@anthropic-ai/sdk`), with the key now set, through a server route that wraps the tree as tools. Lily
   speaks; the browser listens. Keep spending small and logged.
5. A visual polish pass across everything, using Maeve's references when they come.
6. Plug & Play.

Paid real-photo scans still need photos from Maeve. Ask when the pipeline is ready for them.

**Photoreal capture research done:** `docs/reference/capture/README.md`.
- **Recommendation:** keep the parametric model as the editable room, and make it look real from the photos:
  - colors sampled from the photos;
  - straightened photo textures;
  - more Poly Haven materials, picked by Claude;
  - matched HDRIs;
  - camera poses from Apple photogrammetry through a `swift` script, which runs here;
  - 1–2 key pieces scanned with photogrammetry.
- Splats can't be the editable model. This Mac is an M1 with 8 GB.
- **Blocker:** no saved room has real photos, so Stage A can't be tested on anything real. Ask Maeve for the capture
  checklist in that README (a video, 20–30 stills, close-ups with white paper, one wall length and the ceiling
  height). Until then, Taste Builder goes first.

---

## 2026-10-28 — checkpoint 9f14bbb (previous 7109d82)

**Done:** Space Capture redone after Maeve's notes 1–4 and 7 ("your room"; length and width with "I don't know"; no
door check; "One last look" before the review; no wishlist; the typed size fitted to the walls by `fitToSides` in
`lib/scan/scale.ts`; curtains snapped to their window; a floor outline on the build screen; the review read-back;
the pinned button on phones; dark segment colors). The critic's third pass: SHIP, "SPACE CAPTURE READY TO PRESENT:
YES". Its items 1–3 are in the code (hover guarded by `@media (hover: hover)`, review segments `whitespace-nowrap`
with the dot kept on the segment before it, the footnote cut to "This takes a few minutes."). Items 4–5 are also in
the code (`animate-pulse` on the current build step; `curtains()` in `blender/build_room.py` now draws two open
panels), but no one has seen them in a fresh build yet. Research: `docs/reference/interior-design/` (7 files) and
`docs/reference/capture/README.md`. Taste Builder rebuilt as a sectioned designer interview on Claude Sonnet 5.5
(`app/api/taste/turn`, `lib/taste/*`, `components/taste/*`): visual sets with chips, a "never" step, "I'm not sure"
this-or-that pairs, a live hand-drawn dossier, the read-back, an offline fallback. Spend so far: one test
conversation about $0.32 (18 calls); `data/usage/taste.jsonl` now has 28 rows with the critic's live run under way.
Also `/demo` and Lily through `/api/voice/speak`. `npx tsc --noEmit` passes (re-run on this checkpoint). The
checkpoint holds no `.env*` or `data/` files (checked). Diff: 121 files, about 7,400 lines, mostly new Taste Builder
code and 60+ reference images.

**Decision:** CONTINUE. Verify, at no cost, the two parts built this round that no one has seen working: the Space
Capture fixes 4–5 in a fresh free sample build, and the Taste Builder offline fallback from start to finish with no
key. Fix anything small that turns up.

**Why:** Fixing what's unverified comes first. The open curtains are Blender geometry, so only a render shows
whether the window reads as a window. The offline fallback is what the demo falls back on if the API is slow or
over the turn cap. The critic's live Taste Builder review is still running, so its changes are the step after
this, and this step stays out of the files it is judging except for small fixes. Noted for later: the route's turn
cap is per conversation id, which the page supplies. There's no daily total, so a global daily spend cap read from
`data/usage/taste.jsonl` is a cheap safeguard to add before the loop runs more live conversations.

**Spending guard added:** `app/api/taste/turn/route.ts` now caps live designer turns at 150 a day, counted from
`data/usage/taste.jsonl` (override with `TASTE_DAILY_CALLS`). Past the cap, the route answers 429 and the page carries
on offline. tsc and eslint pass.

---

## 2026-10-28 — Demo round two ready for Maeve (checkpoint 1330c44)

**Done:**
- **Space Capture:** her demo notes are all in. Critic: SHIP, "SPACE CAPTURE READY TO PRESENT: YES". Also done:
  - the size she types is fitted to the room's walls;
  - curtains are drawn open;
  - the floor outline draws itself while the room builds;
  - the read-back.
- **Taste Builder:** rebuilt as a live, sectioned designer conversation (Claude Sonnet 5.5). After four critic
  passes: SHIP, "TASTE BUILDER READY TO PRESENT: YES". It has:
  - visual sets with "I'm not sure" exploration;
  - a hand-drawn notebook;
  - a brief built only from her words.
- **`/demo`:** updated with a "New since your notes" section and an honest list of what's live and what isn't.
- **Spend:** live designer testing so far is about $1.70 across six conversations (`data/usage/taste.jsonl`), with a
  daily cap of 150 calls.

**Taste follow-ups, not blockers** (critic pass 4):
1. Corrections can still drop a clause she reinforced ("the light"). Also, "why now" should reach the brief.
2. A visual set can reopen over a question she already answered in words.
3. The page lags the conversation, or uses words that aren't hers.
4. The designer echoes her after taps. The linen-for-cats advice is wrong.
5. Read-back details:
   - a hero photo that clashes with a practical need;
   - the bell under "Starts from";
   - a tree label in the practical line;
   - two closing lines.

**Later:**
- the visual polish pass, with her references;
- Plug & Play;
- the photoreal capture, which needs her room photos.

**Decision:** STOP. Maeve asked to review the full demo once the agents agree, and they do.

**Waiting on:** Maeve's review of http://localhost:3100/demo (and her design references, and room photos when she
can).

---

## 2026-10-29 — Maeve's review of demo round two

**Her feedback, summarized:**
1. **Taste Builder is still too long.** The intro should say plainly:
   - there are three sections;
   - you can say "I'm finished with this section" anytime and move on;
   - more answers mean a better read of your style;
   - you can come back later.
2. **New section order:**
   - (1) **Who you are:** short; how you see yourself using the space. Infer function rather than asking about it.
   - (2) **Space and style.**
   - (3) **Extras:** how personal it should be, story.
3. **A stopping point in each section** once the design minimum is covered.
4. **An early priorities question** (open-ended, guided) that resizes how many questions each person gets.
5. **Less depth** on "why refresh" and "pieces you didn't like".
6. **Then Plug & Play,** automatically, once Taste Builder is in a good spot.
7. **Real photos to renders** as close to real as possible.
8. **A site-wide visual design pass,** the notes and dossier especially: sleek yet purposeful.
9. **Do as much as possible;** she's away about 12 hours.

**Decision:** CONTINUE.

**Next:**
- In parallel: the Taste Builder restructure (notes 1–5), and the free Stage A photoreal work from
  `docs/reference/capture/README.md`. Reading real photos with Claude still needs Maeve's explicit OK.
  **Update:** Maeve answered directly (2026-10-29): yes, Claude photo reads are OK, capped at $10 total. She has no
  photos yet, so the test uses freely licensed sample room photos, with spend logged in `data/usage/capture.jsonl`.
- **Added by Maeve:** a length choice on the intro (about 2, 5 or 15 minutes, changeable midway). Plug & Play's first
  cut starts now, in parallel (/play/[id]). By the time she's back she wants all of these:
  - the new interview;
  - a first cut of Plug & Play;
  - real capture done.
- **Added by Maeve, for the visual pass:** make the path overview much sleeker and more engaging, with visuals: the
  `/demo` "whole path" and the four-step welcome in CaptureFlow. Show what each step looks like (capture, sorting,
  how taste is learned) instead of listing them.
  - **Naming, open:** she asked whether "Taste Builder" has a formal name. Designers say discovery / client intake,
    which produces the design brief. I proposed "Your Brief" or "Discovery" as the name people see. Waiting on her
    pick; keep the code name until then.
- **Added by Maeve, for the visual pass: custom typefaces** that don't look AI-default.
  - Drop the overused picks: Inter, Playfair, Fraunces, Instrument Serif, Space Grotesk, and the current Newsreader /
    Figtree / Caveat.
  - Choose from foundry-quality fonts that are free for commercial use, such as Fontshare (Gambetta, Sentient, Erode,
    Satoshi, General Sans, Switzer) or other open-license foundry faces. Verify each license and self-host it with
    next/font/local; it's a downloaded file, not a package.
  - Pick a distinctive lettering face for the notebook.
  - Build a specimen page at `/demo/type` with 2–3 pairings shown in real screens. The chosen pairing is live by
    default and can be switched in one place.

**Progress, 2026-10-29:**
- **Taste Builder restructured:**
  - three sections, a length choice, a priorities question that resizes the interview;
  - minimums and stopping points, and "I'm finished with this section";
  - the brief as Program / Constraints / Direction / Key decisions / Nevers / Open questions, with a filler filter.

  The critic's review is running.
- **Plug & Play first cut** at `/play/[id]`:
  - drag, rotate and snap, wall pieces, the tray, a sample catalog, Swap with a cheaper lookalike;
  - a cost pill, undo and redo, saving.

  Its critic pass comes after Taste Builder's. Next for it: real product models, collisions between pieces,
  plain-language requests, and `homebody_on_wall` exported on curtains and art.
- **The photoreal pipeline** is still in progress.
- **The build-in-public pipeline** is set up: the user-level `build-in-public` skill and `social-media-manager` agent, plus
  `docs/social/project.md`. A daily digest runs at about 9:17, drafts only, with Maeve's sign-off.
- **Known issue:** Chrome blocks WebGL for localhost after many 3D tabs. Agents should test 3D in a fresh browser
  instance.

---

## 2026-10-30 — Demo round three ready for Maeve (checkpoint 1a979e6)

**Done since her 2026-10-29 review:**
- **Taste Builder:**
  - restructured (three sections, a length choice, priorities, minimums and stopping points);
  - live designer fixed (two-call brief);
  - craft-grade brief that uses the room's measurements and light;
  - corrections are line edits;
  - filters against filler and against claims she didn't make.
- **Visual pass:** Gambetta + Switzer + Kalam (pending her OK; specimens at `/demo/type`), a design system, an animated path
  overview, the notes as a studio sheet, the brief as a studio deliverable.
- **Plug & Play first cut:**
  - built-ins fixed;
  - placement by function, with a tray fallback;
  - cheaper twins in Swap;
  - the phone sheet;
  - real thumbnails and lighting.
- **Real capture:** three CC BY rooms rebuilt from photos ($1.27 of the $10), with builder vocabulary (sloped ceilings,
  slats, fireplaces), measured colors and matched-view scores.
- **Build in public:** a reusable skill and agent, plus the first digest (2026-10-29), waiting on her sign-off.

**Last critic verdicts:**
- Space Capture: YES.
- Taste Builder: NO before the last round of fixes (corrections as edits), which hasn't been re-reviewed.
- Plug & Play: NO before its last round (tray fallback, placement by function), not re-reviewed.
- Real capture: NO before its fixes, not re-reviewed.

**Decision:** STOP. She asked for these to be done by her return; review comes first.

**Waiting on:** Maeve's review of http://localhost:3100/demo; her approval of the typefaces and the Day 4 thread; her
room photos.

---

## 2026-10-30 — Maeve's review of round three (resumes the loop)

**Feedback:**
1. **The demo room is still the mock-up,** not a recreation. Use the actual room. If the photos aren't enough to build it,
   say so and tell the person exactly what else to provide.
2. **"Here's your room" after sorting doesn't remove the Remove items.** Add a way back or to revise, not just "Looks
   right".
3. **Sorting lets her continue before every item is reviewed.** Block that.
4. **Taste:** for "which of these would you live in", show generated style views of *her* room (her room as the template)
   instead of stock photos.
5. **Taste:** ask what kind of shopper she is (thrift, designer, brands she likes, where she sources things). It
   shapes which brands to build from.
6. **A natural transition** from the interview into Plug & Play, with a walkthrough of how it works.
7. **Plug & Play v2:**
   - **Auto-filled:** pieces are added automatically as a proposed design, not a catalog to add from.
   - **Feedback on any piece:**
     - click it to give feedback;
     - parameter filters (budget, color, style, material, size, …) plus free text or voice;
     - then new alternatives.
   - **Ripple control:** a toggle for whether changing one item ripples to the rest of the room (e.g. cobalt cutlery
     recolors other things), so she controls how much the model decides versus her own customization.
   - **Swipe:** like/dislike swiping to refine taste when it's hard to put into words.
   - **Revisit:** go back to the interview from Play to add depth on chosen dimensions.
   - **Feedback style:** seamless, never a burden, with gentle nudges.
8. **A design model with real taste,** built on a reference library:
   - Wada's *A Dictionary of Color Combinations* (the Japanese color book);
   - foundational spatial and interior design principles;
   - materials and fabrics;
   - placement rules that feed off each other and take the person into account.

   Discuss storage with her.
9. **Real furniture** instead of mock items. The interview captures her preferred brands and channels, so the
   sourcing can target them.
10. **Complete the flow end to end** beyond Plug & Play: Transaction.
11. **GitHub:**
    - back up to GitHub on a `homebody-build` branch, pushed, with the Homebody repo public now;
    - make her other repos public except any with PII or personal info;
    - make her contributions public.

**Decision:** CONTINUE. **Plan, in waves:**
- **Wave 1:**
  - GitHub (publish safely);
  - Space Capture fixes 1–3;
  - research: the design-principles reference library, and real-product sourcing;
  - resume the daily digest.
- **Wave 2:**
  - Taste additions 4–5;
  - Plug & Play v2 (6–7, 9–10);
  - the Transaction flow.
- Then the visual design pass.
- Then Plug & Play.
