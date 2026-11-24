import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const MAX_ATTEMPTS = 8;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
function htmlEscape(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
function dateLabel(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
function saoPauloTomorrowISO() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  const localToday = new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day"))));
  localToday.setUTCDate(localToday.getUTCDate() + 1);
  return localToday.toISOString().slice(0, 10);
}
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 1)}***@${domain}`;
}
function retryTime(attempts: number) {
  const minutes = Math.min(240, 5 * (2 ** Math.max(0, attempts - 1)));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("EMAIL_CRON_SECRET");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "supabase_not_configured" }, 503);

  const isScheduler = Boolean(cronSecret && req.headers.get("x-cron-secret") === cronSecret);
  let userId: string | null = null;
  if (!isScheduler) {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return json({ error: "unauthorized" }, 401);
    userId = user.id;
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const appointmentId = body.appointment_id == null ? null : Number(body.appointment_id);
  if (!isScheduler && (!Number.isSafeInteger(appointmentId) || appointmentId! <= 0)) return json({ error: "appointment_id_required" }, 400);
  if (!isScheduler && body.event !== "CONFIRMACAO") return json({ error: "only_confirmation_is_user_callable" }, 403);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: jobs, error: claimError } = await admin.rpc("claim_due_appointment_emails", {
    p_appointment_id: appointmentId,
    p_event: isScheduler ? null : "CONFIRMACAO",
    p_user_id: userId,
    p_limit: 20,
  });
  if (claimError) return json({ error: "queue_claim_failed", detail: claimError.message }, 500);
  if (!jobs?.length) return json({ sent: 0, failed: 0, skipped: 0, queued: 0 });

  if (!resendKey || !from) {
    for (const job of jobs) {
      await admin.from("notification_log").update({
        status: "failed", locked_at: null, last_error: "RESEND_API_KEY/EMAIL_FROM não configurados",
        error_code: "email_provider_not_configured",
        next_attempt_at: job.attempts < MAX_ATTEMPTS ? retryTime(job.attempts) : new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      }).eq("id", job.id);
    }
    return json({ sent: 0, failed: jobs.length, queued: jobs.length, error: "email_provider_not_configured" }, 503);
  }

  let sent = 0, failed = 0, skipped = 0;
  for (const job of jobs) {
    const { data: appointment, error: appointmentError } = await admin.from("appointments")
      .select("id,user_id,doctor_id,patient,specialty,professional,unit,date_iso,time,status")
      .eq("id", job.appointment_id).maybeSingle();
    const skip = async (reason: string) => {
      await admin.from("notification_log").update({ status: "skipped", locked_at: null, last_error: reason, next_attempt_at: new Date().toISOString() }).eq("id", job.id);
      skipped++;
    };
    if (appointmentError || !appointment) { await skip("consulta_nao_encontrada"); continue; }
    if (["Cancelada", "cancelada", "canceled"].includes(String(appointment.status))) { await skip("consulta_cancelada"); continue; }
    if (job.event === "LEMBRETE") {
      const tomorrow = saoPauloTomorrowISO();
      const currentSchedule = `${appointment.date_iso}T${String(appointment.time).slice(0, 5)}`;
      if (appointment.date_iso !== tomorrow) { await skip("data_nao_e_amanha"); continue; }
      if (job.schedule_signature !== currentSchedule) { await skip("lembrete_de_agendamento_antigo"); continue; }
    }

    const [authResult, patientResult, doctorResult] = await Promise.all([
      admin.auth.admin.getUserById(appointment.user_id),
      admin.from("profiles").select("full_name").eq("user_id", appointment.user_id).maybeSingle(),
      appointment.doctor_id ? admin.from("profiles").select("full_name,specialty").eq("user_id", appointment.doctor_id).maybeSingle() : Promise.resolve({ data: null, error: new Error("doctor_id_missing") }),
    ]);
    const recipient = authResult.data?.user?.email;
    const patientName = patientResult.data?.full_name || appointment.patient;
    // Prioriza o perfil atual; usa o retrato salvo na própria consulta como fallback legado.
    const doctorName = doctorResult.data?.full_name || appointment.professional;
    const specialty = doctorResult.data?.specialty || appointment.specialty;
    if (authResult.error || !recipient || !patientName || !doctorName || !specialty) {
      const reason = !recipient ? "email_do_paciente_nao_encontrado" : !doctorName ? "perfil_do_medico_nao_encontrado" : "dados_do_agendamento_incompletos";
      const backoff = job.attempts < MAX_ATTEMPTS ? retryTime(job.attempts) : new Date(Date.now() + 24 * 60 * 60_000).toISOString();
      await admin.from("notification_log").update({ status: "failed", locked_at: null, last_error: reason, error_code: reason, destination_masked: recipient ? maskEmail(recipient) : null, next_attempt_at: backoff }).eq("id", job.id);
      failed++;
      continue;
    }

    const appointmentDate = dateLabel(appointment.date_iso);
    const time = String(appointment.time).slice(0, 5);
    const location = appointment.unit || "Local não informado";
    const reminder = job.event === "LEMBRETE";
    const subject = reminder ? "Lembrete: sua consulta é amanhã!" : "Consulta agendada com sucesso!";
    const intro = reminder ? "Lembrete: sua consulta está marcada para amanhã." : "Sua consulta foi agendada com sucesso.";
    const safePatient = htmlEscape(patientName), safeDoctor = htmlEscape(doctorName), safeSpecialty = htmlEscape(specialty), safeDate = htmlEscape(appointmentDate), safeTime = htmlEscape(time), safeLocation = htmlEscape(location);
    const text = `${intro}\n\nPaciente: ${patientName}\nMédico: ${doctorName}\nEspecialidade: ${specialty}\nData: ${appointmentDate}\nHorário: ${time}\nLocal: ${location}\n\nAgenda+`;
    const html = `<main style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#15313d"><h1 style="font-size:24px">${htmlEscape(subject)}</h1><p>Olá, ${safePatient}.</p><p>${htmlEscape(intro)}</p><ul><li><b>Médico:</b> ${safeDoctor}</li><li><b>Especialidade:</b> ${safeSpecialty}</li><li><b>Data:</b> ${safeDate}</li><li><b>Horário:</b> ${safeTime}</li><li><b>Local:</b> ${safeLocation}</li></ul><p>Agenda+</p></main>`;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `agenda-email-${job.id}` },
        body: JSON.stringify({ from, to: [recipient], subject, text, html }),
        signal: AbortSignal.timeout(12_000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.id) throw new Error(`provider_${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
      const { error: updateError } = await admin.from("notification_log").update({
        status: "sent", sent_at: new Date().toISOString(), locked_at: null, last_error: null, error_code: null,
        provider_message_id: payload.id, destination_masked: maskEmail(recipient), next_attempt_at: new Date().toISOString(),
      }).eq("id", job.id);
      if (updateError) throw new Error(`log_update_failed: ${updateError.message}`);
      sent++;
    } catch (error) {
      const reason = String(error instanceof Error ? error.message : error).slice(0, 700);
      const nextAttempt = job.attempts < MAX_ATTEMPTS ? retryTime(job.attempts) : new Date(Date.now() + 24 * 60 * 60_000).toISOString();
      await admin.from("notification_log").update({
        status: "failed", locked_at: null, last_error: reason, error_code: "email_send_failed",
        destination_masked: maskEmail(recipient), next_attempt_at: nextAttempt,
      }).eq("id", job.id);
      failed++;
    }
  }
  return json({ sent, failed, skipped, queued: 0 });
});
