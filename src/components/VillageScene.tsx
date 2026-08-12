import Image from "next/image";

export default function VillageScene() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-charcoal">
      <Image
        src="/images/village-fire.png"
        alt=""
        fill
        priority
        sizes="100vw"
        quality={82}
        className="object-cover"
      />
      {/* darken the top edge slightly so header/hero text stays legible over bright canopy gaps */}
      <div
        className="absolute inset-x-0 top-0 h-1/3"
        style={{ background: "linear-gradient(180deg, rgba(10,8,6,0.55) 0%, rgba(10,8,6,0) 100%)" }}
      />
    </div>
  );
}
