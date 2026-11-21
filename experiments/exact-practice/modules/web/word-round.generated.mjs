// ../../../dit/packages/core/src/utils/listenPhrases.ts
var getEligibleListenPhrases = (phrases, availableLetters) => {
  const available = new Set(availableLetters);
  return phrases.filter((phrase) => [...phrase.text].every((character) => character === " " || available.has(character)));
};
var pickIndex = (length, random) => Math.min(length - 1, Math.floor(random() * length));
var shuffle = (values, random) => {
  const next = [...values];
  for (let index = next.length - 1;index > 0; index -= 1) {
    const swapIndex = pickIndex(index + 1, random);
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }
  return next;
};
var createListenPhraseRound = (phrases, options = {}) => {
  if (phrases.length < 4) {
    return null;
  }
  const random = options.random ?? Math.random;
  const targetPool = phrases.filter((phrase) => phrase.id !== options.previousTargetId);
  const target = targetPool[pickIndex(targetPool.length, random)];
  const sameDifficulty = phrases.filter((phrase) => phrase.id !== target.id && phrase.difficulty === target.difficulty);
  const otherDifficulties = phrases.filter((phrase) => phrase.id !== target.id && phrase.difficulty !== target.difficulty);
  const distractors = [
    ...shuffle(sameDifficulty, random),
    ...shuffle(otherDifficulties, random)
  ].slice(0, 3);
  return {
    target,
    options: shuffle([target, ...distractors], random)
  };
};
export {
  createListenPhraseRound,
  getEligibleListenPhrases
};
