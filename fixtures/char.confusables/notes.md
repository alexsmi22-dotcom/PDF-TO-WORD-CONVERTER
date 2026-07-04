# char.confusables fixture

`before.xml` contains three OCR confusions and two things that must be left
alone:

Fixed:
- `sumrnary` → `summary` — `rn`→`m`, allowed only because `summary` appears
  elsewhere in the document (paragraph 2) and `sumrnary` appears nowhere else.
- `2O24` → `2024` — digit context (real digit `2`), so the letter `O`→`0`.
- `hell0` → `hello` — letter context (plain word), so the stray `0`→`o`.

Left alone (guards):
- `1st` — a stray `1` in a word is never auto-changed (l vs I vs i is too
  ambiguous), and this is a legitimate ordinal anyway.
- `summary` (paragraph 2) — no `rn`, no confusables.

Total: 3 corrections. Suggest tier — opt-in, every changed run logged with its
full before/after.
