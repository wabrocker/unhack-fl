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
    ? `Elections office: <a href="${esc(c.soe_url)}" rel="noopener">${esc(c.name)} County Supervisor of Elections</a>`
    : `<span class="unsourced">We don't have ${esc(c.name)} County's elections
       office on file, so we won't guess at it.
       <a href="${OFFICIAL_SOE_DIRECTORY}" rel="noopener">Find it in the state directory</a>.
       </span>`;
}

/** Escape anything from data before it touches innerHTML. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function contactBlock(c) {
  const rows = [
    ["Supervisor", esc(c.supervisor)],
    ["Website", c.soe_url ? `<a href="${esc(c.soe_url)}" rel="noopener">${esc(c.soe_url)}</a>` : null],
    ["Phone", c.soe_phone ? `<a href="tel:${esc(c.soe_phone)}">${esc(c.soe_phone)}</a>` : null],
    ["Email", c.soe_email ? `<a href="mailto:${esc(c.soe_email)}">${esc(c.soe_email)}</a>` : null],
    ["Address", esc(c.soe_address)],
  ].filter(([, v]) => v);

  return `<dl class="contact">${rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("")}</dl>
    <p class="note">Source:
      <a href="${esc(c.source)}" rel="noopener">Florida Division of Elections</a>,
      checked ${esc(c.verified)}.</p>`;
}

function onAction(kind) {
  const c = selected();
  if (!c) return;

  el.output.hidden = false;
  el.output.innerHTML =
    kind === "pollworker"
      ? `<h2>Working the polls in ${esc(c.name)} County</h2>
         <p>Poll workers are hired and trained by your county Supervisor of
         Elections — that office is who you apply to.</p>
         ${contactBlock(c)}
         <p class="unsourced">Statewide requirements (eligibility, mandatory
         pre-election training, county-set pay) still need verifying against
         current law before we state them here. Ask the office above, or see
         their site — each county publishes its own poll-worker page.</p>`
      : `<h2>A records request for ${esc(c.name)} County</h2>
         <p class="unsourced">Not built yet. This will ask what you want to
         know, then draft a Chapter 119 request in your words for you to send
         yourself. It will not send anything, and it will not decide what you
         want to ask.</p>
         ${contactBlock(c)}`;
  el.output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

init();
