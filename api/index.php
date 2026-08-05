<?php
/**
 * unhack-fl — Anthropic API proxy.
 *
 * The only component that touches the API key. The browser never does.
 *
 * Design rule that matters most: the client CANNOT send a prompt. It sends
 * a named action plus structured fields, and this file builds the prompt.
 * Otherwise this becomes a free public Claude endpoint on Bill's card.
 */

declare(strict_types=1);

const MODEL          = 'claude-sonnet-5';
const MAX_TOKENS     = 600;   // one paragraph, not a letter
const RATE_LIMIT     = 8;      // requests per window, per IP
const RATE_WINDOW    = 600;    // seconds
const MAX_FIELD_LEN  = 2000;
const API_URL        = 'https://api.anthropic.com/v1/messages';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Load .env, preferring locations ABOVE the web root. Never logged.
 *
 * From <docroot>/api/ these resolve to, in order:
 *   /home/USER/.env                     — safest, outside every site
 *   /home/USER/domains/.env
 *   /home/USER/domains/SITE/.env        — recommended: above public_html
 *   <docroot>/.env                      — web-served; .htaccess blocks it
 *   <docroot>/api/.env                  — likewise, fallback only
 */
function env_key(?string &$why = null): string {
    $found = false;
    foreach ([
        __DIR__ . '/../../../../.env',
        __DIR__ . '/../../../.env',
        __DIR__ . '/../../.env',
        __DIR__ . '/../.env',
        __DIR__ . '/.env',
    ] as $p) {
        if (is_readable($p)) {
            $found = true;
            foreach (file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                if ($line === '' || $line[0] === '#') continue;
                [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
                if (trim($k) === 'ANTHROPIC_API_KEY') {
                    $v = trim($v, " \t\"'");
                    if ($v !== '') return $v;
                }
            }
        }
    }
    if ($key = getenv('ANTHROPIC_API_KEY')) return $key;

    // Distinguish the two failures — they were previously identical, which
    // cost real debugging time on the first deploy.
    $why = $found
        ? 'A .env was found but it has no usable ANTHROPIC_API_KEY= line. '
        . 'The file must read: ANTHROPIC_API_KEY=sk-ant-...'
        : 'No .env found. Expected one above the web root, e.g. '
        . '/home/USER/domains/SITE/.env';
    return '';
}

/** Crude but adequate per-IP limiter. Stores counts, never request content. */
function rate_limit(): void {
    $dir = sys_get_temp_dir() . '/unhackfl-rl';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $ip   = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $dir . '/' . hash('sha256', $ip);
    $now  = time();
    $hits = is_readable($file)
        ? array_filter((array) json_decode((string) file_get_contents($file), true),
                       fn($t) => is_int($t) && $t > $now - RATE_WINDOW)
        : [];
    if (count($hits) >= RATE_LIMIT) {
        fail(429, 'Too many requests. Wait a few minutes and try again.');
    }
    $hits[] = $now;
    @file_put_contents($file, json_encode(array_values($hits)), LOCK_EX);
}

function field(array $in, string $name, bool $required = true): string {
    $v = trim((string) ($in[$name] ?? ''));
    if ($required && $v === '') fail(400, "Missing: {$name}");
    if (strlen($v) > MAX_FIELD_LEN) fail(400, "Too long: {$name}");
    return $v;
}

/* ---------- Actions. The server owns every prompt. ---------- */

/**
 * Sharpen ONLY the "records requested" paragraph.
 *
 * The letter itself is built in the browser from a fixed template — this
 * touches one paragraph and nothing else. Keeping the scope this narrow is
 * what makes the feature genuinely optional: without it the user still has
 * a complete, sendable request.
 */
function build_sharpen_description(array $in): array {
    $county = field($in, 'county');
    $agency = field($in, 'agency');
    $want   = field($in, 'want');   // the user's own words — the substance

    $system = <<<SYS
    You rewrite one paragraph: the description of records sought in a
    Florida public records request under Chapter 119.

    Your only job is to phrase the SAME request the way an agency's records
    custodian indexes and searches for records — naming record types, date
    ranges, departments, and formats where the user has implied them.

    Hard rules:
    - NEVER add, remove, narrow, or broaden what is being asked for. If the
      user didn't say it, it does not appear.
    - Do not invent date ranges, department names, or record types. If the
      user was vague about one, leave it general rather than guessing.
    - If the request is too vague to identify any record at all, do not
      guess. Return two or three short clarifying questions instead, and
      nothing else.
    - No legal advice, no statutory citations, no deadlines, no fee claims.
      Those live in the surrounding letter already.
    - Plain language. The reader is a records clerk, not a lawyer.
    - Output the paragraph ONLY. No preamble, no heading, no commentary,
      no salutation, no signature.
    SYS;

    $user = <<<USR
    County: {$county}
    Agency or office: {$agency}

    The records I want, in my own words:
    {$want}
    USR;

    return [$system, $user];
}

/**
 * Explain a supplied statute passage in plain language.
 * Grounded strictly in text we pass in — never model memory.
 */
function build_explain(array $in): array {
    $passage = field($in, 'passage');
    $question = field($in, 'question', false);

    $system = <<<SYS
    You explain Florida statutes in plain language for ordinary citizens.

    Hard rules:
    - Explain ONLY what the supplied passage says. If the passage does not
      answer the question, say so plainly and stop. Never supplement from
      memory — a confidently wrong civic fact is worse than no answer.
    - No legal advice. Describe what the text says; never advise a course
      of action.
    - Neutral throughout. Describe, never editorialize or characterize
      motives.
    - Short. Three sentences beats ten.
    SYS;

    $user = "Passage:\n{$passage}"
          . ($question !== '' ? "\n\nMy question: {$question}" : '');

    return [$system, $user];
}

/* ---------- Dispatch ---------- */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'POST only.');

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 16000) fail(413, 'Request too large.');

$in = json_decode($raw, true);
if (!is_array($in)) fail(400, 'Expected JSON.');

$actions = [
    'sharpen_description' => 'build_sharpen_description',
    'explain'             => 'build_explain',
];
$action = (string) ($in['action'] ?? '');
if (!isset($actions[$action])) fail(400, 'Unknown action.');

// Validate and build first, so a bad request gets a useful 400 rather than
// being masked by a server-config error.
[$system, $user] = $actions[$action]($in);

$key = env_key($why);
if ($key === '') {
    error_log('unhack-fl config: ' . ($why ?? 'unknown'));
    fail(500, 'Server is not configured.');   // generic to the public
}

rate_limit();

$payload = json_encode([
    'model'      => MODEL,
    'max_tokens' => MAX_TOKENS,
    'system'     => $system,
    'messages'   => [['role' => 'user', 'content' => $user]],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

$ch = curl_init(API_URL);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_HTTPHEADER     => [
        'content-type: application/json',
        'anthropic-version: 2023-06-01',
        'x-api-key: ' . $key,
    ],
]);
$body   = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err    = curl_error($ch);
curl_close($ch);

// Log status and timing only — never request or response bodies.
error_log(sprintf('unhack-fl action=%s status=%d', $action, $status));

if ($body === false)            fail(502, 'Could not reach the service.');
if ($status === 429)            fail(429, 'The service is busy. Try again shortly.');
if ($status < 200 || $status >= 300) fail(502, 'The service returned an error.');

$data = json_decode((string) $body, true);
$text = '';
foreach ($data['content'] ?? [] as $block) {
    if (($block['type'] ?? '') === 'text') $text .= $block['text'];
}
if ($text === '') fail(502, 'Empty response from the service.');

echo json_encode(['ok' => true, 'text' => $text], JSON_UNESCAPED_SLASHES);
