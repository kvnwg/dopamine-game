// Zips dist-crazygames/ into the CrazyGames upload: crazygames/upload/dumpster-legend-crazygames.zip
// (index.html at the zip root). Runs at the end of `npm run build:crazygames`.
// No dependencies: a small zip writer (deflate) so it works on any OS.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SRC = path.join(ROOT, 'dist-crazygames');
const OUT = path.join(ROOT, 'crazygames', 'upload', 'dumpster-legend-crazygames.zip');

if (!fs.existsSync(path.join(SRC, 'index.html'))) {
  console.error('dist-crazygames/index.html is missing: run `npm run build:crazygames`.');
  process.exit(1);
}

function walk(dir, rel = '') {
  return fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), `${rel}${e.name}/`) : [`${rel}${e.name}`]));
}
const files = walk(SRC);

// CrazyGames requires relative paths only.
const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const abs = html.match(/(?:src|href)="\/(?!\/)[^"]*"/);
if (abs) {
  console.error(`Absolute path in index.html: ${abs[0]} (CrazyGames needs relative paths)`);
  process.exit(1);
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // fixed: the same build gives the same zip

const parts = [];
const central = [];
let offset = 0;
let raw = 0;
for (const name of files) {
  const data = fs.readFileSync(path.join(SRC, name));
  raw += data.length;
  const comp = zlib.deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const nameBuf = Buffer.from(name, 'utf8');
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0);
  head.writeUInt16LE(20, 4);
  head.writeUInt16LE(0x0800, 6);
  head.writeUInt16LE(8, 8);
  head.writeUInt16LE(0, 10);
  head.writeUInt16LE(DOS_DATE, 12);
  head.writeUInt32LE(crc, 14);
  head.writeUInt32LE(comp.length, 18);
  head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(nameBuf.length, 26);
  parts.push(head, nameBuf, comp);
  const dir = Buffer.alloc(46);
  dir.writeUInt32LE(0x02014b50, 0);
  dir.writeUInt16LE(20, 4);
  dir.writeUInt16LE(20, 6);
  dir.writeUInt16LE(0x0800, 8);
  dir.writeUInt16LE(8, 10);
  dir.writeUInt16LE(0, 12);
  dir.writeUInt16LE(DOS_DATE, 14);
  dir.writeUInt32LE(crc, 16);
  dir.writeUInt32LE(comp.length, 20);
  dir.writeUInt32LE(data.length, 24);
  dir.writeUInt16LE(nameBuf.length, 28);
  dir.writeUInt32LE(offset, 42);
  central.push(dir, nameBuf);
  offset += head.length + nameBuf.length + comp.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12);
end.writeUInt32LE(offset, 16);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([...parts, cd, end]));
const mb = (n) => (n / 1e6).toFixed(2) + ' MB';
console.log(`\nCrazyGames upload: ${path.relative(ROOT, OUT)}`);
console.log(`  ${files.length} files, ${mb(raw)} unzipped, ${mb(fs.statSync(OUT).size)} zipped`);
console.log('  limits: 1,500 files, 250 MB total, 20 MB initial download for the mobile homepage');
