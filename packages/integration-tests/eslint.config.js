import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Pin the project root so both `eslint src` and IDE integrations resolve this
  // package unambiguously across the monorepo's multiple TSConfig roots.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  ...tseslint.configs.recommended,
);
