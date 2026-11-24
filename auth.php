<?php

declare(strict_types=1);

session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
]);
session_start();

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

if (isset($_SESSION['user_id'])) {
    header('Location: index.php');
    exit;
}

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

$mode = ($_GET['mode'] ?? 'login') === 'register' ? 'register' : 'login';
$error = '';
$oldName = '';
$oldEmail = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $mode = ($_POST['mode'] ?? 'login') === 'register' ? 'register' : 'login';
    $oldName = trim((string)($_POST['name'] ?? ''));
    $oldEmail = strtolower(trim((string)($_POST['email'] ?? '')));
    $password = (string)($_POST['password'] ?? '');
    $csrf = (string)($_POST['csrf_token'] ?? '');

    if (!hash_equals((string)$_SESSION['csrf_token'], $csrf)) {
        $error = 'A sessão expirou. Atualize a página e tente novamente.';
    } elseif (!filter_var($oldEmail, FILTER_VALIDATE_EMAIL)) {
        $error = 'Digite um e-mail válido.';
    } elseif (strlen($password) < 6) {
        $error = 'A senha deve ter pelo menos 6 caracteres.';
    } elseif ($mode === 'register' && ($oldName === '' || strlen($oldName) < 3)) {
        $error = 'Digite seu nome completo.';
    } else {
        try {
            if ($mode === 'register') {
                $stmt = $db->prepare('INSERT INTO users (name, email, password_hash) VALUES (:name, :email, :password_hash)');
                $stmt->execute([
                    ':name' => $oldName,
                    ':email' => $oldEmail,
                    ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
                ]);
                session_regenerate_id(true);
                $_SESSION['user_id'] = (int)$db->lastInsertId();
                $_SESSION['user_name'] = $oldName;
                header('Location: index.php');
                exit;
            }

            $stmt = $db->prepare('SELECT id, name, password_hash FROM users WHERE email = :email LIMIT 1');
            $stmt->execute([':email' => $oldEmail]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$user || !password_verify($password, $user['password_hash'])) {
                $error = 'E-mail ou senha incorretos.';
            } else {
                session_regenerate_id(true);
                $_SESSION['user_id'] = (int)$user['id'];
                $_SESSION['user_name'] = $user['name'];
                header('Location: index.php');
                exit;
            }
        } catch (PDOException $exception) {
            $error = $exception->getCode() === '23000'
                ? 'Já existe uma conta com este e-mail.'
                : 'Não foi possível concluir a operação. Tente novamente.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= $mode === 'register' ? 'Criar conta' : 'Entrar' ?> | Agenda+</title>
  <link rel="stylesheet" href="../css/style.css">
</head>
<body class="auth-page">
  <main class="auth-shell">
    <section class="auth-card" aria-labelledby="auth-title">
      <a class="auth-brand" href="auth.php"><span class="brand-mark" aria-hidden="true">+</span> Agenda<span>+</span></a>
      <p class="eyebrow">Acesso seguro</p>
      <h1 id="auth-title"><?= $mode === 'register' ? 'Crie sua conta' : 'Bem-vindo de volta' ?></h1>
      <p class="auth-lead">Faça login para agendar e acompanhar suas consultas.</p>

      <?php if ($error !== ''): ?>
        <div class="auth-error" role="alert"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
      <?php endif; ?>

      <form method="post" class="auth-form" novalidate>
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') ?>">
        <input type="hidden" name="mode" value="<?= $mode ?>">
        <?php if ($mode === 'register'): ?>
          <div class="form-field">
            <label for="name">Nome completo</label>
            <input id="name" name="name" type="text" value="<?= htmlspecialchars($oldName, ENT_QUOTES, 'UTF-8') ?>" autocomplete="name" required>
          </div>
        <?php endif; ?>
        <div class="form-field">
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" value="<?= htmlspecialchars($oldEmail, ENT_QUOTES, 'UTF-8') ?>" autocomplete="email" required>
        </div>
        <div class="form-field">
          <label for="password">Senha</label>
          <input id="password" name="password" type="password" minlength="6" autocomplete="<?= $mode === 'register' ? 'new-password' : 'current-password' ?>" required>
          <?php if ($mode === 'register'): ?><small class="field-hint">Use pelo menos 6 caracteres.</small><?php endif; ?>
        </div>
        <button class="btn btn-primary auth-submit" type="submit"><?= $mode === 'register' ? 'Criar conta' : 'Entrar' ?></button>
      </form>

      <p class="auth-switch">
        <?php if ($mode === 'register'): ?>Já possui uma conta? <a href="auth.php?mode=login">Entrar</a>
        <?php else: ?>Ainda não possui uma conta? <a href="auth.php?mode=register">Criar conta</a><?php endif; ?>
      </p>
    </section>
  </main>
</body>
</html>
