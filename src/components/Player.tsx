"use client";

import { useState } from "react";
import YouTubePlayer from "@/components/YouTubePlayer";

const CATEGORIES = [
  { label: "Old Song", playlistId: "PLhXvuO8eMB222gHBObv2wZoyxGs3Ubu2O" },
  { label: "2021", playlistId: "PLhXvuO8eMB22qUgrmpe9RYZKtLnArINNo" },
  { label: "2023", playlistId: "PLhXvuO8eMB20eT0WGqrJURQPfu5hrhXMt" },
  { label: "Cover Song", playlistId: "PLaeR-8k9b6oo" },
  { label: "Instrumental", playlistId: "PLcQTTKWwcHx0" },
] as const;

export default function Player() {
  const [categoryIndex, setCategoryIndex] = useState(0);

  return (
    <div className="flex flex-col items-center gap-3 px-4 pb-6 sm:pb-8">
      <div className="flex flex-wrap justify-center gap-1.5 rounded-full border border-ochre/25 bg-charcoal/70 p-1.5 backdrop-blur-md">
        {CATEGORIES.map((category, index) => (
          <button
            key={category.playlistId}
            type="button"
            onClick={() => setCategoryIndex(index)}
            aria-pressed={categoryIndex === index}
            className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors ${
              categoryIndex === index
                ? "bg-ochre text-charcoal"
                : "text-rice/60 hover:text-rice"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      <YouTubePlayer key={CATEGORIES[categoryIndex].playlistId} playlistId={CATEGORIES[categoryIndex].playlistId} />
    </div>
  );
}
