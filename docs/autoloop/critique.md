# Design critique log

## 2026-10-27 — Space Capture end to end, in the restored prototype look (after checkpoint bee744f)

**Reviewed:** `components/CaptureFlow.tsx` (welcome → handoff), `components/RoomSort.tsx`, `components/GlbViewer.tsx`,
`components/RoomView.tsx` (/rooms/[id]), `app/rooms/page.tsx`, `app/globals.css`, `app/layout.tsx`. Judged from code,
copy and layout classes at phone width (390 px); no screenshots.

**Notes**
- The question screens (scope, access, have, bringing, wishlist) are right: one serif question, two or three
  choices, done. The progress bar plus "About N min left" works and the minutes add up to the "About 10 minutes"
  promised on welcome.
- Chrome competes with the question. The site header (italic wordmark plus "Your rooms") and the footer
  ("Homebody · working prototype") sit on every screen. Welcome shows the wordmark twice (header and a 5xl
  repeat). The progress block names the section twice (eyebrow above, label under the bar).
- The sort screen, the one meant to feel like a game, is the busiest screen in the product: a two-sentence
  subtitle, a three-way view toggle, the 3D view, a hint line, a count line ("0 keep · 0 move · 0 remove · 11 to
  sort"), a list with mono cm dimensions on every row, bucket buttons with a second hint line each, "Select items,
  then pick where they go" (repeats the subtitle), three underlined links (Select all to sort / Undo / Clear
  sorting), then "Done sorting".
- Tap targets are small for a phone: Back is a bare "‹" glyph (about 18 px), the segmented toggles and the
  Yes / Not there pills are text-xs with py-1.5 (about 28–30 px), bucket buttons are text-xs.
- Vocabulary drifts: "Keep here / Keep, move it / Remove", "keep · move · remove · to sort", "staying put",
  "going", "To place later", "things" vs "items" vs "furniture".
- The handoff's primary button, "Open your room", goes to a page that reads as a developer tool: "Fix it with
  Claude" (a paid call), "Render in high quality", tabs for Renders / Your photos / Details, "Building in
  Blender", "Overall confidence: 82%", a "Sure" percentage column, and raw error text in a `<pre>`. This page
  breaks the "AI profile hidden" and "no jargon" principles. At 390 px the four uppercase tabs with gap-7 likely
  overflow, and the non-stacked RoomSort means the Keep/Move/Remove bar doesn't dock, so tapping furniture in 3D
  means scrolling to sort it.
- Failure and waiting states: build error shows the raw pipeline error and offers only "Start over" (photos
  lost). The 3D view is a blank grey box while the GLB loads, with no loading or failure state. The four-minute
  build has nothing to look at besides a checklist.
- Colors: Keep green (#2e8b57) sits close to the brand green (#2F5D50) used for every primary button, and the
  yellow bucket is hard-coded hex (also in the review's dashed border) instead of tokens.

**Verdict:** POLISH. Space Capture is not ready to present.

## 2026-10-27 — Second pass on Space Capture (after checkpoint b963417)

**Reviewed:** the whole flow at 390×844 from code, copy and layout classes, with the sample room
(`202610270912-l05z`) fetched from the dev server: welcome → scope → room → access → tips/have → upload → measure →
build → scale check → "Are these in your room?" → sort → bringing → wishlist → review → handoff; then
`/rooms/[id]` without `?dev=1`, the failed-build state and the 3D loading state. Files: `components/CaptureFlow.tsx`,
`components/RoomSort.tsx`, `components/GlbViewer.tsx`, `components/RoomView.tsx`, `components/HideOnFlow.tsx`,
`app/layout.tsx`, `app/globals.css`, plus `app/rooms/page.tsx`, which is one tap away. No paid calls.

**What got better (all five changes from the first pass are in):** `/` has no site header or footer, so welcome
shows the wordmark once and every question stands alone under the progress bar. The sort screen subtitle is one
line ("Tap what's leaving or moving. The rest stays."), which is the right model. On phones the Keep/Move/Remove bar
docks to the bottom once something is selected. People on `/rooms/[id]` see only their room: no confidence, no
"Fix it with Claude", no raw errors. Keep's grass green is clearly not the brand's green, and amber is a token. The
viewer says "Loading your room…" and has a failure line. The failed build in the flow says "We couldn't build this
room" and offers Try again.

**What still falls short**
- *Bucket names still drift.* `BINS` in `RoomSort.tsx` says "Keep here / Keep, move it / Remove" (buttons and row
  chips); the review chips say "Keep here / Moving / Removing". At 390 px each bucket button is about 99 px wide, so
  "Keep, move it" wraps to two lines while its neighbours sit on one.
- *Sort screen leftovers.* With "the rest stays", "Select all to sort" makes no sense. It asks you to sort what
  you were just told you can leave alone. The Undo link repeats Back, which already undoes on this screen. Both
  are text-xs underlined links, about 16 px tall: the last small targets on the main path. The hint line "Drag to
  turn the room. Tap furniture to select it." stays under the view on every visit.
- *The four-minute wait.* The build screen's primary button is disabled and reads "This takes a few minutes…": a
  status message dressed as a button. The checklist's "Rendering it" step is for stills that people never see now
  that renders sit behind `?dev=1`.
- *`/rooms/[id]` for a real person.* A failed build with no room read yet shows "We couldn't build this room" with
  no button and no next step. With a room read it shows "Try the build again" in the quiet style, worded unlike
  the flow's "Try again". The page carries the site header's "Your rooms" link plus a second "← Your rooms" eyebrow
  link right under it. The first paint is a bare "Loading…". One tap away, `/rooms` lists the sample as "· 0
  images", shows raw stages ("error", "reading") in place of a date, and has a "Build the sample room (no photos
  needed)" link.
- *Finishing details.* The ✕ remove buttons on the upload and "What are you bringing?" lists are bare glyphs (about
  16 px). `--ink-faint` (#9a9d9f on #fbfbf9, about 2.7:1) is used for readable text: the welcome's "Already scanned
  a room?" link, the sort hint, "Tap to add more". Two sentences talk about the roadmap rather than the person:
  "Filming a walkthrough will come with the phone app." (tips) and "Scanning them in 3D will come with the phone
  app." (bringing).

**Verdict:** POLISH. Not ready to present. The bones are now right; what's left is consistency and the two places
(the wait and the room page's failure state) where the person is left with nothing to do.

## 2026-10-27 — Third pass on Space Capture (after checkpoint c96e389)

**Reviewed:** the whole flow at 390×844 from code, copy and layout classes, with the sample room
(`202610270912-l05z`) and the room list fetched from the dev server: welcome → scope → access → tips → upload →
measure → build → confirm → sort → bringing → brought → wishlist → review → handoff; then `/rooms` and `/rooms/[id]`
without `?dev=1` (loaded, building and failed states). Also read the status messages the pipeline writes
(`lib/scan/pipeline.ts`), since both wait screens print them. Files: `components/CaptureFlow.tsx`, `RoomSort.tsx`,
`GlbViewer.tsx`, `RoomView.tsx`, `HideOnFlow.tsx`, `app/rooms/page.tsx`, `app/layout.tsx`, `app/globals.css`. No
paid calls, no retries, no renders.

**What got better (all five changes from the second pass are in):** One set of bucket names everywhere, and "Move
it" now fits on one line at 390 px. The phone sort screen is a toggle, the room, a list and three buckets; the hint
leaves once you start. The build screen no longer shows a dead button: a quiet line waits, and "See your room"
appears only when there's a room to see. A failed room page now has a primary Try again with one honest line about
what happens. `/rooms` reads like a list of rooms, not a job queue. The ✕ targets are 44 px and the roadmap
sentences are gone.

**What still falls short**
- *The wait still talks like a machine.* Both wait screens print `status.message` under the checklist, and those
  messages come straight from the pipeline: "Claude is reading 9 images of your room" names the AI to the person,
  against "the AI profile hidden", and "Rendering realistic views (cutaway)" brings back the rendering step that was
  just cut from the checklist, with the word "cutaway". `/rooms/[id]` still shows the old four-step bar (Reading
  photos / Building / Rendering / Ready) in 12 px ink-faint labels that wrap at about 79 px a column on a phone.
- *Undo is gone on the room page.* Hiding Undo on phones relied on Back being undo, but that's true only inside the
  flow. `/rooms/[id]` renders `RoomSort` with `stacked` and no `undoRef`, so on the room page (on phones and,
  since it's always `stacked` there, on desktop too) a wrong tap can't be undone. You can only re-sort by hand.
- *"To sort" contradicts "the rest stays".* The subtitle says to tap only what's leaving or moving, yet every
  untouched row wears a "To sort" chip: eleven of them on the sample room when the screen opens. The list asks you
  to do the job the subtitle just let you skip.
- *The review tray mislabels what you're bringing.* The dashed tray is headed "Move it (N)" but also lists the
  pieces from "What are you bringing?". A cedar chest coming out of storage isn't something you're moving within
  this room. The tray is a different thing from the bucket and needs its own short heading.
- *Leftover faint text.* ink-faint is still used for sentences people need to read: "No measurement? We'll
  estimate from doors and furniture." (measure), "When you design, drag these into place…" (review tray), the
  date / "Couldn't build" on `/rooms`. On `/rooms/[id]` the h1 keeps the `mt-4` it had under the removed eyebrow
  link, so the title starts lower than on `/rooms`.

**Verdict:** POLISH. Not ready to present, but close. The structure is right. What's left: the wait screens show
backstage text, and the room page lost a safety net (undo) in the last pass.

## 2026-10-27 — Fourth pass on Space Capture (after checkpoint 907309a)

**Reviewed:** the whole flow at 390×844 from code and copy (welcome → scope → access → tips/have → upload → measure →
build → scale → confirm → sort → bringing → brought → wishlist → review → handoff), then `/rooms` and `/rooms/[id]`
without `?dev=1` (loaded, building and failed states), with the sample room (`202610270350-htle`) and the room list
fetched from the dev server. Also relied on the main session's browser check at 390×844 on that room: no "To sort"
chips, a 44 px Undo appears after sorting the sofa to Remove and restores it, no horizontal overflow. Files:
`lib/scan/waitLine.ts`, `components/CaptureFlow.tsx`, `RoomSort.tsx`, `RoomView.tsx`, `app/rooms/page.tsx`,
`app/layout.tsx`, `app/globals.css`. No paid calls, no retries, no renders.

**What got better (all five changes from the third pass are in):** The wait now speaks plainly on both screens
("Reading your photos", "Building walls, floor, doors and windows", "Modeling your furniture", "Finishing up"); no
"Claude", no "rendering", no "cutaway". `/rooms/[id]` uses the flow's own three-step checklist, so the wait looks the
same wherever you see it. The room page has its undo back, at 44 px, and only once there's something to undo. On
phones the list no longer asks you to sort everything: untouched rows are quiet, and only what you've moved
carries a chip, which is exactly "the rest stays". The review tray says what it is ("To find a spot for"). The
sentences people need to read are in ink-soft, and the room title sits where it should.

**What's left (nitpicks, not blockers)**
- The build checklist in the flow still greys upcoming steps with ink-faint while the room page uses ink-soft;
  the same list should look the same in both places.
- `/rooms` keeps `tracking-[-0.03em]` on its title and `/rooms/[id]` dropped it, so the two titles one tap apart
  are set slightly differently.
- The progress bar's section names other than the current one are 11 px ink-faint. They're labels, not
  instructions, and the bar carries the meaning, so this can wait.

**Verdict:** SHIP. Space Capture is ready to present. Every screen asks one thing, the words are plain and
consistent, the waits and failures leave the person with something true to read and something to do, and the room
page is the room plus the one game, with nothing backstage showing. What remains is consistency polish I wouldn't
raise in that room.

## 2026-10-27 — First pass on Taste Builder: the question tree

**Reviewed:** `lib/taste/questions.ts` (37 questions, 8 core, seven stages, `showIf` / `known` / `feeds`, `walk()`)
and `docs/taste-builder.md`, against "Taste Builder requirements" in `docs/product-vision.md`. Read every prompt
aloud as the person hearing it, then walked the sample room (`blender/sample_spec.json`) through the core path. No
UI exists yet, so this is about the conversation itself. Space Capture stays cleared (pass 4, SHIP).

**What's right:** the shape is right. The 2×2 comes first, the stages go broad to specific, the branches really
are branches (kid ages, pets on the sofa, video calls, one follow-up per look), and every skip or prefill carries
a reason the assumptions view can show. "Look is never skipped, because what someone owns isn't always what they
love" is exactly the right instinct. The butterflies note (one nod, never a theme) is honoured in the code comment
and the doc. Most prompts already sound like a person talking.

**What's wrong**
- *Prefills that aren't true.* The sort counts untouched pieces as kept, so the sample room opens with "In the room
  now and keeping 11 of 11 pieces" and prefills both **start** (refresh) and **approach** (customized), though
  nobody sorted anything. The product vision reads "keep the rest" as a sign of someone who values speed (Quick
  refresh), which is the opposite of customized. Other prefills invent a value nobody gave: **hosting** becomes "a
  few times a month" because a box was ticked, **work_from_home** becomes "sometimes" because there's a desk,
  **inspiration** (a place that felt right) is filled with a product link, **story_piece** becomes whichever
  brought item happens to be first, and **budget** prefilled as "lean" from the scan tells people their things look
  cheap. **materials** prefills seven materials as ones they "love" because they own them, which contradicts the
  rule written on **look**.
- *Speed is asked three times.* **approach** ("done well, done quickly"), **tradeoff** ("fast") and **timeline**
  ("as soon as possible") all ask it. **tradeoff**'s "feels like you" asks **approach** again, and "looks
  beautiful" is the answer everyone gives. Five planning questions in a row before anything about the person
  reads like an intake form.
- *Kids are optional.* The requirements name kids → ages as the example functional branch, and it's a safety
  call (glass, corners, grabbing height), yet it's off the core path. **uses** offers "Kids' play" and then
  **kids** asks again later.
- *Repeats.* **unwind** offers Reading and TV again straight after **uses**. **anchor** and **story_piece** both
  ask you to type the name of a piece you're keeping, though we already know the list. **priorities** ("better
  than it does now") makes no sense to someone starting fresh.
- *Lines that don't work out loud.* **look** asks "Which of these sounds most like you?": "these" can't be heard,
  eight options can't be spoken, and it describes a person rather than a room. **budget** asks "how much" and then
  offers moods; "Invest in a few great things" is a strategy, not a level. **pets** lets you pick "No pets" with
  "A dog". **hosting** has no answer for about once a month.

**Verdict:** POLISH. Good bones, but a few prefills currently assume things the person never said, and that's the
one thing this tree promised not to do. Fix the honesty and the speed overlap first; the wording is quick.

## 2026-10-27 — Second pass on Taste Builder: the conversation screen

**Reviewed:** `/taste` at 390×844 from code and copy: `app/taste/page.tsx`, `components/TasteFlow.tsx`, driven by
`walk()` in `lib/taste/questions.ts`, loading the capture answers from localStorage and the room from
`/api/rooms/<id>`; the handoff's "Let's start" in `components/CaptureFlow.tsx`; `HideOnFlow.tsx`. Walked the tree
locally with no capture (8 core screens, 21 with depth) to check the time and counts. Relied on the main session's
browser check that the first screen matches the capture flow's look. No paid calls. Space Capture stays cleared.

**What's right:** it reads as a conversation. One spoken line per screen, single choices answer on one tap, the
capture flow's back arrow, bar and type, no site chrome, and the voice slot left as a comment rather than a dead
button. "Nothing comes to mind" is exactly the right way out of a typed question, and the −/+ stepper beats a number
field on a phone. The because behind a prefill stays backstage. "Now let's get to know you → Let's start" is a calm
handoff.

**What's wrong**
- *The time isn't honest.* 9 seconds a single choice puts eight questions, one with eight looks, at "About 1 min
  left"; the capture flow budgets 12. Then "Want to go a little deeper?" promises "a few more questions" when it's
  13 or more (five of them typed), about five minutes by the screen's own numbers.
- *The bar goes backwards.* After "Go deeper" the route grows to all questions and the first optional one sits
  third, so a full bar drops to about a tenth and then jumps as answered core screens are skipped.
- *The finish screen promises a door that isn't there.* "You can come back anytime to add more" — but nothing links
  to `/taste` except the end of Space Capture. And straight after "I'm done for now", it offers "Add more now", the
  choice they just declined, as the bigger button, while "See your rooms" is a small underlined link.
- *Prefilled answers look like mistakes.* A screen that opens with an answer already chosen, with no word of why,
  reads as a leftover or a default.
- *The keyboard hides the way out.* Typed questions autofocus, so on a phone the keyboard covers Continue and
  "Nothing comes to mind".

**Verdict:** POLISH. The conversation feels right; the time, the bar and the finish screen need to tell the truth.

## 2026-10-27 — Third pass on Taste Builder: the whole path plus "What Homebody assumes about me"

**Reviewed:** the handoff in `components/CaptureFlow.tsx` → `/taste` (`components/TasteFlow.tsx`, `lib/taste/questions.ts`)
through prefills, the go-deeper choice and the finish screen, and the dev-only panel (`components/AssumptionsPanel.tsx`,
`lib/taste/profile.ts`) on `/taste?dev=1`. In the browser at 390×844 with the sample room `202610271128-dzjy`
(sorted: sofa removed, console and bouclé chair kept, TV moved), panel opened. Also ran `buildProfile` locally on that
room in three states (untouched sort, sorted, core path answered with "Light and Scandinavian" over the scan's look).
No paid calls. Space Capture stays cleared.

**What's right:** every change from the second pass is in. The time and the go-deeper count are honest, the finish
screen leads to "See your rooms" and `/rooms` has the door back ("Tell us more about you"), prefills say where they
came from, and the keyboard no longer covers the way out. The panel is gated twice (outside production and only with
`?dev=1`) and loads as its own chunk. `buildProfile` reads the tree's own rules and `because`s, so the panel can't
drift from what the conversation actually does, and a changed guess shows as "over the guess …".

**What's wrong**
- *Blanks bury the assumptions.* With the room untouched, 22 of 31 rows read "Not yet known". The handful of real
  assumptions, the thing Maeve opens the panel to check, sit between rows of nothing.
- *The why and the source are hard to read and often don't cite anything.* Each reason is forced into
  "because " + a lowercased sentence, which gives "because of 11 pieces; …", "because from the room's name and what
  the scan found in it", "because asked after the sort in Space Capture" (a where, not a why). The source is a
  category ("scan signal") in 12 px ink-faint: the thing she asked for is the faintest text on the sheet. Uses doesn't
  name the sofa, TV and bookshelf it came from; materials doesn't name the pieces; the persona's reason is a nested
  "A refresh (…) × Built around me (…)" with double parentheses. Joined with ", ", "Warm, dark wood, Bouclé, Pale
  wood" reads as four materials, not three.
- *Firmness is inherited wrongly.* "Works from the room: Never" is marked sure (ink, no "unconfirmed") while the
  uses it rests on are still an unconfirmed guess, and the reason ("Didn't list working") claims they said something
  they didn't (the known nit; the status is the bigger half). The "From the capture" scan readings are marked said
  and show in firm ink, while the same scan read under Look shows amber as unconfirmed.
- *Overruled evidence keeps steering.* After someone picks "Light and Scandinavian" over the scan's "Warm
  mid-century", Color is still guessed "Warm and earthy" from the word "warm" in that same overruled reading, and
  Go deeper opens the color question with it pre-chosen. The panel shows it with no sign the source was overruled.
- *Going deeper has no way out.* The go-deeper screen says "Stop whenever you like", but the deeper questions have
  only Back. Optional depth with no exit isn't optional.

**Verdict:** POLISH. The conversation is close; the panel is the right tool but not yet a trustworthy one. It has to
show the few real assumptions first, each with a reason that names its evidence and a firmness that's honest.

## 2026-10-27 — Fourth pass on Taste Builder: the whole path plus "What Homebody assumes about me" (after checkpoint 0b134e5)

**Reviewed:** `/taste?dev=1` in the browser at 390×844 with sample room `202610271128-dzjy` (living room, in it now,
not bringing anything; sorted: grey sofa removed, walnut console and bouclé armchair kept, TV moved), panel open at
the start, after the core path (look answered "Light and Scandinavian" over the scan's "warm mid-century"), then
Go deeper → six optional questions → back → "That's enough for now" → finish → `/rooms` → "Tell us more about you".
Code read: `lib/taste/profile.ts`, `components/AssumptionsPanel.tsx`, `components/TasteFlow.tsx`, the `start`,
`approach`, `uses`, `work_from_home`, `look`, `color` and `materials` rules in `lib/taste/questions.ts`. No paid
calls; only a free GET of the room. Space Capture stays cleared.

**The third pass's five issues**
1. *Blanks bury the assumptions:* **fixed.** Groups with real assumptions come first; each group's unknowns fold
   into one faint "Not yet known: …" line, and all-blank groups (Household, Meaningful details) drop to the bottom.
   On the untouched-by-answers sheet the first screenful is the persona and its two halves, which is what Maeve
   opens it for.
2. *Every Why and From names its evidence:* **fixed, with two wrong numbers.** "Why: …" / "From: …" read as
   sentences; uses names the room's name and the sofa, TV and bookshelf; materials names the walnut console and
   bouclé armchair; multi answers join with " · "; the persona reads "A refresh + built around me and my things →
   Gatherer; both rest on the 3 pieces you chose to keep". But the numbers disagree on one sheet: start, approach
   and persona say "chose to keep 3 pieces" (it counts the moved TV), Sorting says "Tapped keep on 2", materials
   names 2. And Sorting's why says "Your taps on 11 pieces; the 7 left untouched say nothing" when 4 were tapped
   (`profile.ts` uses keep+move+remove, which includes the untouched pieces, for "taps").
3. *Guesses resting on guesses marked as guesses:* **fixed.** With uses unconfirmed, "Works from the room: Never"
   is amber, "a guess you haven't confirmed", and its why says it rests on "the uses guessed from the room". Once
   uses is confirmed it turns firm ("Didn't list working…", from your answers) and the question is skipped, which is
   right. Scan readings under From the capture say "not something you said" and show amber.
4. *Overruled scan no longer drives color:* **fixed.** After "Light and Scandinavian", Color is "Calm and light",
   why: "Picked "Light and Scandinavian" over the scan's "warm mid-century", a look that usually runs calm and
   light", and the color screen opens with Calm and light chosen and "From what you told us."
5. *A way out of the optional questions:* **fixed.** "That's enough for now" sits under every optional question,
   keeps every answer (checked in storage) and goes to the finish screen. Only on optional questions in depth "all",
   never on the core path. Small thing: on typed questions it stacks under the underlined "Nothing comes to mind"
   as a second, un-underlined quiet link; two exits of different weight in a row.

**The open question: hiding "Add more now" after "That's enough for now"**
Hiding it *right then* is right: don't offer the thing they just declined. As built it isn't acceptable, because
the hiding is persisted. `justStopped` reads saved state (`depth === "all"`, or the last history entry is
"deeper"), so it stays true forever. In the browser: `/rooms` → "Tell us more about you" → `/taste` opens on
"Thank you, that's plenty for now / You can come back anytime to add more." with a full bar and only "See your
rooms". The one door back is a loop to the room list, and the screen's own promise is false. The same happens
after "I'm done for now" on the go-deeper screen. The only way in is the back arrow, which no one will guess.
"Coming back later via /rooms" is only acceptable once that door actually opens onto the next question.

**Also noticed (not blocking):** uses still counts the grey sofa as evidence for "Relaxing" though it's marked to
remove. Honest about what the scan found, and the room's name carries it anyway, but the why could say "the
scan found … a sofa (going)" or leave removed pieces out.

**Verdict:** POLISH. All five fixes are in and the panel is now a tool Maeve can trust at a glance, apart from two
miscounts. But the person-facing path has a dead end at exactly the moment someone comes back wanting to give us
more, and the screen tells them they can when they can't. One small fix stands between this and ready.

TASTE BUILDER READY TO PRESENT: NO
1. `components/TasteFlow.tsx`: make "just stopped" in-memory, not derived from saved state (e.g. a `useState` set
   in `finish()`), so it only hides "Add more now" in the moment after the tap. When `/taste` opens on "done" with
   open questions left, skip the thank-you and go straight to the next unanswered question (or at least show "Add
   more now" as the primary button). Then "Tell us more about you" on `/rooms` really opens a door.
2. `lib/taste/profile.ts`, Sorting row: count taps as `tappedKeep + move + remove` ("Your taps on 4 pieces; the 7
   left untouched say nothing"). The panel's whole job is to be right about evidence.
3. `lib/taste/questions.ts`, `start` / `approach` `because` and `on`: say what the 3 actually are ("kept or moved 3
   pieces: the walnut console, bouclé armchair and TV"), so the persona, Sorting and materials rows agree and the
   persona's evidence is named.
4. `components/TasteFlow.tsx`, typed optional questions: give "Nothing comes to mind" and "That's enough for now"
   the same quiet style (both underlined or neither), so two exits in a row don't look like two different kinds
   of thing.

## 2026-10-27 — Fifth pass on Taste Builder: the whole path, the panel, and the door back (after checkpoint 7109d82)

**Reviewed:** `/taste?dev=1` in a fresh browser context at 390×844 (light and dark) and 1440×900, with sample room
`202610271128-dzjy` (living room, in it now, not bringing anything; sorted: grey sofa removed, walnut console and
bouclé armchair kept, TV moved). Panel open before any answers, after the core path (look answered "Light and
Scandinavian" over the scan's "warm mid-century") and mid-depth. Two ways out and back: "I'm done for now" on the
go-deeper screen → finish → `/rooms` → "Tell us more about you"; and four optional answers → "That's enough for now"
on the typed routine question → finish → reload `/taste`. Code read: the 0b134e5→7109d82 diff, the uncommitted
`uses` change in `lib/taste/questions.ts`, and `TasteFlow.tsx` (state load, `answer`, `deeper`, `back`, `finish`).
No paid calls; only the free room GET. Space Capture stays cleared.

**The fourth pass's four changes, plus the sofa note**
1. *"Just stopped" in memory; a finished /taste reopens at the next open question:* **fixed.** Straight after
   either exit the finish screen offers only "See your rooms", which is right. "Tell us more about you" now lands
   on "If something has to give, what should we protect?" with "About 5 min left" and "That's enough for now";
   after stopping on the routine question, a reload opens on the routine question. The door is real and the
   finish screen's "You can come back anytime" is now true. One flaw in it, below.
2. *Sorting counts taps:* **fixed.** "Tapped keep on 2, moving 1, removing 1 / Why: Your taps on 4 pieces; the 7
   left untouched say nothing."
3. *Start and approach name the pieces:* **fixed.** "In the room now and kept or moved 3 pieces: Walnut media
   console, TV and Bouclé armchair"; the persona says "both rest on the 3 pieces you kept or moved"; materials
   names the two of those that carry materials. Every row now counts and names the same three. Nit only: the
   names keep their catalog capitals mid-sentence ("…pieces: Walnut media console").
4. *Both quiet exits underlined:* **fixed.** On the routine question "Nothing comes to mind" and "That's enough for
   now" read as one family, same size, color and underline.
5. *Sofa note:* **fixed.** Uses now reads "Living room; the scan found a TV and a bookshelf"; the sofa marked to
   remove is gone from the evidence, and Relaxing rests honestly on the room's name.

**What's still wrong**
- *Back does nothing on the first tap when you come back.* `finish()` pushes the current question onto history
  before setting `cur: "done"`, and the reopen keeps that history. Back pops the question you're already on, so the
  first tap leaves you on the same screen (checked: routine → Back → routine → Back → unwind). It only bites after
  "That's enough for now" (after "I'm done for now" history ends in "deeper", which is a fine place to go back to),
  but it's on the one screen we just made into a door, and a Back button that does nothing feels broken.
- *Dev only, not blocking:* at 390×844 the floating "What Homebody assumes" pill sits on top of the Continue
  button on the uses question; a tap meant for Continue opens the panel. Only Maeve sees it, but she's the one
  using it. A bottom inset on the page when `dev` is on, or moving the pill to the top corner, fixes it.

**Desktop and dark:** the column centres at the same width, the panel sheet reads cleanly at 1440 wide, and dark
mode keeps contrast on options, the primary button and the underlined exits. Nothing to change.

**Verdict:** POLISH, by one line. Every change asked for is in, the panel now agrees with itself on every count and
names its evidence, and the person-facing path has a real way back. The only thing standing between this and
ready is the dead first Back tap at that way back.

TASTE BUILDER READY TO PRESENT: NO
1. `components/TasteFlow.tsx`, the reopen in the `useState` initializer: when a saved `cur: "done"` reopens, drop a
   trailing history entry equal to the question it reopens on (or have `back()` skip entries equal to `cur`), so
   the first Back after "Tell us more about you" goes to the previous screen, not the same one.

## 2026-10-27 — First pass on Taste Builder as a voice conversation (Voice Phase 0, uncommitted, after checkpoint 7109d82)

**Reviewed:** `docs/voice-plan.md`; `lib/taste/agent.ts` (AGENT_PROMPT, TOOLS, getState/recordAnswer, `spokenLine` and
`confirmLine`, the three personas, the keyword interpreter); `components/TasteConversation.tsx`; `lib/taste/saved.ts`.
In a fresh browser context (`critic-voice0`), with sample room `202610271128-dzjy` seeded the usual way (living room,
in it now, not bringing anything; grey sofa removed, walnut console and bouclé armchair kept, TV moved). I ran all three
personas with "Say next line": Family and Story in type mode, Solo in talk mode. I checked the screens at 390×844 in
light and at 1440×900 in dark, plus a reload ("Welcome back"). No paid calls; the only request was the free room GET.
I judged it as the scripted stand-in for the live agent. The interpreter's narrowness isn't scored; what the agent
*says* is.

**Transcripts**
- *Family refresh:* every expected answer landed. "It's me, my partner and our two kids, 4 and 7" filled people,
  kids and kid ages, none of them was asked again, and the butterflies were noted. The tree-as-map idea works. But
  the agent never says back what it heard: "Thank you, that answers a few things at once." A designer would say
  "So four of you, with a four- and a seven-year-old." Without that, the person can't tell they were understood,
  and handling things out of order looks like skipping. The butterfly line was "What a lovely detail. I'll hold on
  to that.", which doesn't name the butterflies and also swallows the acknowledgement of their look answer.
- *Story-led couple:* "Fresh start. We're moving into my late grandfather's flat." The agent answered "What a lovely
  detail" to a death, then "Since you're keeping the walnut media console, TV and bouclé armchair, I'm guessing
  you'd like the room built around you…", citing the evidence they'd just contradicted. "What a lovely detail"
  came up again for Lisbon, word for word. The cat and the guests were recorded but never mentioned.
- *Solo, in a hurry:* the same correction failure. "Starting fresh, I just moved in" got "Got it." and then the
  kept-pieces line again. "I'm living out of boxes" got "Thank you" and then a budget guess.
- *Overall pattern:* 5 of the first 6 agent turns are "I'm guessing X. Is that right?" It's honest, but it plays
  like a yes/no quiz. The first line is a confirmation with no hello, and the budget guess says out loud "Your
  pieces look mostly mid-range to me", which judges their things by price. "Keeping the … TV" when the TV was
  tapped Move is close enough.
- *The ending doesn't land:* "Of course. Thank you, that's plenty for now. You can come back anytime to add more."
  There's no reflection of what it learned and no next step. This is the one moment that proves a designer was
  listening, and it's a form's goodbye. Resuming the same way says "Welcome back" and then asks cold.
- *Strong:* AGENT_PROMPT is good. It's short, has the right rules (one question a turn, at most four options aloud,
  never mention the profile, note_detail then come back), and `record_answer` refusing invented choices is the
  right guardrail. The spoken lines (SPOKEN) are brief and speakable. The prompt is missing three rules the
  transcripts show it needs: say back what you heard, honor corrections, and close with a recap.

**Screen**
- *Type mode* reads as a chat: fading captions, the line set big in Newsreader, chips under it, and a composer.
  That's the right skeleton, and the prefill shown as the chosen chip is a nice touch.
- *Talk mode* is a walkie-talkie, not a call. It shows "Tap to talk" with push-to-talk, a Mute button beside it
  (meaningless when the mic is only open while held), and a Type button that duplicates "Switch to typing" at the
  top. The top half of the screen is empty at both sizes. Nothing on screen says the agent is there, speaking or
  listening, and nothing ends the call. Next to Sierra or ElevenLabs it's still a quiz with a chat skin and a mic
  button. The free Web Speech API can already run a real turn loop (open the mic when the utterance ends), so this
  doesn't have to wait for Phase 1.
- *Craft:* the line steps down to 1.5rem when long, which works. Dark and desktop hold contrast and the column
  centers. The number chips for people (1–8) wrap to a lone "8" on a second row at 390. Dev only: the "What
  Homebody assumes" pill covers "Say next line" at 390, again.

**Verdict:** POLISH. The structure is right: tree as map, one reply filling three questions, notes captured,
everything saved. But the conversation doesn't yet sound like it's listening. It ignores corrections, it
acknowledges with stock phrases (one of them said to a grief), and it ends without a recap. Talk mode feels like a
button, not a call. These are what Phase 1 would inherit, since the prompt and the confirmations are the agent's
script.

TASTE BUILDER (VOICE PHASE 0) READY TO PRESENT: NO
1. Honor corrections (`lib/taste/agent.ts` `confirmLine` plus the turn in `TasteConversation.tsx`, and a rule in
   AGENT_PROMPT). When a reply overrules a prefill, say it back ("A fresh start, got it.") and never cite the
   overruled evidence again. After start = fresh, ask approach plainly rather than "since you're keeping the walnut
   console…". Hearing your correction ignored is the fastest way to feel you're talking to a form.
2. Acknowledge the specific thing heard, not a stock line. Replace "Thank you, that answers a few things at once"
   with what was recorded, built from the labels ("Four of you, with a four- and a seven-year-old. And a spoiled
   cat, noted."). Name the noted detail ("Butterflies. I'll remember that."). Answer loss words (late, passed) with
   care, never "lovely", and never repeat an acknowledgement in one conversation. Add "say back what you heard in a
   few words" to AGENT_PROMPT.
3. Land the ending and the return. The closing turn should recap in one or two sentences what it learned (look,
   approach, household, one noted detail) and say what happens next ("I'll start pulling ideas together for your
   living room."). On resume, add one line of recap before the next question. Add the recap rule to AGENT_PROMPT
   next to finish().
4. Make talk mode a call (`TasteConversation.tsx` `Speak`/`Mic`):
   - When the agent's utterance ends, the mic opens by itself (still free Web Speech).
   - Replace the push-to-talk button with a calm presence in the empty upper half that shows speaking, listening
     or thinking, plus Mute (now meaningful) and End.
   - Drop the duplicate Type button; "Switch to typing" already exists.
5. Open like a person, and confirm less like a quiz:
   - First turn: a short hello with one line about what it saw ("Hi. I've had a look at your living room…").
   - Vary the confirmations so they aren't all "I'm guessing X. Is that right?" ("And built around those pieces?").
   - Drop "Your pieces look mostly mid-range to me" from the budget line; just offer the guess.

KEEP: The tree as the agent's map, with one reply filling several questions that are never asked again, and
`record_answer` refusing anything that isn't a real choice. AGENT_PROMPT's brevity and its rules (one question a turn,
at most four options aloud, never mention the profile), and the big Newsreader line with fading captions and tappable
chips, so voice and touch answer the same way.

## 2026-10-27 — Second pass on Taste Builder as a voice conversation (uncommitted, after checkpoint 7109d82)

**Reviewed:** `docs/voice-plan.md` (now with the "Making the voice sound human" tiers); `lib/taste/agent.ts` (AGENT_PROMPT,
`opening`, `confirmLine`, `overruled`/`asked`, `acknowledge`, `recap`, `welcomeBack`); `lib/taste/voice.ts`;
`app/api/voice/speak/route.ts`; `components/TasteConversation.tsx` (`Call`). I ran the offline runner (`run2.cjs`) for
all three personas, with the sample room and bare, and all six PASS. In a fresh isolated context (`critic-voice1`)
with sample room `202610271128-dzjy` seeded the usual way (living room; console and armchair kept, TV moved, sofa
removed), I ran Story in type mode, a reload to test the return, and Solo in talk mode, timing each turn from line
to open mic. I checked the call screen at 390×844 in light and at 1440×900 in dark. There were no paid calls: the
room GET, plus `/api/voice/speak` returning 503 (no key), then the browser voice (Samantha). I judged the words and
the timing, not the voice's sound.

**The five changes from the last pass**
1. *Corrections are honored.* Done. "Starting fresh, I just moved in" gets "A fresh start, got it." and the kept
   pieces are never named again; approach is then asked plainly. `overruled()` works the overruled evidence out from
   the answers alone, so it still holds on a return. That's the right design. But it only retires "kept", and the
   other guesses from the room keep talking (see the second ruling below).
2. *It says back what it heard, and answers a loss with care.* Done, and it's the biggest improvement. "Two of you.
   And a cat, noted." "Four of you, with a four- and a seven-year-old." "Butterflies. I'll remember that." "I'm sorry
   about your grandfather. I'll keep that in mind as we go." "Lovely" never comes near a loss. No acknowledgement
   repeats across a conversation.
3. *The recap at the end, and on return.* Done. "So: collected and eclectic, built around you and your things, for
   the two of you, with a nod to your grandmother's house in Lisbon. Next, I'll start pulling ideas together for
   your living room." That's the moment that proves it was listening. On a return it says "Last time: …" and then
   asks the next open question, and there's no double recap after a finished visit. Two rough edges:
   - Solo's recap reads "pulled together for you, just for you. Next, I'll start pulling ideas together": "for you"
     twice, and "pull together" twice in one breath.
   - On a return, the intro says "Welcome back." and then the agent opens with "Good to have you back.": two
     welcomes in a row.
4. *Talk mode works as a call.* Done. The line is said, then the mic opens by itself ("Listening…"). The presence
   breathes, there are Mute and End, the duplicate Type button is gone, and after 10 seconds of silence it says
   "I didn't hear anything. Tap the circle to try again." Timing with the browser voice:
   - The opening line takes **18 s** to say.
   - Ordinary turns take 5–9 s.
   - The offer to keep going takes 11 s.

   Two flaws:
   - When the call ends with the recap, the presence stays, still saying "Tap to talk" (tapping does nothing), with
     "Switch to typing" above it. The call is over, but the screen doesn't say so.
   - With a neural key, `speakNeural` fetches the whole clip before it plays and shows "Speaking" during that
     silence. The first time a line is said, that's a second or two of a breathing circle and no sound.
5. *The opening, and varied confirmations.* Mostly done. The confirmations vary well: "And built around those
   pieces…?", "For budget, would somewhere in the middle feel right?", "Anything else?", "Does that still feel like
   you?". The price judgement is gone. The opening is now a hello, but it's 46 words and seven lines at 390, and
   "I can see the warm mid-century in it" is said again two minutes later by the look question. For two of the
   three personas it's also wrong.

**Rulings on the builder's two edge cases**
- *"Thanks for setting me straight" in reply to a mere addition: wrong, cut it.* The uses guess ends "Anything
  else?", which invites them to add. Answering that invitation isn't correcting the agent, and thanking them for
  "setting me straight" makes the agent sound like it made a mistake and is a little servile. On any multi-select
  guess asked as "Anything else?", just say back what they said. Keep the correction shapes ("…, got it.", "Ah, …",
  "…, then.") for single-choice answers that overrule a guess. Drop "Thanks for setting me straight" from
  `CORRECTED` entirely; the other shapes are enough.
- *After a fresh start, look and uses (and budget) still cite "your room": a real bug, fix it.* A fresh start means
  what was scanned isn't theirs to judge by. For the story-led couple, the room is their late grandfather's, so
  "Your room has a warm mid-century feel. Does that still feel like you?" asks whether a dead man's furniture is
  them. That's exactly the correction the last pass asked to be honored. "From the room, it looks like a place
  for…" and "would somewhere in the middle feel right?" (from the price of the pieces) rest on the same overruled
  evidence. When start = fresh, `overruled()` should retire `scan.style`, `scan.items` and `scan.price` as well as
  "kept", so look, uses and budget are asked plainly with their SPOKEN lines. The hello, said before any
  correction, can stay.

**Screen**
- In talk mode at 390, the presence, status, Mute and End sit in the upper half, and the line and chips sit below.
  That's calm and it reads as a call. Desktop dark holds: the column is centered and contrast is fine.
- The dev voice label and the persona controls clear the assumptions pill.
- The line still dominates the screen in Newsreader with fading captions above it. That's right.

**Verdict:** POLISH, and close. All five changes landed; the conversation now listens, says back, grieves properly
and closes with a recap. What's left is small, but one item is the same failure the last pass named, aimed at the
persona most likely to be shown: after "fresh start… my late grandfather's flat", it still cites the room as theirs.
It shouldn't be presented until that's gone.

TASTE BUILDER (VOICE) READY TO PRESENT: NO
1. Retire every guess drawn from the room once they say "fresh start" (`lib/taste/agent.ts` `overruled()`). When
   `answers.start === "fresh"`, add `scan.style`, `scan.items` and `scan.price` alongside "kept", so look, uses and
   budget are asked plainly. Add one runner check: no "Your room has", "From the room" or "feel right?" budget
   guess after "A fresh start".
2. Cut "Thanks for setting me straight", and don't treat accepting "Anything else?" as a correction
   (`acknowledge`). For multi-select guesses, just say it back ("Reading, having people over and eating."). Keep
   the correction shapes for single-choice overrides only.
3. Shorten the opening to one breath (`opening` + `confirmLine` start): drop "and I can see the warm mid-century
   in it", since the look question says it later and it's wrong for two of three personas. Aim for under 10 s
   aloud, e.g. "Hi, I'm glad you're here. I've had a look at your living room. You're keeping the walnut console,
   TV and armchair, so this sounds like a refresh. Is that right?"
4. End the call visibly, and make "Speaking" true (`TasteConversation.tsx` `Call`, `voice.ts`):
   - When `cur === "done"`, still the presence and replace "Tap to talk" with "Call ended", or collapse the
     presence; hide "Switch to typing".
   - Show "Thinking…" until audio actually starts (`audio.onplay` / the first utterance's `onstart`), so a
     neural-voice fetch never plays as a silent "Speaking".
5. Tidy the recap and the return (`learned`, `recap`, `welcomeBack`):
   - In the recap: "just you", not "just for you"; "a finished room", not "pulled together for you"; and
     "Next, I'll start on ideas for your living room."
   - On a return, drop "Good to have you back." from the spoken line (the intro already said welcome back) and
     open with "Last time: …".

KEEP: The say-back, built from the recorded labels: "Two of you. And a cat, noted.", "Four of you, with a four- and a
seven-year-old.", the care at a loss, and no acknowledgement ever repeated. Also `overruled()` working the
overruled evidence out from the answers alone, and the turn loop: say the line, open the mic, quiet presence,
Mute/End.

## 2026-10-27 — Third pass on Taste Builder as a voice conversation (uncommitted, after checkpoint 7109d82)

**Reviewed:** `lib/taste/agent.ts` (`opening`, `acknowledge`, `learned`/`recap`, `welcomeBack`), `lib/taste/voice.ts`
(`onStart` from `audio.onplay` and the first utterance's `onstart`), and `components/TasteConversation.tsx` (`Call`,
"Call ended"). I recompiled `agent.ts` and ran `run2.cjs` for all three personas, with the sample room and bare. All six
PASS, including the new check that nothing from the room is cited after "A fresh start". In headless Chromium, with
sample room `202610271128-dzjy` seeded the usual way (console and armchair kept, TV moved, sofa removed), I ran the
Story persona as a full talk-mode call at 390×844 light, 1440×900 dark and 390×844 dark, then reloaded to test the
return. Browser speech and recognition were stubbed to play the scripted turns with a 0.9 s delay before each line, so
the Thinking→Speaking handoff is visible. `/api/voice/speak` was routed to a 503 (the key is empty anyway). No paid
calls.

**The five changes**
1. *Fresh start retires the room:* done. After "Fresh start… my late grandfather's flat" it says "A fresh start, got
   it. I'm sorry about your grandfather." Look, uses and budget are then asked plainly. Nothing from the room comes
   back.
2. *"Setting me straight":* gone. "Relaxing, watching TV and kids' play." is just said back.
3. *One-breath opening:* done. It's 31 words, about 10 s with the browser voice, and the mid-century line is gone.
   With no room: "Hi, I'm glad you're here. Let's start with the big picture." Good.
4. *Call ended / Thinking…:*
   - Thinking… is correct. The dots show until the sound starts, then Speaking, then Listening.
   - Call ended is only half right. The status goes "Thinking… → Call ended" the moment the last answer lands, but
     `Call` still runs `speak(line)` on the recap. So the agent says its most important line, the one that proves it
     listened, under a grey disc that says the call is over. The same thing happens when they tap End: `finish("")`
     produces the recap and it's spoken aloud after they hung up.
5. *Recap and return:* done. "So: modern and minimal, a finished room, just you. Next, I'll start on ideas for your
   living room." On a return the only greeting is in the intro, and the spoken line opens "Last time: built around
   you and your things, for the two of you."

**Smaller notes**
- The "Keep going?" line on screen ("There are about 15 more, roughly 5 minutes") counts questions out loud. That's
  a form talking. "About five more minutes, if you have them. Or we can stop here." says it like a person.
- "Reading, and having friends over for dinner" is said back as "having people over and eating". The labels are
  right for the profile, but saying them back loses their warmth. Optional: say "friends over for dinner" back from
  their own words.
- The finished screen at 390 in light is calm, with the recap in Newsreader, captions above it and one primary
  button. Dark holds at both sizes. The Next dev badge covers the "Industrial loft" chip at 390, but only in dev.

**Verdict:** POLISH, one fix from ready. The words are now right for every persona, and the corrections, grief and
recap all land. The only blocker is a truth problem in the last ten seconds: the screen says "Call ended" while the
agent is still talking, and End doesn't end.

TASTE BUILDER (VOICE) READY TO PRESENT: NO
1. Make the end of the call truthful (`TasteConversation.tsx` `Call`). When the conversation finishes naturally, keep
   the presence live and showing "Speaking" while the recap plays, and switch to "Call ended" from speak's `onEnd`,
   not from `cur === "done"`. When they tap End, stop the audio and don't speak the recap; show it on screen only.
   Ending means silence.
2. Say the "Keep going?" offer in time, not a count (`TasteConversation.tsx` `deeper` line, and match it in
   `run2.cjs`): "That's everything I need to get started. About five more minutes, if you'd like to keep going. Or
   we can stop here."
3. (Optional) Say multi-select answers back in their own words where they gave them ("friends over for dinner"),
   and keep the labels for the profile.

KEEP: The say-back and the care at a loss ("A fresh start, got it. I'm sorry about your grandfather."), and the recap
that names their own detail ("with a nod to your grandmother's house in Lisbon"). Thinking… until the sound actually
starts, and a fresh start retiring everything drawn from the room, worked out from the answers alone.

## 2026-10-27 — Space Capture after Maeve's first-demo notes (uncommitted, after checkpoint 7109d82)

**Reviewed:** `components/CaptureFlow.tsx` and `components/RoomView.tsx`. I walked the full flow in a fresh headless
Chromium context at http://localhost:3100/?sample=1 at 390×844 light: one room, here now, the tips, the upload in
sample mode, length 16′ 6″ (also tried 2 ft and the switch to meters), width 12′, the build, sorting (sofa Remove, TV
Move it), One last look (lamp marked Not here), bringing a cedar chest, the review and the handoff. I re-shot width,
sort, confirm and review at 390 dark, 1440 light and 1440 dark. Only the free sample build ran. No paid calls.
Research used: `docs/reference/interior-design/intake-process.md`. The read-back is where trust is built, and
keepers are constraints.

**Maeve's notes, checked:**
- "Building your room": done for one room, on the build screen and in RoomView.
- Two measurements with "I don't know": done. Switching units carries the number across, and the gentle "That seems
  small for a room" check works.
- The door check is gone.
- "Is this here?" now comes after sorting.
- The wishlist and link screens are gone.
- Keep / Move / Remove is intact and still the best part. The 3D tints (pink sofa, amber TV) and the pills on each row
  read at once.

**What's wrong:**
1. *Truth:* I typed 16′ 6″ × 12′ and the review says "14 × 10 ft". The sample build drops the measurement
   (`app/api/rooms/route.ts` sample branch, `measurement: ""`). With photos, the size only goes to Claude as a hint.
   We now ask two questions and then show a different answer, in the exact demo Maeve will run.
2. *Order:* "One last look" asks "Is this here?" about the brass lamp she has just sorted as Keep. Then "Bringing any
   furniture…" follows the "last" look. Ask only about unsure items left on Keep, put this step right before the
   review, and give it a calmer row: no "Is this here?" under every name (the heading already asks it) and a
   compact Yes/No toggle. Right now the control squeezes names onto two lines ("Brass arc / lamp", "Linen /
   curtains").
3. *Measurement screens, craft:*
   - The focus ring is the browser's default blue on every input, in both themes, and the only off-palette color in
     the product.
   - "I don't know" is a full-width grey slab with the same weight as the primary, plus a footnote. Make it a quiet
     text link, "I don't know, work it out from my photos", and drop the footnote.
   - The placeholders "14" and "0" read as values that were filled in. Use "—" or leave them empty.
   - The length sub is three clauses. "Wall to wall, the longer side. A rough number is fine." is enough.
   - The unit switch is a heavy, left-hung block. Make it a small "ft · m" toggle aligned with the right of the field.
4. *Layout:* on a phone the primary button floats mid-screen, with 40% empty below it (measure, build, handoff,
   welcome). Pin the action to the bottom safe area, where a thumb is.
5. *Build screen:* "This takes a few minutes. You can keep this screen open." floats in the middle of nothing.
   "Building the room in 3D" is ticked while the line under it says "Finishing up". The time left goes up from
   6 to 7 minutes when the build finishes. A designer would show the room taking shape here: at least draw the floor
   outline from the typed sides, labelled 16′ 6″ × 12′.
6. *Review:*
   - "Your room is in" is an odd phrase.
   - The chips mix facts with counts ("Keep here 8", "Move it 1").
   - The dashed amber box reads as a warning, and "To find a spot for (2)" is form language.
   - Make it a read-back instead, as the research says: "Here's your room." Then one line, "16′ 6″ × 12′, 8′ 6″
     ceiling", and "Staying: 8 · Moving: TV · Going: grey sofa · Coming in: cedar chest".
7. *Handoff:* three stacked full-width buttons. Keep "Let's start" and make the other two quiet text links.
8. *Desktop 1440:* a 528 px phone column in the middle of an empty canvas. The 3D room should be the stage there,
   with the model large on the left and the list on the right. This is for the polish pass.
9. Dark mode holds. The selected segment is darker than its track, which reads as inverted. That's minor and for
   polish.

**Quick:** 1 (in sample mode, scale the sample footprint to the typed sides; or, for every build, rescale the spec
footprint to the typed L×W before Blender, which is code only and free), 2, 3, 4, the time-left bump in 5, 6 and 7.
**For the polish pass:** a live floor-outline drawing on the build screen, the two-pane desktop layout, a shared
segmented-control and button system (the quiet secondary style, focus tokens, and pressed and disabled states), and
motion between steps beyond the single rise.

**Verdict:** POLISH. Maeve's notes are all carried out faithfully, and the sort still delights. But the flow asks for
her measurements and then shows other ones, and the new screens look like default form controls, not like a
designer's work.

SPACE CAPTURE READY TO PRESENT: NO

## 2026-10-28 — Second pass on Space Capture: the five fixes and fitToSides (uncommitted, after checkpoint 7109d82)

**Reviewed:** `components/CaptureFlow.tsx`, `lib/scan/scale.ts` (`fitToSides`), and the sample branch of
`app/api/rooms/route.ts`. I walked the full flow in a fresh headless Chromium context at http://localhost:3100/?sample=1
at 390×844 light: one room, here now, the tips, the upload, length 16′ 6″ (switched to m and back), width 12′, the
build (48 s), sorting (sofa Remove, TV Move it), bringing a cedar chest, One last look (lamp marked Not here), the
review and the handoff. I re-shot width, build, sort, confirm, review and handoff at 390 dark, 1440 light and 1440
dark, and read the fitted `spec.json` (room 202610280434-8omu). Only the free sample build ran.

**Last pass's five, checked:**
1. Truth: fixed. The spec is 5.029 × 3.658 m, and the review reads "16′ 6″ × 12′ · 8′ 6″ ceiling".
2. One last look: fixed. It lists only unsure pieces still on Keep (lamp, print, curtains), sits right before the
   review, and the Yes / Not here toggle is compact and keeps names on one line. The struck-through name is a nice
   touch.
3. Measurement screens: fixed. Green focus in both themes, no placeholders, a quiet link, and a small ft · m toggle.
   Switching units carries the value across.
4. Pinned action: fixed on every phone screen.
5. Read-back: fixed and good. "Here's your room" and one line of facts, then one line of what's happening.
Also fixed: the build ticks (nothing is ticked early) and the handoff now has one button and two quiet links.

**Ruling on fitToSides:** the approach is right, so keep it. When the room depth is off, photos misjudge the room, not
the sofa. So stretching the walls and keeping furniture at its true size is what a designer would do, and scaling
everything only when the read is off by more than a third is a sensible guard. On the sample the result is good. The
sofa stays on its wall, the console and TV stay on theirs, and the sofa-to-coffee-table gap goes from 19 cm (too
tight) to 47 cm (right). It has two flaws:
- (a) It decides "near a wall" from the item's **center** (`Math.min(v - a, z - v) >= 0.75`). A bed, sectional or
  dining bench with its back on a wall has a center more than 0.75 m in, so it moves in proportion: off the wall when
  stretched, into it when shrunk. Measure from the item's rotated near edge (center minus half the depth or width for
  its rotation) and keep the distance when that edge is within about 0.3 m.
- (b) Curtains and other window-bound pieces move with the room, not with their window. In the sample this was
  already wrong (the curtains cover x 0.8–2.9, the window 2.07–3.67) and the stretch makes it worse: the rod and
  panel now hang over blank wall to the left of the window, in every view of the demo. Fix the sample (curtains
  x = 2.87 before fitting), and in `fitToSides` snap `curtains` to the center of the nearest window on their wall.

**What's still wrong:**
1. The 3D curtains, above. They're the first thing your eye finds on the back wall.
2. Build screen: still a blank page with three ticks. "This takes a few minutes. You can keep this screen open."
   sits at the bottom on its own. When the build finishes, the header still says "About 7 min left" (the build's 4
   minutes are still counted), and on the next screen it's 3.
3. Review line: "Staying 8 · Moving: TV · Going: grey sofa". "Staying" has no colon and is a bare count next to
   names. Use "8 pieces staying · Moving: TV · Going: grey sofa · Coming in: cedar chest".
4. Dark mode: the selected segment (Everything / What stays) is still darker than its track, so it reads as
   inverted. Lift it to a lighter surface than the track, as in light mode.
5. Desktop 1440: still a 528 px column. The two-pane layout (the room on the left, the list on the right) is still
   owed for the polish pass. On a phone it doesn't matter.
6. Minor: on the length screen, "ft" shows twice (the suffix in the field and the toggle), and "fine." drops to a
   line of its own at 390. "Wall to wall, the longer side." is enough, because the field already says rough is
   fine by having no placeholder.

**Verdict:** POLISH. The flow is now honest and calm on a phone. The typed size goes all the way through, and the
read-back is the best screen in the product. Two things stand between this and a presentation: the curtains hang
beside the window in the room you're asked to trust, and the build is a blank wait.

SPACE CAPTURE READY TO PRESENT: NO

## 2026-10-28 — Third pass on Space Capture: the second pass's fixes (uncommitted, after checkpoint 7109d82)

**Reviewed:** `components/CaptureFlow.tsx` (FloorPlan, time left, review line, length sub), `lib/scan/scale.ts`
(`place`, `hangAtWindow`), `blender/sample_spec.json`, and the `--segment` token in `app/globals.css`. I walked the
full flow in a fresh headless Chromium context at http://localhost:3100/?sample=1 at 390×844 light, typing
16′ 6″ × 12′ (sample build, 141 s, room 202610280446-6w1i). I re-shot width, build, sort, confirm, review and
handoff at 390 dark, 1440 light and 1440 dark, and turned the 3D room by dragging to see the window wall. Only the
free sample build ran.

**Last pass's list, checked:**
- Curtains: fixed. The fitted spec puts them at x 3.52, the exact center of the window (2.72–4.32), and the
  sample is corrected at the source (2.87). Turned to face the wall, the pleated panels and the rod hang over the
  window.
- fitToSides: fixed. "Near a wall" is now measured from the rotated near edge, within 0.3 m. The sofa, console and
  TV stay on their walls, and the rug and coffee table stay centered.
- Build screen: fixed. The floor outline draws itself, labelled 16′ 6″ and 12′, and fills in. Time left reads 7,
  then 3 once the build is done, then 3 on the sort screen, so it never goes up.
- Review line: fixed. It reads "8 pieces staying · Moving: TV · Going: grey sofa · Coming in: cedar chest".
- Dark segment: fixed. It's lighter than its track on the sort and review screens.
- Length sub: fixed. It reads "Wall to wall, the longer side."

**What's still wrong (all small):**
1. Sticky hover. `.btn-primary:hover { opacity: .9 }` (and the quiet-link hover) has no `@media (hover: hover)`
   guard. After you tap Continue, the next screen's button sits in the same spot and shows faded, as if it were
   disabled. This shows on confirm and review, and on handoff "Capture another room" is dark while "Open your
   room" is grey. iOS Safari keeps a tapped element's hover the same way.
2. Review line wrap at 390: the second line starts "· Coming in: cedar chest". Keep each separator with the
   segment before it, and don't let a segment break inside itself (`whitespace-nowrap` on each). A line should
   never start with a dot.
3. Build screen footnote: "This takes a few minutes. You can keep this screen open." still wraps and leaves "open."
   alone on the last line. Cut it to "This takes a few minutes." The outline and ticks already show it's working.
4. The active build step uses the same empty circle as the pending one, only darker. Give the current step a slow
   pulse or a spinning arc, so the screen looks alive during the two-minute wait.
5. From the default 3D angle, the closed linen curtains blend into the wall, and the rod shows as a black diagonal
   line on its own. Draw the curtains open, as two panels pulled to the sides with the glass between them, so the
   window reads as a window. A designer shows a room with its light.

**Deferred to the polish pass (not blockers):** the two-pane desktop layout (the room large on the left, the list on
the right; 1440 is still a 528 px column), a shared button, segment and link system, motion between steps, door and
window marks on the build outline once the read arrives, and "ft" showing twice on the length field.

**Verdict:** SHIP. All six fixes hold in light and dark. On a phone the flow is honest, one question at a time, and
calm. The typed size runs from the outline through the 3D room to the read-back, and the curtains hang on their
window. Items 1–3 above are a few minutes of work and should land before the demo, but nothing here would need an
apology.

SPACE CAPTURE READY TO PRESENT: YES

## 2026-10-28 — Taste Builder rebuilt as a designer's intake (uncommitted, after checkpoint 7109d82)

**Reviewed:** `app/api/taste/turn/route.ts`, `lib/taste/designer-prompt.ts`, `session.ts`, `visual.ts`, `dossier.ts`,
`offline.ts` and `components/taste/*`, against `docs/reference/interior-design/`. Fresh headless Chromium profile,
the sample capture seeded (room 202610271128-dzjy). I ran **one live conversation in type mode: 19 turns** (convo
6a8f49e5…, about 76k input, 7.8k output and 112k cached tokens in `data/usage/taste.jsonl`). I played Priya: her fiancé
Tom moved in ("two garage sales collided"), he practices cello in the room every evening, a greyhound on the sofa,
"a hotel bar at 6pm", aubergine walls, his late grandmother's Persian rug from Tehran rolled up in a closet, Nowruz
with both families in March, $5–8k with the sofa as the splurge. I went through rooms (with chips and nevers),
palettes, materials and patterns ("I'm not sure", 6 pairs). In the read-back I corrected "not mid-century" and
"leave my mom's plastic sofa off the page", then confirmed. Shots at 390×844 light and dark and 1440×900 light and
dark. I walked the offline fallback for 5 turns (no calls).

**As a designer running the intake.** This is the first version that feels like a person listening. The trigger and
the pain come first. It dug where I bit: the cello got a corner, and "I hate the TV" got "make it less of a focal
point". It handled the loss with care ("I'm so sorry about Tom's grandmother") and found the one pattern the room
needs in the rug. The read-back statement is something a designer would actually write. Pacing: life took 6 turns,
taste 6, story 5, plus budget, so 18 turns before the read-back. That's a little over the 4–5 target and longer than
the "about eight minutes" the intro promises. Drawing restraint held (0–2 entries a turn). Where it falls short:
- One turn asked two questions ("Where does the cello live, and where does he sit?").
- It asked whether Biscuit sleeps on the sofa after I'd said she thinks it's hers.
- It recorded "reading" as said, and it's in the final statement. I never said it; it was the tree's guess.
- It asked color in words ("dark and rich, or lighter?") before showing palettes, and asked pattern in words after
  the exploration. The prompt says it never does this.
- The room grid is fixed. After "dim, moody, hotel bar", eight of nine rooms are bright and white. A designer
  would lead with what she described (deco-moody, eclectic-moody, glam-panelled are in the library) and mix in
  contrasts.

**Broken (truth):**
1. *"I'm not sure" ignores the set.* On Pattern it opened a room this-or-that ("Bright and airy, or quiet and
   grounded?", which I'd answered three times). It then recorded `pattern: "plain"`. I'd picked "collected walls"
   and a room hung with colorful art. Being unsure is now saved as a preference. `VisualSet` → `Explore` only
   knows `PAIRS` of rooms, and `treeAnswers` turns "patterns shown, none liked" into "plain".
2. *The correction went wrong.* I said "leave my mom's plastic sofa off the page". The designer said back "her
   mother's sofa is off the page". It crossed out **the grandmother's rug** and "drama from shape and texture". The
   plastic sofa is still under "The nod". I said not mid-century. The statement now says "nothing that reads as
   mid-century", and the line directly under it still says "The look: Art Deco, with mid-century warmth (30%)".
3. *An empty room name.* The capture has `room: ""`, so the dossier is titled "Your", and the confirm line reads "I'll
   start on ideas for your , and you can add more anytime." (`TasteStudio` uses `?? "room"`, which doesn't catch
   an empty string.)
4. *A literal "→" on the page:* "Tom moved in → two rooms' worth of stuff".
5. *The page claims things nobody said:*
   - after two room picks, a taped-on "jewel tones" palette in ink, before any palette was shown;
   - "budget: somewhere in the middle?" from the scan, before budget came up;
   - "a refresh, built around you", the hidden persona read, in the practical strip;
   - "budget: happy to invest" and "budget: $5–8k" both in the read-back, and the same for the timeline.
6. *A 49-second turn* (turn 15) with only a pulsing dot. There's no timeout and no "still thinking".

**As a UI designer.** The intro is calm and right. The desktop two-pane layout (the conversation on the left, the page
on the right) is the right stage. Dark mode holds. The hand-drawn page is charming when full, but:
- On a phone at the start it's five empty dashed boxes, which reads as a form waiting to be filled.
- The "look" zone on a phone crams bars, a float-right polaroid and wrapped notes into a messy collage.
- "Because" lines clip mid-word while they write in ("a room that works for tw").
- Material swatches are uneven: Carrara is a white square with three grey lines (it reads as a cracked screen);
  terrazzo is plain tan; velvet and linen are flat fills. Next to them, the kilim "swatch" is a photo of a rug shop.
- Drawn pattern tiles ("geometric" reads as "AAA") sit beside photos.
- The "what is it about this one?" card covers a third of the grid.
- The read-back on a phone opens with a 130-word wall of text before any picture. Concept boards are visual-first,
  and the statement should be 2–3 sentences.
- "and a touch of eclectic streak" is ungrammatical.
- "I'd rather type" is still a full grey slab.

**Verdict:** POLISH. The conversation is genuinely good, the best thing in the product after Keep / Move. But the
read-back, the moment trust is built, contradicts the correction she just made and crosses out her
grandmother-in-law's rug. "I'm not sure" saves a preference she didn't give.

TASTE BUILDER READY TO PRESENT: NO

## 2026-10-28 — Second pass on the rebuilt Taste Builder (uncommitted, after checkpoint 9f14bbb)

**Reviewed:** `/taste` after the five fixes from the first pass, in a fresh headless Chromium profile (seeded through
`/demo`'s "Skip to the conversation", so the room is "Living room"). I ran **one live conversation in type mode: 19
designer turns** plus the confirm (convo 8a18a81e…, 3–7.5 s a turn, never slow, about 75k input and 7k output tokens
in `data/usage/taste.jsonl`). I played Marcus, an architect, divorced, with Nia (11) and Theo (8) every other week:
- he opened vaguely ("it just feels kind of blah… not us");
- his dad's brass arc lamp from a draftsman's table;
- Lego cities on the floor, and video calls from the bouclé chair;
- rooms with chips and nevers, then **"I'm not sure" on palettes** (5 pairs), materials, and patterns;
- a **style rejection** in words ("please, no mid-century");
- Lisbon and a box of rescued azulejo tiles;
- a **correction naming two lines** ("'Kids at home (8–12, 3–7)'" and "'friends over'");
- asked to wrap up at turn 17, corrected the read-back ("'Bohemian' isn't me; put no mid-century under Never"), then
  confirmed.

Shots at 390×844 and 1440×900, light and dark.

**What the fixes got right.**
- The vague opener got a gentle follow-up with three chips that put words to "blah" ("It feels impersonal / too
  plain / flat"). A designer does exactly that (`question-bank.md`, opening).
- The palette "I'm not sure" now stays in the set: Earthy vs Moody, then Soft color, then Mid-century. It stopped by
  itself when one held three rounds, and it recorded exactly the two he chose.
- Named-line corrections landed: the kid ages were fixed and "friends over" was crossed out.
- "No mid-century" left the blend at once.
- The read-back opens on a hero that respects his nevers, then the palette and materials. The statement is 60 words in
  his own images: Lego cities, his dad's lamp, azulejos on show, striped shutter light. That's the concept-board order
  `dossier.md` asks for.
- Real wood, stone and textile textures, the compact chip row, and a room grid that led with warm rooms are all
  better.
- The wrap-up request was honored immediately.

**Broken (truth).**
1. *The designer says the page changed when it didn't.* After "put no mid-century under Never", it said
   "mid-century now sits under Never, as your biggest one. I've updated the page below." Never still reads "exposed
   brick columns, white curved sectional, concrete". The causes:
   - `not_styles` only removes the family from the blend and writes no Never line;
   - `ReadBack.tsx` keeps `live("never").slice(0, 3)`, the first three, so picture nevers crowd out anything spoken
     later (chinoiserie and brushed nickel are dropped too);
   - `answers.look` is still `"midcentury"` in the saved profile, which `lib/taste/questions.ts:484` reads further
     downstream.

   This is the same kind of failure as the first pass: the voice and the page disagree.
2. *Read-back rows are raw or garbled:*
   - "Starts from: brass arc lamp — the anchor, a round table, seats four " Nia's best friend"" has a stray quote, and
     the round table is something he *wants*, not something he's keeping. It also fell out of the statement after the
     correction.
   - "The nod" pastes his whole Lisbon answer, ending "until midnight.; everyone around one table, talking".
3. *Ink he never said.* The designer's own tree answers draw as sure facts:
   - "unwinding on the sofa";
   - "works in here sometimes → a desk that disappears" (he takes calls; he never asked for a desk);
   - "friends over", until he caught it;
   - "kids at home (8–12, 3–7)".

   After the fix, "kids at home (8–12)" is *struck through* even though it's now true. Who's here says the same thing
   four ways. "gecko campaign (Theo), answer: no" sits in ink like a log line.

**As a designer running the intake.** The tone is kind and quick, but the rhythm is a template:
- Nearly every turn opens by restating him ("A gecko campaign, I respect the persistence." "Lisbon, with the painted
  tiles and those long dinners." "Everyone around one table, talking, and the tiles out…").
- Three set transitions in a row end "Let's look at color / materials / pattern."
- Some questions are still a checklist. "Do you read in here?", chasing its own pencil guess, came right after the
  story of his father's lamp. "Any pets who join in?"
- It missed the designer's obvious move. He has a box of rescued azulejos; a designer asks where they could live: a
  tiled tabletop for that round table, a framed panel behind the video-call chair. Instead it asked about Lisbon in the
  abstract twice.
- Chips sometimes don't match: "Seats the four of us" after he'd said three, and chips offered under a line that asked
  nothing.
- Pacing: the read-back came at turn 18, and only because he asked to stop. Budget and timeline never came up. That's
  still over the ~14 target and the "about ten minutes" promise.
- The style read "Bohemian 60%" for a walnut, leather, brass and plaid architect came from one sage-and-rattan pick. It
  took a correction to get "Eclectic, with organic texture and a touch of Mediterranean sun", which is a better read.

**As a UI designer.**
- The metal swatches are blurry radial gradients. Brass, black steel and nickel look like images that failed to load,
  next to photographic oak and brick.
- Terrazzo is a checkerboard mosaic.
- In the pairs, the "Moody" card has no color-name line while its partner does, and "Terracotta" truncates.
- "Chinoiserie" and "Bold graphic print" are crops of illustrations, not fabric.
- In dark mode the walnut and worn-leather dots in the read-back almost disappear.
- One look line ("pattern with history") has no icon, so the column jogs.
- The final hand line says "your room" where the voice says "your living room".
- Light and dark otherwise hold, and the desktop two-pane layout is calm.

**Verdict:** POLISH. The process is now honest: "I'm not sure" behaves, and corrections to named lines work. But in
the read-back, the moment that earns trust, the designer told him his biggest "never" was on the page when it wasn't,
and printed a garbled line under "Starts from". I wouldn't put it in front of Maeve until the page and the voice can't
disagree.

TASTE BUILDER READY TO PRESENT: NO

## 2026-10-28 — Third pass on the rebuilt Taste Builder (uncommitted, after checkpoint 9f14bbb)

**Reviewed:** `/taste` after the second pass's five fixes (`lib/taste/session.ts`, `designer-prompt.ts`, `visual.ts`,
`components/taste/ReadBack.tsx`, `Dossier.tsx`, `VisualSet.tsx`, `Explore.tsx`, `Swatches.tsx`), in a fresh headless
Chromium profile seeded through `/demo`'s "Skip to the conversation". I ran **one live conversation in type mode: 18
designer turns to the read-back, 21 with corrections, then the confirm** (convo 3df3bc3d…, 20 calls, median 3.1 s, max
4.7 s, about 70k input, 5.8k output and 143k cached tokens). I played Kayla, a night-shift nurse who isn't very
articulate:
- "idk. it feels like a waiting room lol"; she eats on the floor with Mochi the cat and a laptop;
- Dev games on the couch on weekends;
- she wants it "like a cave kind of";
- rooms with chips and two nevers, "I'm not sure" on palettes (Moody three times), walnut and leather with concrete
  as a never, a kilim;
- out of nowhere, her dad drove trucks and brought her a snow globe from every state, 30 of them in a box under the
  bed;
- "idk like 2k? nurse money lol";
- read-back corrections: "i never said the console", "industrial is fine, i liked the green couch one", "idk about
  velvet with her claws", "i dont read in there".

Shots at 390×844 and 1440×900, light and dark.

**What the fixes got right.**
- "No industrial" left Never in ink the moment she said so, and the console came out of the statement.
- Every never shows (spoken, then pictured).
- No log lines.
- Chips appear only under questions.
- Budget and timeline both came up, and the money line is honest about $2k.
- The swatches are now all photographs: terrazzo, brass, black steel, nickel. The patterns are real fabric, every
  palette card is named, and the dark-mode ring keeps the walnut and leather dots visible.
- The palette "I'm not sure" stopped by itself after three Moody picks and recorded exactly that.
- Two moments were real designer work, the kind `intake-process.md` describes:
  - "Kilim and Persian rugs, so the floor you live on gets to be the star" connects a pick to her life;
  - after "I thought they'd look like clutter": "They wouldn't have to; one lit shelf could make them the best thing
    in the room." That's the concrete-object move I asked for. In the read-back it also caught velvet vs claws
    unprompted.
- The read-back is calm and visual-first on both sizes, and dark mode holds.

**Broken (truth).**
1. *The statement is still written from guesses she never confirmed.* The final brief says the room "works for
   unwinding, film nights…". Her first real answer was "nobody sits on the couch", and "unwinding on the sofa?" sat in
   pencil on the page the whole time, never crossed out. The first statement also said "starts from the walnut
   console" after she'd answered "not really" to the anchor question, and the second said "works for reading". The
   pencil rule now holds on the page but not in the concept. The model writes the statement from the tree's guesses.
   This is the third pass in a row where the brief says something she didn't say.
2. *A correction drops the heart of the brief.* After her corrections, the snow globes fell out of the statement, and
   they're the one personal story she offered. The mood words changed every turn: cave-like, then lived-in, then
   collected. Nothing she said changed them.
3. *Voice and page disagree on the close.* "that's it i think" got "That's everything I need, thank you. I'll start
   on ideas…", while the page still asked "Yes, this is it / Not quite?". She had to confirm twice.
4. *The hidden profile shows.* The read-back prints "(70% mid-century, 20% Art Deco, 10% transitional)". She never saw
   a Deco room, and her two room picks were a navy mid-century room and a green-sofa industrial loft. The percentages
   are the AI profile, which the product principles say stays hidden, and "a little Deco glamour" is a claim nobody
   made.
5. *`/demo` is false to Maeve.* `app/demo/page.tsx:94` still says the conversation is "scripted from the question
   tree… matched by keywords… The live AI agent comes next, with your OK." It now runs live on Sonnet. She will read
   this first.

**As a designer running the intake.**
- Life took 8 turns, against a target of 4–5. Two were the tree's internal questions put to a person: "starting fresh
  or a refresh?" (she'd said she lives there), and "a finished room pulled together for you, or one built around you
  and the things you already love?", which is persona sorting. A real designer reads that; she doesn't ask it.
  "Somewhere to eat" (she said "both") was dropped and never reached the brief.
- The echo opener is gone in the prompt but not on the page. Six of the first nine turns open by restating her: "A
  waiting room, that's a useful way to put it." "And a cat, noted." "Two years in and the floor still wins." "So
  there's a Dev and a TV with a purpose." "Mochi on whoever, that's clear." "A cozy cave, that fits…". The same
  happens in the story: "Thirty snow globes, one from every state your dad drove through. Where do they live now,
  besides the box under the bed?" That asks what she had just told it.
- The room grid after "like a cave" was mostly bright: scandi, warm-minimal, a white sectional with a view. The moody
  rooms in the library (deco-moody, eclectic-moody, glam-panelled) never appeared. The `grandmil-wallpaper` crop is a
  pouf against wallpaper, not a room.
- The page wrote things she never said:
  - "Dev on the couch, *her* on the floor": third person on her own page;
  - "performance fabric, no velvet", then "a velvet sofa", then "the green velvet sofa pulled you in";
  - "Mochi *sleeps* on whoever's there";
  - "a cat?" stayed in pencil after "my cat";
  - after "none" on two pictures, "no industrial" went into Never in ink, though she had *liked* an industrial room.
    A family never should come from words, not from one picture.
- The read-back kept asking new questions ("Is the TV where you and Dev still want it?"). After a correction, the
  read-back should only confirm.
- The function she gave isn't in the brief: night shifts, lamps over daylight, eating on the floor. The "lamps and
  evening light" note was the best line on the page, and it vanished.

**As a UI designer.** Calm and coherent at both sizes, and dark mode is good. These go to the visual pass with
Maeve's references:
- the empty zone headings at the start still read as a form;
- "The nod" row reads like notes ("~30, boxed under the bed; …");
- "Edit" sits on the statement's last line;
- the room images are requested at `w=3840` on a phone;
- bouclé reads as peach stucco;
- the dev-only "N" badge covers the input's first letters (not product, but Maeve will see it in dev).

**Verdict:** POLISH. It's close: the swatches, the nevers, the corrections and two genuinely designerly moments are
there. But the brief she confirms still says she unwinds on a sofa nobody sits on, and drops her dad's snow globes.
That's the one thing the read-back exists to get right.

TASTE BUILDER READY TO PRESENT: NO

## 2026-10-28 — Fourth pass on the rebuilt Taste Builder (uncommitted, after checkpoint 9f14bbb)

**Reviewed:** `/taste` after the third pass's five fixes. I used a fresh headless Chromium profile, entered through
`/demo`'s "Skip to the conversation", and ran **one live conversation in type mode** (convo b9ccd894…). It took 15
designer calls: 14 to the read-back, one correction, then "Yes, that's it, dear" to close. Median 3.9 s, max 9.5 s,
about 61k input, 5.3k output and 119k cached tokens, roughly $0.30. Shots at 390×844, plus a check at 1440×900 in dark
mode.

I played Dorothy, a retired fourth-grade teacher who talks in tangents:
- She retired in June. The room is dark before noon (west window), so it feels like a "funeral parlor".
- Walt, her husband, died two years ago. His brown recliner is "hate it but can't get rid of it".
- She does the crossword with coffee every morning. Book club of six meets every other Thursday, and they never have
  enough seats.
- She remembered bean plants on her classroom windowsill.
- She is "not a white-couch person". Pickles the cat sheds orange.
- Her mother's 1956 quilt is in the cedar chest. "Not florals everywhere."
- Thanksgiving is at her house this year. Budget $3–4k on a pension.
- She has 400 boxed mysteries and remembers the library at Greenway in Devon.
- Walt's reading glasses and his brass dinner bell are still in the room. She can let the recliner go "if there were
  something else of his".
- Her knees can't manage low sofas.
- Her correction: "I kill every plant, it was the light I liked", and "the recliner can go".

**What the fixes got right (all five confirmed).**
1. *The statement is true.* Every clause in both statements is something she said or picked. The pencil guesses
   ("unwinding on the sofa?", "reading?") stayed in pencil and never reached the brief. "films and TV" was crossed
   out, not promoted.
2. *Corrections are targeted and the story survives.* After the correction, plants and the recliner left, and the
   quilt, the bell, the glasses, the mysteries and the book club all stayed.
3. *No percentages.* "The look: Scandinavian, with bohemian ease" matches her two room picks.
4. *The close.* "Yes, that's it, dear" confirmed in one step, and the page agreed with the voice.
5. *Nevers.* "florals everywhere" and "white sofa" came from her words. "dark lounge" came from a room she marked as a
   hard no, which is right.

`/demo` now tells the truth about the live designer.

**As a designer running the intake.** This is the first run that felt like a person who listens.
- "I'm sorry about Walt" was one short line, then straight to the mornings.
- "Those plants make me think of the bean sprouts on your classroom sill" was a callback to a tangent she'd dropped two
  turns earlier.
- "A quilt like that could hang on a wall where no cat can reach it" solved her actual fear.
- "Those two small things can carry what the recliner has been carrying" is the best line this product has produced.
  That is what `intake-process.md` means by drawing out the story behind an object, and it led her to let the
  recliner go on her own.
- Life took three turns, not eight, and the section tabs moved on without a form-like feel.
- The read-back reads like the sample brief in `dossier.md`.

**Still wrong (not blockers for Maeve's review).**
1. *Corrections still lose what she reinforced.* She said "it was the **light** I liked". The designer replied "The
   light stays", but the rewritten statement dropped light entirely. Before that, "Light, plants and texture" was the
   only trace of why she came (the room is dark before noon), and "why now" never appears on the read-back card. This
   is the same bug as the "night shifts" drop the builder reported. The statement rewrite should keep every clause
   the correction didn't touch, and "why now" should reach the brief.
2. *The pattern sheet hid a question.* She answered the pattern step in words (the quilt). The next turn reopened the
   pattern grid while the designer asked "Where should the four hundred mysteries live?", and that question sat
   hidden behind the sheet. It recovered a turn later by asking again. Don't reopen a set she has already answered in
   words.
3. *The page lags the conversation:*
   - the recliner said "can't let it go" until the read-back;
   - the reading glasses were never written down;
   - the bell's note says "near where you sit" after she chose "on a shelf with the books";
   - "just you?" stayed in pencil after she said Walt had died;
   - "Mum's quilt" is not her word (she said "my mother").
4. *Echo openers come back after taps:*
   - "Earthy it is."
   - "Gingham and plain texture, so just a touch of pattern."
   - "Washed linen, practical and soft, that suits Pickles too." Washed linen holds cat hair and snags, so this is
     also bad advice per `palettes-materials-patterns.md`.
5. *Read-back details:*
   - The hero image is a low grey sofa, after she said low sofas are hard to get out of.
   - "STARTS FROM: Walt's brass ship's bell" is a nod, not the starting point.
   - The practical line shows "by: in the next few months", a tree label, when she said Thanksgiving.
   - Two closes stack up: "That's the brief…" and then "Got it. On to ideas…".

**As a UI designer.** Calm at both sizes, and dark mode holds. These go to the visual pass with Maeve's references:
- `/demo` still says "DEMO AS OF OCT 27";
- the dev "N" badge still covers the input's first letters;
- room images are still requested at `w=3840`;
- the empty zone headings at the start still read like a form.

**Verdict:** SHIP for Maeve's review. The three truth blockers are closed. What's left is how faithfully the page
tracks later turns, plus the known correction-drop bug, which now has a second example (light).

TASTE BUILDER READY TO PRESENT: YES

## 2026-10-29 — Restructured Taste Builder (three sections, lengths, priorities, craft voice; uncommitted after 1330c44)

**Reviewed:** `/taste` after the restructure (`lib/taste/pace.ts`, `lib/taste/craft.ts`, the new brief shape, the
rewritten `designer-prompt.ts`). Fresh headless profile, seeded through `/demo`'s "Skip to the conversation".
1. Standard length, type mode, 390×844, as Nadia: 31, rents a one-bed, works two days a week at the table by the
   window, Juniper the cat who "scratches everything", board games with four or five friends on the floor, $1,500
   total, done before her sister visits at Thanksgiving.
2. A fresh run with Quick chosen on the intro (two kids aged 6 and 9, a golden retriever, homework, Fridays).
3. 1440×900 in light and dark.

**Blocker: the live designer doesn't run at all.** Every call to `/api/taste/turn` returns 200 and streams
`{"t":"error"}`: Anthropic 400, *"The compiled grammar is too large, which would cause performance issues. Simplify
your tool schemas or reduce the number of strict tools."* (my free probe, request req_011CgWr9QndBFq39EPBd3GKm).
`TurnSchema` grew with program / constraints / direction / decisions / open_questions plus pace fields, and
structured output can no longer compile it. The page treats the error as a passing failure and answers each turn
with the free interpreter, silently, with `convo.offline` still false. Nothing reaches `data/usage/taste.jsonl` (no
rows for convo a494e5ee), so the cost was $0. Nobody could have noticed this from the UI. **The craft-voice live
brief has never run once.** Everything below is the offline interpreter, which is exactly what Maeve would get today.

**The intro is right.** Three numbered sections, the "I'm finished with this section" promise, "you can always come
back", and a three-way length choice with honest times. It's one calm screen with one task. It matches her note
almost word for word, and it is the best thing in this round.

**What broke in the Standard run (offline, because of the blocker).**
- *Priorities resized against her words.* "I'd rather it look good than be done fast" became
  `protect: [speed, style, budget]`, which dropped her to Quick ("Then I'll keep this short"). The cause is
  `offline.ts:84`: `fast` matches with no negation check. Also, picking Standard on the intro doesn't count as
  choosing it, because it's already checked, `onChange` never fires, and `pace.chosen` stays false. So the one
  length she chose on purpose was the one the system was allowed to override.
- *She was asked her budget after giving it.* She said "$1,500 total" in the priorities answer. Extras then opened
  with "For budget, would somewhere in the middle feel right?", a leading question that suggests a bracket. Even
  after she repeated "I said, about 1500 dollars", the brief listed **"Budget range" under Open questions**. That's
  the "never ask what they've told you" rule broken twice, in the section that exists for practical facts.
- *The page pencils what she said and inks what she didn't.* After her first answer the page showed "friends
  over?", "working?" and "sleep?", all in pencil. She said the first two outright and never the third (it's a
  living room; she has a one-bed). "Unwinding on the sofa" and "films and TV", which she also said ("on the sofa
  with a show"), dropped off the page. The desktop run repeated this: "I read and work in there" gave "reading?"
  and "working?" in pencil. Cause: `namedAll` in `session.ts` judges a multi-choice answer all or nothing, so one
  invented choice ("sleeping") demotes every real one to a guess. The previous pass fixed the opposite error (the
  brief inking guesses); this one now pencils facts.
- *The brief.* "A living room for a cat: having people over and working." Program: "a cat". One decision
  (performance fabric, which is correct and well phrased). Juniper, the scratching, the window desk two days a
  week, board games on the floor for five or six, $1,500, Thanksgiving, the August lease end: all gone. A designer
  reading this brief could not draw the room. The `craft.ts` vocabulary is good; the interpreter simply doesn't
  feed it her free-text facts.

**Quick run (chosen on the intro):** 6 replies, as promised, with the right section ticks. The rule decisions are
real trade lines:
- "Sofa in a tight-weave performance fabric, 30,000+ double rubs"
- "TV as the one focal wall; seat at 1.5–2.5× the screen diagonal"
- "Spend on the sofa and the rug; source case goods secondhand or in stock"

This is the voice Maeve asked for (`craft-standards.md`). But the golden retriever never reached "Who's here" as
a decision until the priorities turn. Homework after school was dropped, so there's no task-light or table
decision. "Before school starts in September" was answered, then dropped from the brief. The program line reads
"three people + a dog + kids at home". The statement "A living room for three people and a dog: watching TV."
reads like a template.

**As a designer running the intake.** The structure is now correct per `intake-process.md`: function first, then
pictures, then story and practical bits, with a stopping point. The lines still aren't a designer's:
- "Thank you, that helps." opens turns 2, and then the read-back as "Thank you."
- "Lovely, that tells me a lot." appears after both picture sets in both runs.
- "And a dog, noted." is the echo opener the prompt bans.
- The date is asked as "As soon as possible, in the next few months, or no rush at all?", which is the "how fast"
  framing the research tells us to replace with a date that matters (`README.md`, "Also worth carrying"). The
  live prompt has this right; the offline script doesn't.

**As a UI designer (for the visual pass, not blockers).**
- The phone tabs say "You / Style / Extras", while the intro and desktop say "Who you are / Space and style /
  Extras". Pick one set of names.
- The empty dashed zone boxes at desktop still read as a form.
- "About 10 questions left · Standard" plus "I'm finished with this section" make two rows of chrome above the
  input on the phone. They could share one line.
- The dev "N" badge still covers the input's first letters.
- The read-back's statement + Edit + hero image is calm and well composed at desktop, and dark mode holds.

**Verdict:** POLISH. The structure Maeve asked for is built, and the intro is presentable. But the live designer is
dead on arrival, and the fallback writes a brief that is thinner and less true than last round's. The craft voice
has never been seen live.

TASTE BUILDER READY TO PRESENT: NO

---

## 2026-10-29 — Plug & Play first cut, and the photoreal capture (uncommitted after 1330c44)

**Reviewed.** `/play/[id]` (`components/play/*`, `lib/play/*`) in a fresh headless Chromium (SwiftShader WebGL),
on the cabin 202610291233-9swx at 1440×900 and 390×844 and the sample 202610271128-dzjy at 390×844:
open, Catalog, Add, rotate, Swap, drag on the canvas, From above, and the tray. For capture, I compared
`data/test-photos/*` with the rebuilds of the cabin, lake (202610291232-jg7t) and grey-sofa (202610291245-n1df)
rooms (scratchpad `compare_*.jpg`, `sample_before_after.jpg`), and read their `spec.json` and `look.json` against
`blender/build_room.py` and `blender/photo_look.py`. No paid calls.

### Plug & Play

**What works.** The bones are right, and the editor already feels like a toy rather than CAD:
- tap a piece and a calm pill names it with its price; one floating toolbar (90° left/right, 15°, Swap,
  Remove or Put away, Done);
- undo and redo;
- wall pieces get Higher and Lower instead of rotate;
- a "From above" plan;
- a running cost in the header;
- an honest "Sample: made-up products and prices" label.

"Yours stay free" is exactly the right idea: their own pieces cost nothing, so the number is only what's new. No
console errors at either size.

**What breaks it, in the order the person meets it.**
1. *On the cabin, the architecture is furniture.* The charcoal TV wall and the two oak slat strips are spec items, so:
   - When the 3D view cuts away the right wall to look in, those panels stay standing. They become a 2.5 m freestanding
     screen across the middle of the room, hiding the sofa (`cabinD_01_open.png`).
   - Dragging from the middle of the room picked up "Vertical oak slat strip (near side) · Yours". It walked off the wall
     into the room, and offered "90° left / 90° right / Put away" (`cabinD_08_dropped.png`, `cabinM_07_tap.png`).

   A designer would never hand a client a room where the wall cladding can be carried around. The fireplace, live-edge
   shelf, TV and split AC are the same class. They should be fixed to their wall, hide with it, and not be draggable.
2. *New pieces land on top of what's there.* "Add" placed the Arden sofa:
   - on the cabin, half inside the charcoal panel and over a side table, with the red overlap line showing
     (`cabinD_03_added.png`, `cabinD_09_top.png`);
   - in the sample room, across the existing sofa and the coffee table (`sampleM_03_added.png`, `sampleM_09_top.png`).

   `spot()` searches for clear floor, but the result still overlaps. The very first thing anyone does produces a
   collision. The Sims answer is a piece that lands clear, or turns red and won't drop.
3. *Swap for a cheaper lookalike barely exists yet.*
   - Only one dupe pair is in the catalog (Hollis → Arden, `look: "curved-boucle"`). The Ojai chair's `boucle-lounge`
     has no partner.
   - The catalog lists Arden first, so the natural path (Add the top sofa, then Swap) shows three more-expensive sofas.
     "Same look, $X less" never appears unless you happen to add Hollis.
   - Swapping one of the person's own pieces shows unrelated catalog sofas, ranked by taste and price, with no relation
     to what they own.

   Dupe.com's idea, and what Maeve asked for, is "this, for less". That needs every studio piece to have a basics twin,
   and the swap list to lead with the lookalike.
4. *The phone sheet fights the room.*
   - Closed (118 px), it shows the two tabs and a clipped "SAMPLE" line. The dev "N" badge sits over it. The catalog
     itself is invisible, so a first-time user sees no next step.
   - Raised for Swap, the room shrinks to ~370 px, and the name pill plus the toolbar cover its lower half, which is
     where the piece being swapped sits (`sampleM_05_swap.png`, `sampleM_06_swapped.png`).
   - The header pill loses its "New pieces" label on phones and reads "$1,595 · 1", which is ambiguous. It isn't
     tappable either, though it's the one place a Webkinz player would expect the "what I've added" list.
5. *Pieces are icons, not things.* The catalog thumbnails are flat SVG glyphs, the same drawing for four sofas in
   four colors. The room in Play is the GLB under flat light: grey walls, no contact shadows, none of the warmth the
   Blender renders now have. "Realistic visuals with game-like interaction" (`product-vision.md` §3) currently has the
   interaction and not the visuals. The thumbnails can be rendered from the same parametric models in `models.ts`, for
   free.

**Small notes:**
- "To find a spot for" is the empty default tab on rooms with no sorting. The cabin and the sample both open to
  "Everything has a spot."
- The desktop hint "Drag a piece to move it · drag the room to look around" is good. Phones have no equivalent.

### Real capture

**How close it is.** It reads the room well and builds it like a blocking model. The *read* is excellent. The cabin spec
names all of these:
- the mono-pitch ceiling rising 2.9 → 3.7 m, the dark rafters and the live-edge beam;
- the vertical oak battens and the charcoal TV wall;
- the live-edge shelf and fireplace surround;
- Eames-style shell chairs, tree-slice tables on hairpin legs, and a wire cage pendant.

`photo_look.py` measures the right colors: the charcoal sectional is #3b3d41 and the shag rug #8c8b8a. Room proportions,
door and window positions, floor tone and the overall light are right. The sample before/after shows the light work paid
off, with warm and believable daylight.

**Where it falls apart, photo by photo.**
- *Cabin:*
  - flat ceiling, with no slope, rafters or beam: the single feature that makes this room this room;
  - the battens became two plain oak slabs, and the fireplace and live-edge shelf became an oak box;
  - the shell chairs became black box chairs, the cage pendant a black cone, and the tree-slice tables white marble
    discs;
  - the walls render cyan-tinted (look.json walls #e5f3f3, against "crisp white" in the read).
- *Lake:*
  - the view is a garden with a fence, not the lake and birches;
  - the polished large-format marble became beige tiles with dark grout;
  - the sheers are missing, and the ship painting is a blank green square;
  - render 1 has a yellow-green cast (walls measured #f3ead3).
- *Grey sofa:*
  - the charcoal L-sectional rendered mid-grey and split into a sofa, a loveseat and a third block;
  - the grey shag rug is a flat white plane, though `look.json` measured #8c8b8a, so the measured color isn't reaching
    that material;
  - the walnut top came out pink;
  - a wood-framed TV/mirror panel was invented where the photo shows a dark slatted wall;
  - eye view 2 frames an empty corner.

**The biggest gap:** the builder's vocabulary, not the read. The spec says "mono-pitch ceiling with rafters", "vertical
battens", "moulded shell chair", "live-edge", and `build_room.py` has only a flat ceiling, boxes, and a handful of
generic sofa, chair and table builders, so it drops all of them. Second: with one or two photos there is no render from
the photo's own viewpoint (`render_photo_*` needs ≥8 posed photos). The comparisons set different angles side by side,
which hides the misses rather than measuring them.

**Verdict:** POLISH, for both. Plug & Play's interaction model is right and worth keeping, but a first-time user
collides on the first tap, can drag the walls around in the cabin, and never sees a cheaper lookalike. Capture reads
like a designer and builds like a massing model.

PLUG & PLAY READY TO PRESENT: NO
REAL CAPTURE READY TO PRESENT: NO

---

## 2026-10-29 — Taste Builder after the restructure, the live-designer fix, and the visual pass (uncommitted after 1330c44)

**Reviewed:** `/taste` end to end in a fresh headless Chromium (closed after), seeded by `/demo` → "Skip to the
conversation". I ran one live Standard conversation at 390×844 (typed). The persona: a single mom with two boys
(7 and 10), Biscuit the shedding lab mix who sleeps on the couch, $3,000 hard cap, her mom visiting at Christmas,
and her late father's worn brown corduroy armchair. Then I corrected one brief line and checked 1440×900 in light
and dark. Live run: convo 7da09506, 15 rows in `data/usage/taste.jsonl`, about $0.35.

**The live designer works now.** The two-call brief fixed last round's blocker: every turn was live, and the
read-back came from the second call. The craft voice is real.
- "Tight-weave performance fabric or a washable cover on the sofa, because Biscuit sleeps on it daily and sheds."
- "In-stock pieces only, because your mom arrives for Christmas."
- "Lighting in layers at 2700K on dimmers, a brighter task lamp for homework."
- "White oak, matte hardwax oil; stonewashed linen for curtains and cushions": it routed the linen away from the
  dog without making a fuss about it.
- The loss was handled the way a good designer would: "I'm sorry about your dad. It stays, and we'll build the room
  around it, with the dog's spot kept to the sofa." One sentence of care, then a decision. "Palette and rug drawn from
  the brown of your dad's corduroy armchair" is the best line Homebody has written.

The Program and Constraints sections hold her facts this time: Biscuit by name, the ages, homework at the coffee
table, the cap, the date.

**What a designer would still catch.**
- *The room it already knows is missing from the brief.* The capture says 14 × 10 ft with one big south window. The
  brief has no measurement or clearance at all: no rug size, no sofa length, no 14–18" to the coffee table, no
  walkway, no south-light sheer. Its first open question is "Room dimensions and window positions". The prompt itself
  suggests that line (`designer-prompt.ts:134`, "dimensions, window positions"). Maeve asked for measurements and
  clearances (`craft-standards.md`, "Space"), and the one fact we have for free is left out.
- *Budget asked after she gave it.* She said "$3,000 … can't go over" in the priorities answer, and the notes inked it
  ("$3,000 for the whole room, hard cap"). Extras still opened with "what feels right to spend". She had to say "Like I
  said, 3,000 total." This is the same failure as last round, now in the live path. Line 41 of the prompt scripts the
  budget question with no "skip if known".
- *The nevers over-read one image.* One rejected room (purple wallpaper) became four nevers: wallpaper, "a black
  table", "a curved white sofa", "a chandelier". That is the over-reading `learning-taste-from-images.md` warns about.
  After her correction, the redraw went too far the other way: it also dropped "Jewel tones" and "Black steel", which
  she had explicitly marked as hard no's. The open questions and the idea were rewritten too, and nothing on the page
  showed what changed (the README's takeaway 10: "corrections visibly crossed out").
- *The filter is breaking sentences.* `deFluff`'s trailing-word rule (`craft.ts:33`, `\b(a|an|and|with|the)\s*$`) cut a
  legitimate "with": the line on screen read "tell me which ones you could live ." This goes through the spoken path
  too. After the correction, the desktop brief showed "Dog sleeps on the sofa; the corduroy armchair is off-limits to
  your", which is cut mid-phrase. The "Because" labels make broken English out of noun phrases: "Because $3,000
  hard cap…", "Because done before mid-December…".
- *Palette stated twice, differently.* Direction says "soft color as the secondary, the brown of the corduroy chair
  as the grounded accent". The next line says "30 Sand/Camel · 10 Clay/Espresso". A brief that contradicts itself
  isn't a deliverable.
- *Pencil on things she said.* "Unwinding on the sofa", "films and TV" and "reading" stayed as "?" guesses through the
  whole first section, although she said "a book or a show". They were on the page before she had said a word.

**Flow.** Standard felt the right length for a busy parent: about 12 replies, two "Keep going, or move on?" stops,
four picture sets. The priorities line is a list read aloud ("some want it done fast, some want it just right, and
some care most about the look, the budget, how it works…"). Ask it as one question with the chips doing the listing.
"That's enough for me to go on. Keep going, or move on?" is the prompt's exact wording both times; let the model
say it in its own words, as the prompt intends. The correction reply "The black table and the chandelier are fine."
just repeats her back; it should say what was redrawn.

**Visual.** Gambetta and Switzer are a real step up: the intro, the designer's line and "Your living room" no longer
look like a default stack. The desktop brief is composed: the idea beside the hero picture, the palette bar,
numbered sections in a two-column grid. Dark mode holds. But the "studio working sheet" is still a well-made card
list (eyebrow, hairline, row). Kalam appears only as the "?" glyph, so nothing on the page feels drawn by a person.
On the phone the picture sheet puts "I'm not sure" and "I'm finished with this section" *above* the question, and the
dev "N" badge still covers "Type your answer". The "Natural oak" swatch reads orange-brown next to a brief that says
white oak.

**Verdict:** POLISH. This is the first time the live designer has produced a brief I'd hand to a carpenter for half
of it. But it ignores the room's own measurements, re-asks the budget, over-reads a rejected image, mangles
sentences with its own filter, and contradicts itself on the palette. Maeve would hit at least two of those in one
run.

TASTE BUILDER READY TO PRESENT: NO

## 2026-10-30 — Final check on Taste Builder: room-aware brief, Quick swap, corrections (uncommitted after 8f9bcaf)

**Reviewed:** `/taste` at 390×844 in a fresh headless Chromium (closed after), seeded by `/demo` → "Skip to the
conversation". I ran one live conversation at Quick, typed (convo 3b43c1a3). Then I looked at the saved state at
1440×900, in light and dark. The persona: "I'm Priya", 34. She works from home three days a week at a little desk in
the room. She said "the window faces west, not south… blazing hot in the late afternoon". Mochi the cat naps in that
sun and claws anything nubby. She has two or three friends to dinner on the coffee table, $2,000 for the whole room,
and her parents visit in late January. She picked two rooms and two palettes, and rejected two rooms and High contrast.
Then she corrected the brief: "not everything stays… the grey sofa has to go. The bookshelf and the walnut console
stay."

**What's fixed and working.**
- Quick is right-sized: two replies, one room set, one palette set, then the brief. There was no anchor or story
  question.
- Budget and date were never re-asked. They became concrete lines: "in-stock pieces only, no made-to-order", with the
  reason "Why: done before your parents visit in late January".
- The "Why:" labels read cleanly, and no sentences were cut by the filter.
- Her name became "you" in the body text.
- The room is in the brief, with numbers:
  - "14 ft x 10 ft with an 8 ft 6 in ceiling and one 5 ft window facing west" (it took her correction over the
    capture);
  - "Rug 6 × 9 ft: the largest standard size that leaves 18" of floor at the walls";
  - "Sofa up to 96" on the 14 ft wall; coffee table about 64" long, 14–18" from the sofa".
- There is one 60-30-10 line.
- Pencil appears only on the pre-read guesses and the open questions.
- The live notes are good designer shorthand: "Mochi… claws nubby fabric ↳ tight-weave performance fabric, no bouclé or
  loop pile". In the dossier, the nevers were precise: "exposed brick columns", "navy sofa".
- The picture sheet's "What is it about this one?" is a real designer's move.
- On the phone, "I'm not sure" and "I'm finished" now sit below the grid.
- The desktop brief is composed, and dark mode holds.
- The designer's reply to the correction ("That puts the sofa first in the $2,000, in a tight-weave fabric Mochi can't
  hook.") is exactly right.

**What a designer would still catch.**
- *The west window gets no light treatment in the brief.* The notes drew "West window, hot after 4pm ↳ linen sheers,
  low-sheen finishes", but the brief dropped it.
  - `ownBrief` filters direction lines with `wrongLight(x, sp)` (`session.ts:448`). `facing()` (`craft.ts:198`) reads
    only the capture's "Large south window", so any line naming west is thrown away, even after she corrected it in her
    own words.
  - The south fallback was skipped only because "Desk zone at the window" contains "window".
  - The result: a client who said "blazing hot in the late afternoon" gets her desk *at* the west window ("sits in the
    best daylight"), with no solar shade and no glare plan. A designer would set the desk perpendicular to the glass and
    specify solar shades. The fix that was meant to stop wrong light advice now suppresses the right advice.
- *The correction didn't redraw only what it touched. It re-wrote half the brief and left the contradiction standing.*
  After one sentence about the sofa and two kept pieces:
  - the struck line is correct ("$2,000…; existing pieces stay"), but its twin decision "Spend only on gaps and keep
    existing pieces" is still unstruck, next to the new one;
  - Direction now has the style references twice, the desk zone twice, and the rug twice ("6 × 9 ft" and "Rug sized to
    leave 18 in…");
  - "$2,000 for the whole room" appears as a new line beside its struck twin;
  - "Which existing pieces are definitely staying" is still an open question she has just answered;
  - untouched lines were struck and re-worded: the tight-weave decision, the desk decision, and the brick never.

  The brief got longer and less true with each correction. `dossier.md` and README takeaway 10 call for a redraw of the
  touched lines only.
- *"Existing pieces stay" was claimed without her saying it.* `keepOK` checks only named pieces, so a blanket "existing
  pieces stay" passes. It also contradicts the brief's own open question about what stays.
- *The nevers regressed to whole photo captions in the brief.* The dossier had "exposed brick columns" and "navy sofa",
  but the brief says "Exposed brick columns, steel windows, a grey tufted sofa" and "The navy sofa under a packed wall
  of colorful art, flowers and plants". Neither is what she rejected: in the second picture the packed, colorful
  gallery wall is the point, not the sofa. She is replacing a grey sofa, so "a grey tufted sofa" reads as a
  self-contradiction.
- *The Idea is a program summary, not an idea.* "A living room for one and a cat that works as your office…" has a
  dangling modifier (the cat works as the office). It says nothing about the look, the light or the material.
  Compare last round's "Palette and rug drawn from the brown of your dad's corduroy armchair".

**Smaller.**
- The palette line routes "Butter/Sage" to "upholstery, wood, rug", and butter-colored wood is not a finish.
- She picked Warm neutrals too, but the bar shows only Soft color.
- The hero image is the cool grey room, not the sage one she reacted to ("The colors").
- On return after a finished brief, the intro still says "Three short sections…" above "Carry on talking". She has a
  brief: show it.
- "Which of these feels most like you?" allows several picks.

**Verdict:** POLISH. The interview is now the right shape, and the first draft of the brief is the best yet. But the
one correction made the brief contradict itself in four places. The west light, the biggest physical fact she
volunteered, is filtered out of the deliverable. Maeve will correct a line within her first minute, and she will see
it.

TASTE BUILDER READY TO PRESENT: NO

---

## 2026-10-30 — Plug & Play, second pass: last round's five fixes, after the visual pass (uncommitted after 1330c44)

**Reviewed.** `/play/[id]` in fresh headless Chromium instances (SwiftShader WebGL, one per run, each closed after):
- the cabin 202610291233-9swx at 390×844 and 1440×900;
- the sample 202610271128-dzjy at 390×844 (light) and 1440×900 (dark).

In each run I opened the room, probed it with taps in 3D and From above, then:
- added the top sofa, swapped it, added a chair, then added a second sofa;
- swapped one of the person's own pieces;
- opened "What you've added".

Screenshots are in scratchpad `pp3/` and `pp3b/`. No console errors, no paid calls.

**What got fixed, and it shows.**
- *Built-ins.* On the cabin, the TV wall, slat strips and fireplace now hide with the cut-away wall. They no longer stand
  as a screen in the middle of the room. A 25-point tap probe in both views selected only furniture (the chaise module,
  shell chairs, the new pieces), never the cladding.
- *Swap is now "this, for less".* Every studio piece shows a "Lookalike $749" chip in the catalog. Swap leads with
  "Lark linen-look sofa · Same look, $846 less · $749 −$846" under "Now: $1,595. Tap one to try it in the room."
  On the person's own grey sofa it leads with "Closest to yours", then the lookalike. That is the Dupe idea, said in
  one line.
- *The phone sheet.* The closed sheet is a strip of rendered pieces with prices, so the next step is visible. Swap
  lowers the toolbar and gives the room the top half. The cost pill opens "What you've added", with one row per piece
  and "Your own pieces stay free".
- *Thumbnails.* They are real renders of the same models. Rattan reads as rattan and leather as leather.

**What still breaks it.**
1. *The first Add in the sample room still collides.* In the sample (the demo room), the first Add put the Marlow sofa
   through the floor lamp and into the bookshelf, with the red overlap line showing (`sampleM_02_add_sofa.png`). The
   toast was honest: "No clear floor … by the wall for now". But the wall fallback doesn't check what's already against
   the wall.
   - The third piece did the same: the Hollis sofa landed across the bouclé armchair, and the Pell chair sat on top of
     it (`sampleM_07_top.png`).
   - On the cabin, the second sofa went *under the live-edge dining table* (`cabinD_05_add_sofa2.png`).

   The toast already names the right move ("tap yours, then Swap"), but as instructions. A designer adding a sofa to a
   room that has one means "in place of yours". That should be the one-tap default, not a three-step chore.
2. *Placement ignores what the room is for.* In the cabin, the first sofa found clear floor in the dining end. It sits
   back-to-room, facing the dining table, with the shell chair against its arm (`pp3/cabinM_08_top.png`).
   `craft-standards.md` says "seating faces or frames" the focal point, with 36" walkways and 36" behind a dining chair.
   Clear floor isn't the same as a good spot.
3. *The phone toast takes over the room.* It runs three lines, black, across the top third of the canvas, and stays up
   while the person is deciding. It should be one line plus the action.
4. *From above is a postage stamp on a phone.* The cabin plan fills about a quarter of the canvas width, inside a grey
   void (`cabinM_06_top.png`). This is the view where people check fit, and it should fill the frame.
5. *The room still reads as a massing model.* The cabin walls render cool grey against a flat grey backdrop. On first
   paint, the catalog shows SVG glyphs that pop into renders a few seconds later (`sampleDdark_01_open.png`). The
   pieces are now nicer than the room they sit in.

**Small notes:**
- The "To find a spot for" tab is still there when it's empty.
- In the closed phone strip, the price labels sit on the bottom edge with no safe-area padding.
- "Indigo flatweave rug, 6 × 9" breaks after "6".
- The 9–10 px chips on desktop are at the edge of legible.
- Dark mode holds everywhere else.

**Verdict:** POLISH. This is a real step: the room behaves like a room, and Swap finally says "same look, less". But in
the demo room, the very first Add still drives a sofa through a lamp. That collision was the first thing I flagged last
round, and it is the first thing Maeve would do.

PLUG & PLAY READY TO PRESENT: NO
