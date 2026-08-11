// Routes stay one-line re-exports: expo-router builds its route table from a
// require.context over this directory, so anything living here is bundled into
// the app — test files included. Screens live in `src/screens`.
export { VitalsScreen as default } from '@/screens/vitals-screen';
