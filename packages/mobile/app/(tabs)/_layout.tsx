// Routes stay one-line re-exports: expo-router builds its route table from a
// require.context over this directory, so anything living here is bundled into
// the app — test files included. The layouts themselves live in `src/navigation`.
export { TabsLayout as default } from '@/navigation/tabs-layout';
