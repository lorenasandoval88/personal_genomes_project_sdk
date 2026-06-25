import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const browserPlugins = [
      resolve({ browser: true , preferBuiltins: false      }),
      commonjs(),
      json()
    ];

const nodePlugins = [
      resolve({ browser: false, preferBuiltins: true }),
      commonjs(),
      json()
    ];

export default [
  // App bootstrap bundle (ESM)
  {
    input: 'src/js/get23_main.js',
    output: {
      file: 'dist/main.mjs',
      format: 'es',
      sourcemap: true
    },
    plugins: browserPlugins
  },
  // All users data module (ESM bundle)
  {
    input: 'src/js/get23_allUsers.js',
    output: {
      file: 'dist/allUsers.bundle.mjs',
      format: 'es',
      sourcemap: true
    },
    plugins: browserPlugins
  },
  // Stats module (ESM bundle)
  {
    input: 'src/js/get23_loadStats.js',
    output: {
      file: 'dist/loadStats.bundle.mjs',
      format: 'es',
      sourcemap: true
    },
    plugins: browserPlugins
  },
  // ESM module
  {
    input: 'sdk.js',
    output: {
      file: 'dist/sdk.mjs',
      format: 'es',
      sourcemap: true
    },
    plugins: browserPlugins
  },
  // Universal SDK module — browser-resolved so it has no bare `stream`/`buffer`/`util`
  // imports (which break in browsers). Still works in Node (Cloud Run) because:
  //   - The Buffer shim short-circuits to native Buffer when it exists.
  //   - JSZip's browser build supports the arrayBuffer + .async("string") APIs we use.
  {
    input: 'cloudNodeEntry.js',
    output: {
      file: 'dist/cloud_sdk.mjs',
      format: 'es',
      intro: 'var self = globalThis; var Buffer = globalThis.Buffer || { from: (b) => new Uint8Array(b instanceof ArrayBuffer ? b : (b && b.buffer) || b) };',
      sourcemap: true
    },
    plugins: browserPlugins
  }
];
