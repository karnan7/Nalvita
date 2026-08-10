# @nalvita/data

The shared data layer: React Query hooks over Supabase, plus the
presentation-free logic that goes with them (labels, formatters, permission
checks).

It holds no UI and touches no browser API, so the web app and the Phase 2 React
Native app run the same hooks. Row-level security is still the whole
authorization layer — nothing here grants access, it only asks.

## Injecting the platform

The Supabase client is not imported; it is supplied by the host app, along with
the two other things the hooks need from their environment:

```tsx
import { NalvitaDataProvider } from '@nalvita/data';

<NalvitaDataProvider
  client={supabase}                         // each platform brings its own
  appBaseUrl={window.location.origin}       // used to build invite/claim links
  openUrl={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
>
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
</NalvitaDataProvider>;
```

- **`client`** — web creates a browser client; mobile creates one backed by
  `expo-secure-store`. Never a `service_role` client.
- **`appBaseUrl`** — invite and handover links must point at the *web* app even
  when generated on a phone, because whoever receives one may not have the app
  installed.
- **`openUrl`** — how this platform opens a short-lived signed document URL: a
  new tab in the browser, the system viewer on a phone.

`usePlatform()` throws when the provider is missing rather than falling back to
a default, so a misconfigured app fails loudly instead of sending health queries
nowhere.

## Constraints

- **No browser APIs.** `tsconfig` omits the DOM lib on purpose, so `window`,
  `document`, and `localStorage` will not typecheck here. The handful of
  web-standard globals that are used (`crypto`, `TextEncoder`) are declared in
  `src/platform-globals.d.ts` — React Native must polyfill `crypto`.
- **No UI.** Components live in the app packages.
- **Depends on `@nalvita/core`**, which stays framework-free in turn.

Build order is `core` → `data` → `web`.
