# Shussapp API v1 (mobile app)

The Expo app talks to the same Next.js backend as the website, through
`/api/v1`. All logic and rules live in the backend; the app only displays data.

## Conventions

- **Auth:** send `Authorization: Bearer <token>` (from a sign-in endpoint).
  Tokens last 90 days and are extended automatically while the app is used.
- **Language:** send `Accept-Language: nl` or `en`. Error messages, push
  notifications and achievement names follow it.
- **Errors:** always `{ "error": { "code", "message" } }` with a 4xx/5xx status.
  `401 unauthorized` → sign in again. `message` is safe to show for 400s.
- **Dates** are ISO strings. **Photos:** `photoPath` is relative to the API
  host; load it with the bearer header (`GET /api/game-photo/{gameId}`).

## Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/google` | `{ idToken }` | `{ token, expiresAt, created, user, crews }` |
| POST | `/auth/apple` | `{ identityToken, fullName? }` | same |
| POST | `/auth/logout` | `{ pushToken? }` | 204 |
| GET | `/me` | | `{ user, crews }` |
| PATCH | `/me` | `{ name }` | `{ user, crews }` |
| DELETE | `/me` | `{ confirm: "DELETE" }` | 204 (account deletion) |
| POST / DELETE | `/me/push-token` | `{ token, platform }` / `{ token }` | 204 |
| GET / POST | `/crews` | — / `{ name }` | `{ crews }` / `{ crewId }` |
| POST | `/crews/join` | `{ code }` | `{ crewId }` |
| GET | `/crews/{id}` | | `{ crew, insights, guests, tournaments }` |
| GET | `/crews/{id}/feed?limit=25` | | `{ games }` |
| POST | `/crews/{id}/leave` | | 204 (409 for the owner) |
| POST | `/crews/{id}/guests` | `{ name }` | `{ userId, claimToken }` |
| POST | `/claim` | `{ code }` | 204 |
| POST | `/games` | `{ groupId, matType, teams, shotsByPlayer }` | `{ gameId }` |
| GET / DELETE | `/games/{id}` | | `{ game, comments, reactions }` / 204 |
| POST | `/games/{id}/comments` | `{ text }` | `{ comments }` |
| DELETE | `/games/{id}/comments/{commentId}` | | 204 (own comments) |
| POST | `/games/{id}/reactions` | `{ reaction }` | `{ added, reactions }` |
| POST | `/games/{id}/photo` | multipart `photo` (≤ 4 MB) | `{ photoPath }` |
| GET | `/players/{id}` | | `{ player, crew, stats, achievements, nemesis, opponents }` |
| GET | `/players/{a}/vs/{b}` | | `{ a, b, crew, aWins, bWins, meetings }` |
| GET | `/stats` | | Deep stats payload |

`POST /games` teams: `[{ label?, playerIds, finalRank }]`; 2-mat = 2 teams of 1,
4-mat = 2 teams of 2, 8-mat = 4 teams of 2; ranks 1..n. Shots:
`[{ playerId, fieldHit: "1" | "2" | "3" | "mama" | "miss" }]`.

## Server configuration

| Env var | What |
| --- | --- |
| `GOOGLE_CLIENT_IDS` | iOS + Android OAuth client ids (comma-separated) |
| `APPLE_CLIENT_IDS` | the app's bundle id |
| `EXPO_ACCESS_TOKEN` | optional, if Expo push security is enabled |

Database: migrations `0011` (push language) and `0012` (`app_push_token`).
