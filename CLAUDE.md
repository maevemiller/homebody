@AGENTS.md

# Start here
Read `docs/HANDOFF.md` first. It covers what Homebody is, how to run it, where everything is documented, Maeve's
standing preferences and hard rules, the current state, and open questions. Then read `docs/BACKLOG.md` for what's
next and `docs/SESSION-HISTORY.md` for how we got here.

Before ending any session, and before anything else when usage is running low:
1. update `docs/HANDOFF.md`, `docs/BACKLOG.md` and `docs/SESSION-HISTORY.md`;
2. run `npx tsc --noEmit`;
3. commit to `homebody-build` and run `git push origin homebody-build`.

Never commit `.env*`, `data/`, `blender/assets/` or the Fontshare font files.
