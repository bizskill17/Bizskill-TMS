<?php
declare(strict_types=1);
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
session_start();
$_SESSION = [];
session_destroy();
echo json_encode(['success'=>true]);
