import esbuild from 'esbuild';

// Bundle server.ts → api/index.js (Vercel serverless function)
await esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  outfile: 'api/index.js',
  platform: 'node',
  target: 'node18',
  format: 'esm',
  external: ['express', '@google/genai', 'pg', 'web-push', '@vercel/blob'],
  sourcemap: false,
  minify: false,
  logLevel: 'info',
});

console.log('✅ server.ts bundled → api/index.js (Vercel serverless function)');
