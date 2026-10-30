# Build in public: project settings for Homebody

## Project

**Homebody** is an AI interior designer. The goal: give everyone the experience of hiring a polished, thoughtful
interior designer.

The pieces:
- **Space Capture:** your real room rebuilt to scale in 3D, plus sorting what stays, moves or goes;
- **Taste Builder:** a live designer interview that produces a design brief;
- **Plug & Play:** a game-like 3D editor;
- **Transaction:** buying room by room, with Dupe-style alternatives.

Stack: Next.js, three.js, Blender, Claude, and ElevenLabs for the voice.

## Voice

- **Maeve's own account, first person.** "I'm building Homebody…"
- **Content mix:** half product progress, half how she works with Claude Code.
- **Audience:** builders curious about AI-assisted development, plus design-minded people.
- **Tone:** serious about the craft, specific, unhyped. The same "substance over fluff" bar as the product.

## Progress sources

- `docs/autoloop/log.md`: dated entries of what was done and decided.
- `docs/autoloop/critique.md`: the design critic's reviews. Good for challenges.
- `git log --oneline refs/homebody/checkpoints`: snapshots. Diff between two of them for what changed.
- `docs/social/workflow-notes.md`: Maeve's prompting and workflow moments. Append new ones.
- `docs/social/last-digest.txt`: the marker (the last log heading and checkpoint covered).

## Visuals

- **The app:** http://localhost:3100. Check it's up; never start a second dev server.
- **Seeding:** `/demo` has "Start from the beginning" (sample room) and "Skip to the conversation". The sample room id
  is `202610271128-dzjy`. Plug & Play is at `/play/<room id>`.
- **Tools:**
  - the chrome-devtools MCP tools, in a fresh isolated context (`screencast_start`/`stop` for clips);
  - headless Chromium from the existing npx cache;
  - `~/.local/bin/ffmpeg`;
  - macOS `sips`.

  No installs.
- **Sizes:** 390×844 for phone, 1440×900 for desktop.

## Delivery

- **Output:** `docs/social/YYYY-MM-DD/` with `thread.md`, `substack.md`, `notes.md` and `media/`.
- **Notify:**
  - send a phone push notification with the hook line and "digest ready for sign-off";
  - send `thread.md` to Maeve's device with SendUserFile.
- **Posting:** not automated yet. After Maeve signs off in chat, she posts, or the main session posts if X API access
  has been set up. Auto-posting is **disabled**.

## Rules

- Sign-off is required for every digest.
- **Never include:**
  - anything from `.env.local`, or API keys;
  - per-call costs or usage numbers;
  - anything from her personal files outside the project;
  - test personas presented as real people;
  - the dev-only assumptions panel or dev badges.
- Plans and mocks must be labeled as such: Plug & Play is a first cut, and Transaction isn't built.
- No hype vocabulary (see the skill's banned list).
