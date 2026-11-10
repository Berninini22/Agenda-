import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  const { question } = await req.json().catch(() => ({}));
  if (typeof question !== "string" || question.trim().length < 3 || question.length > 700) return new Response(JSON.stringify({ error: "invalid_question" }), { status: 400, headers: cors });
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "assistant_not_configured" }), { status: 503, headers: cors });
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini", temperature: 0.2, max_tokens: 400, messages: [ { role: "system", content: "Você é um assistente de acessibilidade para o Agenda+, sistema de agendamento brasileiro. Responda em português claro e curto, com recomendações práticas de acessibilidade digital. Pode orientar sobre navegação e sugerir melhorias gerais, mas não diagnostique, não peça dados pessoais e não prometa conformidade WCAG sem auditoria. Se perguntarem sobre saúde, emergência ou decisões clínicas, esclareça que não pode orientar clinicamente. Não afirme ter testado a interface." }, { role: "user", content: question.trim() } ] }) });
    const payload = await response.json();
    if (!response.ok) return new Response(JSON.stringify({ error: "provider_error" }), { status: 502, headers: cors });
    const answer = payload.choices?.[0]?.message?.content;
    if (typeof answer !== "string") throw new Error("empty answer");
    return new Response(JSON.stringify({ answer }), { headers: cors });
  } catch (_) {
    return new Response(JSON.stringify({ error: "assistant_unavailable" }), { status: 502, headers: cors });
  }
});
