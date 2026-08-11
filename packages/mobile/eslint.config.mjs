import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', '.expo/**', 'expo-env.d.ts'] },
  // Pin the project root so both `eslint src app` and IDE integrations resolve
  // this package unambiguously across the monorepo's multiple TSConfig roots.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
);
