# X thread, 2026-10-29 (first digest: days 1–4, focused on 10-28 and 10-29)

Status: **draft, needs Maeve's sign-off.** Not posted.
Counts use X's weighting (′ ″ × count as 1). Every post is under 280. No links in the thread; the long-form link
goes in a reply under the last post.

---

**Hook** (262) · media: `media/01-typed-size-three-screens.png`

> I'm building Homebody, an AI interior designer. Day 4.
>
> You type your room's size. It draws the floor at that size while the 3D room builds, then reads it back: 16′ 6″ × 12′.
>
> An earlier build asked for the size, then showed 14 × 10 ft. A critic agent caught it.

Alt text: Three phone screens. 1: "How long is the room?" with 16 ft 6 in typed. 2: "Building your room", a green
floor outline labelled 16′ 6″ by 12′ above a build checklist. 3: "Here's your room", a 3D living room, with
"16′ 6″ × 12′ · 8′ 6″ ceiling" and "9 pieces staying · Moving: TV · Going: grey sofa".

---

**1/** (211) · media: `media/02-sort-clip.mp4` (12 s, 780×1688, muted)

> 1/ Then you sort what's already in the room, on the 3D model: Keep here, Move it, Remove. Tap the sofa, choose Remove, and it turns pink in the room.
>
> It was the one screen I liked as-is on my first walkthrough.

Alt text: Phone screen recording. A 3D living room above a list of pieces. The grey sofa is selected and marked
Remove, and it turns pink in the model; the TV is marked Move it and turns amber.

Fallback still if the video won't upload: `media/02a-sort-phone.png`.

---

**2/** (256) · media: `media/03-taste-intro-phone.png`, `media/04-taste-notebook-desktop.png`

> 2/ Taste Builder is a designer's intake, not a style quiz. Rebuilt today from my notes:
>
> 3 sections: who you are, space and style, extras
> A length choice: about 2, 5 or 15 min
> "I'm finished with this section" works anytime
>
> A notebook fills in as you talk.

Alt text 1: Phone screen: "Before I design anything, I'd love to get to know you." Three numbered sections, then
"How much time do you have?" with Quick (about 2 min), Standard (about 5 min) and In depth (about 15 min).
Alt text 2: Desktop. The conversation on the left asks about budget; on the right, a dotted notebook page titled
"Your living room" with handwritten notes: friends over, working, two of you, a dog, a palette strip, a taped-on
room photo, and a Never list.

---

**3/** (279) · media: `media/05-taste-brief-crop.png`

> 3/ The brief it ends on should read like a designer's working notes. A filter cuts mood words like "inviting" or "curated" unless something concrete is behind them.
>
> From an offline test run: "Sofa in a tight-weave performance fabric, 30,000+ double rubs, because a dog at home."

Alt text: A design brief titled "Your living room", with Program, Direction (style and a 60/30/10 palette), Key
decisions, Nevers and Open questions.

---

**4/** (276) · media: `media/07-play-clip.mp4` (about 29 s, 1440×900). Stills if needed:
`media/06a-play-added-piece.png`, `media/06b-play-swap.png`

> 4/ Plug & Play, first cut: drag, rotate and swap pieces in the captured room. The running cost counts only what's new; your pieces stay free.
>
> The catalog is 34 made-up sample products. New pieces can still land on top of old ones, and cheaper-lookalike swaps barely work yet.

Alt text: Desktop 3D editor. A leather sofa is added from a catalog marked "Sample: made-up products and prices",
dragged, rotated, then opened in Swap, which lists three other sofas with price differences. The header shows
"New pieces $2,890 · 1". The new sofa overlaps the existing one.

---

**5/** (276) · media: `media/08-capture-photo-vs-render.jpg`

> 5/ First real-photo test, on freely licensed photos (not my room yet). Left: photo. Right: rebuild.
>
> It reads the room well: sloped ceiling, battens and live-edge shelf are all in its notes. But it builds a massing model. Flat ceiling, boxes. The builder needs more shapes.

Alt text: Left, a photo of a long living room with a sloped, beamed ceiling, an oak-slat wall, a charcoal TV wall
and a fireplace. Right, Homebody's 3D rebuild: the same layout, floor tone and doors, but a flat ceiling and plain
box shapes for the slats, shelf and chairs.

**Reply directly under 5/ (required credit, CC BY 2.0):**
> Photo on the left: "Stylish living room features a comfortable gray sofa and wooden paneling under a high ceiling" by Shixart1985, CC BY 2.0, via Wikimedia Commons.

---

**6/** (273) · text only

> 6/ What broke: the live designer stopped answering. The API rejected its reply schema as too large, and the page quietly switched to the offline script. Nothing on screen said so.
>
> The critic caught it by probing the route. Lesson: in dev, a fallback has to announce itself.

---

**7/** (274) · text only (optional: a cropped screenshot of one `READY TO PRESENT` line from
`docs/autoloop/critique.md`, if Maeve wants one)

> 7/ How I work: Claude Code runs on a 20-minute timer. Build a step, then a design-critic agent reviews it, then a next-step agent saves a checkpoint and picks what's next.
>
> The critic's bar: "Could this be presented to Steve Jobs and Jony Ive without apology?"

---

**8/** (240) · text only

> 8/ 4 days: 20 checkpoints on a private git ref (never my branches), 21 critic reviews.
>
> Next: a visual pass with new typefaces, no more overlapping pieces in Plug & Play, and a builder that knows sloped ceilings. Then photos of my own room.

**Reply under 8/** (once the Substack post is live):
> The full write-up, with the critic's notes and all the screens: <link>

---

Posting time: Tue–Thu, 9–11 am US Eastern, with an hour free afterwards to answer replies.
