/* Game photos live in Vercel Blob. The store can be private (default — only
 * crew members can see them, served through /api/game-photo) or public
 * (set BLOB_ACCESS=public: served straight from the Blob CDN). */

export const BLOB_ACCESS: "public" | "private" = process.env.BLOB_ACCESS === "public" ? "public" : "private";

/** The <img src> for a game's photo. The stored URL's file name changes with
 * every upload, so it doubles as a cache-buster for the proxy route. */
export function photoSrc(gameId: string, photoUrl: string) {
  if (BLOB_ACCESS === "public") return photoUrl;
  const v = photoUrl.split("/").pop()?.split(".")[0] ?? "";
  return `/api/game-photo/${gameId}?v=${encodeURIComponent(v)}`;
}
