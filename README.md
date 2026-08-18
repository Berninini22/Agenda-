# Agenda+

Sistema web de agendamento de consultas com cadastro, login e consultas vinculadas à conta do usuário.

## Publicação no GitHub Pages

O projeto foi preparado para funcionar como site estático no GitHub Pages. A autenticação e o armazenamento das consultas são feitos pelo Supabase, enquanto HTML, CSS e JavaScript ficam publicados no GitHub.

No repositório, configure o Pages em **Settings > Pages > Build and deployment > Deploy from a branch**, escolha a branch `index` e a pasta `/ (root)`. O arquivo de entrada é `index.html` na raiz. A tela de login fica em `auth.html`.

## Configuração do Supabase

No painel do Supabase, abra **SQL Editor > New query**, cole o conteúdo do arquivo `supabase-schema.sql` e execute. Esse script cria a tabela `appointments`, habilita Row Level Security e permite que cada usuário leia, crie e cancele somente as próprias consultas.

O projeto já está configurado com a URL pública do Supabase e a publishable key no arquivo `js/supabase-config.js`. Essa chave é apropriada para uso no frontend. Nunca publique uma `service_role key` ou a senha do banco.

## Endereços

Na publicação final, abra `https://berninini22.github.io/Agenda-/auth.html` para entrar ou criar uma conta. Após o login, o usuário é encaminhado para `index.html`. Visitantes sem sessão são enviados novamente para `auth.html`.

## Desenvolvimento local

Como o projeto é estático, ele pode ser testado com qualquer servidor HTTP local. Na raiz do projeto, execute `python3 -m http.server 8000` e abra `http://localhost:8000/auth.html`. Não abra os arquivos com duplo clique, pois o navegador pode bloquear requisições do Supabase em `file://`.
