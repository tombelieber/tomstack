# Batch Grill Me

Resolve consequential goal and specification decisions before implementation.
The agent inspects facts itself, then asks all currently answerable decisions
in one round with recommendations. Answers determine the next round; dependent
questions wait. Work begins after the user confirms shared understanding.

Use `$batch-grill-me <goal or spec>`, or let Auto Pilot invoke it when an outcome
is not yet pinned down. Reuse confirmed decisions rather than reopening them.
