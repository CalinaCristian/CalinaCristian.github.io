# Exact source geometry prerequisite

This change adds an opt-in source geometry contract for newly rebuilt districts. It is not a claim that unresolved road/building contacts or authored landmark detail have passed fidelity acceptance.

The builder retains complete valid positive-area source outlines and holes, including small structures and untyped mapped parts. It records incomplete/invalid source geometry explicitly and retains detected road contacts without shrinking/deleting a building. Precise footprints feed runtime and cached physical surfaces. The source-policy runtime also requires explicit landmark `sourceIds`; radius/name/centroid clearing remains legacy-only.

The independent audit's default ring is600m. Source IDs are authoritative when present, and boundary/topology checks are separate from identity. Historical spatial matching is available only for legacy datasets lacking identities; historical40m² metrics remain labelled subsets. Invalid-source skips have their own output artifact.

Validation on 2026-11-08:

- Strict identity fixture covers a missing source beside an identically shaped source, a2m² building, a sub-metre part, a moved matching ID and explicit unclosed source geometry.
- Pipera's source-policy rebuild retains all2282 valid source records, including all7 missing records from the initial rebuilt baseline; strict identity/topology checks pass for all2275 ways/parts and7 relation outer buildings. All5 courtyard buildings/7 inner rings remain exact. This dataset is intentionally not included in the prerequisite commit.
- Existing read-only geometry fixtures preserve Floreasca3160, Romană5552 and Grozăvești2401 source records. Their roof/assembly/physical union checks pass. No pre-existing dataset is rebuilt by the prerequisite commit.
- Syntax, Python fixture and diff checks pass. Mandatory frozen foot/a browser result is recorded in the subsequent Pipera handoff when complete; no hardware FPS claim is made.

Private scratch evidence: `/workspace/reality-pass/pipera/audits/`. No reference imagery is committed.
