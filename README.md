# Homebody

Homebody is an AI interior designer. The aim is to give anyone the experience of hiring a thoughtful,
polished interior designer. It has four pieces:

- **Space Capture:** your real room rebuilt to scale in 3D from phone photos (Claude reads the photos, Blender
  builds the room), then sorting what stays, moves or goes.
- **Taste Builder:** a designer-style interview, by voice or text, that produces a design brief.
- **Plug & Play:** a game-like 3D editor for trying pieces in the captured room.
- **Transaction:** buying room by room (planned, not built).

Built with Next.js, three.js, Blender, Claude and ElevenLabs. It's an early prototype. Product notes are in
`docs/product-vision.md`.

## Setup

1. **Install:** `npm install` (Node 20 or later).
2. **Fonts:** `npm run fonts`. This downloads the typefaces from [Fontshare](https://www.fontshare.com) into
   `app/fonts/`. Their license doesn't allow redistributing the files, so they aren't committed. See
   `public/fonts/LICENSES.md`.
3. **3D assets:** `npm run assets`. This downloads the CC0 textures and skies from [Poly Haven](https://polyhaven.com)
   into `blender/assets/` (about 100 MB).
4. **Keys:** create `.env.local`:

   ```
   ANTHROPIC_API_KEY=...        # photo reading and the live designer
   ELEVENLABS_API_KEY=...       # optional: the designer's voice
   ELEVENLABS_VOICE_ID=...      # optional: a specific voice
   BLENDER_PATH=...             # optional: defaults to /Applications/Blender.app/Contents/MacOS/Blender
   CAPTURE_BUDGET_USD=10        # optional: spending cap for photo reads
   TASTE_DAILY_CALLS=150        # optional: daily cap on live designer calls
   ```

   Without the Anthropic key, Taste Builder falls back to an offline script.
5. **Blender:** install [Blender](https://www.blender.org) (developed on 5.2) for Space Capture's room builds.
6. **Run:** `npm run dev`, then open http://localhost:3000. `/demo` seeds a sample room.

## Credits

- Room and pattern photos in `public/taste/`: Unsplash (material textures there: Poly Haven), listed in `public/taste/CREDITS.md`.
- Textures and skies: Poly Haven, CC0.
- Typefaces: Indian Type Foundry, via Fontshare, under the ITF Free Font License.
