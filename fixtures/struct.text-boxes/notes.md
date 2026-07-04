# struct.text-boxes fixture

`before.xml` has one logical text box stored twice inside an
`mc:AlternateContent`: a DrawingML copy in `mc:Choice` and an identical VML
copy in `mc:Fallback`. The word "Text trapped in a box." therefore appears
twice in the raw XML even though only one renders.

`after.xml`: the box is lifted **once** (from the Choice branch) into the body
flow, right after its anchor paragraph, and the whole `mc:AlternateContent`
(both copies + the box shape) is removed. The anchor paragraph is left with an
empty run.

Because this removes the duplicate fallback copy, the run multiset changes, so
the rule logs each lift as a text-altering change (`altersText: true`) — the
change log records every box's text for review. Standalone (non-Alternate
Content) boxes are a pure reorder. Suggest tier.
