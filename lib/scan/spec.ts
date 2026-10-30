import { z } from "zod";

// The room spec is the contract between the photo reader (Claude) and the
// builders (Blender for renders + .glb, three.js for the live viewer).
// All lengths are meters. Plan coordinates: origin at footprint[0], x and y
// on the floor, z up. The footprint runs counterclockwise, so the room's
// interior is on the left of each wall as you walk from corner i to i+1.

export const FLOOR_MATERIALS = [
  "wood_light", "wood_mid", "wood_dark", "parquet", "concrete", "painted_concrete",
  "tile", "terrazzo", "carpet",
] as const;

export const WALL_MATERIALS = ["paint", "painted_brick", "brick", "concrete", "wood_panel"] as const;

export const ITEM_MATERIALS = [
  "fabric", "velvet", "boucle", "leather", "wood_light", "wood_mid", "wood_dark",
  "metal_black", "metal_brass", "metal_chrome", "painted", "plastic", "glass",
  "marble", "stone", "ceramic", "wicker", "foliage",
] as const;

export const CATEGORIES = [
  "sofa", "sectional", "armchair", "accent_chair", "dining_chair", "office_chair", "stool",
  "bench", "ottoman", "coffee_table", "side_table", "dining_table", "desk", "console_table",
  "kitchen_island", "counter", "bed", "nightstand", "dresser", "wardrobe", "bookshelf",
  "shelving_unit", "cabinet", "tv_stand", "tv", "rug", "floor_lamp", "table_lamp",
  "pendant_light", "plant", "artwork", "mirror", "curtains", "appliance", "bicycle", "other",
] as const;

const Point = z.object({ x: z.number(), y: z.number() });

const Opening = z.object({
  type: z.enum(["door", "window", "opening", "glass_door"]),
  wall: z.number().int().describe("Index i of the wall from footprint[i] to footprint[i+1] (the last wall closes back to footprint[0])"),
  offset: z.number().describe("Meters from footprint[wall] along the wall to the opening's near edge"),
  width: z.number(),
  height: z.number(),
  sill: z.number().describe("Height of the bottom edge above the floor; 0 for doors"),
});

const Item = z.object({
  id: z.string().describe("Short unique slug, e.g. grey-sofa"),
  name: z.string().describe("What the owner would call it, e.g. 'Grey three-seat sofa'"),
  category: z.enum(CATEGORIES),
  width: z.number().describe("Side to side, along the item's own x axis"),
  depth: z.number().describe("Front to back"),
  height: z.number(),
  x: z.number().describe("Center of the footprint, plan coordinates"),
  y: z.number(),
  elevation: z.number().describe("Bottom of the item above the floor; 0 for floor-standing, >0 for wall-mounted or hanging"),
  rotation: z.number().describe("Degrees counterclockwise. At 0 the width runs along +x and the front faces +y; 90 faces -x; 180 faces -y; 270 faces +x"),
  primary_color: z.string().describe("Hex like #8a8f93 for the main surface"),
  secondary_color: z.string().describe("Hex for legs, frame, or trim"),
  primary_material: z.enum(ITEM_MATERIALS),
  secondary_material: z.enum(ITEM_MATERIALS),
  seen_in: z.array(z.number().int()).describe("1-based photo numbers this item appears in"),
  confidence: z.number().describe("0 to 1: how sure you are about size and placement"),
  notes: z.string().describe("Anything the builder or a designer should know, e.g. 'mid-century, tapered legs'"),
  fixed: z.boolean().optional().describe("True for things built into the architecture that can't be moved: wall cladding and slats, accent wall panels, fireplaces, built-in or floating shelves, wall-mounted AC units"),
});

export const RoomSpecSchema = z.object({
  name: z.string().describe("e.g. 'Living room' or 'Open-plan studio'"),
  summary: z.string().describe("Two sentences describing the space as a designer would"),
  footprint: z.array(Point).describe("Floor outline corners in meters, counterclockwise, footprint[0] at (0,0)"),
  ceiling_height: z.number(),
  floor: z.object({ material: z.enum(FLOOR_MATERIALS), color: z.string() }),
  walls: z.object({ material: z.enum(WALL_MATERIALS), color: z.string() }),
  ceiling_color: z.string(),
  openings: z.array(Opening),
  items: z.array(Item),
  lighting: z.string().describe("Natural light, direction if you can tell, and fixtures"),
  scale_basis: z.string().describe("What set the scale: the owner's measurement, a door, a standard counter height, etc."),
  confidence: z.number().describe("0 to 1 overall"),
  ceiling: z.object({
    shape: z.enum(["flat", "mono_pitch", "gable"]),
    high_height: z.number().describe("Height at the highest point (the ridge, or the high side of a mono-pitch); ceiling_height is the low side"),
    low_wall: z.number().int().describe("Index of the wall on the low side (mono-pitch), or a wall parallel to the ridge (gable)"),
    rafters: z.boolean().describe("Exposed rafters running up the slope"),
    rafter_color: z.string(),
    beam: z.boolean().describe("A large exposed beam running along the room, parallel to the low wall"),
    beam_color: z.string(),
  }).optional().describe("Only for sloped or beamed ceilings; leave out for a flat ceiling"),
  outdoor_view: z.enum(["garden", "trees", "water", "city", "street", "fields", "sky", "unknown"]).optional().describe("What the windows look out on"),
  photo_marks: z.array(z.object({
    photo: z.number().int().describe("1-based photo number"),
    points: z.array(z.object({
      u: z.number().describe("Fraction of the photo's width from the left"),
      v: z.number().describe("Fraction of the photo's height from the top"),
      x: z.number(), y: z.number(), z: z.number().describe("The same point in room coordinates, meters"),
    })),
  })).optional().describe("For each photo, 6–10 clearly visible points whose room coordinates you know: floor and ceiling corners, door and window corners. Not all on one plane. Lets the builder render from the photo's own viewpoint"),
  photo_regions: z.array(z.object({
    photo: z.number().int().describe("1-based photo number"),
    surface: z.string().describe("'wall', 'floor', 'ceiling', or an item id from items"),
    box: z.array(z.number()).describe("[x0, y0, x1, y1] as fractions of the photo's width and height from the top left"),
  })).optional().describe("Clean, evenly lit patches where each surface's true color can be measured"),
  coverage: z.object({
    corners_seen: z.number().int().describe("How many of the room's floor corners are visible in at least one photo"),
    walls_seen: z.number().int().describe("How many walls are seen well enough to place their doors, windows and length"),
    floor_visible: z.boolean().describe("Enough open floor is visible to judge the room's depth and the floor material"),
    wide_shot: z.boolean().describe("At least one photo shows two walls meeting and the floor between them"),
    missing: z.array(z.string()).describe("Up to 3 short, specific asks for the owner, as instructions, e.g. 'Add a photo of the wall with the window, from the opposite corner'. Empty when the photos are enough"),
  }).optional().describe("How well the photos cover the room, so the owner can be asked for what's missing"),
  profile_signals: z.object({
    style: z.array(z.string()).describe("Style cues a designer would note, e.g. 'warm mid-century', 'industrial loft'"),
    price_level: z.string().describe("Rough price level of the existing pieces, e.g. 'mostly mid-range'"),
    lifestyle: z.array(z.string()).describe("Hints about how they live, e.g. 'cyclist', 'lots of books'"),
  }),
});

export type RoomSpec = z.infer<typeof RoomSpecSchema>;
export type RoomItem = RoomSpec["items"][number];
