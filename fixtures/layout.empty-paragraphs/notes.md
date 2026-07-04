# layout.empty-paragraphs fixture

`before.xml` has a run of four blank paragraphs (fake vertical spacing) and a
separate single blank paragraph.

`after.xml`: the run of four collapses to one blank paragraph. The lone single
blank is left untouched — collapsing exactly-two (and single separators) is off
by default because they are often intentional; the aggressive profile enables
runs of two via the `collapseDoubles` option.

A blank paragraph here has zero text characters and anchors no drawing, so
removing it is text-neutral and cannot detach an image.
