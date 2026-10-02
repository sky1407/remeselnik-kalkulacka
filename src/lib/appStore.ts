import { create } from "zustand";
import type { InteriorTrade } from "@/lib/interior/roomStore";

export type Trade = "cellulose" | InteriorTrade;

interface AppState {
  trade: Trade;
  setTrade: (trade: Trade) => void;
}

/** Zvolené remeslo – určuje, či sa zobrazí dom (celulóza) alebo interiér izby. */
export const useAppStore = create<AppState>()((set) => ({
  trade: "cellulose",
  setTrade: (trade) => set({ trade }),
}));
