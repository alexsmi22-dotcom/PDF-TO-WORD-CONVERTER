# char.ligatures fixture

`before.xml` contains five presentation-form ligatures in one run:

- `oﬃce`  (U+FB03 ﬃ → `ffi`)  → `office`
- `ﬁled`  (U+FB01 ﬁ → `fi`)   → `filed`
- `ﬂat`   (U+FB02 ﬂ → `fl`)   → `flat`
- `ﬀ`     (U+FB00 ﬀ → `ff`)   → `ff`
- `waﬄe`  (U+FB04 ﬄ → `ffl`)  → `waffle`

`after.xml` is the expanded result. Text changes, which is legal because the
rule logs a text-altering change per affected run.
