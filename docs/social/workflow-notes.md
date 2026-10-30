# How Maeve works with Claude Code: moments worth sharing

The social media manager appends new entries here. Each entry is something concrete another builder could copy.

## 2026-10-26 to 10-29

- **She gave the AI the north star, not a spec.** "Democratize the experience of hiring a great interior designer."
  When unsure, the agents ask what a great designer would do.
- **Code names for each piece:** Space Capture, Taste Builder, Plug & Play, Transaction. Short names make long sessions
  easy to steer.
- **A self-running loop:** a timer fires every 20 minutes. Each tick, Claude does the next step, a design-critic agent
  reviews it, and a next-step agent saves a checkpoint and picks what's next. It runs until a usage limit, then picks
  back up after the reset.
- **A critic with a named bar:** "Could this be presented to Steve Jobs and Jony Ive without apology?" Later it also
  had to judge as a seasoned interior designer, grounded in a research folder the agents wrote.
- **Hard rules up front:** no installs, no commits, no paid photo reads without asking, never touch secrets. The AI
  asks before spending, and logs and caps the spending it's allowed to do (a daily cap on live conversation calls).
- **Timeframes unlock autonomy:** "I won't be looking at this for ~12 hours; do as much as you can" turned into a
  plan that ran three agents in parallel: the interview rebuild, Plug & Play, and real capture.
- **Checkpoints instead of commits:** snapshots saved to a private git ref, so nothing touches her branches.
- **Feedback in plain words:** "it looks like it was just developed by an AI thing", "fluffy, substanceless". The AI
  turned each into a standing rule for every agent, such as banned filler phrases and design notes that must be
  decisions with reasons.
- **Researching before building:** before redesigning the interview, an agent researched how real designers run
  intake consultations (60–90 minutes in person) and how style quizzes learn taste from images. Then the interview was
  rebuilt on that research.
- **Remote Control:** `/remote-control` in VS Code lets her steer the same session from the Claude app on her phone
  while the Mac stays awake.
- **One question at a time when she's around, none when she's away:** quick multiple-choice questions before she left
  (posting approval, voice, budget caps), then uninterrupted work.

## 2026-10-29 (added by the social media manager)

- **A verdict line a script can read:** every critic review ends with one line such as
  `TASTE BUILDER READY TO PRESENT: NO`. Demo round two waited for Maeve only once both Space Capture and Taste
  Builder said YES, so "done" isn't a matter of interpretation.
- **The critic re-checks the numbers, not just the pixels:** it typed 16′ 6″ × 12′, read the saved room file, and
  found the review showing 14 × 10 ft. Asking the critic to walk the flow with specific inputs catches bugs that
  screenshots alone miss.
- **Silent fallbacks hide breakage:** the live designer failed on every call for a while (the reply schema was too
  large to compile), and the page fell back to the offline script with no visible sign. The critic found it by
  calling the route directly. Rule worth copying: in dev, a fallback must label itself.
- **Licensed stand-ins before the real thing:** with no photos of her own room yet, the agents tested capture on
  CC BY photos and wrote a CREDITS.md at download time. Sample catalog data is labeled SAMPLE in the data file and in
  the UI.

## 2026-10-30 (added by the social media manager)

- **Change the structure when patches keep failing.** Read-back corrections failed two critic reviews while the code
  tried to diff a regenerated brief against the old one. The fix that held was structural: give the model the brief
  with an id on every line and accept only edit operations (replace, remove, answer an open question). Lines it
  doesn't name can't drift.
- **Make "closer to real" a number.** Each photo rebuild now renders from the photo's own camera and logs a color
  difference (mean ΔE) and an edge-match score. It turns "looks better" into a target the agents can work toward.
- **Name the feeling, not the fix.** "Think Apple" produced the system font; "tech bro startup" undid it within the
  day. Short, blunt reactions steered the visual direction faster than specs did. The agents also saved the reaction
  to memory, so later passes don't repeat it.
- **Debug the claim before the tool.** "Blender didn't work" was really Chrome turning WebGL off after crashed 3D
  tabs. The lasting fix wasn't a retry; it was a still-image fallback that says why on screen.
