# Dit Product Decisions

Durable product decisions for Dit. This is not a changelog and should not
mirror git history. Add an entry when a decision explains product intent that
future work should preserve, especially if the same implementation could be
changed or "cleaned up" in a way that would accidentally undo that intent.

Entries should be short and written as decisions, not implementation notes:
what was decided, why it matters to the product, and what future agents should
avoid undoing.

## Decisions

- **2026-06-02: Practice correctness feedback stays color-coded.** Correct
  answers briefly tint the Practice display with `feedback.success`; missed
  answers briefly tint it with `feedback.error`. This applies to the status
  text, the target character or active word character, and the pip row. Keep the
  feedback transient and tied to answer confirmation only; green/red are not
  selection colors, reward decoration, or persistent score styling.
