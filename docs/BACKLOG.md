# Homebody backlog

Highest priority first. Keep this current at the end of every session. Details for each item are in
`docs/autoloop/log.md`, under "Maeve's review of round three" (2026-10-30), unless noted.

## Now (in progress when paused, 2026-10-30)

1. **Taste Builder: style views of her own room:** built (2026-10-30, cloud session). `components/taste/styleshots.ts`
   renders her captured room in all 9 presets (`lib/taste/styleviews.ts`) when `/taste` opens, and the rooms set shows
   them, with stock photos under "Show me more" and as the fallback. Left: check it in a real browser mid-interview
   (it was only checked on a test page in headless Chrome), and get a design-critic review.
2. **Taste Builder: shopper question:** built (`shop` and `brands` questions, `lib/taste/shopping.ts`, "Sourcing"
   line and sourcing decisions in the brief).
3. **Handoff from the brief into Plug & Play:** built ("See it in your room" opens `/play/<id>?from=brief`).
4. **Plug & Play v2:**
   - **The room starts furnished:** first slice built (`lib/play/propose.ts`, rule-based; each pick has a craft reason,
     shown in the "First pass" tab). Left: the fuller design engine (`lib/design/`: Wada color matching, ripple engine;
     see `docs/reference/design-principles/`), and marking the proposed pieces in the room itself.
   - **Walkthrough:** built, 2 steps, skippable.
   - **Style presets** (critic, 2026-10-30): spread them further apart (darker Japandi, warmer limewash, terracotta near
     #B5532E, deeper navy and ruby), a rug pattern per style, cut caption words a render can't show.
   - **Real products:** from `docs/reference/sourcing/seed-products.json` (credit "Amazon.com, CC BY 4.0"; no prices,
     so label them), ranked by her sourcing preferences.
   - **Feedback on any piece:** one-tap like or dislike; a "Change this" sheet with parameter chips (budget, color,
     style, material, size, shape) plus text or voice, giving 3–5 alternatives; gentle nudges.
   - **Ripple toggle:** "Just this piece" or "Let the room follow", with a preview.
   - **Swipe deck:** "Teach me your taste".
   - **"Ask your designer" / "Add to my brief":** links back into the interview.
   - **"Next: review and buy"** goes to `/checkout/<id>`.
5. **Transaction, `/checkout/[id]`:**
   - new pieces with images, links and prices (or labelled estimates), plus cheaper-lookalike toggles;
   - totals against the budget;
   - room by room;
   - per-retailer link groups, with no payments;
   - an affiliate disclosure placeholder;
   - a printable plan.

   Started; check what exists.

## Next

6. **Re-review with the design critic:** Space Capture (latest fixes), Taste Builder, Plug & Play and real capture. Each
   last verdict predates its latest fixes.
7. **Small Taste Builder issues:**
   - materials read off photos can still slip into the brief's idea line;
   - blanket "keep what's there" phrasing slips past the filter;
   - the second-palette strip, the hero choice, and reopening on the brief are unverified in a browser.
8. **Small Plug & Play issue:** a second coffee table doesn't offer "In place of yours".
9. **Small viewer issue:** the still fallback when WebGL is off shows "Drag to turn the room".
10. **Voice mode** has never been tested with a real microphone, so test it end to end.

## Later, or needs Maeve

11. **Real capture of her own room.** It needs her photos or video. Then camera poses (Apple photogrammetry needs
    overlapping walk-around shots) and photo textures on walls.
12. **Real-product feeds:** affiliate sign-ups (Impact.com first, then Amazon Associates/Creators API, Skimlinks,
    CJ/Awin, eBay/Etsy keys). Needs her accounts.
13. **Design canon storage:** decide with her (`docs/reference/design-principles/storage-plan.md`).
14. **Posting the build-in-public threads:** needs her sign-off, then X API access for auto-posting.
15. **Production gate:** confirm `?dev=1` panels never ship (`NODE_ENV` gating) with a real production build.
16. **Unsplash photographer credits:** fill them in, in `public/taste/CREDITS.md`, before launch.
