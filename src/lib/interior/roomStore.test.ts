import { beforeEach, describe, expect, it } from "vitest";
import { selectedSurfaces, useRoomStore } from "./roomStore";

const initial = useRoomStore.getState();
const room = () => useRoomStore.getState().rooms.find((r) => r.id === useRoomStore.getState().activeId)!;

describe("useRoomStore", () => {
  beforeEach(() => useRoomStore.setState(initial, true));

  it("pridá izbu, prepne na ňu a nedovolí zmazať poslednú", () => {
    const s = useRoomStore.getState();
    s.addRoom();
    expect(useRoomStore.getState().rooms).toHaveLength(3);
    expect(room().name).toBe("Izba 3");

    for (const r of useRoomStore.getState().rooms) useRoomStore.getState().removeRoom(r.id);
    expect(useRoomStore.getState().rooms).toHaveLength(1);
  });

  it("rozmery obmedzí na povolený rozsah a výška obkladu nepresiahne izbu", () => {
    const s = useRoomStore.getState();
    s.setDimension("kupelna", "length", 99);
    s.setDimension("kupelna", "height", 2.4);
    s.setTileHeight("kupelna", 3);
    expect(room().length).toBe(15);
    expect(room().tileHeight).toBe(2.4);
  });

  it("výber plôch je oddelený pre každé remeslo", () => {
    const s = useRoomStore.getState();
    s.toggleSurface("painter", "kupelna", "wall-0");
    s.toggleSurface("tiler", "kupelna", "floor");
    const state = useRoomStore.getState();
    expect(selectedSurfaces(state, "painter", "kupelna")).toEqual(["wall-0"]);
    expect(selectedSurfaces(state, "tiler", "kupelna")).toEqual(["floor"]);
    state.toggleSurface("painter", "kupelna", "wall-0");
    expect(selectedSurfaces(useRoomStore.getState(), "painter", "kupelna")).toEqual([]);
  });

  it("zmazanie izby odstráni aj jej výber", () => {
    const s = useRoomStore.getState();
    s.toggleSurface("painter", "obyvacka", "wall-1");
    s.removeRoom("obyvacka");
    expect(useRoomStore.getState().selected).toEqual({});
  });

  it("pridá a odoberie okno", () => {
    const s = useRoomStore.getState();
    s.addOpening("kupelna", 0, "window");
    expect(room().openings.map((o) => o.kind)).toEqual(["door", "window"]);
    s.removeOpening("kupelna", 0);
    expect(room().openings.map((o) => o.kind)).toEqual(["window"]);
  });

  it("neplatný názov ignoruje", () => {
    useRoomStore.getState().renameRoom("kupelna", "   ");
    expect(room().name).toBe("Kúpeľňa");
  });
});
