# Configuração de e-mails do Agenda+

O site publicado é estático e usa Supabase para autenticação, banco e funções. O envio das notificações usa a API HTTPS do Resend a partir de uma Supabase Edge Function. SMTP customizado do Supabase Auth atende e-mails de autenticação; não é um endpoint de envio arbitrário da agenda. Não coloque credenciais de e-mail no navegador.

## Instalação

1. No provedor transacional, crie uma chave de API e verifique o domínio usado no remetente. Escolha um endereço no domínio verificado, por exemplo `Agenda+ <agenda@seudominio.com>`.
2. No projeto Supabase, configure os secrets `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_CRON_SECRET` e `APP_ORIGIN`. Gere `EMAIL_CRON_SECRET` com valor aleatório longo. Os secrets padrão `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são usados no ambiente da Edge Function; nunca os copie para HTML/JavaScript. Exemplo sem credenciais reais: `.env.email.example`.
3. Abra `supabase-email-notifications.sql`, substitua `YOUR_PROJECT_REF`, `YOUR_SUPABASE_PUBLISHABLE_KEY` e `REPLACE_WITH_A_LONG_RANDOM_SECRET`. Use o mesmo segredo cron que configurou como `EMAIL_CRON_SECRET`. Execute o SQL Editor uma única vez após `supabase-schema.sql`. A migração cria histórico/fila, índices únicos, triggers de agendamento/reagendamento/cancelamento, função de claim concorrente e cron de cinco em cinco minutos. O SQL usa Vault para segredos do cron; não use service-role como chave de agendamento.
4. Com Supabase CLI conectado ao projeto certo, publique `supabase/functions/appointment-emails/index.ts` como `appointment-emails`. O arquivo `supabase/config.toml` desliga a validação JWT do gateway somente para essa função; o código verifica manualmente JWT de usuário para confirmação e segredo separado para o cron.
5. Publique o site atualizado para que `js/script.js` acione a confirmação assim que o banco concluir o agendamento. O cron também processa confirmações pendentes se a chamada imediata falhar.

## Comportamento

A inclusão de uma consulta cria uma confirmação e um lembrete na fila no próprio banco. A confirmação é enviada logo após o agendamento; se o pedido do navegador falhar, o cron tenta dentro de cinco minutos. O lembrete fica elegível às 09h de São Paulo no dia anterior à consulta. O worker obtém e-mail do usuário em Supabase Auth e consulta nome do paciente, perfil do médico, especialidade e local nas tabelas existentes.

Uma chave única por consulta/tipo/versão do horário impede filas duplicadas. O banco usa `FOR UPDATE SKIP LOCKED` e lease para evitar dois workers enviarem a mesma linha. O provedor recebe um `Idempotency-Key` estável. As tentativas e falhas ficam em `notification_log`; falhas repetem com atraso crescente até oito tentativas. Consultas canceladas são ignoradas. Se data ou hora mudarem, a linha de lembrete antiga é invalidada e outra é criada para a nova data/hora.

## Verificação do histórico

Consulte no SQL Editor:

```sql
select id, appointment_id, event, destination_masked, status, attempts,
       next_attempt_at, sent_at, last_error
from public.notification_log
where channel = 'email'
order by id desc;
```

Estados `sent`, `failed` e `skipped` distinguem envio, erro e cancelamento/reagendamento. Não marque manualmente falhas como enviadas. O envio real depende de domínio remetente verificado e secrets válidos. Sem eles, os registros ficam como falha e são tentados novamente conforme a política acima.

Com Supabase CLI, uma vez preenchido um arquivo local `.env.email` (não publique esse arquivo), as secrets podem ser carregadas com `supabase secrets set --env-file .env.email --project-ref SEU_PROJECT_REF`. Em seguida, faça `supabase functions deploy appointment-emails --project-ref SEU_PROJECT_REF`. O deploy e a migração no banco são passos separados.

## Referências oficiais

[1]: https://supabase.com/docs/guides/functions/schedule-functions "Agendamento de Edge Functions no Supabase"
[2]: https://supabase.com/docs/guides/auth/auth-smtp "SMTP personalizado do Supabase Auth"
[3]: https://resend.com/docs/api-reference/emails/send-email "API transacional de envio do Resend"
