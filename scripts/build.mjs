import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out);
await cp(resolve(root, 'index.html'), resolve(out, 'index.html'));
await cp(resolve(root, 'src'), resolve(out, 'src'), { recursive: true });
console.log(`Built ${out}`);
