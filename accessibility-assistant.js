(() => {
  "use strict";
  if (!window.supabase?.createClient || !window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY) return;
  const root = document.createElement("section");
  root.className = "a11y-assistant";
  root.innerHTML = '<details><summary>Ajuda de acessibilidade</summary><form><label for="a11yQuestion">Pergunte sobre como usar o Agenda+ ou sobre acessibilidade digital</label><textarea id="a11yQuestion" maxlength="700" rows="3" required placeholder="Ex.: como aumentar o texto?"></textarea><button type="submit">Perguntar</button><p role="status" aria-live="polite"></p></form></details>';
  document.body.append(root);
  const form = root.querySelector("form");
  const answer = root.querySelector('[role="status"]');
  const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = root.querySelector("textarea").value.trim();
    if (!question) return;
    const button = form.querySelector("button");
    button.disabled = true;
    answer.textContent = "Consultando o assistente…";
    try {
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) throw new Error("Entre na sua conta para usar o assistente.");
      const { data, error } = await client.functions.invoke("accessibility-assistant", { body: { question } });
      if (error) throw error;
      if (!data?.answer) throw new Error("O assistente não retornou uma resposta.");
      answer.textContent = data.answer;
    } catch (error) {
      answer.textContent = error?.message?.includes("FunctionsHttpError")
        ? "Assistente indisponível. Verifique se a função accessibility-assistant foi implantada e se OPENAI_API_KEY está configurada."
        : (error.message || "Não foi possível consultar o assistente.");
    } finally { button.disabled = false; }
  });
})();
