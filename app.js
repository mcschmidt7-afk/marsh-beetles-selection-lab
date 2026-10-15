import { advanceGeneration, createRun, MAX_GENERATIONS } from "./model.js";

const $ = (selector) => document.querySelector(selector);
const initialChartStyle = { pale: "#b8862c", dark: "#285c57", darkDash: "7 4" };
const state = { habitat: "pale", pressure: 2, running: false, runToken: 0, seed: seedFromLocation(), prediction: "", run: null, chartSelection: [], chartStyle: { ...initialChartStyle }, chartDraft: { ...initialChartStyle } };
state.run = createRun(state.seed);

const habitatLabels = { pale: "pale dry silt", dark: "dark wet sediment", mixed: "mixed marsh" };
const habitatHints = {
  pale: "On pale silt, dark grey beetles tend to stand out more.",
  dark: "On dark sediment, pale beetles tend to stand out more.",
  mixed: "A mixed marsh gives neither beetle pattern the same background everywhere.",
};
const pressureLabels = { 1: "Low", 2: "Medium", 3: "High" };

const references = {
  marsh: $("#marsh"), field: $("#beetle-field"), eventCard: $("#event-card"), generation: $("#generation-badge"),
  total: $("#total-count"), pale: $("#pale-count"), dark: $("#dark-count"), paleBar: $("#pale-bar"), darkBar: $("#dark-bar"),
  palePercent: $("#pale-percent"), darkPercent: $("#dark-percent"), outcome: $("#outcome-copy"), history: $("#history-body"),
  chart: $("#chart"), chartPanel: $(".chart-panel"), chartSelection: $("#chart-selection"), clearChartSelection: $("#clear-chart-selection"), expandChart: $("#expand-chart"), paleColor: $("#pale-color"), darkColor: $("#dark-color"), darkDash: $("#dark-dash"), updateChart: $("#update-chart"), graphStyleStatus: $("#graph-style-status"), finch: $("#finch-flyover"), seed: $("#seed-readout"), pressure: $("#pressure"), pressureOutput: $("#pressure-output"), habitatHint: $("#habitat-hint"), reflection: $("#reflection-prompt"), prediction: $("#prediction"),
  step: $("#step-button"), run: $("#run-button"), reset: $("#reset-button"), trial: $("#new-trial-button"),
};

function seedFromLocation() {
  const value = new URLSearchParams(location.search).get("seed");
  return value && /^\d+$/.test(value) ? Number(value) >>> 0 : Math.floor(Math.random() * 2 ** 32) >>> 0;
}

function render() {
  const current = state.run.history.at(-1);
  const palePercent = current.paleFraction === null ? 0 : Math.round(current.paleFraction * 100);
  const complete = state.run.population.length === 0 || current.generation >= MAX_GENERATIONS;
  references.marsh.className = `marsh ${state.habitat}`;
  references.generation.textContent = `Generation ${current.generation}`;
  references.generation.setAttribute("aria-label", `Generation ${current.generation}`);
  references.total.textContent = current.total;
  references.pale.textContent = current.pale;
  references.dark.textContent = current.dark;
  references.paleBar.style.width = current.total ? `${palePercent}%` : "0%";
  references.darkBar.style.width = current.total ? `${100 - palePercent}%` : "0%";
  references.darkBar.style.flex = current.total ? "1" : "0";
  references.palePercent.textContent = current.total ? `${palePercent}% pale` : "No surviving beetles";
  references.darkPercent.textContent = current.total ? `${100 - palePercent}% dark grey` : "";
  references.seed.textContent = state.seed;
  references.pressureOutput.textContent = pressureLabels[state.pressure];
  references.habitatHint.textContent = habitatHints[state.habitat];
  references.field.replaceChildren(...currentVisuals(state.run.population));
  references.history.replaceChildren(...state.run.history.map(row));
  renderChart(state.run.history);
  const event = current.event;
  references.eventCard.textContent = complete
    ? (current.total === 0 ? "The population ended. Reset or start a new trial." : `This trial stops at generation ${MAX_GENERATIONS}. Reset or start a new trial.`)
    : event
    ? `${event.eaten} detected · ${event.survived} survived · ${event.offspring} offspring`
    : "Choose a habitat, then run a generation.";
  references.outcome.textContent = event
    ? generationSentence(current, event)
    : "Start with 48 beetles: equal numbers of each inherited pattern.";
  document.querySelectorAll(".choice").forEach((button) => {
    const selected = button.dataset.habitat === state.habitat;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  references.step.disabled = state.running || complete;
  references.run.disabled = state.running || complete;
  document.querySelectorAll(".choice").forEach((button) => { button.disabled = state.running; });
  references.pressure.disabled = state.running;
  references.clearChartSelection.disabled = state.chartSelection.length === 0;
  references.updateChart.disabled = chartStylesMatch();
  references.reflection.textContent = current.generation
    ? reflectionText(current)
    : "After you run a generation, use two values in the table to support or revise your prediction. Did any individual change pattern during its lifetime?";
}

function reflectionText(current) {
  const prediction = state.prediction === "" ? "No prediction was saved." : `Your prediction: ${state.prediction === "same" ? "neither beetle pattern may change much" : state.prediction === "pale" ? "pale speckled beetles may increase" : "dark grey speckled beetles may increase"}.`;
  return `${prediction} Compare generation 0 with generation ${current.generation} in the table. Explain how inherited variation, detection, and reproduction could account for the population pattern. No individual changed its pattern during this run.`;
}

function generationSentence(current, event) {
  if (current.total === 0) return `Generation ${current.generation} in ${habitatLabels[current.habitat]}: all beetles were detected. No organisms survived to reproduce, so this population ended.`;
  const dominant = current.paleFraction > 0.55 ? "pale" : current.paleFraction < 0.45 ? "dark" : "neither";
  const phrase = dominant === "neither" ? "Neither beetle pattern is clearly more common yet." : dominant === "pale" ? "Pale speckled beetles are now more common." : "Dark grey speckled beetles are now more common.";
  return `Generation ${current.generation} in ${habitatLabels[current.habitat]}: ${event.eaten} were detected, then survivors produced ${event.offspring} offspring. ${phrase}`;
}

function currentVisuals(population) {
  const sample = shuffle(population, state.run.generation + state.seed).slice(0, 48);
  return sample.map((beetle, index) => {
    const node = document.createElement("span");
    node.className = `beetle ${beetle.pattern}`;
    node.style.setProperty("--x", `${5 + ((index * 37) % 90)}%`);
    node.style.setProperty("--y", `${18 + ((index * 61) % 66)}%`);
    node.style.setProperty("--delay", `${(index % 9) * -0.17}s`);
    return node;
  });
}

function shuffle(items, seed) {
  const copy = [...items];
  let value = seed >>> 0;
  for (let index = copy.length - 1; index > 0; index--) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const other = value % (index + 1);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function row(item) {
  const tr = document.createElement("tr");
  if (state.chartSelection.some((point) => point.generation === item.generation)) tr.classList.add("chart-selected");
  tr.dataset.generation = item.generation;
  const values = [item.generation, habitatLabels[item.habitat], item.pale, item.dark, item.total, item.paleFraction === null ? "—" : `${Math.round(item.paleFraction * 100)}%`];
  values.forEach((value) => { const cell = document.createElement("td"); cell.textContent = value; tr.append(cell); });
  return tr;
}

function renderChart(history) {
  const width = 600, height = 300, left = 58, right = 22, top = 30, bottom = 52;
  const usableWidth = width - left - right, usableHeight = height - top - bottom;
  const maxGeneration = Math.max(1, history.at(-1).generation);
  references.chart.style.minWidth = maxGeneration > 30 ? `${Math.max(600, (maxGeneration + 1) * 18)}px` : "";
  references.chartPanel.classList.toggle("dense-chart", maxGeneration > 30);
  const x = (generation) => left + (generation / maxGeneration) * usableWidth;
  const y = (value) => top + (1 - value) * usableHeight;
  const plotted = history.filter((entry) => entry.paleFraction !== null);
  const fraction = (entry, series) => series === "pale" ? entry.paleFraction : 1 - entry.paleFraction;
  const line = (series) => plotted.map((entry) => `${x(entry.generation)},${y(fraction(entry, series))}`).join(" ");
  const ticks = [0, .25, .5, .75, 1];
  const xTicks = [...new Set([0, Math.round(maxGeneration / 4), Math.round(maxGeneration / 2), Math.round(maxGeneration * .75), maxGeneration])];
  const selected = selectedRange();
  const habitatChanges = history.filter((entry, index) => index > 0 && entry.habitat !== history[index - 1].habitat);
  const point = (entry, series) => {
    const value = fraction(entry, series), isSelected = state.chartSelection.some((item) => item.generation === entry.generation && item.series === series);
    const label = `${series === "pale" ? "Pale speckled" : "Dark grey speckled"} beetles, generation ${entry.generation}: ${Math.round(value * 100)} percent, ${series === "pale" ? entry.pale : entry.dark} of ${entry.total}.`;
    const marker = series === "pale" ? `<circle class="point-mark pale-dot" fill="${state.chartStyle.pale}" cx="${x(entry.generation)}" cy="${y(value)}" r="4"/>` : `<rect class="point-mark dark-square" fill="${state.chartStyle.dark}" x="${x(entry.generation) - 4}" y="${y(value) - 4}" width="8" height="8"/>`;
    const tabIndex = entry.generation === 0 && series === "pale" ? 0 : -1;
    return `<g class="chart-point ${isSelected ? "selected-point" : ""}" role="button" tabindex="${tabIndex}" data-generation="${entry.generation}" data-series="${series}" aria-label="${label}"><title>${label}</title><circle class="point-hit" cx="${x(entry.generation)}" cy="${y(value)}" r="6" fill="transparent"/>${marker}</g>`;
  };
  const band = selected ? `<rect class="range-band" x="${Math.min(x(selected.start.generation), x(selected.end.generation))}" y="${top}" width="${Math.abs(x(selected.end.generation) - x(selected.start.generation))}" height="${usableHeight}"/>` : "";
  references.chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  references.chart.innerHTML = `
    <title id="chart-title">Pale and dark grey beetle proportions by generation</title>
    <desc id="chart-description">${chartText(history)}</desc>
    <text class="axis-label" x="${left + usableWidth / 2}" y="${height - 7}" text-anchor="middle">Generation</text>
    <text class="axis-label" transform="translate(13 ${top + usableHeight / 2}) rotate(-90)" text-anchor="middle">Population (%)</text>
    <g class="grid">${ticks.map((tick) => `<line x1="${left}" y1="${y(tick)}" x2="${width - right}" y2="${y(tick)}"/><text x="${left - 8}" y="${y(tick) + 4}" text-anchor="end">${tick * 100}%</text>`).join("")}</g>
    ${band}
    ${habitatChanges.map((entry, index) => `<g class="annotation"><line x1="${x(entry.generation)}" y1="${top}" x2="${x(entry.generation)}" y2="${top + usableHeight}"/><text x="${Math.min(x(entry.generation) + 4, width - right - 6)}" y="${top + 12 + (index % 3) * 12}">Gen. ${entry.generation}: ${habitatLabels[entry.habitat]}</text></g>`).join("")}
    <polyline class="line pale-line" stroke="${state.chartStyle.pale}" points="${line("pale")}"/><polyline class="line dark-line" stroke="${state.chartStyle.dark}" stroke-dasharray="${state.chartStyle.darkDash}" points="${line("dark")}"/>
    ${plotted.map((entry) => point(entry, "pale") + point(entry, "dark")).join("")}
    <line x1="${left}" y1="${top + usableHeight}" x2="${width - right}" y2="${top + usableHeight}" stroke="#58716c"/>
    <line x1="${left}" y1="${top}" x2="${left}" y2="${top + usableHeight}" stroke="#58716c"/>
    ${xTicks.map((tick) => `<text x="${x(tick)}" y="${top + usableHeight + 16}" text-anchor="middle">${tick}</text>`).join("")}`;
  renderSelectionText(history);
  references.chart.querySelectorAll(".chart-point").forEach((point) => {
    point.addEventListener("click", () => selectChartPoint(point));
    point.addEventListener("keydown", handleChartPointKeydown);
  });
}

function chartText(history) {
  const start = history[0], end = history.at(-1);
  return end.paleFraction === null
    ? `The population ended at generation ${end.generation}; no trait proportion remains. The run began at ${Math.round(start.paleFraction * 100)} percent pale.`
    : `At generation ${end.generation}, ${Math.round(end.paleFraction * 100)} percent of ${end.total} beetles are pale speckled. The run began at ${Math.round(start.paleFraction * 100)} percent.`;
}

function selectedRange() {
  if (state.chartSelection.length !== 2) return null;
  const [first, second] = [...state.chartSelection].sort((a, b) => a.generation - b.generation);
  return first.generation === second.generation || first.series !== second.series ? null : { start: first, end: second };
}

function renderSelectionText(history) {
  const range = selectedRange();
  if (!range) {
    references.chartSelection.textContent = state.chartSelection.length ? "Choose a second point for the same beetle pattern in a different generation." : "Select two points for the same beetle pattern to compare an average change across generations.";
    return;
  }
  const start = history.find((entry) => entry.generation === range.start.generation), end = history.find((entry) => entry.generation === range.end.generation);
  if (!start || !end || start.paleFraction === null || end.paleFraction === null) { references.chartSelection.textContent = "Slope is unavailable because an endpoint has no surviving population."; return; }
  const value = (entry) => range.start.series === "pale" ? entry.paleFraction : 1 - entry.paleFraction;
  const slope = ((value(end) - value(start)) * 100) / (end.generation - start.generation);
  const habitats = new Set(history.filter((entry) => entry.generation >= start.generation && entry.generation <= end.generation).map((entry) => entry.habitat));
  const name = range.start.series === "pale" ? "Pale speckled beetles" : "Dark grey speckled beetles";
  references.chartSelection.textContent = `${name}: generation ${start.generation} (${Math.round(value(start) * 100)}%) to generation ${end.generation} (${Math.round(value(end) * 100)}%). Average change: ${slope >= 0 ? "+" : ""}${slope.toFixed(1)} percentage points per generation.${habitats.size > 1 ? " This range spans multiple habitat backgrounds, so it cannot isolate habitat’s effect." : ""} This describes the population trend, not an individual changing.`;
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const FINCH_FLYOVER_MS = 1900;

async function playFlyover(token) {
  if (reducedMotion()) return token === state.runToken;
  references.eventCard.textContent = "Finches pass over the marsh; the model is applying its detection step.";
  references.finch.classList.add("active");
  await wait(FINCH_FLYOVER_MS);
  references.finch.classList.remove("active");
  return token === state.runToken;
}

async function advanceOne(token) {
  if (state.run.population.length === 0 || state.run.generation >= MAX_GENERATIONS) return false;
  if (!await playFlyover(token)) return false;
  state.run = advanceGeneration(state.run, { habitat: state.habitat, pressure: state.pressure });
  render();
  await wait(reducedMotion() ? 90 : 120);
  return token === state.runToken;
}

async function advance() {
  if (state.running) return;
  state.running = true;
  const token = ++state.runToken;
  render();
  await advanceOne(token);
  if (token === state.runToken) { state.running = false; render(); }
}

async function runSeveral() {
  if (state.running) return;
  state.running = true; render();
  const token = ++state.runToken;
  for (let step = 0; step < 6; step++) {
    if (!await advanceOne(token)) break;
  }
  if (token === state.runToken) { state.running = false; render(); }
}

document.querySelectorAll(".choice").forEach((button) => button.addEventListener("click", () => { state.habitat = button.dataset.habitat; render(); }));
references.pressure.addEventListener("input", () => { state.pressure = Number(references.pressure.value); render(); });
references.prediction.addEventListener("change", () => { state.prediction = references.prediction.value; render(); });
references.step.addEventListener("click", advance);
references.run.addEventListener("click", runSeveral);
function cancelActiveRun() { state.runToken++; state.running = false; references.finch.classList.remove("active"); }
references.reset.addEventListener("click", () => { cancelActiveRun(); state.chartSelection = []; state.run = createRun(state.seed); render(); });
references.trial.addEventListener("click", () => { cancelActiveRun(); state.chartSelection = []; state.seed = Math.floor(Math.random() * 2 ** 32) >>> 0; state.prediction = ""; references.prediction.value = ""; state.run = createRun(state.seed); history.replaceState({}, "", `${location.pathname}?seed=${state.seed}`); render(); });
references.clearChartSelection.addEventListener("click", () => { state.chartSelection = []; render(); });
references.expandChart.addEventListener("click", () => { const expanded = references.chartPanel.classList.toggle("expanded"); references.expandChart.setAttribute("aria-expanded", String(expanded)); references.expandChart.textContent = expanded ? "Collapse graph" : "Expand graph"; });
function chartStylesMatch() {
  return state.chartStyle.pale === state.chartDraft.pale && state.chartStyle.dark === state.chartDraft.dark && state.chartStyle.darkDash === state.chartDraft.darkDash;
}

function updateChartDraft() {
  const wasMatching = chartStylesMatch();
  state.chartDraft = { pale: references.paleColor.value, dark: references.darkColor.value, darkDash: references.darkDash.value };
  const matches = chartStylesMatch();
  references.updateChart.disabled = matches;
  if (wasMatching && !matches) references.graphStyleStatus.textContent = "Style changes ready. Select Update graph to apply.";
}

references.paleColor.addEventListener("change", updateChartDraft);
references.darkColor.addEventListener("change", updateChartDraft);
references.darkDash.addEventListener("change", updateChartDraft);
references.updateChart.addEventListener("click", () => {
  state.chartStyle = { ...state.chartDraft };
  render();
  const paleName = references.paleColor.options[references.paleColor.selectedIndex].text;
  const darkName = references.darkColor.options[references.darkColor.selectedIndex].text;
  const dashName = references.darkDash.options[references.darkDash.selectedIndex].text.toLowerCase();
  references.graphStyleStatus.textContent = `Graph updated: Pale ${paleName}, Dark Grey ${darkName}, ${dashName}.`;
  requestAnimationFrame(() => references.updateChart.focus());
});
function handleChartPointKeydown(event) {
  const point = event.currentTarget;
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectChartPoint(point); return; }
  if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    const points = [...references.chart.querySelectorAll(".chart-point")];
    const current = points.indexOf(point), direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    points[(current + direction + points.length) % points.length]?.focus();
  }
}

function selectChartPoint(element) {
  const point = { generation: Number(element.dataset.generation), series: element.dataset.series };
  const existing = state.chartSelection.findIndex((item) => item.generation === point.generation && item.series === point.series);
  if (existing >= 0) state.chartSelection.splice(existing, 1);
  else if (state.chartSelection.length === 0 || state.chartSelection[0].series === point.series) {
    if (state.chartSelection.length === 2) state.chartSelection = [point];
    else state.chartSelection.push(point);
  } else state.chartSelection = [point];
  render();
  references.chart.querySelector(`.chart-point[data-generation="${point.generation}"][data-series="${point.series}"]`)?.focus();
  const selectedRow = references.history.querySelector(`tr[data-generation="${point.generation}"]`);
  selectedRow?.scrollIntoView({ block: "nearest" });
}
$("#copy-seed-button").addEventListener("click", async () => { try { await navigator.clipboard.writeText(String(state.seed)); } catch { /* clipboard permission is optional */ } });
$("#simplifications-button").addEventListener("click", (event) => { const panel = $("#simplifications"); panel.hidden = !panel.hidden; event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden)); });
render();
