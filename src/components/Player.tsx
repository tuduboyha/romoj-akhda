import YouTubePlayer from "@/components/YouTubePlayer";

const YOUTUBE_PLAYLIST_ID = "PLTZJfq1G9f3Q";

export default function Player() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 pb-6 sm:pb-8">
      <YouTubePlayer playlistId={YOUTUBE_PLAYLIST_ID} />
    </div>
  );
}
