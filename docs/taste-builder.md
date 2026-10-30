# Taste Builder — sections, length and the question tree

Last updated: 2026-10-29

The first part of this doc is how the conversation at `/taste` (`components/taste/TasteStudio.tsx`) is paced: its
three sections, each section's minimum, and how long it runs. The code for that is `lib/taste/pace.ts`, and the
designer's instructions are in `lib/taste/designer-prompt.ts`. The second part is the plain-language version of the
question tree, `lib/taste/questions.ts`, which the live designer and the free interpreter use as their map.

## The conversation (Maeve's review, 2026-10-29)

### The intro says four things, plainly

- There are three sections.
- You can say "I'm finished with this section" anytime and move on. The same control sits under the conversation
  the whole time.
- The more you share, the better we know your style.
- You can come back and add more later.

It also asks "How much time do you have?" (see Length, below).

### Three sections

1. **Who you are.** One open question: "Tell me a little about yourself, and how you see yourself using the space."
   The room's function (who's there, what happens in it, kids, pets, work, hosting) is inferred from that answer
   rather than asked as a checklist. Then the **priorities question**, guided but open-ended: "Where do your
   priorities lie with this room? Some people want it done fast, some want it just right, and some care most about
   the look, the budget, how it works, or making it personal." It's asked early because it sizes the rest.
2. **Space and style.** The visual sets: rooms, then palettes; materials, patterns, a feeling question, hard nos
   and a place that felt right are depth. At most one question about what isn't working in the room.
3. **Extras.** How personal the room should feel (and, if they want it, the story and one quiet nod), then the
   practical bits: a budget range and a date that matters.

Deliberately not asked any more: "why now" or "why are you refreshing" as a question of its own (if they offer a
reason, it's drawn under "Why now" and the conversation moves on), and which of their pieces they didn't like (the
sort already says what's going).

### Section minimums, and why

Each section's minimum is the least a designer can start work from. They're kept small on purpose; everything else
is depth.

| Section | Minimum | Why this and nothing more |
|---|---|---|
| Who you are | Their answer about themselves and the space; their priorities | One open answer gives who's there and what the room is for, which decides the furniture list before style does (`intake-process.md` §2). Priorities decide what gets given up first, and how long to keep talking. |
| Space and style | The rooms set; the palettes set | Rooms are the strongest single style signal, and the rooms set also catches the rooms they'd never live in, so hard nos come for free. Palette is what makes new pieces belong with what stays. Materials and pattern can be read from those two well enough to start. |
| Extras | A budget range; a date that matters | Every recommendation is priced, so there's no plan without a range. The date decides in-stock versus made-to-order. It's not needed when speed is their priority (the answer is "as soon as possible") or a date already came up. The story is the heart of a customized room, but it's optional: it's offered, never required. |

Once a section's minimum is in, the designer offers a natural stopping point, once per section: "That's enough for
me to go on. Keep going, or move on?" with "Keep going" and "Move on" as quick replies. At Quick length it isn't
offered (it would double a hurried person's questions); the designer just moves on.

### Length

The intro offers three lengths, and the choice can be changed midway from the control under the conversation, or
in words ("I've got more time", "let's wrap up").

| Length | Shown as | Their replies (you / style / extras) | Who it's for |
|---|---|---|---|
| Quick | about 2 min | the minimum only (2 / 2 / 2 at most) | In a hurry; "just get it done" |
| Standard (default) | about 5 min | about 3 / 4 / 3 | Most people |
| In depth | about 15 min | about 5 / 6 / 5 | People who love this part |

Why these three, and no 30-minute option: a designer's first consultation runs 60–90 minutes in person, but much of
that is walking the room, which Space Capture already did. Online style quizzes run 5–10 minutes, and completion
drops past about 7–8 minutes (`learning-taste-from-images.md`). So Standard sits under that line, Quick is the
true minimum, and In depth is for people who chose it. A 30-minute option would promise a conversation the
question bank can't fill without padding.

**The priorities answer resizes the interview.** The length shown selected on the intro counts as their choice
(the critic found a visibly selected Standard being overridden). Within it, their priorities shift where the depth
goes: the look → one more style reply; personal → one more in Extras; how it works → one more in Who you are;
budget → money comes up plainly in Extras. Saying plainly that they're in a hurry ("speed, honestly", "I just need
it done", "let's wrap up") drops to Quick, and "I've got more time" goes deeper, at any point. A negated phrase
("I'd rather it look good than be done fast") never counts as speed, and the interview is never shortened when the
look or getting it right matters to them.

**The remaining length is shown honestly:** "About N questions left", counted from each section's reply target and
what its minimum still needs (at Quick, only what's missing). It never shows a number lower than what's still
required.

### Fallbacks and saved state

- The live turn's schema is kept small and flat, and the brief is a second, read-back-only call (`BriefSchema`):
  one schema for both grew past what structured output will compile (an API 400, found by the critic on
  2026-10-29). Any 4xx from the API now switches the conversation to the free interpreter for good and is logged in
  dev; dev builds show a small "offline" tag in the progress row whenever a turn came from the interpreter.
- The free interpreter writes budget figures and dates said anywhere ("about $1,500 total", "before my sister
  visits at Thanksgiving") onto the practical strip, so they count toward the Extras minimum and land in
  Constraints; it asks the practical questions plainly ("What feels right to spend on this room?", "Is there a date
  it needs to be ready for?"), with no guessed bracket and no echo openers.

- The free interpreter (`lib/taste/offline.ts`) walks the same three sections with the same minimums, offers the
  same stopping point, honours the length and "I'm finished with this section", and resizes from the priorities
  answer the same way.
- Conversations saved before this change (sections `life` / `taste` / `story`, no length) load as Who you are /
  Space and style / Extras at Standard length (`migrateConvo` in `lib/taste/session.ts`).

### Notes and the brief: the craft, not the mood (Maeve, 2026-10-29)

Every note on the page and every line of the brief is a design decision, or a fact that drives one, in the trade's
vocabulary (`docs/reference/interior-design/craft-standards.md`): clearances, lighting layers and color
temperature, species and finish, sheen, durability (double rubs), 60-30-10 roles, lead times, and style named by
reference. The truth rule still holds: facts are what she said, picked or confirmed (ink); a decision always carries
its "because", the fact from her that drives it; other inferences are pencil.

- **The brief** (ReadBack) is structured like a designer's: one plain sentence at the top, then Program,
  Constraints, Direction, Key decisions (each "— because …"), Nevers and Open questions. The live designer writes
  program, constraints, direction, decisions, nevers and open questions (`TurnSchema.concept`); the page adds what it
  knows for certain: kept pieces, her practical lines, the style blend by reference, the palette as 60-30-10 with
  named roles, and the materials she picked with their finishes (`lib/taste/craft.ts`). The free interpreter writes
  the same structure from rules (`ruleDecisions`, `openQuestions`).
- **Mood words:** at most two in the whole brief, each tied to its means ("warm = walnut + brass + 2700K"), usually
  none. The notebook page keeps at most two of her own words, minus filler.
- **Banned filler** ("warm and inviting", "a sanctuary", "effortless", "curated", "gathered", "elevated",
  "cozy yet…", "timeless", "a space that tells your story", "the heart of the home", "a touch of", and more) is in
  the prompt with good and bad examples, and is also cut in code from every note, brief line and statement the model
  writes (`deFluff` in `lib/taste/craft.ts`). Briefs saved before this change keep their older layout, with the
  filler cut on display.
- **Style names** are references with what they put in the room ("Mediterranean, with mid-century walnut and
  tapered legs"), never "a touch of bohemian ease".

### After the critic's 2026-10-29 review of the restyled builder

- **The captured room is in the brief.** `loadKnown` now passes the room's size, ceiling, windows and light
  (`Known.space`). The designer is told to use them, and at least two Direction or decision lines carry
  measurements; if the designer's don't, the page adds its own (`spaceLines` in `lib/taste/craft.ts`): the largest
  standard rug that leaves 18" at the walls, sofa length against the long wall with 14–18" to the coffee table,
  36" walkways, and what the window's light calls for. Known dimensions are never an open question.
- **A known budget or date is never asked again.** "Where we are" marks them KNOWN, and a line that asks anyway is
  rewritten in code to confirm and go deeper ("$3,000 is the ceiling. Is there one piece you'd put most of it
  into?"). The free interpreter catches "$3,000" without a "budget" word, and a holiday in a clause ("my mom
  visits at Christmas").
- **The filler filter only touches the words beside a cut** (a marker-based tidy), so "you could live with." is
  never clipped. The "off-limits to your" break came from the her → your rewrite missing a capitalized "Dog"; kin
  and pet words are now matched case-insensitively. Reasons in the brief read "Why: …".
- **Corrections are edits (2026-10-30).** A read-back correction never regenerates the brief. The designer gets
  the brief with a line id for every line and returns edit ops (`replace`, `remove`, `add`, `answer_open`);
  `applyEdits` applies them: replaced and removed lines are struck, adds are appended, an answered open question is
  retired, and every other line stays byte-identical. The prompt tells the designer to remove conflicting lines
  (a blanket "existing pieces stay" when the sofa goes). The free interpreter makes the same kind of ops. Blanket
  stay or "spend only on gaps" claims are cut unless she said so; light follows the orientation she states over the
  capture (west: solar shades, desk perpendicular to the glass).
- **Nevers and corrections (earlier round).** One rejected room is one never (its defining words), never itemized; a never stands
  only on her words or a tap. A read-back correction redraws only the lines it touches: a line the designer
  edited is replaced if it shares a word with the correction, a dropped line goes only if it shares two, and
  everything else (the idea, the open questions, tapped hard nos) stays as it was. Removed lines stay on the page,
  struck through. The designer's reply says what it redrew.
- **One palette line**, the page's 60-30-10, and one materials line; the designer's own versions step aside.
  Guessed uses ink as soon as she names them ("a book or a show").
- The priorities question is one question; its chips do the listing.

## The question tree

The tree below still applies. The changes on 2026-10-29: **tradeoff** is now the priorities question, asked early
in Who you are ("Where do your priorities lie with this room?", adding "Getting it just right" and "How it works day
to day" to its choices), and the tree's questions are grouped into the three new sections (functional and lifestyle
questions in Who you are, style questions in Space and style, story questions plus budget and timeline in Extras).

## How it works

- **36 questions, 8 on the core path.** The core path is start, approach, timeline, budget, people, uses, kids
  and look. **kid_ages** is a branch inside the kids slot, so it only joins the core path when there are kids.
  The other 27 are optional depth that people can come back to later. Most people only ever see a handful of
  them, because many only appear after a specific answer.
- **Bucketing comes first.** The first questions place someone in the 2×2 and set budget and timeline. Speed is
  asked once, in **timeline**. Everything after that gets narrower.
- **Each question has:** an id; a prompt written the way a person would say it; an answer kind (single choice,
  multi choice, short text or number; a choice can be *exclusive*, like "No pets", which clears the others;
  some choices are built from what we know, like their own pieces); an optional branch condition (`showIf`); a core or optional flag; a rule
  that reads what's already known; the profile field it feeds; and a one-line "why".
- **Two ways to use what we already know:**
  - **Skip:** we're sure, so we don't ask.
  - **Prefill:** we're fairly sure, so we ask it as a quick confirmation ("Sounds like this is a refresh, right?").
    That's also how the voice interview opens with what it knows ("I see you're keeping the walnut console…").

  Every skip or prefill carries a "because", such as *"The scan read the room as 'warm mid-century'"*. The
  assumptions view will show those reasons.
- **Where "known" comes from** (each question lists its sources in `from`):
  - Space Capture intake: scope, room, access, have, bringing (and what was brought), wish (and its link);
  - the scan: `profile_signals` (style, price_level, lifestyle) and the detected items;
  - the sort: only taps count. A piece someone tapped Keep or Move on is a kept piece; a piece they never
    touched stays in the room but says nothing about them, so it never counts as kept. A Remove tap counts too;
  - earlier answers in this same conversation.

## The tree

★ = core path. Indented questions only appear after the answer shown.

### 1. Bucketing
- ★ **start**: "Are you starting fresh in a new place, or giving a room you already live in a refresh?"
  This is half the 2×2: a fresh start needs a full plan, a refresh works around what stays.
  *Known:* it's skipped as fresh when they can't be in the space and it's empty. It's prefilled as fresh when
  they can't be there and are planning a whole apartment or house or working from a floor plan, or when they're
  removing at least half the pieces. It's prefilled as refresh when they're in the room and tapped Keep (or Move)
  on at least one piece ("In the room now and chose to keep 3 pieces").
- ★ **approach**: "Would you like a finished room pulled together for you, or one built around you and the things
  you already love?" This is the other half of the 2×2 (standard vs customized), and it picks the persona, the
  service tier and how much we curate. It says nothing about speed; **timeline** asks that.
  *Known:* prefilled as customized when they're bringing pieces, have a wishlist item, or tapped Keep on pieces.
  Prefilled as standard when they're removing half or more. Leaving the sort untouched prefills nothing.
- **tradeoff**: "If something has to give, what should we protect?" (getting it done soon, the budget, the look,
  making it personal). This sets what we give up first when the plan can't have everything. It's optional, so the
  core path doesn't open with five planning questions in a row. *Known:* nothing yet.
- ★ **timeline**: "When would you love for it to be done?" It decides in-stock vs made-to-order, and whether to plan
  in phases. *Known:* nothing yet.
- ★ **budget**: "What kind of budget feels right for this?" (keep it lean, somewhere in the middle, happy to invest,
  not sure yet). Every recommendation is priced. Asking is better than guessing, and it helps avoid the "paying for
  a fancy quiz" feeling. *Known:* prefilled as middle or invest from the scan's `price_level`. It's never
  prefilled as lean, because that tells people their things look cheap.

### 2. Functional, for everyone
- ★ **people**: "How many people use this room most days?" Seating, table size and storage all scale with it.
- ★ **uses**: "What do you mostly use this room for?" The room's jobs decide the furniture list before style comes
  into it. *Known:* prefilled from the room name and the items the scan found (sofa → relaxing, TV → watching TV,
  bookshelf or a "reader" signal → reading, desk → working, and so on).
- **priorities**: "What does this room most need to get right?" It names the problem to solve, so the plan
  fixes it instead of only restyling. It works for a fresh start too, where there's no "now" to improve on.
  *Known:* "a better layout" is prefilled when they marked pieces to move.

### 3. Functional branches
- ★ **kids**: "Are there kids at home, or kids who visit a lot?" Kids change materials, corners and what sits at
  grabbing height, so this is a safety call and sits on the core path. *Known:* prefilled as at home when **uses**
  includes kids' play.
  - ★ **kid_ages** (if yes or they visit): "How old are they?" A toddler and a teenager need opposite things.
- **pets**: "Any pets?" ("No pets" is exclusive: picking it clears a dog or cat.) Fur, claws and muddy paws rule out some fabrics and rugs.
  - **pets_on_furniture** (dog or cat): "Are they allowed on the sofa?" Decides between performance fabric and
    something delicate like velvet or bouclé.
- **work_from_home**: "How often do you work from this room?" A desk that has to disappear at 6pm is a different
  piece from a home office. *Known:* a desk or "working" says they work here but not how often, so it's asked with
  nothing chosen. Skipped as never if they listed uses without working.
  - **video_calls** (if they work here): "Do you take video calls in here?" Then the wall behind them and the light
    on their face matter.

### 4. Lifestyle
- **hosting** (if "having people over" is a use, or uses wasn't asked): "How often do people come over?" (every
  week or so, now and then, rarely). Frequent hosts need flexible seating and surfaces; others can give that space
  to comfort. *Known:* nothing; a ticked box says they host, not how often.
  - **hosting_style** (every week or so, or now and then): "When friends come over, is it dinner around a table, or everyone piled
    on the sofa?" Decides whether the money goes to a table or to seating.
- **unwind**: "What else helps you unwind in here?" (music, games, pottering with plants, just quiet). Reading and
  TV are already in **uses**, so they aren't offered again. A music corner and a plant shelf each want a different
  spot near the light. *Known:* nothing. A plant in the scan or a `lifestyle` hint is read from the photos, not
  said by them, and owning a plant isn't loving plants.
- **routine**: "Walk me through a normal day in this room, from morning to night." Routines surface needs a
  checklist misses.

### 5. Broad style
- ★ **look**: "Which of these feels most like home to you?" (warm mid-century, light and Scandinavian, modern and
  minimal, collected and eclectic, classic and traditional, earthy and natural, industrial loft, not sure yet).
  This one answer steers every product pick after it. *Known:* prefilled from the scan's `style`. It's never
  skipped, because what someone owns isn't always what they love. *For voice:* "these" can't be heard and eight
  options can't be spoken, so voice shows the looks as pictures, or speaks at most four of them.
- **color**: "Do you like your rooms calm and light, warm and earthy, or bold with color?" Palette is the fastest way
  to make new pieces belong with old ones. *Known:* prefilled from words in the scan's `style`.
- **pattern**: "How do you feel about pattern?" Rugs, pillows and curtains are where pattern lives, and they're easy
  to get wrong.
- **materials**: "Which materials do you love having around?" New pieces should echo what stays.
  *Known:* prefilled with at most the three most common materials among pieces they tapped to keep, because "the
  most common materials in what stays". It never claims they love them; owning isn't loving (see **look**).
- **avoid**: "Is there anything you never want to see in your home?" One hard no saves a dozen wrong suggestions.

### 6. Specific style (branches off broad style)
- **look_midcentury / look_scandi / look_minimal / look_eclectic / look_traditional / look_organic /
  look_industrial**: one follow-up for whichever look they picked, splitting it in two. For example: "Cozy and
  layered like a Copenhagen flat, or pared back and airy?" The two halves of each look shop very differently.
- **inspiration** (look is "not sure yet"): "Is there a place that felt exactly right to you? A hotel, a café, a
  friend's home?" People who can't name a style can almost always name a place. *Known:* nothing; a product link
  isn't a place.
- **bold_colors** (color is bold): "Which colors pull you in?" Bold only works if it's the right bold.
- **anchor** (if anything is staying or being brought): "Is there one piece everything else should work around?
  Maybe one with a story behind it?" A pick, not typed text: the choices are the pieces still in the room plus
  the ones they're bringing, and "Nothing in particular". Designers start from one hero piece, often the one
  someone carried from home to home; this names it instead of guessing. It replaces the old **story_piece**
  question, which asked the same thing. *Known:* nothing; it's never prefilled.

### 7. Personal story
- **places**: "Where have you lived, or where are you from, that still feels like home?" Where someone comes from
  shapes what feels like home, like Indian textiles or Copenhagen candlelight.
  - **places_feel** (if they named somewhere): "What did you love about how homes felt there?" It turns a place into
    something we can buy: a color, a material, a kind of light.
- **meaningful_detail**: "Is there something small that means a lot to you, a person, a place, a thing, that we
  could quietly nod to?" "My grandmother loved butterflies" becomes **one** small, considered nod, like a single
  print or a pillow, never a butterfly theme.

## The sample room

Run against `blender/sample_spec.json` (style "warm mid-century", price "mostly mid-range", lifestyle "reader",
11 items) with no sort taps, so nothing counts as kept. The intake assumed is the usual sample path: one living
room, they're in it, not bringing anything, no wishlist.

| Question | Result | Because |
|---|---|---|
| ★ budget | prefill **somewhere in the middle** | Existing pieces read as "mostly mid-range" |
| ★ uses | prefill **relaxing, TV, reading** | From the room's name and what the scan found in it (sofa, TV, bookshelf, "reader") |
| ★ look | prefill **warm mid-century** | The scan read the room as "warm mid-century" |
| work_from_home | **skipped** (never) | Didn't list working as a use for this room |
| unwind | asked, **nothing chosen** | The fiddle-leaf fig and the "reader" hint are inferred from photos, not said, so they prefill nothing |
| color | prefill **warm and earthy** | The scan read the room as "warm mid-century" |

- On the core path, 3 of the 8 questions become one-tap confirmations. **start**, **approach**, **timeline**,
  **people** and **kids** are asked cold. With no sort taps, there's no honest reason to prefill start or approach.
- **hosting** doesn't appear, because "having people over" isn't among the uses. **materials** is asked with nothing
  chosen, because nothing was tapped to keep. **anchor** offers the 11 pieces in the room as picks.
- Because look is prefilled as mid-century, **look_midcentury** is the one specific-style follow-up that appears.
- With no intake at all (the sample spec alone), the result is the same.

## Where this comes from

- **The April 12 brainstorm** (see "Origin" in `docs/product-vision.md`):
  - the fresh start vs refresh × standard vs customized 2×2 becomes **start** + **approach**;
  - "tradeoffs between speed, style, budget, and customization" becomes **tradeoff** (optional, so speed is only
    asked once on the core path, in **timeline**);
  - "timeline" becomes **timeline**;
  - the pricing concern ("paying for a fancy quiz") is why **budget** asks for a range and doesn't quote a price;
  - the open question "should functional questions vary by persona, or ship bare-bones first?" is answered by the
    branches: one functional base for everyone, with the depth unlocked by answers.
- **Story-driven personalization** (Indian and Copenhagen influences; "a personal story shows up first"): this is
  stage 7. It's optional depth, because it only pays off once the basics are right.
- **The AI user profile principle:** every answer, scan signal and sorting choice is a signal, so skips and
  prefills come from them instead of asking again.
- **Taste Builder requirements (2026-10-27):** bucketing first, broad to specific, every branch earns its time, a
  short core path, optional depth you can come back to.

## Planned next (not built in this step)

- **Text now, voice later.** The prompts are already written as spoken lines. The first screen is text-first, one
  question per screen in the capture flow's look, with a slot left for a mic. Voice reuses the same tree, so
  nothing here changes when it arrives.
- **The profile builder.** It turns answers and signals into assumptions, each with its cited reason (the
  `because` above, or the answer itself), written to the profile field each question names.
- **"What Homebody assumes about me" (dev only).** A toggle that shows the profile's current assumptions (persona
  bucket, style, budget, lifestyle, meaningful details) and why each was made. It will be gated the same way as the
  room page's backstage panel (`/rooms/[id]?dev=1`, development builds only). It must never ship to users.
- **For you to review:** the questions and choices are taste and product calls. Reword or cut anything that doesn't
  sound like Homebody.
