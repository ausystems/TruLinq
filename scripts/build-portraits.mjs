/* Member portraits: art-directed square crops of the photos members uploaded to their Trulinq profiles.
   Masters live in assets/portraits/<slug>.jpg (square, metadata stripped). This script renders the sizes the site
   uses into public/portraits/<slug>-<size>.webp. Run `npm run portraits` after adding or replacing a master.
   To add a master from an original: node scripts/build-portraits.mjs --master <slug> <file> <left> <top> <size> [brightness] */
import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const masters = join(root, 'assets/portraits');
const out = join(root, 'public/portraits');
mkdirSync(masters, { recursive: true }); mkdirSync(out, { recursive: true });
export const SIZES = [96, 240, 480, 960];

const args = process.argv.slice(2);
if (args[0] === '--master') {
  const [, slug, file, left, top, size, brightness] = args;
  let img = sharp(file).rotate().extract({ left: +left, top: +top, width: +size, height: +size });
  if (brightness) img = img.modulate({ brightness: +brightness }).gamma(1.1);
  await img.resize(1200, 1200, { fit: 'cover' }).jpeg({ quality: 90, mozjpeg: true }).toFile(join(masters, `${slug}.jpg`));
  console.log(`master ${slug}.jpg written`);
} else {
  for (const f of readdirSync(masters).filter((n) => n.endsWith('.jpg'))) {
    const slug = f.replace(/\.jpg$/, '');
    for (const w of SIZES) {
      await sharp(join(masters, f)).resize(w, w, { fit: 'cover' }).sharpen({ sigma: w <= 240 ? 0.6 : 0.4 }).webp({ quality: w <= 240 ? 78 : 82, effort: 6 }).toFile(join(out, `${slug}-${w}.webp`));
    }
    console.log(`portraits ${slug}: ${SIZES.join(', ')}`);
  }
}
