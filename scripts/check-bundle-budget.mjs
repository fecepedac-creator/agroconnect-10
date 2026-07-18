import {readdir, stat} from "node:fs/promises";
import {join} from "node:path";

const budgets = {
  ".js": 550 * 1024,
  ".css": 70 * 1024,
};
const assetsDir = join(process.cwd(), "dist", "assets");
const files = await readdir(assetsDir);
const violations = [];

for (const file of files) {
  const extension = Object.keys(budgets).find((candidate) => file.endsWith(candidate));
  if (!extension) continue;
  const {size} = await stat(join(assetsDir, file));
  if (size > budgets[extension]) {
    violations.push(`${file}: ${(size / 1024).toFixed(1)} kB > ${budgets[extension] / 1024} kB`);
  }
}

if (violations.length > 0) {
  console.error("Bundle budget exceeded:\n" + violations.map((item) => ` - ${item}`).join("\n"));
  process.exit(1);
}

console.log("Bundle budget passed.");
