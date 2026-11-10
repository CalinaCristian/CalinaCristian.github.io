#!/usr/bin/env node
// No game build step. Stamp committed runtime content so every diagnostic identifies its source.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const walk = dir => !existsSync(resolve(root, dir)) ? [] : readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(?:js|json|css|html|bin|png|jpg|jpeg|webp|svg|webm|mp3|ogg|woff2?)$/i.test(e.name) ? [`${dir}/${e.name}`] : []);
const paths = [...new Set(['index.html', 'index.css', 'index.js', 'canvas.js', 'public/telemetry.js', 'game/index.html', 'game/style.css', ...walk('game/src'), ...walk('game/vendor'), ...walk('game/data'), ...walk('game/assets')])].filter(p => existsSync(resolve(root, p))).sort();
const canonical = (path, bytes) => path.endsWith('.html') ? Buffer.from(bytes.toString().replace(/^[\t ]*<meta name="game-(?:release|source)" content="[^"]*">\r?\n?/gm, '')) : bytes;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = paths.map(path => ({ path, sha256: hash(canonical(path, readFileSync(resolve(root, path)))) }));
const fingerprint = hash(Buffer.from(sources.map(s => `${s.path}\0${s.sha256}\n`).join(''))), releaseId = `game-${fingerprint.slice(0, 16)}`;
const target = resolve(root, 'game/release.json');
if (!process.argv.includes('--write')) {
    const current = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : null;
    const valid = current?.fingerprint === fingerprint && ['index.html', 'game/index.html'].every(path => readFileSync(resolve(root, path), 'utf8').includes(`<meta name="game-release" content="${releaseId}">`));
    console.log(JSON.stringify({ valid, releaseId, files: sources.length }));
    if (!valid) process.exitCode = 1;
} else {
    const requestedSource = process.argv.find(arg => arg.startsWith('--source='))?.slice(9) || 'HEAD';
    const sourceCommit = execFileSync('git', ['rev-parse', '--verify', `${requestedSource}^{commit}`], { cwd: root, encoding: 'utf8' }).trim();
    for (const source of sources) {
        const committed = execFileSync('git', ['show', `${sourceCommit}:${source.path}`], { cwd: root, maxBuffer: Math.max(32 * 1024 * 1024, statSync(resolve(root, source.path)).size + 65536) });
        if (hash(canonical(source.path, committed)) !== source.sha256) throw new Error(`Commit ${source.path} before stamping the release.`);
    }
    for (const path of ['index.html', 'game/index.html']) {
        let text = readFileSync(resolve(root, path), 'utf8').replace(/^[\t ]*<meta name="game-(?:release|source)" content="[^"]*">\r?\n?/gm, '');
        text = text.replace(/^([\t ]*)(<meta\s+charset=[^>]+>)/im, (_, indent, charset) => `${indent}${charset}\n${indent}<meta name="game-release" content="${releaseId}">\n${indent}<meta name="game-source" content="${sourceCommit}">`);
        if (!text.includes(`name="game-release"`)) throw new Error(`Missing charset anchor in ${path}`);
        writeFileSync(resolve(root, path), text);
    }
    writeFileSync(target, JSON.stringify({ releaseId, sourceCommit, fingerprint, normalization: 'HTML release/source meta lines excluded to avoid a self-referential hash', sources }, null, 2) + '\n');
    console.log(JSON.stringify({ releaseId, sourceCommit, files: sources.length }));
}
