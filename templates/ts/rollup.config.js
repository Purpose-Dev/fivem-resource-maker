import { terser } from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: ['src/client/index.ts', 'src/server/index.ts'],
    output: {
        dir: 'dist',
        format: 'cjs',
        sourcemap: true,
    },
    plugins: [
        resolve(),
        commonjs(),
        terser(),
    ],
};