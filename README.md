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
