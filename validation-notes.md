# Validação visual inicial

- A tela `auth.html?mode=register` carregou no servidor local sem erros aparentes.
- O formulário inicia com o perfil **Sou paciente** selecionado e não exibe os campos profissionais.
- Ao selecionar **Sou médico**, aparecem CRM, UF do CRM, especialidade e telefone profissional.
- Foi corrigida uma colisão de CSS que mantinha o bloco profissional visível mesmo oculto pelo atributo `hidden`.
- Os scripts `auth.js`, `script.js` e `doctor.js` passaram em `node --check`.

A rota `doctor.html` sem sessão redireciona para `auth.html`, e a rota `index.html` sem sessão mantém o mesmo bloqueio. Isso confirma que o novo painel não fica público por acidente.

O smoke test local retornou HTTP 200 para `auth.html`, `index.html`, `doctor.html`, `css/style.css`, os três scripts JavaScript, `supabase-schema.sql` e `README.md`. A checagem de sintaxe JavaScript também foi concluída sem erros.

## Correção de navegação

A versão inicialmente exibida pelo navegador estava em cache. Após abrir a página com um parâmetro de atualização, o cadastro passou a exibir o bloco **“É médico? — Sou médico”**, a opção de perfil médico e o link **“Voltar para o início”** apontando para `home.html`. A nova página pública `home.html` foi criada sem o script de sessão, portanto não exige login.

O novo teste confirmou que o botão **“Selecionar perfil médico”** funciona dentro da criação de conta: ele marca **“Sou médico”**, revela CRM, UF, especialidade e telefone, e foca no campo de CRM. Também foi adicionado versionamento dos assets da autenticação para evitar que a publicação mantenha JavaScript antigo em cache.

A nova `home.html` carregou como página pública, com opções de entrar, criar conta e cadastro profissional. A tela de login também passou a mostrar o botão **“Sou médico”**, e o link **“Voltar para o início”** aponta para `home.html` tanto no login quanto no cadastro.

O teste final confirmou que, na tela de login, clicar em **“Sou médico”** leva para `auth.html?mode=register&switch=1`, abrindo a criação de conta. O cadastro continua com o seletor de perfil e o retorno público para `home.html`.
