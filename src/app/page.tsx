import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Player from "@/components/Player";
import VillageScene from "@/components/VillageScene";

export default function Home() {
  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-charcoal">
      <VillageScene />

      <div className="relative z-10 flex h-full flex-col">
        <Header />
        <Hero />
        <div className="flex-1" />
        <Player />
      </div>
    </main>
  );
}
