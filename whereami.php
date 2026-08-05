<?php
// TEMPORARY DIAGNOSTIC — delete immediately after use.
// Reports only paths and booleans. Never prints the key.
header('Content-Type: text/plain; charset=utf-8');

echo "PHP version : " . PHP_VERSION . "\n";
echo "cURL loaded : " . (function_exists('curl_init') ? 'yes' : 'NO') . "\n";
echo "This file   : " . __DIR__ . "\n\n";

echo "Candidate .env locations api/index.php checks, in order:\n";
$base = __DIR__ . '/api';           // where index.php lives once deployed
foreach ([
    $base . '/../../../../.env',
    $base . '/../../../.env',
    $base . '/../../.env',
    $base . '/../.env',
    $base . '/.env',
] as $p) {
    $real   = realpath($p);
    $exists = file_exists($p);
    printf("  %-8s %-9s %s\n",
        $exists ? 'EXISTS' : 'missing',
        $exists ? (is_readable($p) ? 'readable' : 'UNREADABLE') : '',
        $real ?: $p
    );
}

$env = getenv('ANTHROPIC_API_KEY');
echo "\nANTHROPIC_API_KEY in environment: " . ($env ? 'set (' . strlen($env) . " chars)" : 'not set') . "\n";
echo "\nDELETE THIS FILE NOW.\n";
