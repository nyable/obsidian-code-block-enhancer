import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import scss from 'rollup-plugin-scss';
import copy from 'rollup-plugin-copy'
// import del from 'rollup-plugin-delete'
const isProd = (process.env.BUILD === 'production');
const outputDir = './dist'

export default {
  input: './src/main.ts',
  output: {
    dir: outputDir,
    sourcemap: 'inline',
    sourcemapExcludeSources: isProd,
    format: 'cjs',
    exports: 'default',
  },
  external: ['obsidian'],
  plugins: [
    typescript(),
    nodeResolve({ browser: true }),
    commonjs(),
    scss({ output: `${outputDir}/styles.css`, sass: require('sass') }),
    copy({
      targets: [
        { src: './manifest.json', dest: outputDir },
      ],
    }),
  ]
};