import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shussapp",
    short_name: "Shussapp",
    description: "Log games, track streaks, and settle the crew leaderboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#1b3d2c",
    theme_color: "#1b3d2c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
