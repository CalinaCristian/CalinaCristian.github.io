// CPU-only observation of the exact compiler's pre-model inputs. Derivative
// copy lives in the same tools directory for unchanged relative imports. It
// exits before body/roof/cache output, and ALL final dataset writes are disabled.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [reviewFile, idsFile, outputFile] = process.argv.slice(2);
if (!outputFile) throw Error('REVIEW_JSON TARGET_IDS_JSON OUTPUT_JSON required');
const root = path.resolve(new URL('../../../..', import.meta.url).pathname), original = path.join(root, 'tools/osm/build-data.mjs');
const source = fs.readFileSync(original, 'utf8'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const dataFile = path.join(root, 'game/data/bucharest-grozavesti.json'), before = sha(fs.readFileSync(dataFile));
const marker = '        const retainedInferredModel = retainedSourceInferredBuildingModel(sourceContextReview,';
const reviewLine = "    const returnReview = returnFile && args['source-returns'] !== 'none' && fs.existsSync(returnFile) ? JSON.parse(fs.readFileSync(returnFile, 'utf8')) : null;";
if (source.split(marker).length !== 2 || source.split(reviewLine).length !== 2 || source.split('fs.writeFileSync(file, json);').length !== 2) throw Error('Compiler capture anchors changed; refuse guessed instrumentation');
const ids = JSON.parse(fs.readFileSync(idsFile)), rows = `const capturedModelInputs = new Map(), captureIds = new Set(${JSON.stringify(ids)});\n`;
const observer = `        if (captureIds.has(t.__id)) {
            capturedModelInputs.set(t.__id, {sourceId:t.__id,tags:t,sourceRingLL:lls,sourceHolesLL:rb.holesLL||[],heightM:Number.isFinite(h)?h:null});
            fs.writeFileSync(process.env.SOURCE_MODEL_CAPTURE_OUTPUT, JSON.stringify([...capturedModelInputs.values()], null, 2));
            if (capturedModelInputs.size === captureIds.size) process.exit(0);
        }
`;
let derived = source.replace(reviewLine, "    const returnReview = JSON.parse(fs.readFileSync(process.env.SOURCE_MODEL_CAPTURE_REVIEW, 'utf8'));\n");
derived = derived.replace(marker, observer + marker).replace('fs.writeFileSync(file, json);', "throw Error('Capture incomplete; dataset writes are disabled');");
// ES imports remain at top level; a declaration immediately before the first
// city build is safe and keeps the frozen compiler's actual initialization.
derived = derived.replace('function buildCity(cityId, did = null) {', rows + '\nfunction buildCity(cityId, did = null) {');
const temporary = path.join(root, 'tools/osm', `.source-model-observer-${process.pid}.mjs`);
if (fs.existsSync(temporary)) throw Error('Refuse overwrite: ' + temporary);
fs.writeFileSync(temporary, derived);
try {
    execFileSync(process.execPath, ['--no-warnings', '--max-old-space-size=8000', temporary, '--tiles', '/workspace/reality-pass/grozavesti/tiles', '--cache', '/workspace/reality-pass/grozavesti/osm-cache', '--city', 'bucharest', '--district', 'grozavesti'], {
        cwd: root, env: { ...process.env, SOURCE_MODEL_CAPTURE_REVIEW: path.resolve(reviewFile), SOURCE_MODEL_CAPTURE_OUTPUT: path.resolve(outputFile) }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024,
    });
    const after = sha(fs.readFileSync(dataFile)); if (before !== after) throw Error('Capture unexpectedly changed dataset');
    fs.writeFileSync(outputFile + '.manifest.json', JSON.stringify({ scope: 'CPU compiler input observation only; no dataset output/native browser/actor operation', compilerSha256: sha(source), observerSha256: sha(derived), reviewedInputSha256: sha(fs.readFileSync(reviewFile)), targetIds: ids, outputSha256: sha(fs.readFileSync(outputFile)), datasetSha256Before: before, datasetSha256After: after, datasetUnchanged: true }, null, 2));
    console.log(JSON.stringify({ captured: JSON.parse(fs.readFileSync(outputFile)).length, datasetUnchanged: true, outputFile }));
} finally { fs.unlinkSync(temporary); }
