# Pedagogical philosophy

The methodology behind how Dit teaches Morse. This doc is the "why" for the behavior spelled out in [APP_BEHAVIOR.md](APP_BEHAVIOR.md) — when in doubt about a product decision, start here.

## Auditory reflex over decoding

Skilled operators don't count dots and dashes. They hear a letter the same way you hear your own name — as a whole shape, not as phonemes. Dit is designed to build that reflex arc directly, so it:

- Never shows users a dit/dah chart during learning. Seeing the visual pattern is the thing that trains the *wrong* skill (count, then translate).
- Teaches the character sound first, then lets users optionally inspect the pattern in the Reference view once they've learned it.
- Treats "hearing and typing" and "feeling and sending" as the same exercise in two directions.

## Immediate Flow Recovery (IFR)

Real reception has fades, QRM, and moments where your brain just blanks. A learner who stalls on a missed character loses the next three. IFR trains the opposite habit: drop the miss, catch the next one.

In the app this is `practiceIfrMode` in Practice: a wrong answer advances immediately and queues the missed letter for later review instead of pinning the user on it. The alternative ("stay on the target") is still available because some learners want that drill at first. IFR is the goal state.

## Koch method with Farnsworth spacing

Two separate ideas, both core to Dit:

- **Koch:** start at realistic character speed (Dit defaults to 12 WPM, see `DEFAULT_CHARACTER_WPM`) with only two letters, and add a new one once the learner is solid. You never slow the characters down — muscle memory learned at 5 WPM doesn't transfer to 12.
- **Farnsworth:** keep character speed fixed but stretch the *gaps between characters* so the learner has time to think. Tighten the gaps as they get faster. This is what "effective speed" refers to in the settings.

The progression is character-speed-fixed, effective-speed-variable. Defaults are 12/8 (see `DEFAULT_EFFECTIVE_WPM`); the goal state is 12/12.

## Frequency-based character order

New letters are introduced in order of how often they appear in real QSO traffic, not alphabetically and not by visual shape. This has two effects:

- The first five letters Dit teaches (T, E, N, R, A) form real words — TEN, RAT, NET, EAT — so the very first practice session produces something that feels like language instead of gibberish.
- Common radio abbreviations (CQ, QRS, 73) become recognizable as the pack list grows, which keeps motivation high.

## Self-paced over cohort-paced

There's no "you're on lesson 4 of 20." The guided course advances in small packs, but the user decides when to add the next letter. Practice, Freestyle, and Listen are free-roam — jump in, jump out, come back tomorrow. No streak shame, no "fell behind."

The daily-goal streak (15 correct answers a day) is the only pacing signal, and it's a gentle one — designed to reward showing up, not to punish missing a day. See [APP_BEHAVIOR.md](APP_BEHAVIOR.md) for the exact rules.

## Time-to-recognize (TTR)

Latency between the sound playing and the user typing the answer is a better proxy for "has this letter clicked?" than accuracy alone. A learner can be 100% accurate and still be decoding analytically if it takes them two seconds. A fast reflex is the actual goal.

Listen mode tracks TTR per letter (`ListenTtrRecord`) and uses it to bias review toward slow letters. Letters that are both slow *and* frequently missed get the heaviest weighting in next-draw selection.

## What we deliberately don't do

- **No visual dit/dah chart during practice.** Available in Reference, hidden during the reflex-building exercises.
- **No "lessons" with fixed endings.** Every mode loops; the user decides when to stop.
- **No speed slowdown as a difficulty setting.** Character WPM is fixed; only effective WPM (gap width) adjusts. Slowing characters teaches the wrong thing.
- **No gamified punishment.** Streaks reward, they don't shame. Missing a day resets `current` but `longest` is preserved.

## References

- Koch, L. (1935). *Doctoral dissertation on the psychological aspects of learning Morse code*, Technische Hochschule Carolo-Wilhelmina zu Braunschweig. Koch's original argument that characters must be learned as whole acoustic shapes at target speed, not built up from dits and dahs. Scan and English translation: [qsantos.fr on Koch's dissertation](https://qsantos.fr/2023/09/22/koch-dissertation-on-learning-morse-code/).
- Bloom, J. (KE3Z). "A Standard for Morse Timing Using the Farnsworth Technique." *QEX* (ARRL), April 1990. The formal spec for how character-speed and effective-speed interact — the math Dit follows. [PDF via ARRL](https://www.arrl.org/files/file/Technology/x9004008.pdf).
- IFR and TTR framing in this doc come from the modern CW training community (CW Academy, Long Island CW Club) rather than a single paper. [LICW](https://longislandcwclub.org/) publishes the clearest practical writeups.

