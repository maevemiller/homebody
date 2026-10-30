# Data files

Data, not packages. Nothing here is installed or imported from npm.

## wada-sanzo-colors.json

The 159 colors and 348 combinations of Wada Sanzō's *A Dictionary of Color Combinations*
(originally *Haishoku Sōkan*, 1933–34).

- **Downloaded:** 2026-10-30 from
  https://raw.githubusercontent.com/mattdesl/dictionary-of-colour-combinations/master/colors.json
- **License:** MIT, © 2020 Matt DesLauriers. A copy is in `wada-sanzo-LICENSE.md`; keep it next to the data.
- **Provenance:** Dain M. Blodorn Kim compiled the data for `dblodorn/sanzo-wada`. Matt DesLauriers fixed errors
  and used a more perceptual CMYK→RGB conversion. The book's original plates are public domain in Japan (Wada died
  in 1967). Seigensha publishes the modern edition; don't reproduce its page layouts or scans.
- **Shape:** an array of 159 colors. Each color has these fields:
  `{ name, combinations: number[] (palette ids 1–348), swatch: 0–5 (chapter), cmyk, lab (D50), rgb, hex }`.
  A combination is every color whose `combinations` list contains its id. There are 120 two-color, 120
  three-color and 108 four-color combinations.
- **Use:** invert it to `combo id → [colors]` once at build time. How Homebody uses it is in `../color.md`.
- **Caveat:** the hex values are screen conversions from CMYK print values. They're right for UI swatches, but
  they aren't paint matches.
- **Known typos in names:** "Cerulian Blue" and "Calamine BLue" are kept exactly as in the source.
