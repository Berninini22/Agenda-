# Agenda+

Sistema web de agendamento de consultas com autenticação de usuários.

## Funcionalidades

O projeto possui criação de conta, login, logout, proteção da página principal e da API, além de cadastro, listagem e cancelamento de consultas associadas à conta autenticada. As senhas são armazenadas com `password_hash` e as consultas ficam em um banco SQLite criado automaticamente em `data/agenda.sqlite`.

## Requisitos

É necessário ter PHP 8 ou superior com as extensões `pdo` e `pdo_sqlite` habilitadas.

## Execução local

Na pasta raiz do projeto, execute:

```bash
php -S localhost:8000 -t .
```

Depois, abra [http://localhost:8000/pages/auth.php](http://localhost:8000/pages/auth.php). O acesso a `pages/index.php` é bloqueado automaticamente para quem não estiver autenticado. O arquivo `pages/index.html` redireciona para a mesma área protegida por compatibilidade com o endereço antigo.

A pasta `data` precisa ter permissão de escrita para que o PHP possa criar o banco SQLite automaticamente.
