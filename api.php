<?php

declare(strict_types=1);

session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
]);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Faça login para utilizar o Agenda+.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$dataDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0750, true);
}

$db = new PDO('sqlite:' . $dataDir . DIRECTORY_SEPARATOR . 'agenda.sqlite');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)');
$db->exec('CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    patient TEXT NOT NULL,
    mode TEXT NOT NULL,
    specialty TEXT NOT NULL,
    professional TEXT NOT NULL,
    unit TEXT NOT NULL,
    date_iso TEXT NOT NULL,
    time TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)');

$userId = (int)$_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

function inputJson(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function respond(array $payload, int $status = 200): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    if ($method === 'GET') {
        $stmt = $db->prepare('SELECT id, patient, mode, specialty, professional, unit, date_iso AS dateISO, time FROM appointments WHERE user_id = :user_id ORDER BY date_iso, time');
        $stmt->execute([':user_id' => $userId]);
        respond(['appointments' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    if ($method === 'POST') {
        $data = inputJson();
        $required = ['patient', 'mode', 'specialty', 'professional', 'unit', 'dateISO', 'time'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || trim((string)$data[$field]) === '') {
                respond(['error' => 'Preencha todos os dados da consulta.'], 422);
            }
        }
        if (!in_array($data['mode'], ['presencial', 'teleconsulta'], true)) {
            respond(['error' => 'Modalidade de atendimento inválida.'], 422);
        }
        $stmt = $db->prepare('INSERT INTO appointments (user_id, patient, mode, specialty, professional, unit, date_iso, time) VALUES (:user_id, :patient, :mode, :specialty, :professional, :unit, :date_iso, :time)');
        $stmt->execute([
            ':user_id' => $userId,
            ':patient' => trim((string)$data['patient']),
            ':mode' => $data['mode'],
            ':specialty' => trim((string)$data['specialty']),
            ':professional' => trim((string)$data['professional']),
            ':unit' => trim((string)$data['unit']),
            ':date_iso' => trim((string)$data['dateISO']),
            ':time' => trim((string)$data['time']),
        ]);
        respond(['success' => true, 'id' => (int)$db->lastInsertId()], 201);
    }

    if ($method === 'DELETE') {
        $data = inputJson();
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            respond(['error' => 'Consulta inválida.'], 422);
        }
        $stmt = $db->prepare('DELETE FROM appointments WHERE id = :id AND user_id = :user_id');
        $stmt->execute([':id' => $id, ':user_id' => $userId]);
        if ($stmt->rowCount() === 0) {
            respond(['error' => 'Consulta não encontrada.'], 404);
        }
        respond(['success' => true]);
    }

    respond(['error' => 'Método não permitido.'], 405);
} catch (Throwable $exception) {
    respond(['error' => 'Erro interno ao processar a solicitação.'], 500);
}
