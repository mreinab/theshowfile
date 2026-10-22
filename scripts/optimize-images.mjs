// Converts the original images in assets/ into lightweight WebP files in
// public/ and writes a manifest the site reads:
//   assets/looks/look-XX.jpg        → public/looks/look-XX.webp   (carousel)
//   assets/details/look-XX/*.jpg    → public/details/look-XX/*.webp (hover grid, up to 5)
// Look dimensions go in the manifest so the carousel can reserve each image's
// space before it loads.
import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const LOOKS_SRC = 'assets/looks';
const LOOKS_OUT = 'public/looks';
const DETAILS_SRC = 'assets/details';
const DETAILS_OUT = 'public/details';
const MANIFEST = 'src/looks.manifest.json';
const MAX_DETAILS = 5;
const FORCE = process.argv.includes('--force');
const IMAGE = /\.(jpe?g|png|webp|avif|tiff?)$/i;

async function listImages(dir, pattern = IMAGE) {
  const files = await readdir(dir).catch(() => []);
  return files.filter((f) => pattern.test(f) && IMAGE.test(f)).sort();
}

async function convert(src, out, resize) {
  const fresh = !FORCE && await stat(out)
    .then(async (o) => o.mtimeMs >= (await stat(src)).mtimeMs)
    .catch(() => false);

  if (!fresh) {
    await mkdir(path.dirname(out), { recursive: true });
    await sharp(src)
      .resize({ ...resize, withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90, effort: 5 })
      .toFile(out);
    console.log(`  ✓ ${src} → ${out}`);
  }
}

const manifest = [];

for (const file of await listImages(LOOKS_SRC, /^look-/i)) {
  const id = path.parse(file).name;
  const out = path.join(LOOKS_OUT, `${id}.webp`);
  await convert(path.join(LOOKS_SRC, file), out, { height: 2000 });

  const details = [];
  for (const detail of (await listImages(path.join(DETAILS_SRC, id))).slice(0, MAX_DETAILS)) {
    const name = path.parse(detail).name;
    await convert(
      path.join(DETAILS_SRC, id, detail),
      path.join(DETAILS_OUT, id, `${name}.webp`),
      { width: 1600, height: 1600, fit: 'inside' },
    );
    details.push(`/details/${id}/${name}.webp`);
  }

  const { width, height } = await sharp(out).metadata();
  manifest.push({ id, src: `/looks/${id}.webp`, width, height, details });
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`${manifest.length} looks ready.`);
