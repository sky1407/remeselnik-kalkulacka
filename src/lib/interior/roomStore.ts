import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { OpeningSpec } from "@/lib/house/house";
import { ROOM_LIMITS, RoomSpecSchema, type RoomDimension, type RoomSpec } from "./room";

export type InteriorTrade = "painter" | "tiler" | "drywall";
export type InteriorView = "dollhouse" | "inside";

const OPENING_PRESETS: Record<OpeningSpec["kind"], Omit<OpeningSpec, "wall">> = {
  window: { kind: "window", position: 0.5, width: 1.2, height: 1.4, sill: 0.9 },
  door: { kind: "door", position: 0.5, width: 0.8, height: 2, sill: 0 },
};

const DEFAULT_ROOMS: RoomSpec[] = [
  {
    id: "kupelna",
    name: "Kúpeľňa",
    length: 2.5,
    width: 2,
    height: 2.6,
    openings: [{ ...OPENING_PRESETS.door, wall: 2 }],
    tileHeight: 2,
    wetZone: true,
  },
  {
    id: "obyvacka",
    name: "Obývačka",
    length: 5,
    width: 4,
    height: 2.6,
    openings: [
      { ...OPENING_PRESETS.window, wall: 0, width: 1.5, height: 1.5 },
      { ...OPENING_PRESETS.door, wall: 2, position: 0.2 },
    ],
    tileHeight: 0,
    wetZone: false,
  },
];

/** Bez `crypto.randomUUID` – to v mobile cez http://IP-adresu (nezabezpečený kontext) neexistuje. */
const newId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const selectionKey = (trade: InteriorTrade, roomId: string) => `${trade}:${roomId}`;

const PersistedSchema = z.object({
  rooms: z.array(RoomSpecSchema).min(1).max(50),
  activeId: z.string(),
  selected: z.record(z.string(), z.array(z.string()).max(10)),
});
type Persisted = z.infer<typeof PersistedSchema>;

interface RoomState extends Persisted {
  view: InteriorView;
  fitRequest: number;
  addRoom: () => void;
  removeRoom: (id: string) => void;
  setActive: (id: string) => void;
  renameRoom: (id: string, name: string) => void;
  setDimension: (id: string, key: RoomDimension, value: number) => void;
  addOpening: (id: string, wall: OpeningSpec["wall"], kind: OpeningSpec["kind"]) => void;
  removeOpening: (id: string, index: number) => void;
  setTileHeight: (id: string, meters: number) => void;
  setWetZone: (id: string, wet: boolean) => void;
  toggleSurface: (trade: InteriorTrade, roomId: string, surfaceId: string) => void;
  setView: (view: InteriorView) => void;
  requestFit: () => void;
}

/** Stabilná referencia – selektor Zustandu nesmie pri prázdnom výbere vracať zakaždým nové pole. */
const NO_SELECTION: readonly string[] = Object.freeze([]);

/** Vybrané plochy izby pre dané remeslo. */
export const selectedSurfaces = (
  state: Pick<RoomState, "selected">,
  trade: InteriorTrade,
  roomId: string,
): readonly string[] => state.selected[selectionKey(trade, roomId)] ?? NO_SELECTION;

export const useRoomStore = create<RoomState>()(
  persist(
    (set): RoomState => {
      /** Úprava jednej izby – neplatný výsledok (napr. otvor mimo rozsahu) sa zahodí. */
      const updateRoom = (id: string, fn: (r: RoomSpec) => RoomSpec) =>
        set((s) => ({
          rooms: s.rooms.map((r) => {
            if (r.id !== id) return r;
            const next = fn(r);
            return RoomSpecSchema.safeParse(next).success ? next : r;
          }),
        }));

      return {
        rooms: DEFAULT_ROOMS,
        activeId: DEFAULT_ROOMS[0].id,
        selected: {},
        view: "dollhouse",
        fitRequest: 0,
        addRoom: () =>
          set((s) => {
            const room: RoomSpec = {
              id: newId(),
              name: `Izba ${s.rooms.length + 1}`,
              length: 4,
              width: 3.5,
              height: 2.6,
              openings: [{ ...OPENING_PRESETS.door, wall: 2 }],
              tileHeight: 0,
              wetZone: false,
            };
            return { rooms: [...s.rooms, room], activeId: room.id, fitRequest: s.fitRequest + 1 };
          }),
        removeRoom: (id) =>
          set((s) => {
            if (s.rooms.length <= 1) return s;
            const rooms = s.rooms.filter((r) => r.id !== id);
            const selected = Object.fromEntries(Object.entries(s.selected).filter(([k]) => !k.endsWith(`:${id}`)));
            return { rooms, selected, activeId: s.activeId === id ? rooms[0].id : s.activeId };
          }),
        setActive: (id) => set((s) => (s.rooms.some((r) => r.id === id) ? { activeId: id, fitRequest: s.fitRequest + 1 } : s)),
        renameRoom: (id, name) => updateRoom(id, (r) => ({ ...r, name })),
        setDimension: (id, key, value) => {
          if (!Number.isFinite(value)) return;
          const { min, max } = ROOM_LIMITS[key];
          updateRoom(id, (r) => ({ ...r, [key]: clamp(value, min, max) }));
        },
        addOpening: (id, wall, kind) => updateRoom(id, (r) => ({ ...r, openings: [...r.openings, { ...OPENING_PRESETS[kind], wall }] })),
        removeOpening: (id, index) => updateRoom(id, (r) => ({ ...r, openings: r.openings.filter((_, i) => i !== index) })),
        setTileHeight: (id, meters) => updateRoom(id, (r) => ({ ...r, tileHeight: clamp(meters, 0, r.height) })),
        setWetZone: (id, wetZone) => updateRoom(id, (r) => ({ ...r, wetZone })),
        toggleSurface: (trade, roomId, surfaceId) =>
          set((s) => {
            const key = selectionKey(trade, roomId);
            const current = s.selected[key] ?? [];
            const next = current.includes(surfaceId) ? current.filter((x) => x !== surfaceId) : [...current, surfaceId];
            return { selected: { ...s.selected, [key]: next } };
          }),
        setView: (view) => set((s) => ({ view, fitRequest: s.fitRequest + 1 })),
        requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
      };
    },
    {
      name: "remeselnik-rooms",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ rooms, activeId, selected }): Persisted => ({ rooms, activeId, selected }),
      skipHydration: true,
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted);
        if (!parsed.success) return current;
        const { rooms, activeId, selected } = parsed.data;
        return { ...current, rooms, selected, activeId: rooms.some((r) => r.id === activeId) ? activeId : rooms[0].id };
      },
    },
  ),
);
