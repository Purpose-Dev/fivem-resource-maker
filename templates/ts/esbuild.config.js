import { build } from 'esbuild';

build({
    entryPoints: ['src/client/index.ts', 'src/server/index.ts'],
    bundle: true,
    outdir: 'dist',
    minify: true,
}).catch(() => process.exit(1));