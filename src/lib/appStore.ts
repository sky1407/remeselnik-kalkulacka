import { create } from "zustand";
import type { InteriorTrade } from "@/lib/interior/roomStore";

export type Trade = "cellulose" | InteriorTrade;
export type PainterArea = "interior" | "exterior";

interface AppState {
  trade: Trade;
  /** Maliar pracuje v izbách alebo na fasáde domu. */
  painterArea: PainterArea;
  setTrade: (trade: Trade) => void;
  setPainterArea: (area: PainterArea) => void;
}

/** Zvolené remeslo – určuje, či sa zobrazí dom (celulóza) alebo interiér izby. */
export const useAppStore = create<AppState>()((set) => ({
  trade: "cellulose",
  painterArea: "interior",
  setTrade: (trade) => set({ trade }),
  setPainterArea: (painterArea) => set({ painterArea }),
}));
