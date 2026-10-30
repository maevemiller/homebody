# Storage plan: how the design model gets its knowledge

Last updated: 2026-10-30. Part of `docs/reference/design-principles/` (see `README.md`). **For discussion with
Maeve.** It lays out options and trade-offs, then recommends the simplest one.

## What we're storing

| Knowledge | Size today | Shape | Changes |
|---|---|---|---|
| This library (`design-principles/*.md`) | ~85 KB ≈ **21k tokens** | prose + numbers | rarely |
| Interior-design intake library (`interior-design/*.md`) | ~95 KB ≈ 24k tokens | prose + tables | rarely; mostly for Taste Builder |
| The 15 rules (`README.md`) | ~1.5k tokens | checkable rules | rarely |
| Wada color data (`data/wada-sanzo-colors.json`) | 60 KB (about 15k tokens if put in a prompt, which it shouldn't be) | structured data | never |
| Product catalog (`sourcing/seed-products.json`, later feeds) | 33 items ≈ 80 KB → **10k–1M items** later | structured data | daily (prices, stock) |
| Per-room state (spec, kept items, `DesignState`) | 5–30 KB per room | structured | every edit |
| Person profile (Taste Builder dossier) | 2–10 KB | structured + quotes | per session |

The key fact: **the whole design knowledge base is about 45k tokens.** It's small, stable and well-structured,
so it doesn't need a search engine. The product catalog is the only thing that will grow large.

## The three places knowledge can live

### 1. In the prompt (the model reads it every call)
- **For:** judgement and taste: principles, the order of decisions, the vocabulary, how to explain, when to break
  a rule. Things the model must *weigh*, not look up.
- **Cost:** with prompt caching, a stable prefix is cheap after the first call (cached reads cost a fraction of
  normal input). 5–10k tokens of principles adds little latency and cost.
- **Risk:** long prompts dilute attention, and the model may "know" a rule but not apply it consistently. Numbers in
  prose get misremembered (30" vs 36").

### 2. In a JSON knowledge base (code picks the relevant slice)
- **For:** lookup tables the model needs *some* of, per situation: fabric suitability by life (kids, pets, sun),
  lighting by room type, ergonomic sizes, wood species, metal pairings, rug sizes by layout, style-family material kits.
- **How:** code selects the slice by known keys (room type, the categories in play, person flags such as `pets:
  "cat"`), and either injects it into the prompt or exposes it as a tool (`get_design_rules({ topic, roomType })`).
- **No vector store is needed,** because the keys are known: we always know the room type, the categories and the
  person's flags. Keyword/key lookup is exact; embeddings would only add fuzziness.

### 3. In code (deterministic rules and validators)
- **For:** everything with a number or geometry: clearances, distances, heights, rug coverage, the coffee table to
  sofa ratio, 60-30-10 area measurement, ΔE and undertone tests, LRV estimates, accent repeat counts, wood and metal
  counts, lumen targets, locks and budget, and the ripple ranking (`coherence.md`).
- **Why:** code is exact, testable and free, and it can *check the model's output* and send back specific failures
  ("rug too small: the front legs of chair-2 are off it").
- **Already started:** `lib/play/placement.ts` and `layout.ts` (walkways, coffee table gap, dining clearance, focal
  point), and `lib/taste/craft.ts` (banned filler, vocabulary).

## Options

| Option | What | Pros | Cons | Effort |
|---|---|---|---|---|
| **A. Everything in the prompt** | Paste all ~45k tokens into the system prompt, cached | Fastest to build; the model sees everything | Diluted attention; inconsistent numeric rules; cost per uncached call; nothing *checks* the output | ½ day |
| **B. Condensed canon in the prompt + code validators** | ~4–6k-token "design canon" (the 15 rules, the decision order, coherence procedure, vocabulary) + code that checks numbers after the model proposes | Small prompt; hard rules enforced; failures fed back for a retry | The canon must be hand-written and kept in sync with the docs | 2–4 days |
| **C. B + a keyed JSON knowledge base** | B, plus `lib/design/kb/*.json` (fabrics, woods, metals, lighting by room, ergonomics, rug sizes, style kits), injected by context or exposed as a tool | Model gets precise tables only when relevant; same data drives code checks and UI; easy to extend | A little more plumbing; JSON must be curated from the docs | 4–6 days |
| **D. RAG with a vector store** | Chunk the markdown, embed it, retrieve top-k per request | Scales to a big corpus | Overkill at 45k tokens; retrieval can miss the one rule that matters; needs infra (pgvector, Pinecone, etc.); harder to debug | 1–2 weeks |
| **E. Fine-tune** | Train taste into a model | Possibly the most "native" taste | Expensive, slow, opaque; not available or sensible for this stage | n/a |

## Recommendation: Option B now, growing into C. No vector store for principles.

1. **A cached system-prompt "design canon," about 4–6k tokens.** Contents:
   - the 15 rules from `README.md`, verbatim;
   - the brief-to-choices order (`people.md` §5);
   - the coherence procedure (`coherence.md` §2–4, condensed);
   - the vocabulary and banned filler (already in `craft.ts`);
   - a short "when to break a rule" note.

   It sits in the prompt prefix with the person's profile and room state after it, so caching works.
2. **Code validators** in `lib/design/rules.ts` (new) implementing the checkable rules. They run after every model
   proposal, and failures go back to the model once for a fix. Many space rules already exist in `lib/play/`; move
   the constants there, or share them.
3. **Small keyed JSON tables**, added as each feature needs them. Start with `fabrics.json` (suitability flags) and
   `lighting.json` (fc by room, placement heights), because product filtering and the lighting check need them first.
   Code passes only the relevant rows (e.g. pet-safe fabrics when `pets` is set).
4. **Wada stays a data file used by code.** A `colorMatches(anchorHex)` function returns the top 3–5 combinations
   (with names and hex values) and passes them to the model as candidates. The 60 KB file never goes in a prompt.
5. **The markdown library stays the human source of truth.** When a rule changes, it changes in the doc, then in the
   canon, JSON or code. A small test can assert that the numbers in `rules.ts` match the README's 15 rules.

**Why this is the simplest good option:** there's no new infrastructure (no database, no embeddings), and every
rule lives in exactly one enforceable place. The prompt stays short enough that the model actually applies what's
in it, and we can add JSON tables one at a time.

## When a vector store *would* be needed

- **Products, not principles.** Once the catalog passes about 5–10k items, "find a cobalt-ish velvet accent chair
  under $600 that looks like this photo" needs **structured filters (category, price, dimensions, material,
  family) first, then similarity ranking** on image and text embeddings. Postgres + pgvector (or the search a
  hosting provider gives) handles both in one place. Dupe.com's MCP (`sourcing/README.md`) covers visual lookalikes
  without our own index at first.
- **Designer examples.** If we collect hundreds of annotated reference rooms ("this room works because…") as
  few-shot examples, retrieval by style family + room type is still keyed; embeddings help only past ~1,000 examples.

## Open questions for Maeve

1. Is a validator-feedback loop (the model proposes, code checks, one retry) acceptable for latency in Plug & Play?
   It adds about one model call when a rule fails.
2. Should rule-breaking ("one red chair, unrepeated") be allowed only for the hero and the personal nod, or more
   freely when the person's taste is eclectic?
3. Where should per-room `DesignState` live once rooms leave local `data/`? (The same question as for room specs.)
