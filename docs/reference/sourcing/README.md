# Real-product sourcing

Last updated: 2026-10-30.

How Homebody can show **real furniture**, with images, prices, dimensions and buy links, legally and practically.
It serves Plug & Play's sidebar (price, alternatives, swap) and Transaction (cart, "same look, different price",
affiliate links) in `docs/product-vision.md`. The current Plug & Play catalog (`lib/play/products.json`) is made-up
sample data.

**Status of this research:** network and program details come from brand pages, network help centres and
affiliate directories, which often disagree or go stale. Every program here needs confirming at sign-up. This is not
legal advice; have a lawyer review the affiliate and API terms before launch.

---

## 1. Bottom line

1. **Use licensed sources, not scraping.** Facts (a product's name, price and dimensions) aren't copyrightable in the
   US, but retailer **terms of use are contracts**, and nearly every furniture site checked forbids bots and
   scraping or commercial reuse. **Product photos are copyrighted.** robots.txt allowing a path is *not* permission.
2. **Now, free and legal:** the **Amazon Berkeley Objects (ABO)** dataset (CC BY 4.0) holds 147k real Amazon
   listings, about 6,700 of them US furniture and decor items **with to-scale glTF 3D models**, images and
   dimensions. A 33-item sample is built: `seed-products.json`. Its gaps: no prices, a 2017–2020 snapshot, and Amazon
   private labels only.
3. **Next, needing Maeve (sign-ups and keys):** an affiliate network account (Impact first: Target, Walmart, West Elm
   and many DTC brands), then Amazon Associates → Creators API, CJ (Wayfair), and free developer keys for eBay and
   Etsy (vintage). Skimlinks or Sovrn wraps links to thousands of merchants with one sign-up, but provides no
   catalog data.
4. **Shopify `/products.json` is technically open and contractually closed.** Of the 13 DTC brands checked, none
   permits it, and most prohibit it explicitly. Go through their affiliate programs or ask for a feed.
5. **3D:** ABO GLBs for the seed; **parametric models sized to real dimensions** (extending the Blender pipeline) as the
   scalable default; Sketchfab CC BY/CC0 for hero pieces; never extract retailers' AR models.

## 2. The legal frame, briefly

| Thing | Status | Implication |
|---|---|---|
| Product facts (name, price, W×D×H, material) | Not copyrightable in the US (*Feist*) | Fine to record, **if obtained legitimately** (an API, a feed, a licensed dataset, or a human reading the page) |
| Retailer website terms | Contract; most ban bots, scraping, "data mining" and commercial reuse | Automated collection violates them even when robots.txt allows the path |
| Product photos and descriptions | Copyrighted (brand or photographer) | Show only under a license: an affiliate agreement, API terms, CC license, or permission |
| Linking to a product page | Fine | A plain link always works; affiliate links earn commission |
| Hotlinking images from a retailer CDN | Legally murky and usually against terms | Use images supplied through the affiliate feed or API, under its terms |
| Retailer AR/3D models (USDZ/GLB in "view in your room") | Copyrighted assets, no license | Don't extract or reuse |
| Affiliate disclosure | FTC requires clear disclosure | "We may earn a commission" near buy links |

## 3. Retailer, affiliate and product APIs

| Source | Access | Data you get | Notes | Needs Maeve |
|---|---|---|---|---|
| **Amazon Creators API** (replaces PA-API 5, retired spring 2026; 403s now) | Amazon Associates account; credentials in Associates Central after meeting eligibility | Titles, images, prices and offers, features, some dimensions (per PA-API precedent) | PA-API required recent qualifying sales to keep access; whether the Creators API does too is **unconfirmed**. Data may be used only to send traffic to Amazon; prices must be kept fresh | Yes |
| **Impact.com** (Target, Walmart, Home Depot, West Elm and other Williams-Sonoma brands per directories, many DTC brands) | Join Impact as a partner, then apply to each brand | Catalogs via in-platform download, FTP (> 3 GB) or API: SKU, UPC/EAN, current and original price, stock, product URL, **image URL**, category; brand-specific extra fields | The single most useful network for home goods. Dimensions only if the brand includes them | Yes |
| **Walmart Affiliate API** (walmart.io) | Walmart affiliate (on Impact) + walmart.io key | Product search, lookup, reviews, recommendations | A real product API, separate from Impact tracking | Yes |
| **Target Partners** | On Impact | Catalog through Impact (details visible only after joining) | ~5–8% commission, 7-day cookie (directory figures) | Yes |
| **Wayfair** (also AllModern, Joss & Main, Birch Lane) | Directories say **CJ Affiliate** (2024); verify | Product data feed | CJ's publisher product-search API is documented inconsistently; feeds are the reliable route | Yes |
| **CJ Affiliate** | Publisher account | Advertiser product feeds; GraphQL product search for joined advertisers (per third parties; verify at developers.cj.com) | | Yes |
| **Rakuten Advertising, Awin, FlexOffers, Ascend (Pepperjam)** | Publisher accounts | Product feeds per merchant | Awin: AptDeco; FlexOffers: Castlery, CB2, Crate & Barrel; Ascend: Chairish, 1stDibs (directories) | Yes |
| **Skimlinks / Sovrn Commerce** | One publisher sign-up | Automatic affiliate wrapping for tens of thousands of merchants; a Product API existed historically | Gets commission on almost any outbound link (Burrow and Crate & Barrel reportedly via Skimlinks). **Not a catalog source** | Yes |
| **IKEA** | No US affiliate program found; no official public API | – | Unofficial endpoints and scrapers exist; **don't**. Admitad and Awin list IKEA in some EU countries | – |
| **Google Shopping** | No public product-search API for third parties. The Content API and Merchant API manage *your own* products | – | SerpApi-style scraping of Google results is paid and violates Google's terms; skip | – |
| **Dupe.com MCP** | `https://mcp.dupe.com/mcp`, anonymous for search; an API key for product details | Visual lookalikes across retailers by URL, image or text, with price, retailer and affiliate link | Its agent notes: show price and retailer, link out, call prices "indicative", never "identical". **Bulk, commercial or feed-like use: contact legal@dupe.com first** | For production, yes |

## 4. Public Shopify storefronts (DTC brands)

Every Shopify store answers `/products.json` (up to 250 products per page, with title, variants, prices, images,
tags and sometimes dimensions in the HTML body). Checked on 2026-10-30:

| Brand | robots.txt | `/products.json` | Terms of use on automated access / reuse | Usable? |
|---|---|---|---|---|
| Floyd | Shopify default (doesn't block it) | 200 (open) | Bars "data mining" and publicly displaying contents or commercial use "except as expressly authorized" | **No** |
| Burrow (Havenly) | default | 404 | Bars "data mining, bots, spiders, automated tools…" | **No** |
| Castlery | – | redirect | "Scraping the Services without our prior consent is expressly prohibited" | **No** (has its own affiliate program) |
| Joybird (La-Z-Boy) | – | redirect | Bars harvesting or scraping; materials only "as specifically permitted" | **No** |
| Parachute | default | rate-limited | Bars "spider, crawl, or scrape" | **No** |
| Medley | default | rate-limited | No "data mining, robots, or similar"; personal, non-commercial use only | **No** |
| Sabai | default | rate-limited | No scraping "without express prior written consent" | **No** |
| Maiden Home | default | rate-limited | Same clause as Burrow | **No** |
| Schoolhouse | – | rate-limited | No reproducing or incorporating site content into another service without permission | **No** |
| Albany Park | default | rate-limited | Terms cover sales only; site content still copyrighted | **Not without permission** |
| Article | – | redirect | Terms page not found at `/terms` | Unverified; assume no |
| Interior Define | – | 404 | Brand acquired by Havenly after an assignment for the benefit of creditors | Ask Havenly |
| Thuma | default | 404 | Terms page not reachable | Unverified; assume no |

**Conclusion:** don't build on `/products.json`. Instead:
- **Join their affiliate programs** (most are on Impact, Skimlinks, FlexOffers or their own; Castlery runs its own).
- **Ask for a feed.** DTC brands want placement in design tools; a short email ("we design rooms for people and
  link to your products; may we use your catalog feed and 3D models?") often gets a CSV, images and sometimes GLB
  models. Havenly now owns Burrow and Interior Define and is a competitor, so expect friction there.

## 5. Thrift, vintage and secondhand

| Source | Access | Notes |
|---|---|---|
| **eBay Browse API** | Free developer account + keys; eBay Partner Network for commission | Search by keyword, category or **image**; returns images, price, condition, location; use `itemAffiliateWebUrl` for commission. Good for vintage furniture with local-pickup filters. Read the API License for display and caching rules |
| **Etsy Open API v3** | Free key; personal app first, then a commercial access review | Strong for vintage and handmade. Must show "The term 'Etsy' is a trademark of Etsy, Inc. This Application uses Etsy's API, but is not endorsed or certified by Etsy." No scraping |
| **1stDibs** | Affiliate (content creators; listed on CJ and Ascend) | High-end vintage and antiques; no public API found |
| **Chairish** | Affiliate via Ascend (Pepperjam); FlexOffers and ShareASale listings show "closed" | Mid-to-high vintage; no public API found |
| **AptDeco** | Affiliate on Awin (terms mention ShareASale) | Used furniture with delivery; no public API found |
| **Kaiyo** | – | Reported to have ceased operations in August 2024 (CB Insights); unconfirmed |
| **Facebook Marketplace** | **No public listings API; terms forbid scraping; Meta actively blocks it** | Not allowed. At most, deep-link to a Marketplace search the user runs themselves |
| **Craigslist, OfferUp** | No API; terms forbid scraping | Not allowed |

Vintage pieces are one-offs that sell quickly, so treat them as **live search results** (eBay/Etsy queries
built from the design: "walnut mid-century credenza 60in under $800 near me"), not catalog entries. Show dimensions
only when the listing states them.

## 6. 3D models for real products

| Route | License | Quality | Scale |
|---|---|---|---|
| **ABO 3D models** | CC BY 4.0 ("Amazon.com" credit) | High: real geometry and PBR materials, to scale | 7,953 models (~6.7k US furniture and decor). **Heavy (~50 MB per GLB)**, so decimate and compress (meshopt or Draco, 2K textures) in the Blender pipeline before the browser |
| **Parametric models sized to real dimensions** | Ours | Good enough when materials and proportions are right | **Unlimited.** Extend `blender/build_room.py`'s category generators with parameters (arm style, leg shape and taper, cushion count, base type, material and color) set from the product's dimensions and photo. **Recommended default** for catalog scale |
| **Sketchfab** | Per model: CC BY / CC BY-SA / CC0 OK commercially, with attribution; CC BY-NC not OK; Store models royalty-free but not redistributable | Varies | The Download API requires each user to authenticate with Sketchfab and the app to show the license. Best for a few hero or design-classic pieces |
| **Brand-supplied models** | Per agreement | Best | Many brands have GLB/USDZ for AR; ask as part of a feed partnership |
| **Retailer AR models** (IKEA, Wayfair, Amazon "View in your room") | Copyrighted, no license | – | **Don't extract** |
| **Image-to-3D** (open models like TRELLIS; paid Meshy and Tripo) | Depends on the model's license *and* the photo's rights | Improving; geometry approximate | Generating a 3D derivative of a retailer's photo may exceed an affiliate image license. Use it for the user's own furniture (Space Capture) and for brand-permitted photos |
| **Poly Haven, Objaverse, 3D-FUTURE** | CC0 / mixed / **non-commercial** | – | Poly Haven: CC0 but few furniture models. Objaverse: check per object. 3D-FUTURE: research only |

## 7. "What kind of shopper are you?" → sources

Taste Builder's interview can ask, in passing, how and where the person likes to shop. Each answer becomes a
**channel weight** that filters and ranks sources (and feeds the persona 2×2 and price tier).

| They say | Signal | Sources to weight | Persona lean |
|---|---|---|---|
| "Amazon, fast and easy" / "I need it next week" | speed, in stock | Amazon (Creators API), Walmart, Target; filter for in-stock and ship time < 2 weeks | Quick refresh |
| "IKEA and Target, I'm on a budget" | value | Target, Walmart, Amazon; IKEA by link only (no feed); eBay used | Considered first home, Quick refresh |
| "West Elm, CB2, Article" | mid-premium, modern | Impact and FlexOffers feeds for those brands; Skimlinks wrapping | Showroom-style |
| "I love DTC brands: Floyd, Burrow, Castlery" | design-led, online | Their affiliate programs; ask for feeds | Showroom-style, Considered first home |
| "Vintage, thrift, Facebook Marketplace" | secondhand, unique, sustainable | eBay and Etsy APIs (live search), Chairish, AptDeco; deep-link to a Marketplace search they run | Gatherer |
| "Antiques, investment pieces" | high-end, heirloom | 1stDibs, Chairish, Etsy vintage | Gatherer (premium) |
| "Made to order, custom fabrics" | customization, can wait 8–16 weeks | DTC custom upholstery (Interior Define-type, Joybird, Maiden Home) via affiliate; show lead times | Customized axis |
| "Local makers, sustainable, made in USA" | values | Etsy; tag a brand's "made in", certifications (FSC wood, GREENGUARD) where feeds provide them | Gatherer, Considered |
| "Brands I like: …" | named brands | Boost those merchants; use Dupe for lookalikes at other price points | any |
| "I hate assembling" / "white glove" | service | Prefer assembled delivery; flag flat-pack | any |

Store the result in the profile as `shopping: { channels: {...weights}, brands_like: [], brands_avoid: [],
secondhand_ok: bool, lead_time_max_weeks, assembly_ok: bool }`. The recommender filters the catalog by it before
the design model chooses.

## 8. Staged plan

### Now: free and legal (no keys, no sign-ups)
1. **Seed catalog from ABO.** `seed-products.json` has 33 items: sofas, chairs, ottomans, tables, a desk, storage,
   a bed, lighting, rugs, a mirror and a planter. Each has a real name, brand, Amazon link, dimensions (checked
   against its 3D model), a CC BY image URL, a **GLB 3D model URL**, and a source and license note, plus a
   `homebody` block shaped like `lib/play/products.json` (meters, material ids, style-family guesses). Expand it to
   150–200 with the same script logic (the filter is US + has a 3D model + has dimensions; then choose by category,
   style and palette).
   - **Prices:** none in the dataset. For the prototype, show "price on Amazon" or a hand-entered price marked with
     a date; real prices come with the Creators API.
   - **Freshness:** a 2017–2020 snapshot, so many ASINs are discontinued. That's fine for designing and rendering;
     before showing "Buy", check them live (API, later).
   - **Attribution:** show "Product data, images and 3D models: Amazon.com, from the Amazon Berkeley Objects dataset
     (CC BY 4.0)" in the credits, and note our changes. The license copy is `LICENSE-ABO-CC-BY-4.0.txt`.
2. **Parametric stand-ins for everything else.** For non-ABO products, render a parametric model sized to the real
   dimensions, so the room stays to scale.
3. **Dupe MCP for lookalikes in the prototype** (anonymous search, low volume, honest User-Agent, results shown as
   indicative with links out). Contact Dupe before any production or bulk use.
4. **Plain links are always allowed.** A hand-curated "inspiration" list linking to real product pages (no copied
   photos) can sit beside the 3D seed.

### Later: needs Maeve (accounts, keys, agreements)
In rough order of value:
1. **Impact.com partner account** → apply to Target, Walmart (+ walmart.io key), West Elm / Pottery Barn, Home
   Depot and any DTC brands there. Download catalogs; this becomes the main catalog.
2. **Amazon Associates** → Creators API credentials (eligibility may need early qualifying sales). Live prices for the
   ABO seed come from here.
3. **Skimlinks or Sovrn**: one sign-up to monetize any outbound link.
4. **CJ** (Wayfair and its brands) and **FlexOffers / Awin / Ascend** (Castlery, CB2, Crate & Barrel, AptDeco,
   Chairish, 1stDibs).
5. **eBay developer account + eBay Partner Network** and an **Etsy developer app** (personal, then commercial
   review) for vintage.
6. **Direct brand partnerships** for feeds and 3D models (emails to DTC brands).
7. **Legal review** of each agreement's display, caching and image rules; FTC disclosure copy.

### Catalog schema (what every product record should have)
`id, source, source_id, name, brand, category, room, price {amount, currency, as_of}, dims_in {w,d,h}, dims_source,
materials, colors (hex + names), style_families, image {url, license}, model3d {url, license, kind:
"scan"|"parametric"|"brand"|"sketchfab"}, product_url, affiliate_url, availability {in_stock, lead_time_weeks,
checked_at}, license, attribution`. Plus Homebody tags used by the rules: fabric double rubs, cleaning code,
pet-safe, fade-resistant, CCT/CRI for lamps.

## Sources

- [Amazon Berkeley Objects dataset (CC BY 4.0)](https://amazon-berkeley-objects.s3.amazonaws.com/index.html)
- [Amazon: PA-API 5 deprecation → Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation)
- [DEV: PA-API v5 shutting down April 30, 2026](https://dev.to/th3nate/amazon-pa-api-v5-is-shutting-down-april-30-2026-here-is-what-changes-at-the-auth-layer-22ek)
- [Impact: Download product catalogs as a partner](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/marketing-content/product-marketplace-and-catalogs/download-product-catalogs-as-a-partner)
- [Strackr: Wayfair affiliate program (CJ)](https://strackr.com/blog/wayfair-affiliate-program)
- [Target Partners FAQ](https://partners.target.com/faqs)
- [Walmart affiliates FAQ (Impact)](https://affiliates.walmart.com/faqs)
- [WIOpy: Walmart I/O Affiliate API wrapper](https://pypi.org/project/WIOpy/)
- [API Evangelist: IKEA (no official public API)](https://providers.apievangelist.com/providers/ikea/)
- [Skimlinks API docs (link wrapper)](https://support.skimlinks.com/hc/en-us/sections/360004586053-APIs-Link-Wrapper)
- [Hamster Garage: Burrow affiliate case study (Skimlinks)](https://www.hamstergarage.com/case-study/burrow)
- [Castlery affiliate program](https://www.castlery.com/sg/affiliate-program)
- [FlexOffers: CB2 affiliate program](https://www.flexoffers.com/affiliate-programs/cb2-affiliate-program)
- [Creator Hero: Crate & Barrel affiliate program](https://www.creator-hero.com/blog/crate-and-barrel-affiliate-program-in-depth-review-pros-and-cons)
- [UpPromote: West Elm affiliate directory](https://uppromote.com/affiliate-directory/west-elm/)
- [Dupe.com agent instructions (MCP)](https://dupe.com/agent.txt)
- [Dupe.com FAQ](https://dupe.com/faq)
- [eBay Browse API overview](https://developer.ebay.com/api-docs/buy/browse/overview.html)
- [Etsy API terms](https://www.etsy.com/mx/legal/api)
- [1stDibs: affiliate program](https://www.1stdibs.com/answers/does-1stdibs-have-an-affiliate-program)
- [affi.io: Chairish](https://affi.io/m/chairish)
- [Awin: AptDeco merchant terms](https://ui.awin.com/merchant-profile-terms/93197)
- [CB Insights: AptDeco vs Kaiyo](https://www.cbinsights.com/compare/aptdeco-vs-furnishare)
- [SociaVault: Why there's no Facebook Marketplace API](https://www.sociavault.com/blog/facebook-marketplace-api-alternative)
- [Sketchfab Download API guidelines](https://sketchfab.com/developers/download-api/guidelines)
- [Sketchfab API agreement](https://sketchfab.com/developers/terms)
- [Retail Dive: La-Z-Boy acquires Joybird](https://retaildive.com/news/la-z-boy-snaps-up-joybird/528151)
- [Yahoo: Havenly picks up Interior Define](https://www.yahoo.com/now/owner-picks-pieces-custom-furniture-001900346.html)
- [Wayfair WANDS dataset (MIT; search relevance, no images or prices)](https://github.com/wayfair/wands)
- Brand terms pages read on 2026-10-30: floydhome.com/policies/terms-of-service, burrow.com/policies/terms-of-service,
  castlery.com/us/terms-of-use, joybird.com/terms-of-use, parachutehome.com, medleyhome.com, sabai.design,
  maidenhome.com, schoolhouse.com, albanypark.com (each `/policies/terms-of-service`).
