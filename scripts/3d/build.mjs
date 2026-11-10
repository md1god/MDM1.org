// Bundles mdm1-3d.src.js (+ the parts of three.js it uses) into the committed, minified /js/mdm1-3d.js.
// The deploy workflow stays a plain static publish: it never runs this, it just ships the committed bundle.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { statSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../js/mdm1-3d.js');

await build({
  entryPoints: [resolve(here, 'mdm1-3d.src.js')],
  outfile: out,
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020'],
  legalComments: 'none',
  banner: { js: '/* MDM1.org 3D layer — built from scripts/3d/mdm1-3d.src.js (three.js, MIT). Do not edit by hand. */' },
});

console.log(`built ${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
