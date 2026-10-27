# Local font integrity

[English](fonts.md) · [فارسی](fonts.fa.md)

The licensed Vazirmatn33.003 variable source is kept outside public serving at font-source/vazirmatn-variable.woff2. Its 811 source codepoints are assigned across Latin/basic, Arabic/Persian and extended CSS ranges. The original source has no Cyrillic coverage; this phase adds no alphabet support. public/fonts/OFL.txt carries the SIL Open Font License.

The generated subsets are 32,392, 44,188 and 24,168 bytes. The manifest records source/subset hashes, sizes, ranges, axes and tool versions. CSS assignments are disjoint and complete; supporting spaces may exist in multiple binaries for shaping. Weight100–900, source copyright/license names and fontTools standard shaping features are preserved. Optional stylistic/numeric features listed in the manifest require an authorized regeneration before use.

## Required verification

Use Python3.14.4 in a fresh activated disposable environment outside the checkout. Install font-source/requirements.txt: fonttools4.67.0, Brotli1.2.1 and coverage7.17.0. The normal npm run validate -- full gate includes npm run check:fonts; CI and the scanner install the same dependencies unconditionally.

check:fonts opens the real full source with fontTools, computes its cmap partition, subsets it with fixed recalcTimestamp:false, verifies every assigned codepoint remains, compares weight axes and source copyright/license metadata, and regenerates all three WOFF2 buffers, CSS and JSON in memory. The --check mode compares exact committed bytes and fails for a stale output. It does not rewrite assets.

Node owner tests independently check source/output hashes and bytes, distributed license presence, every CSS range for disjoint/full assignments, budgets and preload selection for all ten locales. The preload helper always selects Latin and adds Arabic only for fa/ar. This is a selection policy, not measured browser loading.

Measured Python branch/line coverage is generated at coverage/fonts/coverage.xml and imported into Sonar; TypeScript and governance reports remain separate. No source/security/coverage exclusion is added. Generated manifest/CSS have a narrow formatting ignore so the real generator's exact output remains deterministic.

## Authorized maintenance

Only after an intentional font change, use python scripts/subset-website-fonts.py to rewrite generated outputs, then run the full gate. Ordinary validation uses --check and never regenerates missing/stale files to hide a failure. Pinned tools are required for byte determinism. The source remains outside public/; do not restore the full source as a preload.

No browser shaping, glyph appearance, network request or layout/font-performance claim is established here. The runnable phase must compare rendered text against the full source and verify real EN/FA/TR loading, mixed text, reduced motion and JavaScript-disabled content. See [client/document scope](client-document.md) and [phase policy](bootstrap.md).
