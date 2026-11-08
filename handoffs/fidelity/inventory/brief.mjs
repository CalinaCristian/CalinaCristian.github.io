import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
const [id, worktreeOverride, baseOverride] = process.argv.slice(2);
const task = manifest.tasks.find((entry) => entry.id === id);
if (!task) {
    console.error('Usage: node handoffs/fidelity/inventory/brief.mjs TASK_ID [ABSOLUTE_WORKTREE] [FROZEN_BASE_SHA]');
    console.error('Task IDs: ' + manifest.tasks.map((entry) => entry.id).join(', '));
    process.exit(1);
}
const base = baseOverride || '<root supplies the latest tested staging SHA; do not use the old inventory base blindly>';
const worktree = worktreeOverride || task.worktree;
const entityRows = ['districts', 'landmarks', 'scenes'].flatMap((kind) => manifest[kind].filter((entry) => entry.task === task.id));
const evidenceKeys = [...new Set(entityRows.flatMap((entry) => [...entry.sourceEvidence, ...entry.reviewEvidence]))];
const specs = task.kind === 'scene' ? 'specs/15-tourist-spots.md, specs/20-research.md and relevant spec12 model contracts' : 'specs/12-buildings-streetscape.md, specs/20-research.md and relevant spec15 consumers';
const profiles = [];
const collect = (key) => {
    if (profiles.includes(key)) return;
    for (const parent of manifest.acceptanceProfiles[key].extends || []) collect(parent);
    profiles.push(key);
};
collect(task.acceptanceProfile);
console.log([
    `Fresh-context task ${task.id}: ${task.title}.`,
    `Use only worktree ${worktree}, branch ${task.branch}, frozen base ${base}. Root creates the isolated worktree/branch; do not switch another worker's directory.`,
    `Read AGENTS.md, specs/STATUS.md, ${specs} and handoffs/fidelity/FIDELITY-GOAL.md. Your selected manifest records are summarized below; do not read the whole inventory into context.`,
    `Before editing, root must confirm dependencies integrated: ${task.dependsOn.join(', ') || 'none'}. Current reserved owners are in manifest.reservedTasks.`,
    `Edit boundary: ${task.ownedFiles.join('; ') || 'root integration only'}.`,
    task.ownedFunctions ? `Owned builder functions: ${task.ownedFunctions.join(', ')}. Associated anchor/footprint/registry rows only; no whole-file formatting or shared helper edits.` : '',
    `Entities: ${task.entityIds.join(', ') || 'shared integration requests'}. Conflicts: ${task.conflictGroups.join(', ')}.`,
    task.notes || '',
    ...entityRows.map((entry) => `${entry.id} [${entry.status}]: ${(entry.unresolved || []).join(' ')}`),
    ...evidenceKeys.map((key) => `Evidence ${key}: ${manifest.evidence[key].path} (${manifest.evidence[key].inspected}; ${manifest.evidence[key].availability || manifest.evidence[key].kind}).`),
    `Use the manifest's source/review evidence records and unresolved gaps; local historical reports are pointers, not fresh acceptance. If imagery is absent, regenerate locally with generic tools and secure configured credentials; never copy credentials or imagery into git.`,
    ...profiles.flatMap((key) => manifest.acceptanceProfiles[key].requirements.map((requirement) => `- ${requirement}`)),
    `Write ${task.handoff}: base/final SHA, changed files/functions, independent sources, all reviewed artifact IDs/paths and coverage exclusions, raw check/performance results, unresolved gaps, exact shared integration requests.`,
    'Commit only your owned changes with CalinaCristian <cristycalina@gmail.com>; return SHA and concise handoff. No push or master merge. Root owns global docs/status, staged integration, combined QA and scoped cleanup.',
].filter(Boolean).join('\n'));
