#!/usr/bin/env node
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'public/bundle-sizes.json');

const EXTERNAL = ['react', 'react-dom', 'react/jsx-runtime'];

const ENTRIES = {
  gridsmith: `
    import { Grid } from '@gridsmith/react';
    export default Grid;
  `,
  'ag-grid': `
    import { AgGridReact } from 'ag-grid-react';
    export default AgGridReact;
  `,
  handsontable: `
    import { HotTable } from '@handsontable/react';
    import { registerAllModules } from 'handsontable/registry';
    registerAllModules();
    export default HotTable;
  `,
  glide: `
    import { DataEditor } from '@glideapps/glide-data-grid';
    export default DataEditor;
  `,
};

async function measure(id, source) {
  const result = await build({
    stdin: { contents: source, resolveDir: ROOT, loader: 'ts' },
    bundle: true,
    minify: true,
    write: false,
    format: 'esm',
    target: 'es2022',
    external: EXTERNAL,
    logLevel: 'silent',
  });
  const bytes = result.outputFiles[0].contents;
  const gzipBytes = gzipSync(bytes).length;
  return {
    id,
    bytes: bytes.byteLength,
    gzipKb: gzipBytes / 1024,
  };
}

async function main() {
  const sizes = {};
  for (const [id, source] of Object.entries(ENTRIES)) {
    try {
      const { bytes, gzipKb } = await measure(id, source);
      sizes[id] = gzipKb;
      console.log(
        `${id.padEnd(14)} ${(bytes / 1024).toFixed(1).padStart(8)}KB raw / ${gzipKb
          .toFixed(1)
          .padStart(6)}KB gzip`,
      );
    } catch (err) {
      console.error(`${id}: ${err.message}`);
      sizes[id] = null;
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(sizes, null, 2));
  console.log(`\nwrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
