import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shussapp",
    short_name: "Shussapp",
    description: "Log games, track streaks, and settle the crew leaderboard.",
    start_url: "/home",
    display: "standalone",
    background_color: "#0b0d0c",
    theme_color: "#0b0d0c",
    icons: [
      { src: "/icons/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pwa/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
