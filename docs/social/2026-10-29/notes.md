# Notes for Maeve: digest 2026-10-29

**Summary**
1. The first digest covers days 1–4 and centres on 10-28 and 10-29. The hook is the typed room size carried all the
   way through (16′ 6″ × 12′), after the critic caught the review showing 14 × 10 ft.
2. The thread has 9 posts, all under 280 counted. The Substack draft is about 1,190 words. Media is in `media/`:
   12 images (including the 3-screen hook composite) and 2 clips.
3. Nothing is posted. It needs your sign-off. The push notification and SendUserFile weren't sent, because those
   tools weren't available to this run.

## Left out, and why

- **All costs and usage numbers**, including per-conversation spend, the $10 photo-read cap and the 150-call daily
  cap figure. Project rule: no per-call costs or usage numbers. The posts only say there's "a daily cap".
- **The test personas** (the couple with the cello and the greyhound, the cat owner, the family with the retriever).
  They could read as real people. The Taste Builder screenshots come from my own neutral offline run: two people, a
  dog, a window desk.
- **Dev chrome.** The Next.js "N" badge and the amber "offline" pill were hidden with injected CSS for the captures.
  No persona or dev panels are in frame.
- **Voice (Lily / ElevenLabs).** It's real, but the clips are muted and it isn't visible, so it's saved for a later
  digest.
- **Your personal files outside the project.** Not opened.
- **The typeface swap.** It was happening live while I captured (at 12:50 `app/fonts` gained Erode, Gambetta and
  General Sans). It's mentioned only as "next". A Taste run taken mid-swap was discarded so the fonts stay
  consistent.

## Claims to double-check before posting

1. **"Day 4."** The first checkpoint is 10-26 21:25, so today is the 4th calendar day.
2. **"An earlier build asked for the size, then showed 14 × 10 ft."** Source: the critique entry "Space Capture after
   Maeve's first-demo notes", fixed by `fitToSides` (checkpoint 9f14bbb). I re-ran the free sample build today with
   16′ 6″ × 12′ and the review read it back correctly (room `202610291638-3gm2`).
3. **"The one screen I liked as-is."** This paraphrases your demo note 5 ("She likes the Keep / Move experience"). Please
   confirm it's how you'd say it.
4. **The brief line** "Sofa in a tight-weave performance fabric, 30,000+ double rubs, because a dog at home" comes from
   the **offline** rule-based interpreter (`lib/taste/craft.ts`), not the live designer. The post says "offline
   test run".
5. **Post 6, the live designer outage.** Source: today's critique ("The compiled grammar is too large…"). It looks
   fixed since, because live turns were logging again from about 12:50 EDT. But no log or critic entry confirms
   the fix, so the post doesn't claim one. Re-check before posting. If it's fixed, you could add "Fixed the same
   afternoon."
6. **Real capture.** The coordinator's brief said "real capture works on real photos". The sources say something
   narrower:
   - The log says "the photoreal pipeline is still in progress".
   - The critique gives `REAL CAPTURE READY TO PRESENT: NO`: "reads like a designer and builds like a massing
     model".

   The thread says exactly that, and that these were freely licensed photos, not your room.
7. **The photo credit.** The cabin photo is CC BY 2.0 (Shixart1985, Wikimedia Commons, per
   `data/test-photos/CREDITS.md`). Attribution is required, so the thread has a credit reply under 5/, and Substack
   has a caption. Don't drop it.
8. **The room photos in the Taste Builder screenshots** are Unsplash-licensed (`public/taste/CREDITS.md`).
   Attribution is appreciated but not required; the photographer names were never captured.
9. **"34 made-up sample products"** is the count of entries in `lib/play/products.json`. The app labels them
   "Sample: made-up products and prices", and the posts say so.
10. **"20 checkpoints, 21 critic reviews."** Counted from `refs/homebody/checkpoints` (excluding the initial commit)
    and the `## 2026-…` entries in `docs/autoloop/critique.md`. Both will grow if the loop keeps running before you
    post.
11. **The "20-minute timer" and the Jobs/Ive quote.** From `docs/social/workflow-notes.md` and
    `.claude/agents/design-critic.md`.

## Visual notes

- The 3D shots came from a fresh headless Chromium (SwiftShader WebGL), closed after each run. One free sample build
  ran through the app's own sample path, creating room `data/rooms/202610291638-3gm2`. Delete it if you don't want it.
- Offline mode for Taste Builder came from intercepting `/api/taste/turn` in the test browser. It returned the same
  `{"t":"unavailable"}` line the route sends with no key. `route.ts` and its `KEY_ENV` were never edited, and no live
  designer call came from these runs (each run intercepted 1 call, then the page stayed offline).
- `07-play-clip.mp4` is about 29 s and has a slow stretch in the middle. Trim it to 15 s if you prefer.
