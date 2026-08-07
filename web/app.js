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
  topicButtons: document.getElementById("topic-buttons"),
  topicResult: document.getElementById("topic-result"),
  buttons: () => document.querySelectorAll("button[data-action]"),
};

let counties = [];
let topics = [];
let sheriffs = [];

// #output is shared between poll-worker results and the records draft/
// error, so a county change (or the pollworker toggle) needs to know
// which one currently owns its content before deciding what to do with it.
let outputOwner = null; // null | "pollworker" | "records"

/**
 * Help mode: one attribute on <html>, which styles.css keys every
 * .info-toggle / .info-panel off of. This function is the only place
 * that reads or writes it — the inline <script> at the top of <body>
 * duplicates the read-only part, purely to avoid a flash of the help
 * icons for a returning "off" visitor before this module loads.
 */
function initHelpMode() {
  const KEY = "unhackfl-help-mode";
  const checkbox = document.getElementById("help-mode-toggle");
  if (!checkbox) return;

  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch { /* ignore */ }
  const on = stored === "on"; // unset = first visit = help off by default

  checkbox.checked = on;
  document.documentElement.setAttribute("data-help-mode", on ? "on" : "off");

  checkbox.addEventListener("change", () => {
    const nowOn = checkbox.checked;
    document.documentElement.setAttribute("data-help-mode", nowOn ? "on" : "off");
    try { localStorage.setItem(KEY, nowOn ? "on" : "off"); } catch { /* ignore */ }

    if (!nowOn) {
      // CSS already hides these, but keep ARIA state truthful too — and
      // this means they don't silently reappear pre-opened if help mode
      // is switched back on later.
      for (const btn of document.querySelectorAll(".info-toggle")) {
        btn.setAttribute("aria-expanded", "false");
      }
      for (const panel of document.querySelectorAll(".info-panel")) {
        panel.hidden = true;
      }
    }
  });
}

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

  // Topic starters are a nice-to-have layered on top of the core flow —
  // if this fails to load, the form still works with a blank "want" field.
  try {
    const res = await fetch("../data/topic-starters.json");
    const data = await res.json();
    topics = data.topics ?? [];
  } catch {
    topics = [];
  }

  // A second bulk-verified office, alongside elections. Optional — if it
  // fails to load, the mailto flow just falls back to "we don't know".
  try {
    const res = await fetch("../data/sheriffs.json");
    const data = await res.json();
    sheriffs = data.sheriffs ?? [];
  } catch {
    sheriffs = [];
  }

  initHelpMode();
  renderCountyOptions(counties);
  renderTopicButtons();

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

  // "Help build this" is a whole section, not a contextual aside, so it
  // gets its own toggle rather than joining the info-toggle group below —
  // opening it shouldn't close an unrelated panel someone left open
  // higher up the page.
  const helpToggle = document.getElementById("help-build-toggle");
  const helpBody = document.getElementById("help-build-body");
  helpToggle?.addEventListener("click", () => {
    const open = helpToggle.getAttribute("aria-expanded") === "true";
    helpToggle.setAttribute("aria-expanded", String(!open));
    helpBody.hidden = open;
  });

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
    if (ready) {
      b.querySelector(".btn-label").textContent = b.dataset.action === "records"
        ? "Draft a records request"
        : "See how to apply";
    }
  }

  el.countyNote.hidden = !ready;

  if (!ready) {
    // Back to "Select a county…" — tear everything down.
    el.recordsForm.hidden = true;
    el.output.hidden = true;
    el.output.innerHTML = "";
    outputOwner = null;
    for (const b of el.buttons()) b.setAttribute("aria-expanded", "false");
    resetTopicPicker();
    return;
  }

  // The two sections toggle independently now, so each is refreshed on
  // its own terms rather than one shared "which panel is open" flag.
  if (!el.output.hidden && outputOwner === "pollworker") {
    // Pure display of county data — just re-render for the new county.
    renderPollWorker(c);
  } else if (!el.output.hidden && outputOwner === "records") {
    // Drop the draft rather than leaving a letter addressed to the
    // county the user just navigated away from. The records FORM (if
    // open) stays open — only the result of the old county is stale.
    el.output.hidden = true;
    el.output.innerHTML = "";
    outputOwner = null;
  }

  if (!el.recordsForm.hidden) {
    // Keep the hint in step for the new county.
    setAgencyHint(c);
    // A topic pick from the previous county would otherwise leave a stale
    // "verified for X County" note attached to fields now describing Y.
    resetTopicPicker();
  }

  // Honest about missing data rather than inventing a county URL.
  el.countyNote.innerHTML = c.soe_url
    ? `Elections office: <a href="${esc(c.soe_url)}" rel="noopener">${esc(c.name)} County Supervisor of Elections, ${esc(c.supervisor)}</a>`
    : `<div class="unsourced">We don't have ${esc(c.name)} County's elections office on file, so we won't guess at it. <a href="${OFFICIAL_SOE_DIRECTORY}" rel="noopener">Find it in the state directory</a>.</div>`;
}

/** Single place that writes the county hint, so it can't drift. */
function setAgencyHint(c) {
  el.agencyHint.textContent =
    `In ${c.name} County. If the records are held by the elections office, ` +
    `that's the ${c.supervisor}.`;
}

/**
 * Topic starters: a middle step between "I don't know what to ask for"
 * and the blank agency/want fields. Two layers, matching the fl-counties
 * pattern of verified-fact-or-nothing:
 *
 *   - generic_guidance / generic_want_template: true in general across
 *     Florida counties, never names a specific office. Always available.
 *   - county_overrides: individually researched and sourced facts about
 *     one county's actual office and program. Used when one exists for
 *     the selected county; otherwise we fall back to the generic layer
 *     rather than guessing at a name.
 *
 * Populating the fields is not the same as authoring the request: the
 * agency is a real, sourced fact when we have one, and the want field is
 * always a template with bracketed placeholders the user must still fill
 * in with their own specifics. Both stay fully editable, same as if the
 * user had typed them.
 */
function renderTopicButtons() {
  el.topicButtons.replaceChildren();
  for (const topic of topics) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-secondary topic-btn";
    btn.dataset.topicSlug = topic.slug;
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = topic.label;
    btn.addEventListener("click", () => onTopicPick(topic));
    el.topicButtons.append(btn);
  }
}

function resetTopicPicker() {
  el.topicResult.hidden = true;
  el.topicResult.innerHTML = "";
  for (const b of el.topicButtons.querySelectorAll(".topic-btn")) {
    b.setAttribute("aria-pressed", "false");
  }
}

function onTopicPick(topic) {
  const c = selected();
  if (!c) return;

  const btn = el.topicButtons.querySelector(`[data-topic-slug="${topic.slug}"]`);
  const alreadyActive = btn?.getAttribute("aria-pressed") === "true";

  // Picking the same topic again is a toggle-off: hide the explanation,
  // but leave the agency/want fields alone. The user may have already
  // started editing them, and closing a popup shouldn't clobber that.
  if (alreadyActive) {
    btn.setAttribute("aria-pressed", "false");
    el.topicResult.hidden = true;
    el.topicResult.innerHTML = "";
    return;
  }

  for (const b of el.topicButtons.querySelectorAll(".topic-btn")) {
    b.setAttribute("aria-pressed", String(b.dataset.topicSlug === topic.slug));
  }

  const override = (topic.county_overrides || [])
    .find((o) => o.county_slug === c.slug);

  if (override) {
    el.agency.value = override.agency;
    el.want.value = override.want;
    const sources = (override.source || [])
      .map((u, i) => `<a href="${esc(u)}" rel="noopener">source ${i + 1}</a>`)
      .join(", ");
    el.topicResult.innerHTML = `
      <p><strong>Verified for ${esc(c.name)} County.</strong> Office and
      program name below are researched, not guessed — checked
      ${esc(override.verified)}${sources ? ` (${sources})` : ""}.</p>
      ${override.notes ? `<p>${esc(override.notes)}</p>` : ""}
      <p>Both fields are filled in below. Read them, and edit anything
      that isn't quite your question before continuing.</p>`;
  } else {
    el.agency.value = "";
    el.want.value = topic.generic_want_template;
    el.topicResult.innerHTML = `
      <p>${esc(topic.generic_guidance)}</p>
      <p class="info-caveat">We haven't researched
      ${esc(c.name)} County's specific office for this topic yet, so the
      office field is left blank rather than guessed — the "Which office"
      help above has examples. The description below is a starting
      template: replace the bracketed parts with your own specifics.
      If you find the right office, consider
      <a href="https://github.com/wabrocker/unhack-fl/blob/main/CONTRIBUTING.md"
         rel="noopener">contributing it back</a> for the next person.</p>`;
  }

  el.topicResult.hidden = false;
  el.agency.focus();
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

/**
 * Whichever flow writes into #output next owns it. If the OTHER flow's
 * toggle button currently claims to be "open", that claim just went
 * stale — its content is about to be overwritten — so close it. This is
 * one-directional: the records button's aria-expanded tracks the FORM's
 * visibility, not #output, so opening pollworker never needs to touch it.
 */
function claimOutput(owner) {
  if (outputOwner !== owner) {
    const other = [...el.buttons()].find((b) => b.dataset.action === "pollworker");
    if (owner === "records" && other) other.setAttribute("aria-expanded", "false");
  }
  outputOwner = owner;
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

  claimOutput("pollworker");
  el.output.hidden = false;
  el.output.innerHTML = `
    <h2>Working the polls in ${esc(c.name)} County</h2>
    <p>Poll workers are hired and trained by your county Supervisor of
    Elections — that office is who you apply to.</p>
    ${apply}
    ${contactBlock(c)}
    <p class="note help-only">Eligibility, training, and pay are set county by
    county and change between elections. Treat the county page and the
    office itself as authoritative over anything summarised here.</p>`;
}

/**
 * Each action button independently toggles its own section — picking one
 * doesn't touch the other. "Independent" has one real limit: poll-worker
 * results and the records draft/error share the single #output element,
 * so the pollworker toggle can only own #output when nothing else does;
 * see outputOwner.
 */
function onAction(kind) {
  const c = selected();
  if (!c) return;

  const btn = [...el.buttons()].find((b) => b.dataset.action === kind);
  if (!btn) return;
  const isOpen = btn.getAttribute("aria-expanded") === "true";

  if (kind === "records") {
    if (isOpen) {
      btn.setAttribute("aria-expanded", "false");
      el.recordsForm.hidden = true;
      return;
    }
    btn.setAttribute("aria-expanded", "true");
    el.recordsForm.hidden = false;
    setAgencyHint(c);
    el.recordsForm.scrollIntoView({ behavior: "smooth", block: "start" });
    el.agency.focus();
    return;
  }

  // pollworker
  if (isOpen) {
    btn.setAttribute("aria-expanded", "false");
    el.output.hidden = true;
    return;
  }
  btn.setAttribute("aria-expanded", "true");
  renderPollWorker(c); // sets outputOwner = "pollworker" and unhides #output
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

Under Chapter 119, Florida Statutes, and Article I, Section 24 of the Florida Constitution, I am requesting copies of the following public records:

${want}

A few notes to make this easier to fulfill:

- If any part of these records is exempt from disclosure, please provide the remainder and identify the exemption relied on for each withheld portion.
- Electronic copies are fine, and preferred — PDF or the records' native format, sent to the email address below.
- If fulfilling this request will involve a charge, please contact me with an estimate before doing the work, rather than proceeding.

I understand Chapter 119 does not set a specific deadline, and that you are entitled to a reasonable time to locate the records, review them, and redact anything exempt. A brief acknowledgment that you have received this request would be appreciated.

Thank you for your time.

${name}
${email}

---
Formatted with Unhack FL (fl.unhackdemocracy.us), a free tool that puts public records requests into the form agencies can act on: a named custodian, specific records, a date range, exemption citations, and a cost estimate before charges. That describes this request, not the requester — no identity check was performed, and Chapter 119 does not require one.`;
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
 *
 * Once a rewrite comes back, the button becomes an Undo/Redo toggle
 * between the original wording and the rewritten one — both versions
 * are kept on the button's dataset, so flipping back and forth never
 * calls the rewriter again.
 */
async function onSharpen(c, inputs) {
  const btn = document.getElementById("sharpen");
  const status = document.getElementById("sharpen-status");

  if (btn.dataset.sharpened) {
    const showingSharpened = btn.dataset.showing === "sharpened";
    const want = showingSharpened ? inputs.want : btn.dataset.sharpened;
    document.getElementById("draft").value = buildLetter({ ...inputs, want });
    btn.dataset.showing = showingSharpened ? "original" : "sharpened";
    btn.textContent = showingSharpened ? "Redo the rewrite" : "Undo the rewrite";
    status.textContent = showingSharpened
      ? "Showing your original wording."
      : "Showing the rewritten wording.";
    setTimeout(() => (status.textContent = ""), 4000);
    return;
  }

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

    btn.dataset.sharpened = data.text.trim();
    btn.dataset.showing = "sharpened";
    btn.textContent = "Undo the rewrite";

    document.getElementById("draft").value = buildLetter({
      ...inputs,
      want: btn.dataset.sharpened,
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
  claimOutput("records");
  el.output.hidden = false;
  el.output.innerHTML = `<p class="unsourced">${esc(message)}</p>`;
  el.output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * We only have a handful of VERIFIED office emails per county — offices
 * where a state agency itself publishes a bulk, structured directory, the
 * same way poll_worker_url was populated. Right now that's two: the
 * Supervisor of Elections (Dept. of State) and the Sheriff (FDLE). The
 * "which office" field is free text with no email attached, so offering
 * one of these as a one-click send target for an arbitrary typed-in
 * agency would be exactly the kind of guess this project exists to
 * refuse. Only match when the typed agency plausibly names one of the
 * offices we actually have a sourced email for.
 *
 * Most Florida offices (property appraisers, tax collectors, individual
 * departments) have NO equivalent bulk state directory — see
 * data/README.md. Those stay unmatched here on purpose, not by oversight.
 */
function findVerifiedEmail(agencyText, c) {
  const a = (agencyText || "").toLowerCase();
  if (!a) return null;

  if (a.includes("supervisor of elections") ||
      a.includes("elections office") || a.includes("board of elections") ||
      (c.supervisor && a.includes(c.supervisor.toLowerCase()))) {
    if (c.soe_email) return { email: c.soe_email, label: "the elections office" };
  }

  const sh = sheriffs.find((s) => s.county_slug === c.slug);
  if (sh && sh.email && (
        a.includes("sheriff") ||
        (sh.sheriff && a.includes(sh.sheriff.toLowerCase()))
      )) {
    return { email: sh.email, label: "the sheriff's office" };
  }

  return null;
}

function showDraft(c, text, inputs) {
  const sharpenOff = sessionStorage.getItem("sharpenOff") === "1";
  const verified = findVerifiedEmail(inputs?.agency, c);
  const knownEmail = verified?.email ?? null;

  claimOutput("records");
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
      ${knownEmail
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

    <div class="note">
      Chapter 119 sets no express deadline; the agency gets a reasonable time to retrieve, review, and redact.
      ${knownEmail
        ? ` Send it to ${esc(c.name)} County's ${esc(verified.label)}: <a href="mailto:${esc(knownEmail)}">${esc(knownEmail)}</a>.`
        : ""}
    </div>
    ${knownEmail ? "" : `
    <div class="unsourced">
      We don't have a verified email for "${esc(inputs?.agency || "the office you named")}" — most Florida offices don't publish one in bulk the way elections and sheriffs do. A few ways to find the right address:
      <ul>
        <li>Search "${esc(c.name)} County Florida ${esc(inputs?.agency || "")} public records"</li>
        <li>Check the office's own website for a records or FOIA contact</li>
        <li>Call the county's main line and ask to be routed to public records for this office</li>
      </ul>
      A phone call also works — Chapter 119 doesn't require the request to be emailed.
    </div>`}`;

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
    window.location.href = `mailto:${knownEmail}?subject=${subj}&body=${body}`;
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
