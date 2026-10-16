/* Loads .env (if present) before anything else: locally, the keys go there (see .env.example).
 * On Coolify the environment variables are set in the panel and there is no .env. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'));
} catch (e) {
  /* no .env */
}
