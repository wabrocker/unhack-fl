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
  filter: document.getElementById("county-filter"),
  filterStatus: document.getElementById("filter-status"),
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

// Which panel is currently on screen, so a county change can refresh it
// rather than leaving another county's details showing.
let shownAction = null;

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

  renderCountyOptions(counties);

  el.county.addEventListener("change", onCountyChange);
  el.filter?.addEventListener("input", onFilter);
  el.filter?.addEventListener("keydown", (e) => {
    // Enter picks the county outright when the filter has narrowed to one.
    if (e.key !== "Enter") return;
    e.preventDefault();
    const opts = [...el.county.options].filter((o) => o.value);
    if (opts.length !== 1) return;

    el.county.value = opts[0].value;

    // Enter is a decision, so the filter has done its job — clear it and
    // restore the full list. Picking from the dropdown deliberately does
    // NOT do this: the narrowed list stays put so a mis-click is one click
    // to correct rather than a re-type.
    el.filter.value = "";
    renderCountyOptions(counties);
    el.filterStatus.textContent = "";

    onCountyChange();
    el.county.focus();
  });
  for (const b of el.buttons()) {
    b.addEventListener("click", () => onAction(b.dataset.action));
  }
  el.form?.addEventListener("submit", onRecordsSubmit);

  // Circled-"i" disclosures. The panels live below the card grid, not
  // inside the cards — otherwise opening one stretches its grid row and
  // shoves the neighbouring card's button down.
  const toggles = [...document.querySelectorAll(".info-toggle")];
  for (const btn of toggles) {
    btn.addEventListener("click", () => {
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) return;
      const open = btn.getAttribute("aria-expanded") === "true";

      // Only one open at a time — two long panels stacked is a wall of text.
      for (const other of toggles) {
        other.setAttribute("aria-expanded", "false");
        const op = document.getElementById(other.getAttribute("aria-controls"));
        if (op) op.hidden = true;
      }

      if (!open) {
        btn.setAttribute("aria-expanded", "true");
        panel.hidden = false;
        // Inline field help opens right next to its label; scrolling it
        // would yank the form out from under the reader.
        if (!btn.hasAttribute("data-noscroll")) {
          panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    });
  }
}

/**
 * Normalise for matching: "St. Johns", "st johns" and "saint johns" should
 * all find the same county, and "miami dade" should find Miami-Dade.
 */
function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/\bsaint\b/g, "st")
    // Drop punctuation AND spaces, so "miami dade", "miami-dade",
    // "de soto" and "st johns" all match their county.
    .replace(/[^a-z0-9]/g, "");
}

function renderCountyOptions(list) {
  const keep = el.county.value;
  el.county.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = list.length
    ? "Select a county…"
    : "No county matches that";
  el.county.append(placeholder);

  for (const c of list) {
    const opt = document.createElement("option");
    opt.value = c.slug;
    opt.textContent = `${c.name} County`;
    el.county.append(opt);
  }

  // Preserve the current choice if it survived the filter.
  el.county.value = list.some((c) => c.slug === keep) ? keep : "";
}

function onFilter() {
  const q = norm(el.filter.value);
  const list = q ? counties.filter((c) => norm(c.name).includes(q)) : counties;
  const before = el.county.value;

  renderCountyOptions(list);

  el.filterStatus.textContent = !q
    ? ""
    : list.length === 0
      ? "No county matches that."
      : list.length === 1
        ? `${list[0].name} County — press Enter to choose it.`
        : `${list.length} counties match.`;

  // Filtering away the chosen county must tear down its panels too.
  if (before && el.county.value !== before) onCountyChange();
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

  if (!ready) {
    // Back to "Select a county…" — tear everything down.
    el.recordsForm.hidden = true;
    el.output.hidden = true;
    el.output.innerHTML = "";
    shownAction = null;
    return;
  }

  // A panel from the previous county may still be on screen.
  if (shownAction === "pollworker") {
    // Pure display of county data — just re-render for the new county.
    renderPollWorker(c);
  } else if (!el.recordsForm.hidden) {
    // Keep the hint in step, and drop any draft rather than leaving a
    // letter addressed to the county the user just navigated away from.
    setAgencyHint(c);
    el.output.hidden = true;
    el.output.innerHTML = "";
  }

  // Honest about missing data rather than inventing a county URL.
  el.countyNote.innerHTML = c.soe_url
    ? `Elections office: <a href="${esc(c.soe_url)}" rel="noopener">${esc(c.name)} County Supervisor of Elections</a>`
    : `<span class="unsourced">We don't have ${esc(c.name)} County's elections
       office on file, so we won't guess at it.
       <a href="${OFFICIAL_SOE_DIRECTORY}" rel="noopener">Find it in the state directory</a>.
       </span>`;
}

/** Single place that writes the county hint, so it can't drift. */
function setAgencyHint(c) {
  el.agencyHint.textContent =
    `In ${c.name} County. If the records are held by the elections office, ` +
    `that's ${c.supervisor}.`;
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

/** Renders the poll-worker panel for a county. Safe to call repeatedly. */
function renderPollWorker(c) {
  // The county's own poll-worker page, when one was found on their site —
  // never a URL guessed from their domain.
  const apply = c.poll_worker_url
    ? `<p class="apply">
         <a class="btn-secondary" href="${esc(c.poll_worker_url)}" rel="noopener">
           ${esc(c.name)} County's poll worker page →
         </a>
       </p>
       <p class="note">Found on the county's own site${
         c.poll_worker_verified ? `, checked ${esc(c.poll_worker_verified)}` : ""
       }.</p>`
    // Nothing found: show nothing. The heading, the office contacts, and
    // the county website link below already give a next step — an apology
    // for a link we don't have would only add noise.
    : "";

  el.output.hidden = false;
  el.output.innerHTML = `
    <h2>Working the polls in ${esc(c.name)} County</h2>
    <p>Poll workers are hired and trained by your county Supervisor of
    Elections — that office is who you apply to.</p>
    ${apply}
    ${contactBlock(c)}
    <p class="note">Eligibility, training, and pay are set county by county
    and change between elections. Treat the county page and the office
    itself as authoritative over anything summarised here.</p>`;
}

function onAction(kind) {
  const c = selected();
  if (!c) return;

  shownAction = kind;

  if (kind === "records") {
    el.output.hidden = true;
    el.output.innerHTML = "";
    el.recordsForm.hidden = false;
    setAgencyHint(c);
    el.recordsForm.scrollIntoView({ behavior: "smooth", block: "start" });
    el.agency.focus();
    return;
  }

  el.recordsForm.hidden = true;
  renderPollWorker(c);
  el.output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * Build the letter here, in the browser. No network, no API key, no cost,
 * and nothing to hallucinate — the only free text is what the user wrote.
 * The AI step below is an optional improvement to one paragraph, never a
 * prerequisite for getting a usable request.
 */
function buildLetter({ agency, want, name, email, county }) {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return `${today}

To: ${agency}
${county} County, Florida

Re: Public records request under Chapter 119, Florida Statutes

Dear Records Custodian,

Under Chapter 119, Florida Statutes, and Article I, Section 24 of the
Florida Constitution, I am requesting copies of the following public
records:

${want}

A few notes to make this easier to fulfill:

- If any part of these records is exempt from disclosure, please provide
  the remainder and identify the exemption relied on for each withheld
  portion.
- Electronic copies are fine, and preferred — PDF or the records' native
  format, sent to the email address below.
- If fulfilling this request will involve a charge, please contact me with
  an estimate before doing the work, rather than proceeding.

I understand Chapter 119 does not set a specific deadline, and that you
are entitled to a reasonable time to locate the records, review them, and
redact anything exempt. A brief acknowledgment that you have received this
request would be appreciated.

Thank you for your time.

${name}
${email}

---
Formatted with Unhack FL (fl.unhackdemocracy.us), a free tool that puts
public records requests into the form agencies can act on: a named
custodian, specific records, a date range, exemption citations, and a cost
estimate before charges. That describes this request, not the requester —
no identity check was performed, and Chapter 119 does not require one.`;
}

function currentInputs() {
  const c = selected();
  return {
    county: c ? c.name : "",
    agency: el.agency.value.trim(),
    want: el.want.value.trim(),
    name: document.getElementById("yourname").value.trim(),
    email: document.getElementById("youremail").value.trim(),
  };
}

function onRecordsSubmit(event) {
  event.preventDefault();
  const c = selected();
  if (!c) return;

  const inputs = currentInputs();
  if (!inputs.agency || !inputs.want || !inputs.name || !inputs.email) return;

  showDraft(c, buildLetter(inputs), inputs);
}

/**
 * Optional: ask the server to make the *records description* more
 * specific. Only that paragraph — the rest of the letter stays
 * deterministic. Silently disables itself if the endpoint isn't
 * configured, so the tool works fine with no API account at all.
 */
async function onSharpen(c, inputs) {
  const btn = document.getElementById("sharpen");
  const status = document.getElementById("sharpen-status");
  btn.disabled = true;
  status.textContent = "Working…";

  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "sharpen_description",
        county: inputs.county,
        agency: inputs.agency,
        want: inputs.want,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!data.ok) {
      // Unconfigured or out of credit: hide the option for this session
      // rather than nagging. The template already did the real work.
      sessionStorage.setItem("sharpenOff", "1");
      btn.remove();
      status.textContent = "";
      const note = document.getElementById("sharpen-note");
      if (note) {
        note.textContent =
          "The optional rewrite isn't available right now. Your request above is complete and ready to send.";
      }
      return;
    }

    document.getElementById("draft").value = buildLetter({
      ...inputs,
      want: data.text.trim(),
    });
    status.textContent = "Rewritten — read it before sending.";
  } catch {
    status.textContent = "Couldn't reach the rewriter. Your request is still fine.";
  } finally {
    btn.disabled = false;
    setTimeout(() => (status.textContent = ""), 6000);
  }
}

function showError(message) {
  el.output.hidden = false;
  el.output.innerHTML = `<p class="unsourced">${esc(message)}</p>`;
  el.output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showDraft(c, text, inputs) {
  const sharpenOff = sessionStorage.getItem("sharpenOff") === "1";

  el.output.hidden = false;
  el.output.innerHTML = `
    <h2>Your request</h2>
    <p>
      Ready to send. Read it, change anything that isn't how you'd put it,
      then send it yourself — we don't send anything on your behalf.
    </p>
    <textarea id="draft" rows="22" spellcheck="true"></textarea>
    <p>
      <button type="button" id="copy">Copy</button>
      ${c.soe_email
        ? `<a class="btn-secondary" id="mailto" href="#">Open in email</a>`
        : ""}
      <span class="hint" id="copy-status" role="status"></span>
    </p>

    <div id="sharpen-block">
      ${sharpenOff ? "" : `
      <p>
        <button type="button" id="sharpen" class="btn-secondary">
          Make the records description more specific
        </button>
        <span class="hint" id="sharpen-status" role="status"></span>
      </p>`}
      <p class="hint" id="sharpen-note">
        Optional. This rewrites only the paragraph describing what you
        want, to phrase it the way agencies index records — it never adds
        or changes what you're asking for. The letter above is already
        complete without it.
      </p>
    </div>

    <p class="note">
      Chapter 119 sets no express deadline; the agency gets a reasonable
      time to retrieve, review, and redact. Send it to
      ${c.soe_email
        ? `the office that holds the records — for elections records in ${esc(c.name)} County that's <a href="mailto:${esc(c.soe_email)}">${esc(c.soe_email)}</a>.`
        : "the office that holds the records."}
    </p>`;

  // Set as value, never innerHTML — text is never parsed as markup.
  document.getElementById("draft").value = text;

  document.getElementById("sharpen")
    ?.addEventListener("click", () => onSharpen(c, inputs));

  document.getElementById("mailto")?.addEventListener("click", (e) => {
    e.preventDefault();
    const body = encodeURIComponent(document.getElementById("draft").value);
    const office = (inputs?.agency || "").trim();
    const subj = encodeURIComponent(
      office
        ? `Public records request — ${office} (Ch. 119, Fla. Stat.)`
        : "Public records request (Ch. 119, Fla. Stat.)"
    );
    window.location.href = `mailto:${c.soe_email}?subject=${subj}&body=${body}`;
  });

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
