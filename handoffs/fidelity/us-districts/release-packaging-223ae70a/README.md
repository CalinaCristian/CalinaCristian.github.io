# Read-only Pages packaging audit at223ae70a

Source `223ae70a179fb8c5654f30792555f965b0edbc62`. No root files/config changed, browser started, source/image/history deleted, external reference pixels fetched, full-tree copy made or dependencies installed. Python/git read the immutable tracked tree; reports and tools are this audit's only repository additions. Official Jekyll/Pages configuration and size documentation were read; URLs/content hashes are in `rules-sources.json`.

## Measured payload and predicted output

| Scenario | Tracked publish inputs | Raw input bytes | MiB | Predicted output files |
| --- | ---: | ---: | ---: | ---: |
| Existing config |15,226|1,050,755,925|1002.079|15,401|
| Add three exclusions below |14,319|831,571,107|793.048|14,447|
| Add fourth US exclusion |14,115|812,908,107|775.250|14,226|

The entire tracked tip is15,632files/1,093,996,375bytes. Current explicit/default entry filtering omits406files/43,240,450bytes. `_config.yml` excludes game/dev,game/research,specs,tools,root package.json and root README.md. Jekyll3.10 special leading `. _ # ~` components and backup suffixes are also honored; `.htaccess` is the default explicit inclusion (none here). Config's exclude array replaces the stock exclude array; none of the stock Gemfile/node_modules/vendor-bundle paths are tracked, so union vs replacement would not change this tree's total. There are no symlinks or `.nojekyll`.

**Raw input bytes are exact tracked-blob payload measurements, not actual built-site bytes.** Ruby/Jekyll are absent, so no production Jekyll build was claimed. GitHub Pages232/Jekyll3.10.0 defaults include optional-front-matter/readme-index:174 extra HTML files now,127 after three exclusions,110 after four, while original Markdown remains. The default Primer0.6.0 theme contributes one compiled CSS asset. `jekyll-default-output-prediction.json` lists every predicted extra page and leaves actual built bytes null. HTML/layout/metadata/CSS generation adds bytes; a real final build must measure its `_site` before release.

No tracked file exceeds100MiB. Largest: `game/data/bucharest-unirii.json`,25,461,225bytes(24.282MiB); next `bucharest-romana.json`,21,736,227bytes. Official Pages documentation says published sites may be no larger than1GB; it does not define the unit on that page. Existing raw inputs already exceed decimal1GB by50,755,925bytes and leave only22,985,899bytes below1GiB before generated output. Do not treat the current config as a comfortable size pass. The source repository's1GB recommendation is separate from the published-site limit; no history rewrite/deletion is proposed.

## Minimal safe directory exclusions

| Directory to exclude from Pages only | Files | Bytes saved |
| --- | ---: | ---: |
| `handoffs/fidelity/pipera-fidelity` |218|101,769,431|
| `handoffs/fidelity/original-districts-refresh` |491|77,900,318|
| `handoffs/fidelity/integration-final-acceptance` |198|39,515,069|
| `handoffs/fidelity/us-districts` |204|18,663,000|

First three save219,184,818bytes/907files; all four save237,847,818bytes/1,111files and provide room for final proofs. Root owns any `_config.yml`/README/spec change. Exclusion retains git bytes/history/GitHub links and preserves **all** public comparison/current/historical/context/street-walk pixels and ledgers. Keep `handoffs/fidelity/tourist-context-activities/proof` published: active native report/image hrefs use it. Do not substitute a blanket handoffs exclusion/include override.

Largest currently publishable areas: `game/overview/comparison-data`590,003,003B(562.671MiB),`handoffs`329,819,166B(314.540MiB),`game/data`108,346,781B(103.328MiB),`game/overview/assets`10,193,952B(9.722MiB),`game/src`8,740,813B(8.336MiB). Largest handoff subtrees include Pipera static-layer-frustum80,764,728B,original delivery39,762,010B and integration proof39,458,633B. `measurement.json` contains exact directory/file/exclusion tables.

## Dependency evidence and limits

`audit-public-consumers.py` checked132JSfiles,9,681static local references/constructor bases, all35dynamic data files,8current+20historical atlas manifests,10perspective+2street-walk manifests and85landmark/spot evidence records. It resolves actual image/thumbnail/manifest URLs and native report hrefs as the current viewers do, including76native-proof links targeting27distinct report files. All checked local targets exist and remain publishable; **zero** active targets lie in any of the four proposed directories or existing excluded paths. Comparisons retain865current and2,159historical atlas image references; contexts132,streetwalk1,188. The three new SeaTac native images/report have their own overview context directory and do not load the US handoff copy.

Research/dev/spec/source credits in overview use source-pinned HTTPS GitHub links, not Pages fetches. The game imports compiled source modules and fetches published game/data assets; research/dev references in source comments are not runtime requests. Four raw source/proof path strings in archived spot/S160 metadata refer to original-districts-refresh, but the viewer does not turn them into links or fetch them; they are listed explicitly in the dependency report. Other source-provenance ledgers retain historical repo paths/hashes as data. No claim is made that every relative path printed inside every raw developer report remains a standalone Pages download after exclusion; those complete records remain in git. This scope verifies actual current browser/runtime/overview/native-proof consumers, not arbitrary user-constructed URLs or an executed browser/Jekyll build.

Reproduce without changing the audited checkout:

```sh
python /path/to/measure-jekyll-payload.py --root=/path/to/repo --source=223ae70a179fb8c5654f30792555f965b0edbc62 --out=/tmp/pages-audit
python /path/to/audit-public-consumers.py --root=/path/to/repo --source=223ae70a179fb8c5654f30792555f965b0edbc62 --out=/tmp/pages-audit
```

Scripts use only Python's standard library and git; reject custom include lists because their precedence would require a separate audit. Estimates are tied to the recorded source; future added files/config/plugins require fresh measurement.
