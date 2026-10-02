"use client";

import { num } from "@/lib/format";
import type { BuildingElement } from "@/lib/house/element";
import { ROOM_LIMITS, WALL_NAMES, type RoomDimension, type RoomSpec } from "@/lib/interior/room";
import { useRoomStore, type InteriorTrade } from "@/lib/interior/roomStore";
import { Slider } from "./ui";

const DIMENSIONS: { key: RoomDimension; label: string }[] = [
  { key: "length", label: "Dĺžka (steny A, C)" },
  { key: "width", label: "Šírka (steny B, D)" },
  { key: "height", label: "Výška" },
];

const chip = (active: boolean) =>
  `min-h-12 rounded-full border px-4 text-sm font-medium ${
    active ? "border-green-700 bg-green-600 text-white" : "border-stone-300 bg-white text-stone-800"
  }`;

interface RoomPanelProps {
  room: RoomSpec;
  elements: readonly BuildingElement[];
  trade: InteriorTrade;
}

/** Zoznam izieb a úprava aktívnej izby: názov, rozmery, okná a dvere, pri obklade výška a mokrá zóna. */
export function RoomPanel({ room, elements, trade }: RoomPanelProps) {
  const rooms = useRoomStore((s) => s.rooms);
  const setActive = useRoomStore((s) => s.setActive);
  const addRoom = useRoomStore((s) => s.addRoom);
  const removeRoom = useRoomStore((s) => s.removeRoom);
  const renameRoom = useRoomStore((s) => s.renameRoom);
  const setDimension = useRoomStore((s) => s.setDimension);
  const addOpening = useRoomStore((s) => s.addOpening);
  const removeOpening = useRoomStore((s) => s.removeOpening);
  const setTileHeight = useRoomStore((s) => s.setTileHeight);
  const setWetZone = useRoomStore((s) => s.setWetZone);

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Izby" className="flex flex-wrap gap-2">
        {rooms.map((r) => (
          <button key={r.id} type="button" aria-pressed={r.id === room.id} onClick={() => setActive(r.id)} className={chip(r.id === room.id)}>
            {r.name} · {num.format(r.length)}×{num.format(r.width)}
          </button>
        ))}
        <button type="button" onClick={addRoom} className="min-h-12 rounded-full border border-dashed border-stone-400 px-4 text-sm font-semibold text-stone-700">
          + Pridať izbu
        </button>
      </section>

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm text-stone-600">
          Názov izby
          <input
            // `key` obnoví políčko pri prepnutí izby – rozpísaný názov sa neprenesie do inej izby.
            key={room.id}
            defaultValue={room.name}
            maxLength={40}
            onChange={(e) => renameRoom(room.id, e.target.value)}
            className="h-12 rounded-lg border border-stone-300 bg-white px-3 text-base font-semibold text-stone-900"
          />
        </label>
        <button
          type="button"
          disabled={rooms.length <= 1}
          onClick={() => window.confirm(`Zmazať izbu „${room.name}“?`) && removeRoom(room.id)}
          className="min-h-12 rounded-lg border border-stone-300 px-3 text-sm font-medium text-red-700 disabled:opacity-40"
        >
          Zmazať
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {DIMENSIONS.map((d) => (
          <Slider
            key={d.key}
            label={d.label}
            value={room[d.key]}
            {...ROOM_LIMITS[d.key]}
            display={`${num.format(room[d.key])} m`}
            onChange={(v) => setDimension(room.id, d.key, v)}
          />
        ))}
        {trade === "tiler" && (
          <>
            <Slider
              label="Výška obkladu"
              value={room.tileHeight}
              min={0}
              max={room.height}
              step={0.05}
              display={room.tileHeight > 0 ? `${num.format(room.tileHeight)} m` : "bez obkladu"}
              onChange={(v) => setTileHeight(room.id, v)}
            />
            <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={room.wetZone}
                onChange={(e) => setWetZone(room.id, e.target.checked)}
                className="h-6 w-6 accent-green-600"
              />
              Mokrá zóna (hydroizolácia podlahy + sokel)
            </label>
          </>
        )}
      </div>

      <section aria-label="Okná a dvere" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-stone-700">Okná a dvere</h2>
        {([0, 1, 2, 3] as const).map((wall) => {
          const specs = room.openings.map((o, index) => ({ o, index })).filter(({ o }) => o.wall === wall);
          const placed = elements.find((e) => e.id === `wall-${wall}`)?.openings.length ?? 0;
          const len = wall % 2 === 0 ? room.length : room.width;
          return (
            <div key={wall} className="rounded-lg bg-white p-3 ring-1 ring-stone-200">
              <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">
                  Stena {WALL_NAMES[wall]} · {num.format(len)} m
                </span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => addOpening(room.id, wall, "window")} className="min-h-10 rounded-lg bg-stone-100 px-3 font-medium">
                    + Okno
                  </button>
                  <button type="button" onClick={() => addOpening(room.id, wall, "door")} className="min-h-10 rounded-lg bg-stone-100 px-3 font-medium">
                    + Dvere
                  </button>
                </span>
              </div>
              {specs.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {specs.map(({ o, index }) => (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => removeOpening(room.id, index)}
                        aria-label={`Odstrániť ${o.kind === "door" ? "dvere" : "okno"}`}
                        className="min-h-10 rounded-full border border-stone-300 px-3 text-xs font-medium"
                      >
                        {o.kind === "door" ? "Dvere" : "Okno"} {num.format(o.width)}×{num.format(o.height)} ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {placed < specs.length && (
                <p className="mt-2 text-xs text-amber-700">
                  {specs.length - placed} {specs.length - placed === 1 ? "otvor sa nezmestí" : "otvory sa nezmestia"} – zväčši stenu alebo ho odstráň.
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
