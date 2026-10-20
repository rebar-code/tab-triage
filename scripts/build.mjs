import { build } from 'vite';
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

await build({ build: { watch: watch ? {} : null } });

const options = {
  bundle: true,
  target: 'chrome121',
  outdir: 'dist',
  logLevel: 'info',
};
const workers = { ...options, entryPoints: { background: 'src/background.ts' }, format: 'esm' };
const content = {
  ...options,
  entryPoints: { 'content/github': 'src/content/github.ts' },
  format: 'iife',
};

if (watch) {
  await (await esbuild.context(workers)).watch();
  await (await esbuild.context(content)).watch();
} else {
  await esbuild.build(workers);
  await esbuild.build(content);
}
