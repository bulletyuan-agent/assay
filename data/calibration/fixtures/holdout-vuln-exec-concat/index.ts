import { exec } from 'node:child_process';
export function whichAppOnPort(port: string) {
  return new Promise((resolve) => exec(`lsof -i :${port}`, (_e, out) => resolve(out)));
}
