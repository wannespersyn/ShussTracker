# Shussapp — app-icoon "Flick"

Kroonkurk met snelheidsstrepen op een verloop van goud (#FFC94A) via oranje (#F0782E) naar rood (#C8352B).

## Inhoud

| Map | Bestand | Waarvoor |
|---|---|---|
| `source/` | `shussapp-icon.svg` | Master, vierkant full-bleed |
| | `shussapp-icon-rounded.svg` | Afgeronde versie (web, socials) |
| | `shussapp-glyph.svg` | Enkel het symbool, transparant |
| `ios/` | `icon-1024.png` | App Store / Expo `icon` (geen transparantie, iOS rondt zelf af) |
| `android/` | `adaptive-foreground.png` | Symbool binnen de safe zone |
| | `adaptive-background.png` | Verloop |
| | `adaptive-monochrome.png` | Android 13+ themed icons |
| | `play-store-512.png` | Play Console |
| `pwa/` | `icon-192.png`, `icon-512.png` | Manifest `purpose: any` |
| | `maskable-192.png`, `maskable-512.png` | Manifest `purpose: maskable` |
| | `apple-touch-icon.png` | iOS "Zet op beginscherm" (180×180) |
| `favicon/` | `favicon.svg`, `favicon.ico`, `favicon-16/32/48.png` | Vereenvoudigd: zonder kartelrand en binnenring, zodat het scherp blijft |

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
