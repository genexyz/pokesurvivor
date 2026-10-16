/* Carga .env (si existe) antes que nada: en local, las claves van ahí (ver .env.example).
 * En Coolify las variables de entorno se ponen en el panel y no hay .env. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'));
} catch (e) {
  /* no hay .env */
}
