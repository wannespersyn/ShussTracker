# Shussapp — app-icoon (nov 2026)

Worpboog, kroonkurk en landingsring in mama-rood (#B80E25) op crème (#FBF4E5).
Hertekend als schone vector vanaf de ChatGPT-schets: vlakke vormen, geen verloop,
de lichtrand in de dop is een echte uitsparing.

## Inhoud

| Map | Bestand | Waarvoor |
|---|---|---|
| `source/` | `shussapp-icon.svg` | Master, vierkant full-bleed (crème) |
| | `shussapp-icon-rounded.svg` | Afgeronde versie (web, socials) |
| | `shussapp-icon-dark.svg` | Op mat zwart (#141414) |
| | `shussapp-glyph.svg` | Enkel het symbool, transparant |
| `ios/` | `icon-1024.png` | App Store / Expo `icon` (geen transparantie, iOS rondt zelf af) |
| `android/` | `adaptive-foreground.png` | Symbool binnen de safe zone |
| | `adaptive-background.png` | Crème |
| | `adaptive-monochrome.png` | Android 13+ themed icons |
| | `play-store-512.png` | Play Console |
| `pwa/` | `icon-192.png`, `icon-512.png` | Manifest `purpose: any` (afgerond) |
| | `maskable-192.png`, `maskable-512.png` | Manifest `purpose: maskable` |
| | `apple-touch-icon.png` | iOS "Zet op beginscherm" (180×180) |
| | `badge-96.png` | Meldingsbadge (wit silhouet) |
| `favicon/` | `favicon.svg`, `favicon.ico`, `favicon-16/32/48.png` | Vereenvoudigd (dikkere boog, ronde dop zonder kartels) zodat het scherp blijft |

De Expo-app gebruikt dezelfde set in `mobile/assets/images/` (adaptive achtergrond `#FBF4E5`).

## Next.js (PWA, huidige app)

Zet `favicon.ico` in `app/` en de rest in `public/icons/`.

```ts
// app/layout.tsx
export const metadata = {
  icons: {
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  themeColor: "#F0782E",
};
```

```json
// public/manifest.webmanifest — icons
"icons": [
  { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/icons/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

## Expo (store-app, later)

```json
{
  "expo": {
    "icon": "./assets/icons/ios/icon-1024.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/icons/android/adaptive-foreground.png",
        "backgroundImage": "./assets/icons/android/adaptive-background.png",
        "monochromeImage": "./assets/icons/android/adaptive-monochrome.png",
        "backgroundColor": "#F0782E"
      }
    }
  }
}
```
