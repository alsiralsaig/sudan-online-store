import esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

// Bundle server.ts → dist/server.js
await esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  outfile: 'dist/server.js',
  platform: 'node',
  target: 'node18',
  format: 'esm',
  external: ['express'],
  sourcemap: false,
  minify: false,
  logLevel: 'info',
});

console.log('✅ server.ts bundled → dist/server.js');

// Add Vercel handler wrapper at the end
const wrapper = `

// Vercel serverless handler
async function vercelHandler(req, res) {
  const app = createApp();
  return new Promise((resolve) => {
    app(req, res, () => resolve());
  });
}

export default vercelHandler;
`;

const content = readFileSync('dist/server.js', 'utf8');
writeFileSync('dist/server.js', content + wrapper);

console.log('✅ Added Vercel handler export');
