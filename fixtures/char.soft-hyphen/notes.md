# char.soft-hyphen fixture

`before.xml` contains a soft hyphen in both forms converters emit:

1. A U+00AD code point inside a `w:t` run (`con­version`).
2. An empty `<w:softHyphen/>` run element between two `w:t` runs (`soft` + `ware`).

`after.xml` is the expected result: both removed, visible text becomes
`conversionsoftware`. The soft-hyphen element is deleted outright; the two
surrounding `w:t` runs are left as-is (a later run-merge pass may coalesce
them, but that is not this rule's job).

Invariant note: visible text changes here (U+00AD is dropped), which is legal
because `char.soft-hyphen` logs a text-altering change for each edit.
