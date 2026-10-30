export type RoomId =
  | "living-room"
  | "bedroom"
  | "kitchen"
  | "dining-room"
  | "office"
  | "bathroom"
  | "other";

export type Mode = "fresh" | "refresh";

export type Priority = "speed" | "style" | "budget" | "customization";

export type Timeline = "asap" | "month" | "few-months" | "indefinite";

export type Tier = "standard" | "customized";

export type PersonaKey = "showroom" | "considered" | "quick-refresh" | "gatherer";

export type AestheticTag =
  | "warm-minimal"
  | "scandinavian"
  | "indian-eclectic"
  | "mediterranean"
  | "japandi"
  | "midcentury"
  | "coastal"
  | "industrial"
  | "maximalist-boho";

export type Palette =
  | "warm-neutral"
  | "jewel-tone"
  | "monochrome"
  | "earthy-terracotta"
  | "cool-neutral";

export interface RoomPhoto {
  room: RoomId;
  dataUrl: string;
  name: string;
}

export interface IntakeAnswers {
  rooms: RoomId[];
  mode: Mode | null;
  priorities: Priority[];
  timeline: Timeline | null;
  photos: RoomPhoto[];
}

export interface StyleAnswers {
  aesthetics: AestheticTag[];
  palette: Palette | null;
  story: string;
}

export interface RoomFunctionalInfo {
  pack: "standard" | "extended";
  dimensions: string;
  budget: number;
}

export type FunctionalInfo = Partial<Record<RoomId, RoomFunctionalInfo>>;

export interface CatalogItem {
  id: string;
  room: RoomId;
  category: string;
  categoryLabel: string;
  packTier: "standard" | "extended";
  name: string;
  price: number;
  swatch: string; // hex color used for the placeholder tile
  aesthetics: AestheticTag[];
  palette: Palette[];
  note: string;
  isOwned?: boolean; // true for items synthesized from the user's own inventory
  photoDataUrl?: string; // photo of the actual owned piece, textured onto its 3D proxy
}

// A piece the user already owns — captured by photo, not recommended.
export interface InventoryItem {
  id: string;
  room: RoomId;
  category: string; // matches a ROOM_CATEGORIES key for that room, or "other"
  categoryLabel: string;
  label: string;
  photoDataUrl?: string;
}

export interface HomebodyState {
  step: number;
  intake: IntakeAnswers;
  style: StyleAnswers;
  functional: FunctionalInfo;
  inventory: InventoryItem[];
  swaps: Record<string, string>; // categoryKey ("room::category") -> chosen item id
}

// Real-world footprint in meters, used to size 3D proxies: [width, height, depth]
export type Footprint = [number, number, number];

export type Mount = "floor" | "wall" | "ceiling";

export interface PlacementSpec {
  x: number; // fraction of room width, 0..1
  z: number; // fraction of room depth, 0..1
  rotationY: number; // degrees
  mount: Mount;
}
