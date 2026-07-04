# style.inference fixture

`before.xml` is typical converter output: every paragraph is Normal with direct
formatting only. Sizes are 32, 26, 22, 22 half-points. The modal (body) size is
22. The two larger paragraphs cluster by descending size into Heading 1 (32) and
Heading 2 (26); the two 22-pt paragraphs end with periods and stay body text.

`after.xml`: a `w:pStyle` reference is inserted as the first child of each
heading's `w:pPr`. Direct formatting is intentionally left in place, so the
headings look identical but now carry real structure (navigation pane, TOC,
restyle-all). Visible text is unchanged.

When `word/styles.xml` is present, the rule also injects minimal `Heading1`/
`Heading2` style definitions (with outline levels) if they are missing.
