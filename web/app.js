// unhack-fl — frontend.
//
// Two rules this file exists to enforce:
//   1. No API key here, ever. All model calls go to our own /api endpoint.
//   2. Never render a fact we don't have. A null field renders as "we
//      don't have this yet" plus the official directory link — never as a
//      guess, and never as a plausible-looking constructed URL.

const OFFICIAL_SOE_DIRECTORY =
  "https://dos.fl.gov/elections/contacts/supervisor-of-elections/";

const el = {
  county: document.getElementById("county"),
  countyNote: document.getElementById("county-note"),
  output: document.getElementById("output"),
  buttons: () => document.querySelectorAll("button[data-action]"),
};

let counties = [];

async function init() {
  try {
    const res = await fetch("../data/fl-counties.json");
    const data = await res.json();
    counties = data.counties ?? [];
  } catch {
    el.countyNote.hidden = false;
    el.countyNote.textContent =
      "Could not load county data. Reload, or use the official directory below.";
    return;
  }

  for (const c of counties) {
    const opt = document.createElement("option");
    opt.value = c.slug;
    opt.textContent = `${c.name} County`;
    el.county.append(opt);
  }

  el.county.addEventListener("change", onCountyChange);
  for (const b of el.buttons()) {
    b.addEventListener("click", () => onAction(b.dataset.action));
  }
}

function selected() {
  return counties.find((c) => c.slug === el.county.value) ?? null;
}

function onCountyChange() {
  const c = selected();
  const ready = Boolean(c);

  for (const b of el.buttons()) {
    b.disabled = !ready;
    if (ready) b.textContent = b.dataset.action === "records"
      ? "Draft a records request"
      : "See how to apply";
  }

  el.countyNote.hidden = !ready;
  if (!ready) return;

  // Honest about missing data rather than inventing a county URL.
  el.countyNote.innerHTML = c.soe_url
    ? `Elections office: <a href="${c.soe_url}">${c.soe_name}</a>`
    : `<span class="unsourced">We don't yet have ${c.name} County's
       elections office on file, so we won't guess at it.
       <a href="${OFFICIAL_SOE_DIRECTORY}">Find it in the state directory</a>.
       </span>`;
}

function onAction(kind) {
  const c = selected();
  if (!c) return;

  el.output.hidden = false;
  el.output.innerHTML =
    kind === "pollworker"
      ? `<h2>Working the polls in ${c.name} County</h2>
         <p class="unsourced">Not built yet. This will show eligibility,
         training, pay, and the application route for this county — each
         with its source — once <code>data/fl-counties.json</code> has been
         populated from the state directory.</p>`
      : `<h2>A records request for ${c.name} County</h2>
         <p class="unsourced">Not built yet. This will ask what you want to
         know, then draft a Chapter 119 request in your words for you to
         send yourself. It will not send anything, and it will not decide
         what you want to ask.</p>`;
  el.output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

init();
