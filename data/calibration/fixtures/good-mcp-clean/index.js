import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
export function readNote(name) {
  const p = path.resolve(root, name);
  if (!p.startsWith(root)) throw new Error('path outside notes directory');
  return fs.readFileSync(p, 'utf8');
}
