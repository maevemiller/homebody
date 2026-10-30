# Homebody session history

Newest last. Every session appends a dated entry: what Maeve asked, what was built and decided, and where it stopped.
For the full step log see `docs/autoloop/log.md`; for critic reviews see `docs/autoloop/critique.md`.

## 2026-10-26: Vision and first pipeline
- **Vision:** Maeve set the four pieces and their code names (Space Capture, Taste Builder, Plug & Play, Transaction),
  and the hidden AI user profile ("a mystery" to users; a dev toggle shows it).
- **Prototypes:** clickable mock-ups as Artifacts; she chose one question per screen (Typeform/TurboTax style).
- **First real pipeline:**
  1. photos;
  2. Claude reads them into a spec;
  3. Blender 5.2 builds the room (glb plus renders);
  4. the room viewer with Keep / Move / Remove sorting.

## 2026-10-27: Prototype look, autoloop, Taste Builder v1, voice
- **Look:** she rejected a brown "Fume" restyle and salesy taglines. Back to the prototype look and plain copy, opening
  on the 4-step welcome.
- **Autoloop:**
  - a cron tick every 20 minutes;
  - a next-step agent and a design-critic agent with a Jobs/Ive bar;
  - checkpoints to `refs/homebody/checkpoints`;
  - hard rules: no paid scans or renders without OK, no installs, no commits.
- **Taste Builder v1:**
  - a question tree with skip and prefill rules;
  - the dev-only "What Homebody assumes about me" panel.

  Space Capture reached critic SHIP.
- **Voice:** she asked for a voice-agent conversation, not a click-through. There's a voice plan; she approved
  ElevenLabs and picked the voice Lily. `.env.local` was created for her keys.
- **First demo (`/demo`):** her feedback was to measure with "I don't know", remove the door check and wishlist, "Is
  this here?" later, and much more polish, since "it looks AI-made".

## 2026-10-28: Rebuilt interview and research
- **Research:** interior-design intake research (`docs/reference/interior-design/`) and photoreal capture research.
- **Space Capture:** redone after her notes (typed size fitted to the walls, read-back, floor outline).
- **Taste Builder rebuilt:**
  - a live Claude designer;
  - visual sets with "I'm not sure";
  - a hand-drawn dossier;
  - a read-back.

  Four critic rounds took it to "ready" (a truth rule: the brief comes only from her words).
- **Demo round two** was paused for her review.

## 2026-10-29: Restructure, Plug & Play, real capture, build in public
- **Her review:**
  - three sections (Who you are / Space and style / Extras);
  - "I'm finished with this section";
  - stopping points;
  - a priorities question;
  - a length choice (her research ask: about 2, 5 or 15 minutes);
  - less fluff;
  - substance over AI filler;
  - custom typefaces;
  - then Plug & Play, real capture and a visual pass.
- **She was away about 12 hours; the loop ran unattended with parallel agents:**
  - Taste Builder restructured (live designer bug: the schema was too large, so the brief moved to its own call);
  - the first cut of Plug & Play;
  - real capture on 3 CC BY photo sets ($1.27 of a $10 cap she approved);
  - visual pass phases 1–2 (Gambetta, Switzer and Kalam; a studio-sheet notebook and brief).
- **Build in public:**
  - a reusable `build-in-public` skill and `social-media-manager` agent (user-level), with project settings in
    `docs/social/project.md`;
  - research on what makes good build-in-public posts;
  - a daily digest at 9:17;
  - the Day 4 thread drafted.
- **Remote Control:** set up so she can steer from her phone; the Mac is kept awake with caffeinate.

## 2026-10-30: Polish, redesigns, GitHub, new direction
- **Taste Builder:**
  - the brief uses the room's measurements and light (rug and sofa math checked);
  - no re-asking known facts;
  - corrections became structured line edits;
  - the light comes from her words.
- **Plug & Play:**
  - built-ins fixed;
  - placement by function;
  - the tray fallback;
  - cheaper "basics" twins;
  - the phone sheet;
  - real thumbnails and lighting.
- **Real capture:** sloped ceilings, slats, fireplaces, measured colors, matched-view scores.
- **"Blender didn't work":** in fact Chrome had disabled WebGL. Added a still-image fallback.
- **Design:**
  - she asked for "slicker, no off-white and green, think Apple";
  - the SF type read as "tech bro startup";
  - landed on monochrome minimal plus Gambetta and Switzer;
  - the landing drawings animate only on hover or tap.
- **Day 5 digest drafted.**
- **Her review of round three:**
  - the real room, not the mock-up, asking for more photos when needed;
  - sort gating and a review revise;
  - style views of her own room;
  - a shopper/sourcing question;
  - a handoff into Plug & Play;
  - Plug & Play v2 (auto-furnished, per-piece feedback with parameters, a ripple toggle, swipe, revisit the
    interview);
  - a design-principles library (Wada colors, space, materials);
  - real furniture;
  - Transaction end to end;
  - GitHub backup with her repos public except those with PII.
- **Done:**
  - Space Capture fixes;
  - the design-principles and sourcing research;
  - the GitHub repo (public `maevemiller/homebody`; 8 repos made public, 4 kept private for PII).
- **Paused at her request (usage running low):** the Taste additions, Plug & Play v2 and checkout, mid-way. Everything
  was committed and pushed (7cb5d68), and these handoff files were written. Next: `docs/BACKLOG.md` items 1–5.
