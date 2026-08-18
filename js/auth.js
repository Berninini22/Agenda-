(function () {
  "use strict";

  const { createClient } = window.supabase;
  const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
  const form = document.getElementById("authForm");
  const nameField = document.getElementById("nameField");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitButton = document.getElementById("authSubmit");
  const message = document.getElementById("authMessage");
  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const switchText = document.getElementById("authSwitchText");
  const toggleMode = document.getElementById("toggleMode");
  let mode = new URLSearchParams(window.location.search).get("mode") === "register" ? "register" : "login";

  function setMessage(text, isSuccess) {
    message.textContent = text || "";
    message.classList.toggle("is-success", Boolean(isSuccess));
  }

  function renderMode() {
    const registering = mode === "register";
    nameField.hidden = !registering;
    nameInput.required = registering;
    passwordInput.autocomplete = registering ? "new-password" : "current-password";
    title.textContent = registering ? "Criar sua conta" : "Entrar no Agenda+";
    subtitle.textContent = registering ? "Crie sua conta para agendar e acompanhar suas consultas." : "Acesse sua conta para agendar e acompanhar suas consultas.";
    submitButton.textContent = registering ? "Criar conta" : "Entrar";
    switchText.firstChild.textContent = registering ? "Já tem uma conta? " : "Ainda não tem uma conta? ";
    toggleMode.textContent = registering ? "Entrar" : "Criar conta";
    setMessage("");
  }

  toggleMode.addEventListener("click", function () {
    mode = mode === "login" ? "register" : "login";
    window.history.replaceState({}, "", "auth.html" + (mode === "register" ? "?mode=register" : ""));
    form.reset();
    renderMode();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setMessage("");
    submitButton.disabled = true;
    submitButton.textContent = mode === "register" ? "Criando conta..." : "Entrando...";

    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !emailInput.checkValidity()) throw new Error("Digite um e-mail válido.");
      if (password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");

      if (mode === "register") {
        const name = nameInput.value.trim();
        if (!name) throw new Error("Digite seu nome completo.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Conta criada. Verifique seu e-mail para confirmar o cadastro.", true);
          form.reset();
        } else {
          window.location.replace("index.html");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.replace("index.html");
      }
    } catch (error) {
      setMessage(error.message || "Não foi possível concluir a operação.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = mode === "register" ? "Criar conta" : "Entrar";
    }
  });

  supabase.auth.getSession().then(function ({ data }) {
    if (data.session) window.location.replace("index.html");
  });
  renderMode();
})();
