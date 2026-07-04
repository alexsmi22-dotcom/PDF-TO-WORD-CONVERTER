# struct.section-breaks fixture

`before.xml` has a paragraph-level `w:sectPr` (a continuous section break) whose
page geometry — size, margins, and column count — is identical to the
body-level section that follows it. That break carries no visual meaning; it is
converter noise that makes editing near it misbehave.

`after.xml`: the paragraph-level `w:sectPr` is removed, and the now-empty
`w:pPr` that only carried it is dropped, leaving an empty paragraph (`<w:p/>`)
which the empty-paragraph collapse rule handles later. The body-level section is
kept. Visible text is unchanged — this is a text-neutral structural rule.

The rule deliberately does **not** fire on:
- nextPage breaks (a real page break may be intended),
- breaks across a genuine geometry change (orientation, margins, columns),
- the body-level section.
