# @nalvita/mobile

The Nalvita React Native app — Expo managed workflow, expo-router, sharing
`@nalvita/core` (schemas, constants, design tokens) and `@nalvita/data` (React
Query hooks over Supabase) with the web app.

## Running it

```sh
cp .env.example .env      # fill in from `supabase start` or the cloud project
npm run dev -w @nalvita/mobile
```

**Expo Go no longer works.** The app now depends on native modules that are not
in the Expo Go binary — `react-native-mmkv` (via Nitro) for the offline cache,
and `expo-local-authentication` for the lock. You need a **development build**:

```sh
npx eas build --profile development --platform android   # APK, sideload it
npx eas build --profile development --platform ios       # simulator build
```

Install that once, then `npm run dev` connects to it exactly as Expo Go did.
Simulators alone still work without a build for anything that does not touch
biometrics or MMKV.

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

**The lock is not an overlay.** `src/lib/lock.tsx` locks the app after five
minutes in the background and clears the React Query cache when it does, so the
records leave memory rather than sitting behind a cover. It also blanks the
screen the moment the app goes `inactive`, because that is when iOS takes the
app-switcher snapshot — a cover applied at `background` is already too late.
The opt-out lives on the Profile screen, and defaults **on** wherever the device
has biometrics enrolled.

**Only the emergency set goes offline.** `src/lib/offline-cache.ts` writes
allergies, active medicines, and the emergency slice of the profile (name, date
of birth, gender, blood group) into an AES-256 encrypted MMKV store, keyed from
`expo-secure-store`. Nothing else — documents, vitals history, the audit feed,
conditions, doctors — is ever written to the device.

That line is a privacy decision, not a performance one: cached records sit in
device storage, outside Supabase's RLS, and RLS cannot revoke a copy already on
a phone. Widening the set needs that trade made deliberately. Everything cached
lives under a single key so the boundary is testable, and
`offline-cache.test.ts` asserts the store never holds a second one.

## EAS builds

Everything is in `eas.json`. What the Expo account needs:

1. A free Expo account, then `npx eas login`.
2. `npx eas init` once, to create the project and write its id into `app.json`.
3. Nothing else for Android. EAS generates and stores the keystore for you.

| Profile | What it gives you | Account needed |
| --- | --- | --- |
| `development` | Dev client. Android APK, iOS simulator build | Free Expo account |
| `preview` | Standalone build for testers. Android APK | Free (Android) |
| `preview:simulator` | `preview`, but an iOS simulator build | Free Expo account |
| `production` | Android App Bundle, store-ready | Paid, Phase 4 |

**The iOS device path is blocked on a paid account, and that is unavoidable.**
Installing on a physical iPhone — TestFlight or ad-hoc — requires provisioning
profiles, which require the Apple Developer Program at $99/yr. There is no free
route. Per `CLAUDE.md` that fee is deferred to Phase 4, so on iOS this stops at
the **simulator**, and the profiles above are ready for the day the account
exists.

Android is genuinely free end to end: `--profile preview --platform android`
produces an APK that installs on any device with no Play Console account, and
no $25 fee until an actual store listing is wanted.

## Not here yet

Push notifications (KAR-52), camera document scanning (KAR-50), and profile
switching on mobile — the app is self-only for now, unlike the web app.
