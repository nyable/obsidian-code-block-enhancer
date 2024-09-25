import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';
import { sassPlugin } from 'esbuild-sass-plugin';
import fs from 'fs';
import path from 'path';
const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
    banner: {
        js: banner
    },
    entryPoints: ['src/main.ts', { in: 'src/styles/index.scss', out: 'styles' }],
    bundle: true,
    external: [
        'obsidian',
        'electron',
        '@codemirror/autocomplete',
        '@codemirror/collab',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/common',
        '@lezer/highlight',
        '@lezer/lr',
        ...builtins
    ],
    format: 'cjs',
    target: 'es2018',
    logLevel: 'info',
    sourcemap: prod ? false : 'inline',
    treeShaking: true,
    minify: prod,
    outdir: 'dist',
    plugins: [
        sassPlugin(),
        {
            name: 'copy-file',
            setup(build) {
                build.onEnd((result) => {
                    const outdir = build.initialOptions.outdir;
                    const manifestPath = path.join(process.cwd(), 'manifest.json');
                    if (fs.existsSync(manifestPath)) {
                        fs.copyFileSync(manifestPath, outdir + '/manifest.json');
                    }
                });
            }
        }
    ]
});

if (prod) {
    await context.rebuild();
    process.exit(0);
} else {
    await context.watch();
}