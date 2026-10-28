import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const entries = new Map();
for (const base of ['.', 'playground']) {
  const lock = JSON.parse(
    readFileSync(join(base, 'package-lock.json'), 'utf8'),
  );
  for (const [path, meta] of Object.entries(lock.packages ?? {})) {
    if (!path || meta.dev || meta.link) continue;
    const manifest = join(base, path, 'package.json');
    if (!existsSync(manifest)) continue;
    const p = JSON.parse(readFileSync(manifest, 'utf8'));
    const license =
      typeof p.license === 'string'
        ? p.license
        : JSON.stringify(p.license ?? p.licenses ?? 'UNKNOWN');
    const key = `${p.name}@${p.version}`;
    const notice = [
      'LICENSE',
      'LICENSE.md',
      'LICENSE.txt',
      'LICENCE',
      'COPYING',
      'license',
      'license.md',
      'license.txt',
    ].find((n) => existsSync(join(base, path, n)));
    entries.set(key, {
      name: p.name,
      version: p.version,
      license,
      noticeFile: notice ?? null,
      review:
        license === 'UNKNOWN' ||
        /AGPL|LGPL|GPL|SEE LICENSE|MPL|CC-BY/i.test(license),
    });
  }
}
const rows = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(
  'docs/assistant/dependency-licenses.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scope:
        'Installed non-dev packages from root and playground locks. Metadata review only, not a legal audit. Native transitive binaries require separate review when packaged.',
      packages: rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    { packages: rows.length, review: rows.filter((r) => r.review) },
    null,
    2,
  ),
);
