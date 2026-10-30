# Homebody typefaces: licenses

The font files are in `app/fonts/` (fetched with `npm run fonts`, not committed) and load through `next/font/local` (`app/fonts/index.ts`).
They are the foundry's own web files from the official download zips, unmodified.
The full license text is in `public/fonts/licenses/ITF-FFL-2.0.txt`. Checked 2026-10-29; Boska added 2026-10-30.

| Face | Role | Files | Foundry / source | License | Commercial web use |
| --- | --- | --- | --- | --- | --- |
| **Gambetta** | display (live) | Gambetta-Variable(Italic).woff2 | Indian Type Foundry, via Fontshare | ITF Free Font License 2.0 | Yes |
| **Switzer** | text (live) | Switzer-Variable(Italic).woff2 | Indian Type Foundry, via Fontshare | ITF Free Font License 2.0 | Yes |
| Boska | display (alternate, /demo/type) | Boska-Variable(Italic).woff2 | Indian Type Foundry, via Fontshare | ITF Free Font License 2.0 | Yes |
| General Sans | text (alternate, /demo/type) | GeneralSans-Variable(Italic).woff2 | Indian Type Foundry, via Fontshare | ITF Free Font License 2.0 | Yes |

Each family's zip carries the same `License/FFL.txt`; I checked them byte for byte against the copy here.

Mono text (rare, development views only) uses the system monospace stack and needs no license.
There is no handwriting face any more: notebook marks are typographic.

## ITF Free Font License 2.0

- **Allowed:** personal and commercial use in any medium, websites and apps included, free of charge.
  Self-hosting through `@font-face` on our own site is explicitly permitted ("permitted and recommended").
- **Not allowed:**
  - modifying the files, which includes subsetting, format conversion and renaming metadata. We ship
    the official woff2 files untouched, and `next/font/local` only re-hashes the file name;
  - redistributing the font files themselves, for example through another font site, a public repository
    or a file share;
  - offering the fonts as a selectable typeface for our users to make their own content with. Homebody
    never does this; it only sets its own interface.
- **Public repository:** the `.woff2` files in `app/fonts/` are gitignored, since committing them would be
  redistribution. `npm run fonts` (`scripts/fetch-fonts.mjs`) downloads the official zips from Fontshare and
  extracts the files unmodified. Deploying them as self-hosted webfonts is fine.
