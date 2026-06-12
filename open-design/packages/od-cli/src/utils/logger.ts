/**
 * Logger with color support
 */

export const log = {
  info: (msg: string) => console.log(`  ${msg}`),
  success: (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`  \x1b[33m⚠\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`),
  step: (n: number, total: number, msg: string) => console.log(`  \x1b[36m[${n}/${total}]\x1b[0m ${msg}`),
  heading: (msg: string) => console.log(`\n\x1b[1m\x1b[36m${msg}\x1b[0m\n`),
  dim: (msg: string) => console.log(`  \x1b[2m${msg}\x1b[0m`),
};
