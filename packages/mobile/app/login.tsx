// Route files are kept to a re-export: expo-router builds its route table from
// a require.context over this whole directory, so anything that lives here —
// including a test file — ends up in the app bundle. Screens live in `src/`.
export { LoginScreen as default } from '@/screens/login-screen';
