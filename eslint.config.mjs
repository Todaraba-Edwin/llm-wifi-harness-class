import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'node_modules/**', 'src/generated/**', 'public/search-index.json', 'public/graph.json', 'tests/fixtures/**', 'raw/**', 'wiki/**', 'docs/**', 'artifacts/**', 'next-env.d.ts'] },
];

export default config;
