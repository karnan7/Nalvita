# @nalvita/mobile

The Nalvita React Native app — Expo managed workflow, expo-router, sharing
`@nalvita/core` (schemas, constants, design tokens) and `@nalvita/data` (React
Query hooks over Supabase) with the web app.

## Running it

```sh
cp .env.example .env      # fill in from `supabase start` or the cloud project
npm run dev -w @nalvita/mobile
```

Then open it in Expo Go, or press `i` / `a` for a simulator. No Expo account is
needed for this; it becomes necessary for EAS builds (KAR-58).

## Layout

- `app/` — routes only. expo-router builds its route table from a
  `require.context` over this whole directory, so **anything here ends up in the
  app bundle, including test files**. Route files stay one-line re-exports.
- `src/screens/` — the screen components the routes point at, and their tests.
- `src/lib/` — the platform layer: Supabase client, secure storage, theme, auth.
- `src/components/` — shared UI.

## Things worth knowing

**Sessions live in the device keystore.** `src/lib/secure-storage.ts` backs
Supabase's auth storage with `expo-secure-store` — the Keychain on iOS,
EncryptedSharedPreferences on Android. Never swap it for AsyncStorage, which is
plain text on disk. Android also refuses values past ~2048 bytes and a Supabase
session is bigger than that, so values are split across numbered chunks.

**Token refresh follows foreground state.** Supabase's refresh timer does not
know about app lifecycle; `watchAppStateForAuthRefresh` starts and stops it with
`AppState` so a backgrounded app is not woken to refresh a token nobody wants.

**React is pinned across the whole monorepo.** Expo SDK 57 fixes an exact
version, and two Reacts reaching Metro through a symlinked workspace package
fail at runtime with "invalid hook call". The root `package.json` depends on
React purely to control hoisting — see the note there.

**Tests run on Jest, not Vitest.** React Native needs a Metro/Babel-aware
transform, so this package uses `jest-expo` and
`@testing-library/react-native` — a deliberate exception to the
Vitest-everywhere convention in `CLAUDE.md`. It still emits lcov, so SonarCloud
consumes it the same way.

**`npm run bundle` is the resolution check.** A typecheck cannot tell you
whether Metro resolves the workspace packages through their symlinks; only a
real bundle can. CI runs it on every PR.

## Not here yet

The five real screens (KAR-57), and biometric lock, offline cache, and EAS
build profiles (KAR-58). The tab bar currently uses typographic glyphs — the
React Native icon set is chosen with the rest of the iconography in KAR-57.
