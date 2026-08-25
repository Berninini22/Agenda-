# Validação visual inicial

- A tela `auth.html?mode=register` carregou no servidor local sem erros aparentes.
- O formulário inicia com o perfil **Sou paciente** selecionado e não exibe os campos profissionais.
- Ao selecionar **Sou médico**, aparecem CRM, UF do CRM, especialidade e telefone profissional.
- Foi corrigida uma colisão de CSS que mantinha o bloco profissional visível mesmo oculto pelo atributo `hidden`.
- Os scripts `auth.js`, `script.js` e `doctor.js` passaram em `node --check`.

A rota `doctor.html` sem sessão redireciona para `auth.html`, e a rota `index.html` sem sessão mantém o mesmo bloqueio. Isso confirma que o novo painel não fica público por acidente.

O smoke test local retornou HTTP 200 para `auth.html`, `index.html`, `doctor.html`, `css/style.css`, os três scripts JavaScript, `supabase-schema.sql` e `README.md`. A checagem de sintaxe JavaScript também foi concluída sem erros.
