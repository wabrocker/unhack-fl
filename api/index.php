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
const MAX_TOKENS     = 1200;
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

/** Load .env from above the web root first, then alongside. Never logged. */
function env_key(): string {
    foreach ([__DIR__ . '/../../.env', __DIR__ . '/../.env', __DIR__ . '/.env'] as $p) {
        if (is_readable($p)) {
            foreach (file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                if ($line[0] === '#') continue;
                [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
                if (trim($k) === 'ANTHROPIC_API_KEY') return trim($v, " \t\"'");
            }
        }
    }
    return getenv('ANTHROPIC_API_KEY') ?: '';
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
 * Draft a Chapter 119 public records request.
 * The user supplies what they want to know; we supply the form only.
 */
function build_records_request(array $in): array {
    $county = field($in, 'county');
    $agency = field($in, 'agency');
    $want   = field($in, 'want');   // the user's own words — the substance

    $system = <<<SYS
    You help Florida residents write public records requests under Chapter
    119, Florida Statutes.

    Hard rules:
    - The user supplies the substance. You supply structure and clarity
      ONLY. Never invent, expand, or editorialize what they want to know.
    - If what they've told you is too vague to identify records, do not
      guess. Return a short list of clarifying questions instead.
    - Never state a legal deadline, fee, or exemption as fact. Ch. 119 sets
      no express response deadline; agencies get a reasonable time to
      retrieve, review, and redact. Say only that.
    - Plain language. The reader is a citizen, not a lawyer.
    - Output the letter only, ready to paste. No preamble, no commentary.
    - Do not include a signature block beyond a "[Your name]" placeholder.
    SYS;

    $user = <<<USR
    County: {$county}
    Agency or office: {$agency}

    What I want to know, in my words:
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
    'records_request' => 'build_records_request',
    'explain'         => 'build_explain',
];
$action = (string) ($in['action'] ?? '');
if (!isset($actions[$action])) fail(400, 'Unknown action.');

$key = env_key();
if ($key === '') fail(500, 'Server is not configured.');

rate_limit();

[$system, $user] = $actions[$action]($in);

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
