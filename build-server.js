import esbuild from 'esbuild';

// Bundle server.ts for Vercel serverless
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
});

console.log('✅ Server bundled successfully');
