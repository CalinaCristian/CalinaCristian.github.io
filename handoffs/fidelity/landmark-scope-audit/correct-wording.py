#!/usr/bin/env python3
"""Correct demonstrated implementation wording; preserve capture/source payloads.

This is a metadata-only maintenance script, not a renderer or test runner.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import subprocess

p = argparse.ArgumentParser()
p.add_argument('--root', type=Path, required=True)
p.add_argument('--baseline', default='29f4533895e1abba65f342ebffed735791c1e301')
a = p.parse_args()
root = a.root.resolve()
folder = root / 'game/overview/evidence/landmarks'
report_dir = root / 'handoffs/fidelity/landmark-scope-audit'
DATE = '2026-11-09'
GH = 'https://github.com/CalinaCristian/CalinaCristian.github.io/'
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
def full(ref):
    sha = git('rev-parse', ref + '^{commit}').decode().strip()
    subprocess.run(['git', 'merge-base', '--is-ancestor', sha, a.baseline], cwd=root, check=True)
    return sha
commits = {key: full(ref) for key, ref in {
    'ase': '3174ed69', 'book': 'b203c38a', 'policy': '2c73f3d',
    'rectorat': '6e4160cc', 'cec_association': 'bb32f06f',
    'cec_bands': '052ecc8d', 'tourist_collision': '924aaa05',
    'paint': '5fe9d0c2', 'paint_night': '5d6c0f34',
}.items()}
book_path = 'handoffs/fidelity/remaining-ro-districts/cec-source-masses/shared-source-ledger-proof.json'
book_proof = json.loads((root / book_path).read_text())
assert book_proof['independentChecks']['sourceBookResult'] == dict(book_proof['independentChecks']['sourceBookResult'], passed=True, checks=456, models=33)
book_ids = {r['id'] for r in json.loads((root / 'game/research/landmark-source-bucharest.json').read_text())['landmarks']}
assert len(book_ids) == 33
original_text = {file: git('show', a.baseline + ':' + str(file.relative_to(root))).decode() for file in sorted(folder.rglob('*.json'))}
records = {file: json.loads(text) for file, text in original_text.items()}
assert len(records) == 61
originals = copy.deepcopy(records)
protected = ['captures', 'sourceCommit', 'reviewedAt', 'updatedAt', 'status', 'perf', 'coordinates', 'sourceIds', 'replacementScope', 'sourceLedger', 'name', 'city', 'id', 'schemaVersion']
changes = []

def top_members(text):
    decoder = json.JSONDecoder()
    return [(json.loads(m.group(1)), m.end(), decoder.raw_decode(text, m.end())[1]) for m in re.finditer(r'^  ("[^"\n]+"): ', text, re.M)]

def replace_changed_members(text, before, after):
    # Preserve every unchanged top-level member literally, including the complete
    # original capture array's whitespace, Unicode escapes and number spelling.
    parts, cursor = [], 0
    for key, start, end in top_members(text):
        if before[key] == after[key]:
            continue
        value = json.dumps(after[key], indent=2, ensure_ascii=False).replace('\n', '\n  ')
        parts.extend([text[cursor:start], value]); cursor = end
    parts.append(text[cursor:])
    result = ''.join(parts)
    additions = [(key, value) for key, value in after.items() if key not in before]
    if additions:
        last_end = top_members(result)[-1][2]
        suffix = ''.join(',\n  ' + json.dumps(key) + ': ' + json.dumps(value, indent=2, ensure_ascii=False).replace('\n', '\n  ') for key, value in additions)
        result = result[:last_end] + suffix + result[last_end:]
    assert json.loads(result) == after
    return result

def capture_fragment(text):
    _, start, end = next(member for member in top_members(text) if member[0] == 'captures')
    return text[start:end]

def history(d, field, prior, replacement, refs):
    d.setdefault('historicalImplementationNotes', []).append({
        'priorRecordSnapshotCommit': a.baseline,
        'priorCaptureRecordSourceCommit': d['sourceCommit'],
        'supersededAt': DATE,
        'field': field,
        'priorValue': copy.deepcopy(prior),
        'replacementScope': replacement,
        'acceptedImplementationCommits': [commits[r] for r in refs],
        'note': 'Preserved capture-era implementation wording. This metadata correction does not change capture objects, dates, source SHAs or parity acceptance.',
    })

def source(d, url, label, kind):
    if not any(s.get('url') == url for s in d['sources']):
        d['sources'].append({'url': url, 'label': label, 'type': kind})

def code_source(d, key, label):
    source(d, GH + 'commit/' + commits[key], label + ' (' + commits[key][:8] + ')', 'implementation')

def proof_source(d, file, label, commit=None):
    source(d, GH + 'blob/' + (commit or a.baseline) + '/' + file, label, 'validation')

def replace_gap(d, old, new, refs):
    index = d['remainingGaps'].index(old)
    history(d, 'remainingGaps[' + str(index) + ']', old, new, refs)
    d['remainingGaps'][index] = new

def replace_check(d, index, details, refs, label=None):
    old = copy.deepcopy(d['checks'][index])
    history(d, 'checks[' + str(index) + ']', old, details, refs)
    d['checks'][index]['details'] = details
    if label:
        d['checks'][index]['label'] = label

common_us = 'Integrated source-only replacement and rebuilt district performance are separate acceptance checks; the capture branch predates that shared world policy.'
for file, d in records.items():
    # Only members of the actual33-entry source book receive its later recorded result.
    for index, check in enumerate(d['checks']):
        if 'Entire 33-model check passes 306 checks.' not in check['details']:
            continue
        assert d['id'] in book_ids
        prior = check['details'].replace('Entire 33-model check passes 306 checks.', 'The earlier run across 33 models recorded 306 checks.')
        details = 'Historical source-boundary evidence: ' + prior + ' The later accepted source-book update ' + commits['book'] + ' records 456 checks across 33 models, including this entry, in ' + book_path + '. This wording update cites that existing proof; no tests were rerun and no images were recaptured.'
        replace_check(d, index, details, ['book'], 'Historical source boundary and replacement-identity checks')
        code_source(d, 'book', 'Accepted source-book/topology sync; recorded 456 checks across 33 models')
        proof_source(d, book_path, 'Existing recorded source-book/topology result; not a new execution', commits['book'])
    if d['city'] == 'seattle' and common_us in d['remainingGaps']:
        replace_gap(d, common_us,
            'The shared explicit-ID source-replacement implementation is integrated in production (' + commits['policy'] + '). These studies retain their actual capture-era source and do not establish current district placement, road/body clearance, traffic/mirror budgets or seasonal parity. Registry entries outside a district list and context-only models with no replacement IDs do not replace neighbouring buildings.', ['policy'])
        code_source(d, 'policy', 'Accepted production explicit-ID source replacement; implementation scope only')
        for index, check in enumerate(d['checks']):
            if check['label'] == 'Current source identity and topology review':
                replace_check(d, index, check['details'] + ' Production explicit-ID replacement is now implemented by ' + commits['policy'] + '; this records implementation, not a new integrated placement, clearance or performance pass.', ['policy'])
            elif check['label'] == 'Bucharest foot,a regression':
                replace_check(d, index, 'Historical branch evidence only. ' + check['details'] + ' The statement about subsequent US-only changes belongs to that recorded branch stage; it does not describe all later integrated ROOT changes or constitute a new root regression.', [], 'Historical Bucharest foot,a regression')
    if d['id'] == 'ase':
        prior = d['improvements'][0]
        new = 'Accepted implementation ' + commits['ase'] + ' rebuilt the mapped southwest corner dome, giant facade columns, recessed/arched windows, signs and hole-preserving roof/collision from the complete 29-vertex OSM relation/four courtyards plus cited official photographs. Vertical dimensions, including the 38.25 m model envelope, remain estimates; this is not a measured-height survey.'
        history(d, 'improvements[0]', prior, new, ['ase'])
        d['improvements'][0] = new
        code_source(d, 'ase', 'Accepted ASE corner-dome/facade/courtyard correction')
        proof_source(d, 'game/research/ase-landmark.json', 'ASE mapped source facts, official references and explicit modelling estimates')
    if d['id'] == 'cec':
        old_gap = next(g for g in d['remainingGaps'] if 'Tourist-scene placement and public approach need' in g)
        replace_gap(d, old_gap, 'Shaped-roof collision retains each complete source total-height band rather than a pointwise curved roof height. Canonical association and removal of obsolete blanket parent caps are integrated; complete independent courtyard/frontage, neighbouring-MNIR, public-access and crowd-behaviour comparison remains separate from the recorded primary candle approach.', ['cec_association', 'cec_bands'])
        d['improvements'].append('Canonical CEC, including both prepared r13104229 outers, is associated in Old Town and uses native per-solid polygon/hole/height bands without the obsolete blanket parent collider (' + commits['cec_association'] + ', ' + commits['cec_bands'] + ').')
        for index, check in enumerate(d['checks']):
            if check['label'] == 'Tourist-scene native placement and access':
                replace_check(d, index,
                    'Canonical association and obsolete blanket parent-cap removal are implemented in accepted ' + commits['cec_association'] + ' and ' + commits['cec_bands'] + '. Existing source93b0d8649e7c3a1217ae5b009f124347c41da6a8 tourist evidence records the physical 26.095 m primary candle approach with ordinary source solids/crowd enabled. This broad complete-context gate remains open: that route does not establish matched frontage/courtyard/adjacent-MNIR fidelity, all public approaches or all crowd behaviour. No new browser or test execution accompanies this wording update.', ['cec_association', 'cec_bands'], 'Complete tourist-scene context and access (separate gate)')
        code_source(d, 'cec_association', 'Accepted exact CEC outer/courtyard association in the tourist scene')
        code_source(d, 'cec_bands', 'Accepted native Old Town collider bands; obsolete blanket caps removed')
        proof_source(d, 'game/overview/evidence/spots/stavropoleos-cec.json', 'Current selected Stavropoleos/CEC source-stamped primary-route record')
        proof_source(d, 'handoffs/fidelity/tourist-context-activities/proof/final-24-integrated/initial/results.json', 'Existing 93b0d864 native scene/phone/primary-route report; scope remains limited')
    if d['id'] == 'dinamo':
        gap = next(g for g in d['remainingGaps'] if g.startswith('Neighbour overlap, terrain support'))
        replace_gap(d, gap, 'Source-stamped native Floreasca placement/paint views and two exact-pose atlas tiles are now recorded. They retain raw scene-contact diagnostics and do not establish complete neighbour/terrain clearance, every tourist-scene placement or whole-district parity.', ['paint', 'paint_night'])
        for index, check in enumerate(d['checks']):
            if check['label'] == 'Complete district / traffic / mirror budget':
                replace_check(d, index, 'The original source-era paired Romană sample/Arnia timeout remains historical evidence, not a complete budget pass. Later recorded Floreasca paint/placement controls and two atlas tiles establish the narrow visible-paint correction only; full traffic/mirror/controller and all-scene clearance acceptance remain separate. No new render or test was run for this wording correction.', ['paint', 'paint_night'])
        code_source(d, 'paint', 'Accepted exact 12 cm Dinamo coverage/mip filtering; no line widening')
        code_source(d, 'paint_night', 'Accepted original floodlit paint semantics and isolated-study capture support')
        proof_source(d, 'handoffs/fidelity/original-pitch-paint/proof/final-d5795e20/review-summary.json', 'Existing d5795e20 six native world controls and three isolated-study review')
        proof_source(d, 'handoffs/fidelity/original-districts-refresh/proof/water-overlap-bbaffc/floreasca-publication-validation.json', 'Existing bbaffc0d exact-pose atlas retakes, including both affected Dinamo squares')
    if d['id'] == 'politehnica':
        old_gap = next(g for g in d['remainingGaps'] if g.startswith('The captured branch predates'))
        replace_gap(d, old_gap, 'The eaa40092 captures retain their original pre-policy provenance. Exact body/dome-only replacement is now implemented and excludes Corp AN w1217713450; the old isolated views do not independently certify every current campus placement, body clearance or whole-campus comparison.', ['rectorat', 'policy'])
        d['improvements'].append('Production now combines the exact body/dome declarations from ' + commits['rectorat'] + ' with the integrated explicit-ID replacement path ' + commits['policy'] + '; Corp AN and other undeclared source identities remain separate.')
        for index, check in enumerate(d['checks']):
            if check['label'] == 'Exact replacement declaration':
                replace_check(d, index, check['details'] + ' Accepted declarations ' + commits['rectorat'] + ' and production replacement ' + commits['policy'] + ' are integrated; this implementation note does not recapture the eaa40092 studies or establish whole-campus parity.', ['rectorat', 'policy'])
            elif check['label'] == 'Surveyed metre height and full parity':
                replace_check(d, index, 'Height and detailed bay/fin measurements remain unavailable; complex geometry and complete campus/reference parity remain open. Exact source-policy implementation is already integrated and is not the unresolved gate.', ['rectorat', 'policy'])
        code_source(d, 'rectorat', 'Accepted exact Rectorat body/dome replacement identities; Corp AN excluded')
        code_source(d, 'policy', 'Accepted integrated explicit-ID production source replacement')
    if d['id'] == 'lincoln':
        old_gap = next(g for g in d['remainingGaps'] if g.startswith('Full complex replacement must be verified after'))
        replace_gap(d, old_gap, 'The explicit-ID replacement path and source-preserving Bellevue data are integrated. Complete independent complex placement, vertical fit and neighbour/road clearance remain separate from these original model studies.', ['policy'])
    if d['id'] == 'columbia':
        old_gap = next(g for g in d['remainingGaps'] if g.startswith('The parent relation is treated'))
        replace_gap(d, old_gap, 'The parent relation remains one complete authored building scope. Production replacement uses declared identities and preserves separate neighbouring source identities; these isolated studies do not survey all neighbour clearances.', ['policy'])
    if d['id'] == 'seagarage':
        # This explicitly does NOT promote the pending structural-clearance candidate.
        for index, check in enumerate(d['checks']):
            if check['label'] == 'Current source identity and topology review':
                d['checks'][index]['details'] += ' The existing eight-lightwell controls do not certify under-deck roadway or terminal body clearance; those physical gates remain separate and are not marked fixed here.'
    for key in protected:
        assert d.get(key) == originals[file].get(key), (d['id'], 'Protected field changed', key)
    if d != originals[file]:
        d['implementationNotesUpdatedAt'] = DATE
        d['implementationNotesScope'] = 'Metadata-only correction of accepted implementation/recorded-proof status. Original study source SHAs/dates/capture objects remain authoritative; no new test execution, recapture or parity acceptance.'
        file.write_text(replace_changed_members(original_text[file], originals[file], d))
        changes.append({'id': d['id'], 'file': str(file.relative_to(root)), 'priorRecordSha256': hashlib.sha256(git('show', a.baseline + ':' + str(file.relative_to(root)))).hexdigest(), 'captureSourceCommit': d['sourceCommit'], 'captureCount': len(d['captures']), 'historicalNotesAdded': len(d.get('historicalImplementationNotes', [])) - len(originals[file].get('historicalImplementationNotes', []))})
# Every current image remains byte-identical and all61 capture arrays are unchanged.
images = []
for file, d in records.items():
    before = originals[file]
    assert d['captures'] == before['captures']
    assert capture_fragment(file.read_text()) == capture_fragment(original_text[file])
    for c in d['captures']:
        image = root / 'game/overview' / c['image']
        actual = hashlib.sha256(image.read_bytes()).hexdigest()
        assert actual == c['sha256']
        images.append({'id': d['id'], 'capture': c.get('id', c.get('kind')), 'path': str(image.relative_to(root)), 'sha256': actual, 'sourceCommit': c['sourceCommit'], 'capturedAt': c.get('capturedAt')})
assert len(images) == 183
# The terminal record's genuine grading/clearance gaps are untouched.
terminal = next(f for f, d in records.items() if d['id'] == 'seatac')
assert records[terminal] == originals[terminal]
report = {'baseline': a.baseline, 'updatedAt': DATE, 'scope': 'Only public landmark implementation wording and this handoff; no runtime/assets/renderer/global docs.', 'changedRecords': changes, 'landmarkRecordsVerified': 61, 'capturesPreserved': 183, 'protectedRecordFields': protected, 'allCaptureObjectsDeepEqual': True, 'allCaptureJsonFragmentsByteIdentical': True, 'allImageBytesMatchOriginalHashes': True, 'seaTacTerminalRecordCompletelyUnchanged': True, 'garageTerminalClearanceNotPromoted': True, 'recordedBookProof': {'acceptedCommit': commits['book'], 'path': book_path, 'checks': 456, 'coveredEntries': 33, 'bookMemberIds': sorted(book_ids), 'notRerunHere': True}, 'acceptedImplementationCommits': commits, 'images': images, 'failures': []}
report_dir.mkdir(parents=True, exist_ok=True)
(report_dir / 'wording-correction.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'changedRecords': len(changes), 'capturesPreserved': len(images), 'terminalUnchanged': True, 'failures': []}))
