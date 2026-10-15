export const INITIAL_POPULATION = 48;
const MAX_POPULATION = 120;
export const MAX_GENERATIONS = 60;

export function makeRng(seed) {
  let value = (Number(seed) >>> 0) || 1;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(seed) {
  const population = Array.from({ length: INITIAL_POPULATION }, (_, index) => ({
    id: index,
    pattern: index < INITIAL_POPULATION / 2 ? "pale" : "dark",
  }));
  return { seed: Number(seed) >>> 0, nextId: INITIAL_POPULATION, generation: 0, population, history: [snapshot(0, "pale", population)] };
}

export function snapshot(generation, habitat, population, event = null) {
  const pale = population.filter((beetle) => beetle.pattern === "pale").length;
  const dark = population.length - pale;
  return { generation, habitat, pale, dark, total: population.length, paleFraction: population.length ? pale / population.length : null, event };
}

export function advanceGeneration(run, { habitat, pressure }) {
  if (run.generation >= MAX_GENERATIONS || run.population.length === 0) return run;
  const rng = makeRng(run.seed + run.generation * 9973 + pressure * 101 + habitatCode(habitat));
  const mismatch = { pale: { pale: 0.12, dark: 0.62, mixed: 0.36 }, dark: { pale: 0.62, dark: 0.12, mixed: 0.36 } };
  const pressureFactor = [0, 0.35, 0.55, 0.74][pressure];
  const survivors = run.population.filter((beetle) => rng() > mismatch[beetle.pattern][habitat] * pressureFactor);
  // Predation is final for this generation: no detected organism can re-enter the population.
  const safeSurvivors = survivors;
  const target = Math.min(MAX_POPULATION, Math.max(30, Math.round(44 + rng() * 12)));
  const offspring = [];
  let nextId = run.nextId;
  while (safeSurvivors.length > 0 && safeSurvivors.length + offspring.length < target) {
    const parent = safeSurvivors[Math.floor(rng() * safeSurvivors.length)];
    // Small, need-independent variation keeps both inherited patterns possible.
    const pattern = rng() < 0.035 ? (parent.pattern === "pale" ? "dark" : "pale") : parent.pattern;
    offspring.push({ id: nextId++, pattern });
  }
  const population = [...safeSurvivors, ...offspring];
  const generation = run.generation + 1;
  const eaten = run.population.length - safeSurvivors.length;
  const event = { eaten, survived: safeSurvivors.length, offspring: offspring.length };
  return { ...run, nextId, generation, population, history: [...run.history, snapshot(generation, habitat, population, event)] };
}

function habitatCode(habitat) {
  return { pale: 17, dark: 31, mixed: 53 }[habitat];
}
