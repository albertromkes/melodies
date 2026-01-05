# Psalm Melodies

A mobile-friendly web application for displaying single-note psalm melodies on a musical staff, with the ability to transpose the melody up or down by semitones while preserving musical correctness.

## Features

- 📖 Browse all 150 psalms with verses
- 🎵 Musical staff notation using VexFlow
- 🎹 Transpose melodies up/down by semitones
- 🔍 Search by psalm number, title, or verse text
- 🌙 Light/dark theme support
- 📱 Mobile-friendly design

## Tech Stack

- **Frontend**: Svelte 5 + TypeScript
- **Music**: VexFlow (notation), Tonal.js (transposition)
- **Build**: Vite
- **Mobile**: Capacitor (Android & iOS)
- **Search**: MiniSearch

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### Web (Static Site)

The app builds to a static `dist/` folder. Deploy to any static hosting service:

```bash
npm run build
# Upload dist/ folder to Cloudflare Pages, Netlify, Vercel, etc.
```

For Cloudflare Pages, the build command is `npm run build` and publish directory is `dist`.

### Mobile Apps (Capacitor)

#### Prerequisites

- **Android**: [Android Studio](https://developer.android.com/studio) with SDK
- **iOS**: macOS with [Xcode](https://developer.apple.com/xcode/) (for iOS builds)

#### Android

```bash
# Build and sync web assets to Android
npm run cap:sync

# Open Android Studio
npm run cap:android

# Or run directly on connected device/emulator
npm run android:dev
```

To build an APK:
1. Open Android Studio: `npm run cap:android`
2. Build > Build Bundle(s) / APK(s) > Build APK(s)

#### iOS (macOS only)

```bash
# Build and sync web assets to iOS
npm run cap:sync

# Open Xcode
npm run cap:ios

# Or run directly on simulator/device
npm run ios:dev
```

#### Available Capacitor Commands

| Command | Description |
|---------|-------------|
| `npm run cap:sync` | Build web app and sync to native platforms |
| `npm run cap:android` | Open Android project in Android Studio |
| `npm run cap:ios` | Open iOS project in Xcode |
| `npm run android:dev` | Build, sync, and run on Android device |
| `npm run ios:dev` | Build, sync, and run on iOS simulator |

## Project Structure

```
├── src/
│   ├── lib/
│   │   ├── components/    # Svelte components
│   │   ├── data/          # Psalm JSON data
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utilities (transposition, Capacitor)
│   ├── App.svelte         # Main app component
│   ├── app.css            # Global styles
│   └── main.ts            # Entry point
├── android/               # Capacitor Android project
├── ios/                   # Capacitor iOS project
├── public/                # Static assets
└── dist/                  # Production build output
```

## License

Private project.
