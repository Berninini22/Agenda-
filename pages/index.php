<?php
declare(strict_types=1);
session_start();
if (empty($_SESSION["user_id"])) { header("Location: auth.php"); exit; }
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agenda+ | Agendamento de Consultas Híbrido</title>
<meta name="description" content="Aplicativo híbrido para agendamento de consultas médicas, simples e acessível para todos os públicos.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../css/style.css">
</head>
<body>

<a class="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>

<!-- ===================== HEADER ===================== -->
<header class="site-header">
  <div class="container header-bar">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">+</span>
      <span class="brand-name">Agenda<span class="brand-plus">+</span></span>
    </div>

    <nav class="main-nav" id="main-nav" aria-label="Navegação principal">
      <a href="#agendar" class="nav-link">Agendar</a>
      <a href="#minhas-consultas" class="nav-link">Minhas consultas</a>
      <a href="#sobre" class="nav-link">Como funciona</a>
      <a href="#termos" class="nav-link">Termos de uso</a>
    </nav>

    <div class="header-actions">
      <span class="user-welcome">Olá, <?= htmlspecialchars((string)($_SESSION['user_name'] ?? 'usuário'), ENT_QUOTES, 'UTF-8') ?></span>
      <a class="btn btn-ghost btn-small" href="logout.php">Sair</a>
      <button type="button" class="a11y-toggle" id="a11yToggle" aria-pressed="false">
        <span class="a11y-icon" aria-hidden="true">Aa</span>
        <span>Modo acessível</span>
      </button>
      <button type="button" class="menu-toggle" id="menuToggle" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<main id="conteudo-principal">

  <!-- ===================== HERO ===================== -->
  <section class="hero">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Agendamento de consultas · presencial e digital</p>
        <h1>Marcar uma consulta não devia ser a parte difícil do cuidado.</h1>
        <p class="hero-lead">
          Escolha a especialidade, o profissional e o horário em poucos passos.
          Pensado para funcionar bem no computador, no celular e para quem está
          começando agora a usar a internet.
        </p>
        <div class="hero-actions">
          <a href="#agendar" class="btn btn-primary">Agendar consulta</a>
          <a href="#sobre" class="btn btn-ghost">Como funciona</a>
        </div>
        <dl class="hero-stats">
          <div>
            <dt>Passos para agendar</dt>
            <dd>4</dd>
          </div>
          <div>
            <dt>Especialidades</dt>
            <dd>5</dd>
          </div>
          <div>
            <dt>Consultas por conta</dt>
            <dd>Sim</dd>
          </div>
        </dl>
      </div>

      <div class="hero-panel" aria-hidden="true">
        <div class="mini-card mini-card-1">
          <span class="mini-label">Próxima consulta</span>
          <span class="mini-title">Cardiologia</span>
          <span class="mini-time">Qui · 09:00</span>
        </div>
        <div class="mini-card mini-card-2">
          <span class="mini-label">Confirmado</span>
          <span class="mini-title">Dra. Helena Duarte</span>
          <span class="mini-time">Unidade Centro</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ===================== AGENDAR (STEPPER) ===================== -->
  <section class="section" id="agendar">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Novo agendamento</p>
        <h2>Vamos marcar sua consulta</h2>
        <p class="section-lead">Siga os passos abaixo. Você pode voltar e mudar qualquer escolha antes de confirmar.</p>
      </div>

      <div class="booking-card">
        <!-- Stepper indicator -->
        <ol class="stepper" id="stepper" aria-label="Etapas do agendamento">
          <li class="step is-active" data-step="1">
            <span class="step-index">1</span>
            <span class="step-label">Especialidade</span>
          </li>
          <li class="step" data-step="2">
            <span class="step-index">2</span>
            <span class="step-label">Profissional</span>
          </li>
          <li class="step" data-step="3">
            <span class="step-index">3</span>
            <span class="step-label">Data e horário</span>
          </li>
          <li class="step" data-step="4">
            <span class="step-index">4</span>
            <span class="step-label">Confirmação</span>
          </li>
        </ol>

        <!-- Step 1: Especialidade -->
        <div class="step-panel is-active" data-panel="1">
          <h3 class="panel-title">Qual especialidade você precisa?</h3>
          <div class="option-grid" id="specialtyGrid" role="radiogroup" aria-label="Escolha a especialidade"></div>
        </div>

        <!-- Step 2: Profissional -->
        <div class="step-panel" data-panel="2">
          <h3 class="panel-title">Escolha o profissional</h3>
          <p class="panel-hint" id="specialtyHint"></p>
          <div class="option-list" id="professionalList" role="radiogroup" aria-label="Escolha o profissional"></div>
        </div>

        <!-- Step 3: Data e horário -->
        <div class="step-panel" data-panel="3">
          <h3 class="panel-title">Escolha a data e o horário</h3>
          <div class="date-scroller" id="dateScroller" role="radiogroup" aria-label="Escolha a data"></div>
          <div class="time-grid" id="timeGrid" role="radiogroup" aria-label="Escolha o horário"></div>
        </div>

        <!-- Step 4: Confirmação -->
        <div class="step-panel" data-panel="4">
          <h3 class="panel-title">Confira e confirme</h3>
          <div class="summary-card" id="summaryCard"></div>
          <div class="form-field">
            <label for="patientName">Nome do paciente</label>
            <input type="text" id="patientName" placeholder="Digite seu nome completo" autocomplete="name">
          </div>
          <div class="form-field">
            <label for="patientMode">Como você prefere ser atendido?</label>
            <select id="patientMode">
              <option value="presencial">Presencial, na unidade</option>
              <option value="teleconsulta">Teleconsulta (vídeo)</option>
            </select>
          </div>
          <p class="form-note">Ao confirmar, você concorda com os <a href="#termos">termos e condições de uso</a>.</p>
        </div>

        <!-- Navigation -->
        <div class="booking-nav">
          <button type="button" class="btn btn-ghost" id="btnBack" disabled>Voltar</button>
          <span class="booking-status" id="bookingStatus" role="status" aria-live="polite"></span>
          <button type="button" class="btn btn-primary" id="btnNext">Continuar</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ===================== MINHAS CONSULTAS ===================== -->
  <section class="section section-alt" id="minhas-consultas">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Suas consultas</p>
        <h2>Minhas consultas</h2>
        <p class="section-lead">Tudo o que você agendar nesta conta aparece aqui, com opção de cancelar.</p>
      </div>

      <div id="appointmentsList" class="appointments-list"></div>
      <p class="empty-state" id="emptyState">Você ainda não tem consultas agendadas. Que tal <a href="#agendar">marcar a primeira</a>?</p>
    </div>
  </section>

  <!-- ===================== COMO FUNCIONA ===================== -->
  <section class="section" id="sobre">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Sobre o serviço</p>
        <h2>Feito para funcionar em qualquer situação</h2>
        <p class="section-lead">O Agenda+ combina atendimento digital e presencial para reduzir atrasos, evitar informações desencontradas e facilitar o acesso de todos os perfis de paciente.</p>
      </div>

      <div class="feature-grid">
        <article class="feature-card">
          <span class="feature-index">01</span>
          <h3>Simples de usar</h3>
          <p>Textos claros, botões grandes e poucos passos — pensado especialmente para quem tem pouca familiaridade com tecnologia.</p>
        </article>
        <article class="feature-card">
          <span class="feature-index">02</span>
          <h3>Híbrido de verdade</h3>
          <p>Agende pelo aplicativo ou continue sendo atendido presencialmente: as informações ficam sempre organizadas em um só lugar.</p>
        </article>
        <article class="feature-card">
          <span class="feature-index">03</span>
          <h3>Funciona offline</h3>
          <p>Consultas já confirmadas ficam disponíveis mesmo sem internet, reduzindo o risco de falhas em locais com conexão instável.</p>
        </article>
        <article class="feature-card">
          <span class="feature-index">04</span>
          <h3>Acessível por padrão</h3>
          <p>O modo acessível aumenta o texto e o contraste com um toque, sem esconder nenhuma função.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- ===================== TERMOS ===================== -->
  <section class="section section-alt" id="termos">
    <div class="container container-narrow">
      <div class="section-head">
        <p class="eyebrow">Termos e condições de uso</p>
        <h2>O essencial, em linguagem simples</h2>
      </div>
      <div class="terms-card">
        <p>O usuário é responsável por fornecer dados verdadeiros e atualizados no momento do cadastro e do agendamento das consultas. Informações incorretas podem comprometer o atendimento.</p>
        <p>O aplicativo permite consultar horários disponíveis, agendar e acompanhar atendimentos, mas não substitui o julgamento de um profissional de saúde.</p>
        <p>Os dados cadastrados são utilizados exclusivamente para o funcionamento do serviço de agendamento.</p>
      </div>
    </div>
  </section>

</main>

<!-- ===================== FOOTER ===================== -->
<footer class="site-footer">
  <div class="container footer-grid">
    <div>
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">+</span>
        <span class="brand-name">Agenda<span class="brand-plus">+</span></span>
      </div>
      <p class="footer-note">Trabalho de Conclusão de Curso — Técnico em Desenvolvimento de Sistemas, SENAI Ourinhos, 2026.</p>
    </div>
    <div class="footer-col">
      <h4>Autores</h4>
      <p>Arthur Bachiega Oliveira<br>Rafael Bernini<br>José Otavio Maciel Martins</p>
    </div>
    <div class="footer-col">
      <h4>Orientadores</h4>
      <p>Mariana Scudelari Melo<br>William Devide Komel<br>João Paulo de Oliveira</p>
    </div>
  </div>
</footer>

<!-- Live region for toast messages -->
<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script src="../js/script.js"></script>
</body>
</html>