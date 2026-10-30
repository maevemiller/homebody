# Taste Builder as a voice conversation

Maeve, 2026-10-27: Taste Builder should be an active conversation, like calling a voice agent (Sierra, Decagon,
ElevenLabs), not a click-through. Voice is the default; typing is the alternative. The question tree stays as the
agent's map, but the agent can move around it: take answers out of order, follow up, and let a story come out.

## What changes and what stays

**Stays:** the question tree in `lib/taste/questions.ts` and `walk()`. It still decides what's already known, what to
skip, which branch comes next and when the core path is done. Prefills and their "because"s, the hidden profile
(`buildProfile`) and the dev-only assumptions view also stay.

**Changes:** who walks the tree. Today the screen walks it one card at a time. Next, an agent does: it asks the next
question in its own words and hears a full spoken answer. It records whatever that answer covers (one answer can fill
three questions), and asks the tree what's next. The screen becomes the conversation's companion: live captions, the
current question with tappable choices (so voice and touch both work), and pictures where speech can't do the job,
such as the eight looks.

**The text mode** is the same conversation typed, with the same agent, tree and screen. It isn't a separate form.

## The pieces

```
Browser (/taste)                         Voice platform (hosted)              Our server
-----------------                        -----------------------              ----------
mic + speaker  <-- audio (WebRTC) -->    speech-to-text                       /api/voice/session
captions, question card, chips           turn-taking, interruptions             mints a short-lived token
client tools (run in the browser):       LLM (Claude) + agent prompt          /api/taste/summary
  get_state  -> walk(known)              text-to-speech                         after the call: Claude reads the
  record_answer(id, value, quote)                                              transcript, fills story details
  note_detail(text)  e.g. butterflies                                          and checks the recorded answers
  show(question_id)  -> card + chips
  finish()
```

- **The tree runs in the browser as tools the agent calls.** `get_state` returns what's known, the prefills with
  their "because", and the next 1–3 open questions with their choices. `record_answer` checks the value against the
  question's choices before it's saved, so the agent can't invent options. The browser state stays the single truth,
  so the screen, the profile and the "Add more later" path all keep working.
- **The agent prompt** carries the tone, and these rules:
  - one question per turn and short turns;
  - confirm a prefill as a question ("I noticed you're keeping the walnut console. Is warm mid-century still you?");
  - never read options aloud as a list longer than four;
  - never mention the profile or persona;
  - offer to stop after the core questions.
- **Flexibility comes from the agent, limits from the tree.** If someone says "it's me, my partner and our two kids,
  4 and 7", the agent records people, kids and kid ages, and the tree skips all three. If they drift into a story,
  the agent records the detail and comes back.
- **One pass with Claude after the call** (Opus, not live). It reads the whole transcript and pulls out personal-story
  details ("my grandmother loved butterflies"). It double-checks what was recorded and writes the "because" lines the
  assumptions view shows.

## Choosing a platform

| Option | What it is | Fit |
|---|---|---|
| **ElevenLabs Agents** (recommended) | Hosted voice agent: speech in and out, turn-taking, browser SDK, tools that run in the browser. Claude Sonnet 5.5 is one of its LLM choices. | The best voices, a browser-first SDK and quick to prototype. Roughly $0.08–0.10 a minute plus LLM tokens. |
| Vapi or Retell | Similar orchestration layers, mixing your own speech-to-text, LLM and voice vendors. | Also good. More knobs, and more vendors to manage. Retell and Bland lean toward phone calls. |
| Build it ourselves | Separate speech-to-text (e.g. Deepgram) + Claude + text-to-speech (ElevenLabs), connected by us. | Most control, but turn-taking and interruptions are hard to get right. Later, if cost or control demands it. |
| Speech-to-speech models (OpenAI Realtime, Gemini Live) | One model that hears and speaks. | Lowest latency, but not Claude, and harder to hold to the tree. |
| Sierra or Decagon | Enterprise customer-support agent companies, sold through sales contracts. | The right feel, wrong shape: built for support desks, not embedding in a consumer app we're prototyping. |
| Browser's built-in speech (free) | The Web Speech API in Chrome and Safari. | Fine for a free demo. The voice is robotic, there's no interrupting, and it's uneven across browsers. |

**Latency:** a conversation needs a reply within about a second. The live turns use a fast model (Claude Sonnet
5.5, or Haiku 5.5 if needed). Opus runs only on the one pass after the call.

## Making the voice sound human

Maeve, 2026-10-27: the Phase 0 voice sounds uncanny and scary. That's the browser's built-in speech
(`speechSynthesis`), which uses older system voices. Three tiers:

1. **Free, now:** pick the best voice the device has (macOS "Premium" and "Enhanced" voices are much better than
   the defaults), slow it slightly, pause between sentences, and never read symbols aloud. A real improvement, but
   it will still sound synthetic. On a Mac, Maeve can install a better voice in a minute: System Settings →
   Accessibility → Spoken Content → System voice → Manage Voices → English → **Ava (Premium)** or **Zoe (Premium)**.
2. **A neural voice, before the full agent (recommended next):** keep Phase 0's scripted turns and swap only the
   voice:
   - A server route, `/api/voice/speak`, sends each line to a neural text-to-speech service and streams the audio
     back. It uses a plain `fetch`, so no package install.
   - The key stays on the server, and repeated lines are cached so they cost nothing the second time.
   - Candidates:
     - **ElevenLabs** (the most natural, warm conversational voices; same vendor as the planned agent, so the voice
       carries over unchanged);
     - **Cartesia Sonic** (very low latency);
     - **Hume Octave** (designed for emotional delivery);
     - **OpenAI TTS** (good and inexpensive).
   - Cost is a matter of cents per conversation; check current list prices.
3. **The full agent (Phase 1):** the same voice, plus natural turn-taking and being able to interrupt it. Natural
   speech is half the voice and half the timing: short turns, small acknowledgements, not talking over people.

What makes a voice feel safe rather than eerie, whatever the vendor:
- a warm mid-range voice, not breathy or overly cheerful;
- an unhurried pace;
- sentences short enough to say in one breath;
- no filler laughter;
- the same voice every time.

We'd shortlist three voices for Maeve to pick from by ear.

## Logistics

1. **Account and key:** an ElevenLabs account, with its API key in `.env.local` as `ELEVENLABS_API_KEY`. It never
   reaches the browser: `/api/voice/session` mints a short-lived conversation token per session.
2. **The agent's setup lives in the repo:** the prompt, voice, LLM choice and tool definitions go in a file like
   `lib/taste/agent.ts`, pushed to the platform with a small script. That keeps it reviewable and versioned with
   the tree.
3. **One package install:** `@elevenlabs/react`, the browser SDK (needs Maeve's OK under the no-installs rule).
4. **The screen:**
   - First, a microphone permission step in plain words, with "I'd rather type" right there. If the mic is denied
     or unavailable, it falls back to typing automatically.
   - Then the call view: captions, the current question card with chips, a mute toggle and "Switch to typing".
5. **Saving:** answers save as they're recorded (as today), so a dropped call loses nothing and "Tell us more about
   you" resumes. Transcripts are saved per person next to their rooms.
6. **Privacy:**
   - People will share family details and stories, so tell them it's a conversation they can stop anytime.
   - Set the platform's audio and transcript retention to the minimum.
   - Never send room photos to the voice platform; it gets only text facts.
7. **Cost:**
   - A 5–8 minute interview is roughly $0.50–$1.00 all in.
   - Developing and testing it should take well under $25 of usage.
   - The after-call Claude pass is cents per conversation.
8. **Testing:** the critic stops clicking through screens and reviews conversations. It runs scripted test personas
   in text mode (same agent, no audio cost), then a few real voice calls. It checks that:
   - nothing known gets asked again;
   - out-of-order answers land in the right questions;
   - no turn runs long;
   - the story detail gets captured.

## Order of work

**Phase 0: free, no installs, can start now**
- Write the conversation layer: the agent prompt; the spoken version of each question (most prompts are already
  written to be spoken); follow-ups and how prefills get confirmed; the tool schemas wrapping `walk()`; and text
  personas for testing.
- Rebuild `/taste` as a conversation screen: captions, the question card with chips, and a text box. Script it at
  first (canned agent turns, no AI), so the look and pacing can be judged before any spending.

**Phase 1: needs Maeve's OK (account, key, one install, a small budget)**
- Connect ElevenLabs: the token route, the agent setup script, and the client tools wired to the tree.
- Run text-mode persona tests first, then real voice.

**Phase 2**
- The Claude pass after the call (story details, checking answers).
- Voice and persona tuning.
- Showing the looks as pictures during the call.
- Interruption and silence handling.

## Decisions for Maeve

1. **Platform:** ElevenLabs Agents (recommended), or another from the table. A smaller first step is the neural voice
   alone (tier 2 above): an ElevenLabs key plus a few dollars of usage, no install.
2. **Go-ahead for Phase 1:** create the account and add the key; install `@elevenlabs/react`; a testing budget
   (suggest $25).
3. **Voice:** a warm, unhurried voice (we'll shortlist 3 to pick from) and a name for the agent, or none.

Sources: [ElevenLabs client tools docs](https://elevenlabs.io/docs/agents-platform/customization/tools/client-tools),
[platform pricing comparison](https://www.morphllm.com/best-ai-voice-agent-platforms),
[all-in cost comparison](https://speechify.ai/blog/best-voice-agent-platforms-2026). Pricing is from comparison
sites and vendor blogs. Check it on the vendor's own page before signing up.
