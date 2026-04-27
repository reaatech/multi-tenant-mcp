import { readdir, rename } from "node:fs/promises";
import { join } from "node:path";

async function renameJsToCjs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await renameJsToCjs(fullPath);
    } else if (entry.name.endsWith(".js")) {
      await rename(fullPath, fullPath.replace(/\.js$/, ".cjs"));
    }
  }
}

await renameJsToCjs("dist/cjs");
