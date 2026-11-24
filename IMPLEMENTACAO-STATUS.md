# Agenda+ — status da implementação

## Diagnóstico encontrado

O README aponta como aplicação ativa um frontend estático HTML/CSS/JavaScript com Supabase Auth e tabelas `profiles` e `appointments`. A agenda dos médicos ainda é um objeto semanal JSON em `profiles.availability`; a seleção de médicos e parte dos horários tem comportamento local/de contingência. Há uma versão PHP/SQLite separada, que não é o backend da aplicação publicada. O SQLite enviado está íntegro, mas tem somente 1 usuário e 1 agendamento.

## Implementado nesta atualização

- Cadastro exige marcar o aceite dos Termos de Uso. A interface envia versão e timestamp de consentimento; a migração exige os metadados na criação do usuário e registra o horário do servidor no perfil.
- Nova página `terms.html`, link para leitura integral no cadastro e resumo de termos em `home.html`.
- Filtro na lista de consultas recebidas do médico por dia da semana e manhã/tarde.
- Migração Supabase adiciona estrutura relacional para locais, vínculos médico-local, slots recorrentes segmentados por dia e turno, logs de notificação e RPC transacional para reserva, com índice único como proteção contra dupla reserva.
- Painel assistivo recolhível conectado à Edge Function `accessibility-assistant`. A função exige usuário autenticado, valida tamanho da pergunta e usa chave de IA apenas no ambiente servidor. Sem implantação/chave, apresenta indisponibilidade, sem resposta fictícia.
- Mantido o VLibras Widget que já existia no projeto. O catálogo ConectaGov descreve funções de tradução para glosa, sinais e geração/consulta de vídeo; não é um serviço genérico de usuários. A descrição do catálogo lista `GET /signs`, `GET /translate`, operações `POST /video` e consulta/retorno do vídeo [1]. Esta versão não implementa chamadas diretas a essas rotas; conserva o Widget oficial já carregado.

## Arquivos criados/modificados

Criados: `terms.html`, `supabase-upgrade.sql`, `accessibility-assistant.js`, `supabase/functions/accessibility-assistant/index.ts` e este relatório.

Modificados: `auth.html`, `auth.js`, `home.html`, `doctor.html`, `doctor.js`, `index.html`, `css/style.css` e `README.md`.

## Como configurar

1. Faça backup do projeto Supabase. Execute primeiro `supabase-schema.sql` se o schema base ainda não estiver criado; depois revise e execute `supabase-upgrade.sql` no SQL Editor. O índice de unicidade pode falhar se já houver reservas duplicadas para o mesmo médico/data/hora; identifique e resolva esses casos antes de aplicar.
2. Para IA, publique `supabase/functions/accessibility-assistant/index.ts` como Edge Function `accessibility-assistant`; configure os secrets `OPENAI_API_KEY`, `APP_ORIGIN` e, opcionalmente, `OPENAI_MODEL`. O frontend chama a função somente com sessão autenticada. Não use chave de provedor nem `service_role` no browser.
3. O VLibras Widget existente não exige segredo publicado pela aplicação. Consulte o guia oficial para detalhes da incorporação [2].
4. Para WhatsApp Cloud API, são necessários conta/app Meta, número, token de usuário de sistema, permissões e webhook HTTPS. A documentação da Meta descreve envio de mensagens e webhook de status [3]. E-mail requer escolha e credencial de provedor.

## Testes executados

- `node --check` passou em `auth.js`, `script.js`, `doctor.js`, `accessibility.js` e `accessibility-assistant.js`.
- Parser HTML padrão leu sem erro as páginas `home.html`, `auth.html`, `index.html`, `doctor.html` e `terms.html`.
- Smoke test HTTP local obteve 200 nas páginas principais, SQL, cliente do assistente e função backend.
- SQLite legado retornou `integrity_check = ok`, com 1 linha em `users` e 1 em `appointments`.
- Não foram testados cadastro ou escrita no Supabase, execução PostgreSQL da migração, reserva concorrente real, retorno do modelo de IA, entrega de e-mail/WhatsApp nem navegação real em browser: dependem do projeto Supabase/credenciais e não são validados por testes estáticos.

## Pendências importantes — não declarar como TCC concluído

- A tela atual do médico ainda salva `profiles.availability` (JSON), não os novos registros `doctor_slots`; o seletor de locais também ainda não está ligado ao banco relacional. Portanto, cadastro de slots por local/manhã/tarde e filtro de agenda futura ainda exigem integração frontend/backend.
- O fluxo atual de agendamento ainda envia INSERT diretamente a `appointments`; o índice SQL bloqueia colisões por médico, mas a UI não chama ainda `book_appointment` nem atualiza a disponibilidade consultada a partir dos slots. A nova rotina deve ser integrada antes de considerar reservas plenamente transacionais.
- Foi acrescentado dispatcher de e-mail por Supabase Edge Function, fila SQL com deduplicação e cron; precisa aplicar `supabase-email-notifications.sql`, configurar secrets/domínio e publicar a função. O envio externo não foi testado nesta sessão. WhatsApp continua sem dispatcher.
- O requisito de 20 registros úteis não foi atingido: há quatro locais de demonstração na migração e a base SQLite legada contém dois registros úteis totais. Médicos e pacientes dependem de UUIDs válidos do Supabase Auth; não criei perfis fictícios ligados a contas inexistentes.
- O conteúdo dos Termos é uma base informativa para o projeto acadêmico e requer revisão jurídica e de privacidade antes de uso público real.

## Referências oficiais

[1]: https://www.gov.br/conecta/catalogo/apis/vlibras "Catálogo de APIs do Governo Federal: VLibras"
[2]: https://www.gov.br/governodigital/pt-br/estrategias-e-governanca-digital/sisp/guia-do-gestor/guia-orientativo-de-padroes-e-fluxos-das-tecnologias-de-transformacao-digital/vlibras-widget "Guia oficial do VLibras Widget"
[3]: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started "Documentação oficial da WhatsApp Cloud API"
