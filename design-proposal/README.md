# Two Tabs, Not Three — proposed IA for the copilot

Source artboards for the design canvas at
https://claude.ai/code/artifact/889caaaa-0a07-4926-aa5a-87cf94ef85f9

Each `.dc.html` is one artboard; `canvas.json` places them. Nothing here ships —
these are mockups, drawn at 390×844 against the resolved `[data-theme="soft"]`
tokens in `src/app/copilot/copilot.css` so the proposal is comparable to the
real screen rather than to a generic phone.

| File | Screen |
| --- | --- |
| `Main.dc.html` | **Now** — the call carries the queue button; every other card is a different kind of move |
| `Queue.dc.html` | The queue opened: one draft at a time with the message visible |
| `Working.dc.html` | **Working?** — the read, then the funnel |
| `Stage.dc.html` | A funnel stage opened. This is where the Pipeline tab goes |
| `Map.dc.html` | Every current section, and where it lands |

What it argues, in short: `To send` renders on both Today and Pipeline with
different counts, "send 10 drafts" appears three times on one screen, and
Signals' "What they keep asking for" is rendering `pain_signals` — flags the
scraper sets *about* each prospect (`no_website`, `few_reviews`, `low_rating`).
Those are openings to sell against, not demand. That last one is a data bug, not
a layout one, and it also feeds `growthEdge`, the weekly write and the agent's
context pack.

To edit: change a `.dc.html`, re-run `seed-canvas.mjs` over all of them, and
republish to the same artifact URL.
