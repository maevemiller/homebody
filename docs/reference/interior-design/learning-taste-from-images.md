# Learning taste from images

Last updated: 2026-10-27. Part of the Homebody interior-design reference (see `README.md`).

How to infer someone's taste from what they react to, for the "I'm not sure" path and for every visual question.
Covers quiz formats and the signal each gives, how many choices are enough, fatigue, how designers use Pinterest
boards, and how to turn picks into a profile.

---

## 1. Why images

- People recognize what they like long before they can name it. Havenly's quiz asks for "no design vocabulary"; you
  mark rooms you like and rooms you'd "never live in". Domino's advice: trust the gut reaction, you don't need the
  "why".
- Labels mean different things to different people ("mid-century" calls up a different picture for everyone), so
  designers avoid asking for them.
- Comparative judgments are easier and more reliable than ratings. Research on pairwise comparison vs rating
  scales finds higher reliability, lower variance, slightly faster responses and a simpler task for non-experts.
  The catch: the number of possible pairs grows fast (10 items = 45 pairs), so pairs must be chosen adaptively.

## 2. Formats and the signal each gives

| Format | What the person does | Signal | Strengths | Weaknesses | Best for |
|---|---|---|---|---|---|
| **Room grid, multi-select** | Tap every room they'd live in (6–9 shown) | Broad positive set; coarse family | Fast; one screen covers many families | Weak on *why*; people over-select | First pass at style |
| **"Never" grid** | Tap rooms they'd never live in | Hard negatives | Sharp, high-confidence | Feels negative if overused | Once, right after the like grid |
| **This or that (pairwise)** | Pick one of two images | Relative preference on a chosen dimension | Easiest decision; reliable; can target an axis | Each answer is one bit; needs smart pairing | "I'm not sure" path; splitting neighbors |
| **Swipe / thumbs** (Stitch Fix Style Shuffle) | Thumbs up / down per image, one at a time | Absolute like/dislike per item | Game-like; can run long; Stitch Fix aggregates swipes into style dimensions (tailored ↔ relaxed, preppy ↔ boho) | Easy to swipe mindlessly; fatigue; no comparison | Ongoing refinement after onboarding, not the intake |
| **Attribute chips on an image** | After picking, tap *what* they like: "the wood", "the light", "the rug", "the color" | Which feature drove the pick | Fixes the "she only liked the backsplash" problem | One more tap | After every strong pick |
| **Mood board build** (Modsy) | Top picks become a board; like/dislike each item on it | Item-level preferences inside a style | Feels creative; shows the result forming | Slower; needs product images | End of the visual section |
| **Swatch pick** (palettes, woods, metals, fabrics, patterns) | Pick 1–3 from a set of swatches | Direct attribute preference | Very clear; renders cheaply | Abstract for some people; swatches ≠ rooms | Palette, materials, pattern questions |
| **Upload / Pinterest link** | Share saved images | Their own unprompted taste | Richest, most personal | Noisy; Pinterest's algorithm tends to homogenize boards | Optional; people who already have boards |
| **Slider** (lighter ↔ darker, less ↔ more) | Drag along an axis | A continuous position | Captures "in between" | People cluster at the middle | Rarely; use pairs instead |

## 3. How many choices are enough

There is no validated number for consumer style quizzes. What the evidence does say:

- **Time budget:** commercial style quizzes run about 2–10 minutes (Decorilla "under two minutes", Havenly and
  Decorist "about five", one Havenly article "about ten").
- **Drop-off:** survey completion falls as length grows. Survicate reports ~83% completion at 1–3 questions,
  ~65% at 4–8, ~56% at 9–14, ~42% at 15+. Other vendors see a gentler curve, but abandonment rises noticeably past
  ~7–8 minutes, especially on mobile.
- **Research ceilings:** academic studies that learn personal visual preference collect 70–90 pairwise judgments
  per person. Far too many for an intake, which is why adaptive selection matters.
- **Adaptive elicitation** (questionnaire trees, embedding-region methods) learns the same preference with fewer
  questions by choosing each next item based on earlier answers rather than using a fixed seed set.

**Recommendation for Homebody:**
- Visual style section: **one like grid + one "never" grid + 3–6 adaptive pairs + one palette pick + one materials
  pick.** That's about 8–11 interactions, inside the ~10-question sweet spot.
- "I'm not sure" exploration: **6–12 adaptive this-or-that pairs**, stopping early when the top family is clear
  (e.g. it leads the next by a wide margin and the last three answers agreed). Show progress as the dossier
  filling in, not as "question 7 of 12".
- Hard cap around 15 pairs. If it's still unclear, that's a finding: the person is an **eclectic mixer**; say so
  and ask for a place or a Pinterest board instead.

## 4. Avoiding fatigue

- **Each image must earn a decision.** Don't show two images that differ on nothing the person cares about.
- **Vary the format** every 3–4 screens (grid → pair → swatches → a spoken question).
- **Show the payoff live.** The dossier gaining a color, a wood, a word after each pick turns work into reward.
- **"Both" and "neither" buttons** on pairs. Forced choices between two disliked images produce noise.
- **Consistent photography** (same light, crop and room scale) so people judge the style, not the photo quality.
- **No near-duplicates.** Repeating a style with a slightly different photo feels like a test.
- **Let them stop.** "That's enough for me to start. Want to keep refining?"
- **Interleave meaning.** After a strong pick, ask "what is it about this one?"; it feels like a conversation and
  improves the signal.

## 5. How designers use Pinterest and inspiration images

From Business of Home interviews and related practice writing:
- **Ask what in the image they mean.** Clients may love one tile, not the room (Karen Harautuneian).
- **Look for the thread across many images,** not one hero. Courtney B. Smith asks for 30+ images, not all interiors
  (fashion, places, objects), to build "a filter" for the project.
- **Fewer, unexpected images beat many generic ones.** A handful that make sense is useful; hundreds of pins is "a
  disaster" (Dana Koebbe). Kevin Greenberg distrusts Pinterest's algorithm for homogenizing boards and prefers
  unexpected references.
- **When clients have nothing, show them options and watch the reaction** (Rydhima Brar). That's the "I'm not
  sure" path.
- **Never copy a single image.** Redirect to its underlying spirit.
- **Edit the board together.** Look for themes, then cut the outliers.
- **Separate boards for partners.** Each person collects alone, then compare (DesignDash).

**For Homebody:** accept a Pinterest board or photos as an optional input; tag each image with the same attributes
as our own image library; report the thread back ("You saved 23 rooms; 18 of them have plaster walls and a single
vintage wood piece"); and ask about outliers rather than averaging them away.

## 6. Turning picks into a profile

### 6.1 Tag every image with attributes
Each library image carries hand-checked tags. Suggested schema:

| Dimension | Values (examples) |
|---|---|
| `family` | weights over style families, e.g. `{scandinavian: .7, japandi: .3}` |
| `palette` | palette family + 3–5 dominant hex values |
| `value` | light · mid · dark |
| `temperature` | warm · neutral · cool |
| `density` | sparse · edited · layered · packed |
| `line` | straight · mixed · curved |
| `age` | new · mixed · antique/vintage |
| `woods` | e.g. white oak, walnut |
| `metals` | e.g. brass, black steel |
| `textiles` | e.g. linen, bouclé |
| `pattern` | none · subtle · bold; types |
| `mood` | calm, cozy, bright, moody, elegant, playful, grounded |
| `influences` | e.g. Copenhagen, Indian, Mediterranean |

The same tags apply to swatches, products and uploaded Pinterest images, so one scoring model handles all of them.

### 6.2 Score reactions
- **Like-grid pick:** +1 to each of the image's tags (weighted by its family weights).
- **"Never" pick:** −1.5 (negatives are sharper than likes).
- **Pairwise win:** winner +1, loser −0.5 *on the dimensions where they differ*. Over many pairs this approximates a
  Bradley-Terry ranking, the standard way to turn pairwise choices into scores.
- **Attribute chip** ("the wood"): +2 on that attribute only, and down-weight the rest of the image.
- **Spoken/typed words** ("calm", "my grandmother's house", "Copenhagen"): map to tags with lower weight, and use
  them to pick which images to show next.
- **Keepers from Space Capture:** a weak prior on materials and woods. Owning isn't loving, so never more than a
  nudge (this matches `docs/taste-builder.md`).
- **Recency:** later answers count slightly more; people calibrate as they go.

### 6.3 Pick the next pair adaptively
Choose the pair that best separates the current top two or three candidates on their most uncertain dimension. If
Scandinavian and Japandi are tied, show "bright and social vs low and serene" (see the confusions table in
`style-families.md`). If density is unknown, show "clear surfaces vs collected shelves". Stop when the leader is
clear or the cap is reached.

### 6.4 Present the result as a blend
- **Style mix percentages:** normalize family scores to the top 2–3 and round to friendly numbers ("60% warm
  minimal, 30% mid-century, a thread of Indian textiles"). Stitch Fix shows percentage mixes; Modsy named blends
  ("Rustic Warmth"). Do both: a named blend plus the mix.
- **Palette:** take the top palette family and pull 5–6 hex values, ordered 60-30-10, from the liked images'
  dominant colors.
- **Materials:** the top 2–3 woods, 1–2 metals, 2–3 textiles, each with a short "because".
- **Pattern appetite:** none / a little / lots, plus the favorite type.
- **Mood words:** 3 adjectives (designers start concept boards from a few adjectives).
- **Hard nos:** everything with a strong negative score.
- **Confidence:** keep a per-dimension confidence so the dossier can draw uncertain things lighter, and so the
  conversation knows what to ask next.

### 6.5 Say it back and let them correct it
"You keep choosing light oak, linen and a lot of empty space, with one old piece in each room. Designers call that
warm minimalism. The block-print you lingered on suggests a thread of Indian textiles. Sound right?" A correction is
the strongest signal of all; weight it heavily.

---

## Sources

- [Havenly: What to expect from a Havenly design session (quiz without design vocabulary)](https://havenly.com/learn/what-to-expect-havenly-session)
- [Havenly: Design style quiz](https://havenly.com/design-style-quiz)
- [Hunker: Modsy review (rounds of photos, top picks to mood board, Pinterest upload)](https://www.hunker.com/13723769/modsy-bedroom-design-review/)
- [Business Insider: Modsy review ("Rustic Warmth" blended result)](https://www.businessinsider.nl/modsy-virtual-3d-room-design-review)
- [Decorilla: Style quiz roundup (Stitch Fix percentage profiles)](https://www.decorilla.com/online-decorating/style-quiz)
- [Decorilla: Interior design style quiz](https://www.decorilla.com/online-decorating/interior-design-style-quiz/)
- [Stitch Fix: Style Shuffle and StyleFile (company blog)](https://www.stitchfix.com/women/blog/?p=81746)
- [Domino: 9 questions to find your style](https://www.domino.com/content/how-to-choose-design-style/)
- [Business of Home: 6 designers on inspiration images](https://businessofhome.com/articles/6-designers-on-how-they-make-the-most-of-inspiration-images)
- [DesignDash: Couples who can't agree](https://designdash.com/integration/business/what-do-i-do-if-a-couple-cant-agree-on-a-design-direction/)
- [To rate or not to rate: evaluation methods for generated co-speech gestures (pairwise vs rating reliability)](https://arxiv.org/pdf/2108.05709)
- [A practical guide and software for analysing pairwise comparison experiments](https://arxiv.org/pdf/1712.03686v1)
- [Simple surveys: response retrieval inspired by recommendation systems](https://arxiv.org/pdf/1901.09659)
- [Kim et al., CVPR 2026: Learning personalized photographic style from pairwise preferences](https://cvpr.thecvf.com/virtual/2026/poster/38681)
- [Nguyen et al.: Cold-start recommendation by personalized embedding region elicitation](https://arxiv.org/html/2406.00973v1)
- [Karimi et al.: Improved questionnaire trees for active learning in recommender systems](https://hilpub.uni-hildesheim.de/handle/ubhi/17120)
- [Survicate: Survey completion rate benchmarks](https://survicate.com/blog/survey-completion-rate/)
- [Koji: Ideal survey length](https://www.koji.so/docs/ideal-survey-length-guide)
