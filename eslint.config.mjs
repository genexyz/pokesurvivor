// ESLint (flat config). npm run lint / npm run lint:fix
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/', '.cache/', 'node_modules/', 'videos/'] },

  js.configs.recommended,

  // El juego: scripts clásicos (sin módulos) que comparten el objeto global G.
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        G: 'writable'
      }
    }
  },

  // Datos generados por scripts/*.py: no se revisan.
  { ignores: ['src/js/data/pokedex.js', 'src/js/data/sprites-meta.js'] },

  // Service worker.
  {
    files: ['public/sw.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker } }
  },

  // Fusión de partidas: también la carga el servidor con require.
  {
    files: ['src/js/core/save-merge.js'],
    languageOptions: { globals: { module: 'readonly' } }
  },

  // El servidor (server/): módulos de Node.
  {
    files: ['server/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } }
  },

  // Scripts de Node (build...).
  {
    files: ['scripts/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } }
  },

  {
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      // Se inicializa con un valor por defecto aunque luego se sobrescriba (p. ej. antes de un try).
      'no-useless-assignment': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },

  // Al final: apaga las reglas de estilo que ya hace Prettier.
  prettier
];
