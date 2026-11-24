// Whether a script was started as the command, and not imported by a test.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Compared by real path. Node gives a module its real path, but keeps the command's path as it was typed, so a
 * plain comparison fails for a script started through a symlinked folder and the command would then do nothing
 * and exit 0.
 */
export function isMain(moduleUrl) {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}
