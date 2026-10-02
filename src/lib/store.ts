import { create } from "zustand";
import type { RectRoom } from "@/lib/calc/geometry";

export type RoomDimensions = Pick<RectRoom, "length" | "width" | "height">;

/** Hranice posuvníkov v metroch – zároveň chránia výpočet pred nezmyselnými rozmermi. */
export const ROOM_LIMITS = {
  length: { min: 1, max: 15 },
  width: { min: 1, max: 15 },
  height: { min: 2, max: 5 },
} as const satisfies Record<keyof RoomDimensions, { min: number; max: number }>;

interface CalcState {
  room: RoomDimensions;
  /** ID vybraných plôch z `rectRoomSurfaces`. */
  selected: readonly string[];
  toggleSurface: (id: string) => void;
  setDimension: (key: keyof RoomDimensions, value: number) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const useCalcStore = create<CalcState>()((set) => ({
  room: { length: 5, width: 4, height: 2.6 },
  selected: [],
  toggleSurface: (id) =>
    set((s) => ({
      selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
    })),
  setDimension: (key, value) => {
    if (!Number.isFinite(value)) return;
    const { min, max } = ROOM_LIMITS[key];
    set((s) => ({ room: { ...s.room, [key]: clamp(value, min, max) } }));
  },
}));
