# Agenda+

Sistema web de agendamento de consultas com cadastro, login e áreas diferentes para pacientes e médicos.

## Publicação no GitHub Pages

O projeto funciona como site estático no GitHub Pages. A autenticação, os perfis, a agenda e o armazenamento das fotos são feitos pelo Supabase, enquanto HTML, CSS e JavaScript ficam publicados no GitHub.

No repositório, configure o Pages em **Settings > Pages > Build and deployment > Deploy from a branch**, escolha a branch `index` e a pasta `/ (root)`. A entrada pública agora é `home.html`; a tela de login e cadastro fica em `auth.html`; a área profissional fica em `doctor.html`.

## Configuração do Supabase

No painel do Supabase, abra **SQL Editor > New query**, cole o conteúdo completo de `supabase-schema.sql` e execute. O script cria ou atualiza:

- perfis com os papéis `patient` e `doctor`;
- CRM, UF, especialidade, telefone, foto e disponibilidade semanal do médico;
- consultas vinculadas ao paciente e ao médico;
- políticas de Row Level Security para limitar cada usuário aos dados permitidos;
- o bucket público `avatars`, com gravação restrita à pasta do próprio médico;
- um trigger que cria automaticamente o perfil a partir dos dados do cadastro.

A configuração pública do Supabase fica em `js/supabase-config.js`. Essa chave é apropriada para uso no frontend. Nunca publique uma `service_role key` ou a senha do banco.

Se a confirmação de e-mail estiver habilitada no projeto Supabase, o usuário precisa confirmar o endereço antes do primeiro acesso. Os dados profissionais são enviados junto com o cadastro e são convertidos em perfil pelo trigger do banco.

## Fluxos disponíveis

Na página pública `home.html`, o visitante pode escolher entre entrar e criar conta sem ser redirecionado por uma verificação de sessão. Na tela `auth.html`, o usuário pode alternar entre entrar e criar conta. O botão **Sou médico** aparece tanto no login quanto no cadastro: no login ele abre a criação de conta e, no cadastro, seleciona diretamente o perfil médico. O cadastro médico exige nome completo, número do CRM, UF do CRM e especialidade, além de aceitar telefone profissional opcional.

Pacientes continuam usando `index.html` para escolher especialidade, profissional, data, horário e local. Médicos autenticados são encaminhados automaticamente para `doctor.html`, sem passar pela área de agendamento de pacientes.

No painel médico, o profissional pode visualizar a quantidade de consultas do dia e da semana, o próximo atendimento, a lista de consultas recebidas, os dados profissionais, a foto de perfil e a disponibilidade semanal. Os dias e horários são salvos no campo `profiles.availability`; a foto é armazenada no bucket `avatars`.

## Estrutura do projeto

```text
├── index.html              # Agendamento e consultas do paciente
├── auth.html               # Login e cadastro de paciente/médico
├── doctor.html             # Painel exclusivo do médico
├── css/
│   └── style.css           # Estilos globais, autenticação e painel
├── js/
│   ├── supabase-config.js  # URL e chave pública do Supabase
│   ├── auth.js             # Login, cadastro, papéis e redirecionamento
│   ├── script.js           # Agendamento e consultas do paciente
│   └── doctor.js           # Perfil, agenda e disponibilidade do médico
├── supabase-schema.sql     # Schema, trigger, RLS e bucket de fotos
└── README.md
```

## Endereços

Na publicação final, abra `https://berninini22.github.io/Agenda-/home.html` para acessar a entrada pública. A partir dela, use **Entrar**, **Criar conta** ou **Sou médico**. Depois do login, o sistema encaminha cada papel para sua respectiva área.

## Desenvolvimento local

Como o projeto é estático, ele pode ser testado com qualquer servidor HTTP local. Na raiz do projeto, execute `python3 -m http.server 8000` e abra `http://localhost:8000/auth.html`. Não abra os arquivos com duplo clique, pois o navegador pode bloquear requisições do Supabase em `file://`.

## Acessibilidade em Libras (VLibras)

Todas as telas principais carregam o **VLibras Widget**, solução oficial do Governo Digital para tradução de conteúdo em Português para Libras. O widget é carregado pelo script público `https://vlibras.gov.br/app/vlibras-plugin.js`, sem token ou chave secreta no frontend, e exibe o botão flutuante do tradutor após o carregamento da página. O modo confortável do Agenda+ continua separado: ele aumenta legibilidade, contraste e área de toque.

A integração é um recurso de acessibilidade visual e linguística; ela não consulta dados governamentais nem substitui uma API REST de cadastro, identidade ou validação. Para usar uma API governamental de dados, seria necessário definir qual serviço oficial e quais dados o sistema precisa trocar.

## Atualização de funcionalidades (v2)

O cadastro passou a exigir a aceitação dos Termos de Uso e registra a versão no metadado de criação da conta. Para persistir o aceite no perfil, execute `supabase-upgrade.sql` depois do schema principal. O gatilho grava o horário do servidor e impede que clientes alterem o aceite posteriormente. A página pública `terms.html` é acessível pelo resumo em `home.html` e pelo formulário.

A migração `supabase-upgrade.sql` adiciona tabelas normalizadas para locais, associação médico-local, slots semanais por dia/turno, logs de notificações e uma função transacional para impedir reservas concorrentes duplicadas. **O fluxo atualmente publicado ainda usa `profiles.availability` e o cadastro de consultas do frontend; a gestão do painel e o agendamento precisam ser migrados para `doctor_slots`/`book_appointment` antes de ativar essa nova estrutura em produção.** Não execute a migração em produção sem backup e validação dos dados existentes.

O filtro no painel médico consulta os agendamentos carregados e permite filtrar dia da semana e manhã/tarde. A caixa de perguntas do assistente textual foi retirada das páginas; continuam disponíveis o modo confortável, os controles visuais e o VLibras.

### VLibras e API governamental

O projeto já carrega o VLibras Widget oficial em páginas principais. O catálogo ConectaGov descreve a suíte VLibras e enumera interfaces para sinais, tradução Português→glosa e geração/consulta de vídeo; não é uma API genérica de cadastro de pessoas ou dados de acessibilidade. Esta versão mantém o widget existente e não invoca os endpoints REST descritos no catálogo. Consulte os links oficiais indicados no relatório de implementação antes de qualquer integração direta, pois disponibilidade, autenticação e contrato técnico devem ser confirmados na documentação atual.

### Notificações por e-mail

O projeto inclui uma Edge Function `appointment-emails` e a migração `supabase-email-notifications.sql` para e-mail de confirmação e lembrete um dia antes. A função consulta no Supabase o e-mail autenticado do paciente, os dados do perfil médico e as informações salvas na consulta. Usa fila idempotente, controle de falhas e cron no fuso de São Paulo. Para ativar, configure provedor e secrets, aplique a migração e publique a função conforme `EMAIL-SETUP.md`. O envio real depende dessa configuração no projeto Supabase.

E-mail transacional usa a API HTTPS do Resend no servidor Edge; as credenciais ficam nas secrets do Supabase e nunca no frontend. O SMTP customizado do Supabase Auth é separado e destina-se aos fluxos de autenticação. Para WhatsApp Cloud API, configure uma conta/app da Meta, número e token de usuário de sistema, permissões, modelos de mensagem quando aplicável e webhook HTTPS. Essa integração de WhatsApp continua fora do escopo desta atualização.

### Dados de teste

A base SQLite dentro de `data/agenda.sqlite` pertence à implementação PHP legada e contém apenas um usuário e um agendamento (além das tabelas internas SQLite); não é o banco usado pelo frontend Supabase. A migração inclui quatro locais de demonstração. Não há 20 registros completos coerentemente vinculados a médicos/pacientes, pois isso exige contas Auth válidas e médicos reais/de teste cadastrados. Crie contas de teste no Supabase e associe seus UUIDs a locais/slots antes de apresentar a integração relacional.
