import { QuotePanel } from "@/components/QuotePanel";
import { RoomScene } from "@/components/RoomScene";
import { PAINTER, selectableKinds } from "@/lib/trades";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      <div className="h-[55vh] touch-none bg-gradient-to-b from-sky-50 to-stone-100 lg:h-auto lg:flex-1">
        <RoomScene selectableKinds={selectableKinds(PAINTER)} />
      </div>
      <div className="lg:w-[420px] lg:overflow-y-auto lg:border-l lg:border-stone-200">
        <h1 className="px-4 pt-4 text-xl font-bold">{PAINTER.name} – nová ponuka</h1>
        <QuotePanel />
      </div>
    </main>
  );
}
