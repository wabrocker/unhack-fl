// unhack-fl — frontend.
//
// Two rules this file exists to enforce:
//   1. No API key here, ever. All model calls go to our own /api endpoint.
//   2. Never render a fact we don't have. A null field renders as "we
//      don't have this yet" plus the official directory link — never as a
//      guess, and never as a plausible-looking constructed URL.

const OFFICIAL_SOE_DIRECTORY =
  "https://dos.fl.gov/elections/contacts/supervisor-of-elections/";

// Relative so it works wherever the site is mounted. On Hostinger this
// resolves to /api/index.php; locally, run `php -S localhost:8781 -t .`
// from the repo root (python's http.server will not execute PHP).
const API_BASE = "../api/";

const el = {
  county: document.getElementById("county"),
  countyNote: document.getElementById("county-note"),
  output: document.getElementById("output"),
  recordsForm: document.getElementById("records-form"),
  form: document.getElementById("records"),
  agency: document.getElementById("agency"),
  agencyHint: document.getElementById("agency-hint"),
  want: document.getElementById("want"),
  submit: document.getElementById("records-submit"),
  status: document.getElementById("records-status"),
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
  el.form?.addEventListener("submit", onRecordsSubmit);
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
      : "";

  if (kind === "records") {
    el.output.hidden = true;
    el.recordsForm.hidden = false;
    el.agencyHint.textContent =
      `In ${c.name} County. If the records are held by the elections office, that's ${c.supervisor}.`;
    el.recordsForm.scrollIntoView({ behavior: "smooth", block: "start" });
    el.agency.focus();
    return;
  }

  el.recordsForm.hidden = true;
  el.output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function onRecordsSubmit(event) {
  event.preventDefault();
  const c = selected();
  if (!c) return;

  const agency = el.agency.value.trim();
  const want = el.want.value.trim();
  if (!agency || !want) return;

  el.submit.disabled = true;
  el.status.textContent = "Drafting…";
  el.output.hidden = true;

  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "records_request",
        county: c.name,
        agency,
        want,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      showError(data.error || "Something went wrong. Try again in a moment.");
      return;
    }
    showDraft(c, data.text);
  } catch {
    showError("Could not reach the service. Check your connection and retry.");
  } finally {
    el.submit.disabled = false;
    el.status.textContent = "";
  }
}

function showError(message) {
  el.output.hidden = false;
  el.output.innerHTML = `<p class="unsourced">${esc(message)}</p>`;
  el.output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showDraft(c, text) {
  el.output.hidden = false;
  el.output.innerHTML = `
    <h2>Your draft</h2>
    <p>
      This is a starting point, not a finished letter. Read it, change
      anything that isn't how you'd put it, then send it yourself — we
      don't send anything on your behalf.
    </p>
    <textarea id="draft" rows="18" spellcheck="true"></textarea>
    <p>
      <button type="button" id="copy">Copy</button>
      <span class="hint" id="copy-status" role="status"></span>
    </p>
    <p class="note">
      Chapter 119 sets no express deadline; the agency gets a reasonable
      time to retrieve, review, and redact. Send it to
      ${c.soe_email
        ? `the office that holds the records — for elections records in ${esc(c.name)} County that's <a href="mailto:${esc(c.soe_email)}">${esc(c.soe_email)}</a>.`
        : "the office that holds the records."}
    </p>`;

  // Set as value, never innerHTML — model output is never parsed as markup.
  document.getElementById("draft").value = text;

  document.getElementById("copy").addEventListener("click", async () => {
    const status = document.getElementById("copy-status");
    try {
      await navigator.clipboard.writeText(document.getElementById("draft").value);
      status.textContent = "Copied.";
    } catch {
      status.textContent = "Press ⌘C to copy.";
      document.getElementById("draft").select();
    }
    setTimeout(() => (status.textContent = ""), 3000);
  });

  el.output.scrollIntoView({ behavior: "smooth", block: "start" });
}

init();
