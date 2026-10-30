import { Footprint, Mount, PlacementSpec, RoomFunctionalInfo, RoomId } from "./types";
import { CategoryPick } from "./recommend";
import { parseDimensions } from "./dimensions";

// Real-world footprint per category, in meters: [width, height, depth].
export const FOOTPRINTS: Record<string, Footprint> = {
  sofa: [2.0, 0.8, 0.9],
  "coffee-table": [1.1, 0.4, 0.6],
  rug: [2.4, 0.02, 1.6],
  "floor-lamp": [0.35, 1.5, 0.35],
  "wall-art": [0.9, 0.6, 0.05],
  "throw-pillows": [0.45, 0.45, 0.15],
  "bed-frame": [1.6, 0.5, 2.0],
  nightstand: [0.45, 0.55, 0.4],
  dresser: [1.2, 0.9, 0.5],
  bedding: [1.5, 0.12, 1.9],
  "table-lamp": [0.25, 0.45, 0.25],
  dishware: [0.35, 0.12, 0.35],
  barstools: [0.4, 0.9, 0.4],
  "table-linens": [0.9, 0.02, 0.9],
  "dining-table": [1.8, 0.75, 1.0],
  "dining-chairs": [0.9, 0.9, 0.5],
  "pendant-light": [0.3, 0.3, 0.3],
  desk: [1.3, 0.75, 0.65],
  "office-chair": [0.6, 0.9, 0.6],
  shelving: [0.8, 1.8, 0.35],
  other: [0.6, 0.6, 0.6],
};

// Elevation (meters) for categories that sit on top of another surface
// rather than the floor — approximated, not tied to a specific piece.
const SURFACE_HEIGHT: Record<string, number> = {
  "throw-pillows": 0.42,
  bedding: 0.46,
  "table-lamp": 0.55,
  dishware: 0.42,
  "table-linens": 0.75,
};

const DEFAULT_PLACEMENT: PlacementSpec = { x: 0.5, z: 0.85, rotationY: 0, mount: "floor" };

export const PLACEMENT: Partial<Record<RoomId, Record<string, PlacementSpec>>> = {
  "living-room": {
    sofa: { x: 0.5, z: 0.13, rotationY: 0, mount: "floor" },
    "coffee-table": { x: 0.5, z: 0.42, rotationY: 0, mount: "floor" },
    rug: { x: 0.5, z: 0.5, rotationY: 0, mount: "floor" },
    "floor-lamp": { x: 0.88, z: 0.16, rotationY: 0, mount: "floor" },
    "wall-art": { x: 0.5, z: 0.03, rotationY: 0, mount: "wall" },
    "throw-pillows": { x: 0.38, z: 0.15, rotationY: 0, mount: "floor" },
  },
  bedroom: {
    "bed-frame": { x: 0.5, z: 0.16, rotationY: 0, mount: "floor" },
    nightstand: { x: 0.86, z: 0.16, rotationY: 0, mount: "floor" },
    dresser: { x: 0.12, z: 0.72, rotationY: 90, mount: "floor" },
    bedding: { x: 0.5, z: 0.22, rotationY: 0, mount: "floor" },
    "table-lamp": { x: 0.86, z: 0.16, rotationY: 0, mount: "floor" },
  },
  kitchen: {
    dishware: { x: 0.6, z: 0.55, rotationY: 0, mount: "floor" },
    barstools: { x: 0.62, z: 0.75, rotationY: 0, mount: "floor" },
    "table-linens": { x: 0.55, z: 0.55, rotationY: 0, mount: "floor" },
  },
  "dining-room": {
    "dining-table": { x: 0.5, z: 0.5, rotationY: 0, mount: "floor" },
    "dining-chairs": { x: 0.5, z: 0.78, rotationY: 180, mount: "floor" },
    "pendant-light": { x: 0.5, z: 0.5, rotationY: 0, mount: "ceiling" },
  },
  office: {
    desk: { x: 0.5, z: 0.15, rotationY: 0, mount: "floor" },
    "office-chair": { x: 0.5, z: 0.37, rotationY: 180, mount: "floor" },
    shelving: { x: 0.12, z: 0.62, rotationY: 90, mount: "floor" },
  },
};

export interface SceneObject {
  id: string;
  categoryKey: string;
  categoryLabel: string;
  label: string;
  color: string;
  photoDataUrl?: string;
  isOwned: boolean;
  size: Footprint;
  position: [number, number, number];
  rotationY: number;
  mount: Mount;
}

export interface RoomScene {
  room: RoomId;
  width: number;
  depth: number;
  wallHeight: number;
  estimatedDimensions: boolean;
  backWallPhotoDataUrl?: string;
  objects: SceneObject[];
}

const WALL_HEIGHT = 2.6;

export function buildRoomScene(
  room: RoomId,
  functional: RoomFunctionalInfo,
  picks: CategoryPick[],
  backWallPhotoDataUrl?: string
): RoomScene {
  const { width, depth, estimated } = parseDimensions(functional.dimensions, room);
  const placementForRoom = PLACEMENT[room] ?? {};

  const objects: SceneObject[] = picks.map((pick) => {
    const footprint = FOOTPRINTS[pick.categoryKey] ?? FOOTPRINTS.other;
    const placement = placementForRoom[pick.categoryKey] ?? DEFAULT_PLACEMENT;
    const h = footprint[1];

    let y: number;
    if (placement.mount === "ceiling") {
      y = WALL_HEIGHT - h;
    } else if (placement.mount === "wall") {
      y = 1.1;
    } else if (SURFACE_HEIGHT[pick.categoryKey] !== undefined) {
      y = SURFACE_HEIGHT[pick.categoryKey];
    } else {
      y = 0;
    }

    return {
      id: pick.chosen.id,
      categoryKey: pick.categoryKey,
      categoryLabel: pick.categoryLabel,
      label: pick.chosen.name,
      color: pick.chosen.swatch,
      photoDataUrl: pick.chosen.photoDataUrl,
      isOwned: !!pick.chosen.isOwned,
      size: footprint,
      position: [placement.x * width, y, placement.z * depth],
      rotationY: placement.rotationY,
      mount: placement.mount,
    };
  });

  return {
    room,
    width,
    depth,
    wallHeight: WALL_HEIGHT,
    estimatedDimensions: estimated,
    backWallPhotoDataUrl,
    objects,
  };
}
