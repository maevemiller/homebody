import { CatalogItem, RoomId } from "./types";

export const ROOM_LABELS: Record<RoomId, string> = {
  "living-room": "Living room",
  bedroom: "Bedroom",
  kitchen: "Kitchen",
  "dining-room": "Dining room",
  office: "Office",
  bathroom: "Bathroom",
  other: "Other space",
};

// Rooms the v0 catalog actually covers. Bathroom / other get an honest
// "curation coming soon" state in the functional-info + results steps.
export const CATALOG_ROOMS: RoomId[] = [
  "living-room",
  "bedroom",
  "kitchen",
  "dining-room",
  "office",
];

// Which categories are in the "standard" pack per room vs. only unlocked by
// the "extended" pack. This is the same standard/extended split from the
// original functional-info wireframe, and it doubles as the furniture-only
// vs. +accessories axis from the pricing model.
export const ROOM_CATEGORIES: Record<
  RoomId,
  { core: { key: string; label: string }[]; accessory: { key: string; label: string }[] }
> = {
  "living-room": {
    core: [
      { key: "sofa", label: "Sofa" },
      { key: "coffee-table", label: "Coffee table" },
      { key: "rug", label: "Rug" },
    ],
    accessory: [
      { key: "floor-lamp", label: "Floor lamp" },
      { key: "wall-art", label: "Wall art" },
      { key: "throw-pillows", label: "Throw pillows" },
    ],
  },
  bedroom: {
    core: [
      { key: "bed-frame", label: "Bed frame" },
      { key: "nightstand", label: "Nightstand" },
      { key: "dresser", label: "Dresser" },
    ],
    accessory: [
      { key: "bedding", label: "Bedding" },
      { key: "table-lamp", label: "Table lamp" },
    ],
  },
  kitchen: {
    core: [{ key: "dishware", label: "Dishware set" }],
    accessory: [
      { key: "barstools", label: "Barstools" },
      { key: "table-linens", label: "Table linens" },
    ],
  },
  "dining-room": {
    core: [
      { key: "dining-table", label: "Dining table" },
      { key: "dining-chairs", label: "Dining chairs" },
    ],
    accessory: [{ key: "pendant-light", label: "Pendant light" }],
  },
  office: {
    core: [
      { key: "desk", label: "Desk" },
      { key: "office-chair", label: "Office chair" },
    ],
    accessory: [{ key: "shelving", label: "Shelving" }],
  },
  bathroom: { core: [], accessory: [] },
  other: { core: [], accessory: [] },
};

export const CATALOG: CatalogItem[] = [
  // ---------- living room ----------
  { id: "sofa-bouclé", room: "living-room", category: "sofa", categoryLabel: "Sofa", packTier: "standard", name: "Rounded bouclé sofa, oat", price: 1450, swatch: "#DCD3C1", aesthetics: ["warm-minimal", "scandinavian", "japandi"], palette: ["warm-neutral", "cool-neutral"], note: "Low arms, deep seat — reads calm from across the room." },
  { id: "sofa-kantha", room: "living-room", category: "sofa", categoryLabel: "Sofa", packTier: "extended", name: "Kantha-stitched daybed sofa", price: 1690, swatch: "#8A4A3B", aesthetics: ["indian-eclectic", "maximalist-boho"], palette: ["jewel-tone", "earthy-terracotta"], note: "Hand-stitched cotton layers over a teak frame." },
  { id: "coffee-oak", room: "living-room", category: "coffee-table", categoryLabel: "Coffee table", packTier: "standard", name: "Live-edge oak coffee table", price: 480, swatch: "#B08D57", aesthetics: ["scandinavian", "midcentury", "warm-minimal"], palette: ["warm-neutral"], note: "One slab, oiled finish, visible grain." },
  { id: "coffee-brass", room: "living-room", category: "coffee-table", categoryLabel: "Coffee table", packTier: "extended", name: "Hammered brass tray table", price: 390, swatch: "#B08442", aesthetics: ["indian-eclectic", "maximalist-boho", "mediterranean"], palette: ["jewel-tone", "earthy-terracotta"], note: "Hexagonal brass tray on a folding teak stand." },
  { id: "rug-wool-stripe", room: "living-room", category: "rug", categoryLabel: "Rug", packTier: "standard", name: "Undyed wool stripe rug", price: 620, swatch: "#E4DCC8", aesthetics: ["scandinavian", "warm-minimal", "japandi"], palette: ["warm-neutral", "cool-neutral"], note: "Flat-weave, natural undyed wool." },
  { id: "rug-dhurrie", room: "living-room", category: "rug", categoryLabel: "Rug", packTier: "extended", name: "Hand-loomed cotton dhurrie", price: 540, swatch: "#B5533A", aesthetics: ["indian-eclectic", "maximalist-boho"], palette: ["jewel-tone", "earthy-terracotta"], note: "Geometric border, reversible weave." },
  { id: "lamp-arc", room: "living-room", category: "floor-lamp", categoryLabel: "Floor lamp", packTier: "extended", name: "Arc floor lamp, brushed brass", price: 260, swatch: "#C7B383", aesthetics: ["midcentury", "warm-minimal"], palette: ["warm-neutral"], note: "Marble base, linen shade." },
  { id: "art-block-print", room: "living-room", category: "wall-art", categoryLabel: "Wall art", packTier: "extended", name: "Framed block-print triptych", price: 210, swatch: "#9B5B45", aesthetics: ["indian-eclectic", "maximalist-boho"], palette: ["jewel-tone", "earthy-terracotta"], note: "Hand block-printed on cotton rag paper." },
  { id: "pillow-linen", room: "living-room", category: "throw-pillows", categoryLabel: "Throw pillows", packTier: "extended", name: "Washed linen pillow pair", price: 90, swatch: "#CBBFA6", aesthetics: ["scandinavian", "warm-minimal", "japandi"], palette: ["warm-neutral", "cool-neutral"], note: "Stonewashed European linen, feather fill." },

  // ---------- bedroom ----------
  { id: "bed-oak-platform", room: "bedroom", category: "bed-frame", categoryLabel: "Bed frame", packTier: "standard", name: "Oak platform bed", price: 890, swatch: "#C7A97A", aesthetics: ["scandinavian", "japandi", "warm-minimal"], palette: ["warm-neutral"], note: "Low profile, exposed joinery, no box spring needed." },
  { id: "bed-carved-teak", room: "bedroom", category: "bed-frame", categoryLabel: "Bed frame", packTier: "extended", name: "Hand-carved teak bed frame", price: 1120, swatch: "#7A4B2E", aesthetics: ["indian-eclectic", "maximalist-boho"], palette: ["earthy-terracotta", "jewel-tone"], note: "Traditional relief carving along the headboard." },
  { id: "night-round-oak", room: "bedroom", category: "nightstand", categoryLabel: "Nightstand", packTier: "standard", name: "Round oak nightstand", price: 220, swatch: "#B99E73", aesthetics: ["scandinavian", "midcentury"], palette: ["warm-neutral"], note: "Single drawer, tapered legs." },
  { id: "night-inlay", room: "bedroom", category: "nightstand", categoryLabel: "Nightstand", packTier: "extended", name: "Bone-inlay nightstand", price: 340, swatch: "#EDE7DA", aesthetics: ["indian-eclectic", "maximalist-boho"], palette: ["jewel-tone", "monochrome"], note: "Hand-inlaid geometric bone pattern on mango wood." },
  { id: "dresser-scandi", room: "bedroom", category: "dresser", categoryLabel: "Dresser", packTier: "standard", name: "Six-drawer ash dresser", price: 760, swatch: "#D6C7A6", aesthetics: ["scandinavian", "warm-minimal"], palette: ["warm-neutral"], note: "Soft-close drawers, brushed steel pulls." },
  { id: "dresser-jaipur", room: "bedroom", category: "dresser", categoryLabel: "Dresser", packTier: "extended", name: "Hand-painted Jaipur dresser", price: 980, swatch: "#3C5A6E", aesthetics: ["indian-eclectic", "maximalist-boho"], palette: ["jewel-tone"], note: "Indigo lacquer with hand-painted floral motifs." },
  { id: "bedding-linen", room: "bedroom", category: "bedding", categoryLabel: "Bedding", packTier: "extended", name: "Stonewashed linen bedding set", price: 180, swatch: "#E6DECB", aesthetics: ["scandinavian", "warm-minimal", "japandi"], palette: ["warm-neutral", "cool-neutral"], note: "Duvet cover, sheet set, two shams." },
  { id: "lamp-ceramic", room: "bedroom", category: "table-lamp", categoryLabel: "Table lamp", packTier: "extended", name: "Ceramic bedside lamp, glazed rust", price: 130, swatch: "#A6512F", aesthetics: ["mediterranean", "indian-eclectic"], palette: ["earthy-terracotta"], note: "Hand-thrown stoneware, linen shade." },

  // ---------- kitchen ----------
  { id: "dish-stoneware", room: "kitchen", category: "dishware", categoryLabel: "Dishware set", packTier: "standard", name: "Matte stoneware dinnerware, 16pc", price: 210, swatch: "#DDD6C6", aesthetics: ["scandinavian", "warm-minimal", "japandi"], palette: ["warm-neutral", "cool-neutral"], note: "Reactive glaze, dishwasher safe." },
  { id: "dish-cobalt", room: "kitchen", category: "dishware", categoryLabel: "Dishware set", packTier: "extended", name: "Cobalt hand-painted dinnerware, 16pc", price: 260, swatch: "#2E4A78", aesthetics: ["indian-eclectic", "mediterranean", "maximalist-boho"], palette: ["jewel-tone"], note: "Hand-painted blue pottery, each plate slightly unique." },
  { id: "stool-oak", room: "kitchen", category: "barstools", categoryLabel: "Barstools", packTier: "extended", name: "Oak counter stool, set of two", price: 340, swatch: "#C2A574", aesthetics: ["scandinavian", "midcentury"], palette: ["warm-neutral"], note: "Backless, footrest ring, stacks for storage." },
  { id: "linens-block", room: "kitchen", category: "table-linens", categoryLabel: "Table linens", packTier: "extended", name: "Block-print napkin set", price: 60, swatch: "#B5533A", aesthetics: ["indian-eclectic", "maximalist-boho"], palette: ["earthy-terracotta", "jewel-tone"], note: "Set of six, hand block-printed cotton." },

  // ---------- dining room ----------
  { id: "table-oak-oval", room: "dining-room", category: "dining-table", categoryLabel: "Dining table", packTier: "standard", name: "Oval oak dining table", price: 1180, swatch: "#C7A97A", aesthetics: ["scandinavian", "warm-minimal", "japandi"], palette: ["warm-neutral"], note: "Seats six, solid oak, oiled finish." },
  { id: "table-marble-brass", room: "dining-room", category: "dining-table", categoryLabel: "Dining table", packTier: "extended", name: "Marble-top table, brass base", price: 1620, swatch: "#D8D2C6", aesthetics: ["mediterranean", "maximalist-boho"], palette: ["monochrome", "jewel-tone"], note: "Honed marble top on a cast brass pedestal." },
  { id: "chairs-rattan", room: "dining-room", category: "dining-chairs", categoryLabel: "Dining chairs", packTier: "standard", name: "Woven rattan dining chairs, set of 4", price: 640, swatch: "#C9A96B", aesthetics: ["scandinavian", "coastal", "warm-minimal"], palette: ["warm-neutral"], note: "Hand-woven seats on oak frames." },
  { id: "chairs-carved", room: "dining-room", category: "dining-chairs", categoryLabel: "Dining chairs", packTier: "extended", name: "Hand-carved teak chairs, set of 4", price: 890, swatch: "#7A4B2E", aesthetics: ["indian-eclectic", "maximalist-boho"], palette: ["earthy-terracotta", "jewel-tone"], note: "Traditional carved backrests, upholstered seat." },
  { id: "pendant-glass", room: "dining-room", category: "pendant-light", categoryLabel: "Pendant light", packTier: "extended", name: "Amber glass pendant cluster", price: 320, swatch: "#B5713A", aesthetics: ["midcentury", "mediterranean"], palette: ["earthy-terracotta", "warm-neutral"], note: "Three hand-blown globes at staggered heights." },

  // ---------- office ----------
  { id: "desk-oak-writing", room: "office", category: "desk", categoryLabel: "Desk", packTier: "standard", name: "Oak writing desk", price: 560, swatch: "#C2A574", aesthetics: ["scandinavian", "warm-minimal", "japandi"], palette: ["warm-neutral"], note: "Single drawer, cable cutout, tapered legs." },
  { id: "desk-inlay", room: "office", category: "desk", categoryLabel: "Desk", packTier: "extended", name: "Bone-inlay writing desk", price: 780, swatch: "#3C5A6E", aesthetics: ["indian-eclectic", "maximalist-boho"], palette: ["jewel-tone", "monochrome"], note: "Hand-inlaid top, brass hardware." },
  { id: "chair-wool", room: "office", category: "office-chair", categoryLabel: "Office chair", packTier: "standard", name: "Wool-upholstered task chair", price: 340, swatch: "#8C8676", aesthetics: ["scandinavian", "warm-minimal", "midcentury"], palette: ["cool-neutral", "warm-neutral"], note: "Wool bouclé seat, oak base, full recline." },
  { id: "chair-rattan-office", room: "office", category: "office-chair", categoryLabel: "Office chair", packTier: "extended", name: "Woven rattan swivel chair", price: 410, swatch: "#C9A96B", aesthetics: ["coastal", "indian-eclectic"], palette: ["warm-neutral", "earthy-terracotta"], note: "Hand-woven back, cushioned seat, swivel base." },
  { id: "shelf-ladder", room: "office", category: "shelving", categoryLabel: "Shelving", packTier: "extended", name: "Ladder shelving unit, oak", price: 290, swatch: "#B99E73", aesthetics: ["scandinavian", "warm-minimal", "japandi"], palette: ["warm-neutral"], note: "Five open shelves, leans against the wall." },
];

export function itemsFor(room: RoomId, category: string): CatalogItem[] {
  return CATALOG.filter((i) => i.room === room && i.category === category);
}
