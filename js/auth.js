(() => {
  "use strict";

  const { createClient } = window.supabase;
  const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
  const form = document.getElementById("authForm");
  const nameField = document.getElementById("nameField");
  const nameInput = document.getElementById("name");
  const roleField = document.getElementById("roleField");
  const roleInputs = [...document.querySelectorAll('input[name="role"]')];
  const patientRoleOption = document.getElementById("patientRoleOption");
  const doctorRoleOption = document.getElementById("doctorRoleOption");
  const doctorFields = document.getElementById("doctorFields");
  const crmInput = document.getElementById("crm");
  const crmStateInput = document.getElementById("crmState");
  const specialtyInput = document.getElementById("specialty");
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

  function selectedRole() {
    return roleInputs.find((input) => input.checked)?.value || "patient";
  }

  function renderRole() {
    const isDoctor = selectedRole() === "doctor";
    doctorFields.hidden = !isDoctor;
    doctorFields.setAttribute("aria-hidden", String(!isDoctor));
    doctorRoleOption.classList.toggle("is-selected", isDoctor);
    patientRoleOption.classList.toggle("is-selected", !isDoctor);
    crmInput.required = isDoctor;
    crmStateInput.required = isDoctor;
    specialtyInput.required = isDoctor;
  }

  function renderMode() {
    const registering = mode === "register";
    nameField.hidden = !registering;
    roleField.hidden = !registering;
    nameInput.required = registering;
    passwordInput.autocomplete = registering ? "new-password" : "current-password";
    title.textContent = registering ? "Criar sua conta" : "Entrar no Agenda+";
    subtitle.textContent = registering ? "Escolha seu perfil e comece a usar o Agenda+." : "Acesse sua conta para agendar e acompanhar suas consultas.";
    submitButton.textContent = registering ? "Criar conta" : "Entrar";
    switchText.firstChild.textContent = registering ? "Já tem uma conta? " : "Ainda não tem uma conta? ";
    toggleMode.textContent = registering ? "Entrar" : "Criar conta";
    setMessage("");
    renderRole();
  }

  function redirectByRole(user) {
    const role = user?.user_metadata?.role;
    window.location.replace(role === "doctor" ? "doctor.html" : "index.html");
  }

  toggleMode.addEventListener("click", function () {
    mode = mode === "login" ? "register" : "login";
    window.history.replaceState({}, "", "auth.html" + (mode === "register" ? "?mode=register" : ""));
    form.reset();
    renderMode();
  });

  roleInputs.forEach((input) => input.addEventListener("change", renderRole));

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
        const role = selectedRole();
        if (!name) throw new Error("Digite seu nome completo.");

        const metadata = {
          full_name: name,
          role,
          phone: document.getElementById("phone").value.trim()
        };

        if (role === "doctor") {
          const crm = crmInput.value.trim();
          const crmState = crmStateInput.value;
          const specialty = specialtyInput.value;
          if (!crm || !crmState || !specialty) throw new Error("Preencha CRM, UF e especialidade para continuar.");
          metadata.crm = crm;
          metadata.crm_state = crmState;
          metadata.specialty = specialty;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: metadata }
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Conta criada. Verifique seu e-mail para confirmar o cadastro.", true);
          form.reset();
          renderRole();
        } else {
          redirectByRole(data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        redirectByRole(data.user);
      }
    } catch (error) {
      setMessage(error.message || "Não foi possível concluir a operação.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = mode === "register" ? "Criar conta" : "Entrar";
    }
  });

  supabase.auth.getSession().then(function ({ data }) {
    if (data.session) redirectByRole(data.session.user);
  });

  renderMode();
})();
