/**
 * The Web-standard globals this package relies on, declared explicitly.
 *
 * `tsconfig.base.json` sets `lib: ["ES2022"]` with no DOM, deliberately — this
 * code has to compile for React Native as well as the browser. Pulling in the
 * whole DOM lib would make `window`, `document`, and `localStorage` typecheck
 * here, which is exactly the mistake this package exists to prevent.
 *
 * So only the handful of globals actually used are declared. Each is a web
 * standard that React Native also provides (`crypto` needs a polyfill —
 * `react-native-get-random-values` plus a `subtle.digest` implementation —
 * which the mobile app wires up rather than this package assuming it).
 */

declare const crypto: {
  subtle: {
    digest(algorithm: 'SHA-256', data: Uint8Array): Promise<ArrayBuffer>;
  };
  getRandomValues<T extends Uint8Array | Uint32Array>(array: T): T;
  randomUUID(): string;
};

declare class TextEncoder {
  encode(input: string): Uint8Array;
}
