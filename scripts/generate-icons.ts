import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

async function main() {
  const root = path.join(import.meta.dirname, "..", "apps", "web", "public", "icons");
  const source = await fs.readFile(path.join(root, "studybuddy.svg"));
  await Promise.all(
    [192, 512].map((size) =>
      sharp(source).resize(size, size).png().toFile(path.join(root, `studybuddy-${size}.png`))
    )
  );
  console.log("icons generated");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
