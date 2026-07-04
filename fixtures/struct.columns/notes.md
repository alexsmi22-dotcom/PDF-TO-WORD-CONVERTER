# struct.columns fixture

`before.xml` has a section with `w:cols w:num="2"` and two explicit `w:col`
width children — the converter reproducing side-by-side geometry.

`after.xml`: `w:num` is set to `1` and the per-column `w:col` children are
removed (the `w:space` attribute on `w:cols` is left as-is). Visible text is
unchanged.

Suggest tier: genuinely multi-column documents exist, so this is opt-in with a
per-section preview rather than automatic.
