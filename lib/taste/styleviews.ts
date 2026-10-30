import type { Family, RoomImage } from "./visual";

// Her own room, restyled (Maeve, 2026-10-30: "show generated style views of her room instead of stock
// photos"). Each preset is a style family from docs/reference/interior-design/style-families.md, expressed
// as what it puts in the room: wall color, floor, fabric, wood, metal, rug and curtains. The architecture
// and the furniture stay where the scan put them; only surfaces are recolored. The presets are registered
// as rooms (lib/taste/visual.ts), so a pick scores exactly like a stock photo of that family did.

export interface StylePreset extends RoomImage {
  // what it puts in the room, the card's label
  label: string;
  colors: { wall: string; floor: string; fabric: string; leather: string; wood: string; metal: string; rug: string; curtain: string; painted: string };
  // a stock photo of the same family, for the read-back when the render isn't in this browser
  fallback: string;
}

const preset = (
  family: Family, name: string, puts: string, colors: StylePreset["colors"], fallback: string,
  extra: Pick<RoomImage, "palette" | "value" | "temperature" | "line" | "age" | "woods" | "metals" | "textiles" | "mood">,
): StylePreset => ({
  id: `style-${family}`, family: { [family]: 1 } as Partial<Record<Family, number>>,
  alt: `Your room, ${name}: ${puts}`, label: `${name}: ${puts}`, density: "edited", pattern: "none", colors, fallback, ...extra,
});

export const STYLE_PRESETS: StylePreset[] = [
  preset("scandinavian", "Scandinavian", "white walls, pale oak, oatmeal wool",
    { wall: "#F3F1EC", floor: "#D9C3A0", fabric: "#E2DCD0", leather: "#C9A27A", wood: "#D2B48A", metal: "#2B2B2B", rug: "#ECE7DE", curtain: "#F4F1EA", painted: "#F1EFEA" },
    "scandi-throw", { palette: "cool_neutrals", value: "light", temperature: "neutral", line: "straight", age: "new", woods: ["white_oak"], metals: ["black_steel"], textiles: ["wool"], mood: ["calm", "bright"] }),
  preset("midcentury", "Mid-century", "cream walls, walnut, olive and mustard",
    { wall: "#EFE6D6", floor: "#8A5A36", fabric: "#6B7A3A", leather: "#8A5A3C", wood: "#6B4428", metal: "#B5964A", rug: "#D9A441", curtain: "#E9DFC9", painted: "#E9E1D0" },
    "mcm-navy", { palette: "midcentury", value: "mid", temperature: "warm", line: "mixed", age: "mixed", woods: ["walnut"], metals: ["brass"], textiles: ["wool"], mood: ["warm", "playful"] }),
  preset("japandi", "Japandi", "stone linen, dark oak, low and quiet",
    { wall: "#E9E3D8", floor: "#C8B08C", fabric: "#B9AE9C", leather: "#7A5C44", wood: "#4A3A2C", metal: "#2A2A2A", rug: "#D7CDBC", curtain: "#EFE9DE", painted: "#E4DDD0" },
    "japandi-lattice", { palette: "monochrome", value: "mid", temperature: "neutral", line: "straight", age: "new", woods: ["walnut"], metals: ["black_steel"], textiles: ["linen"], mood: ["calm", "grounded"] }),
  preset("warm_minimal", "Warm minimal", "limewash walls, pale wood, bouclé",
    { wall: "#E7DED1", floor: "#CDB48E", fabric: "#EDE6DA", leather: "#B08D62", wood: "#B08D62", metal: "#A7A9A9", rug: "#E3D8C6", curtain: "#F0EAE0", painted: "#ECE5DA" },
    "warmmin-plaster", { palette: "warm_neutrals", value: "light", temperature: "warm", line: "curved", age: "new", woods: ["white_oak"], metals: ["nickel"], textiles: ["boucle", "linen"], mood: ["calm", "grounded"] }),
  preset("industrial", "Industrial", "concrete grey, dark wood, cognac leather, black steel",
    { wall: "#A9A7A2", floor: "#4E3C2E", fabric: "#5D5F61", leather: "#8A5A3C", wood: "#3E2C23", metal: "#1F1F1F", rug: "#6E6A64", curtain: "#8C8A86", painted: "#3A3A3A" },
    "industrial-brick", { palette: "high_contrast", value: "dark", temperature: "neutral", line: "straight", age: "mixed", woods: ["reclaimed"], metals: ["black_steel"], textiles: ["leather"], mood: ["moody", "grounded"] }),
  preset("boho", "Bohemian", "warm sand walls, terracotta, rattan tones",
    { wall: "#E8DCC8", floor: "#B58A5E", fabric: "#C0673F", leather: "#9C6A40", wood: "#8C6A48", metal: "#B5964A", rug: "#9C4A2A", curtain: "#EFE3CC", painted: "#E5D6BE" },
    "boho-sage", { palette: "earthy", value: "mid", temperature: "warm", line: "curved", age: "mixed", woods: ["reclaimed"], metals: ["brass"], textiles: ["jute"], mood: ["cozy", "playful"] }),
  preset("traditional", "Traditional", "greige walls, dark wood, navy and ruby",
    { wall: "#E1D8C8", floor: "#6A4A32", fabric: "#2E3F5C", leather: "#5A3424", wood: "#4A3020", metal: "#B5964A", rug: "#8E1F35", curtain: "#D9CDB8", painted: "#DCD2C1" },
    "traditional-fireplace", { palette: "jewel", value: "mid", temperature: "warm", line: "mixed", age: "antique", woods: ["walnut"], metals: ["brass"], textiles: ["wool"], mood: ["elegant", "grounded"] }),
  preset("coastal", "Coastal", "salt white, driftwood, washed blues",
    { wall: "#F5F3EE", floor: "#D8CBB4", fabric: "#8FB2C2", leather: "#B7A98E", wood: "#B7A98E", metal: "#A7A9A9", rug: "#C8D7DC", curtain: "#F6F4EF", painted: "#F2F0EB" },
    "coastal-airy", { palette: "coastal", value: "light", temperature: "cool", line: "mixed", age: "new", woods: ["white_oak"], metals: ["nickel"], textiles: ["linen"], mood: ["bright", "calm"] }),
  preset("mediterranean", "Mediterranean", "whitewash, terracotta floor, cobalt",
    { wall: "#F6F1E7", floor: "#C7764B", fabric: "#E5D3B3", leather: "#9C6A40", wood: "#6F5A3E", metal: "#2B2B2B", rug: "#2C5A8C", curtain: "#F4EEE2", painted: "#F2ECE0" },
    "med-arch", { palette: "mediterranean", value: "light", temperature: "warm", line: "curved", age: "mixed", woods: ["walnut"], metals: ["black_steel"], textiles: ["linen"], mood: ["bright", "warm"] }),
];

export const isStyleView = (id: string) => id.startsWith("style-");

// Rendered thumbnails, in this browser only (data URLs), keyed by preset id
export const STYLE_SHOTS = new Map<string, string>();
