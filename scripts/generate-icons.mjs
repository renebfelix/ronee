/**
 * Gera favicon e ícones do PWA/TWA a partir dos SVGs em assets/brand.
 * Uso: npm run icons
 */
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const brand = path.join(root, "assets/brand");
const iconsDir = path.join(root, "public/icons");
const appDir = path.join(root, "src/app");

const icon = await readFile(path.join(brand, "icon.svg"));
const maskable = await readFile(path.join(brand, "icon-maskable.svg"));

const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

await mkdir(iconsDir, { recursive: true });

// Ícones do manifest (purpose "any" e "maskable")
for (const size of [192, 512]) {
  await writeFile(path.join(iconsDir, `icon-${size}.png`), await png(icon, size));
  await writeFile(path.join(iconsDir, `icon-maskable-${size}.png`), await png(maskable, size));
}

// Apple touch icon: quadrado cheio (o iOS aplica o arredondamento)
await writeFile(path.join(appDir, "apple-icon.png"), await png(maskable, 180));

// Favicon SVG (navegadores modernos) — servido pelo Next como /icon.svg
await copyFile(path.join(brand, "icon.svg"), path.join(appDir, "icon.svg"));

// favicon.ico com 16, 32 e 48px (PNGs embutidos no contêiner ICO)
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(icon, s)));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map((img, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i] % 256, 0);
  e.writeUInt8(sizes[i] % 256, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(img.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += img.length;
  return e;
});
await writeFile(path.join(appDir, "favicon.ico"), Buffer.concat([header, ...entries, ...images]));

console.log("✓ Ícones gerados em public/icons e src/app");
