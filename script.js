(function () {
  "use strict";

  /* ===================================================
     Catálogo de especialidades da agenda
     =================================================== */
  const SPECIALTIES = [
    { id: "clinico", name: "Clínico Geral", icon: "🩺", meta: "Cuida da saúde em geral", help: "Para avaliar sintomas e orientar os próximos cuidados.", telehealth: false },
    { id: "cardio", name: "Cardiologia", icon: "❤️", meta: "Cuida do coração", help: "Para cuidar do coração e da circulação.", telehealth: false },
    { id: "pediatria", name: "Pediatria", icon: "🧒", meta: "Cuida de crianças", help: "Para crianças e adolescentes.", telehealth: false },
    { id: "dermato", name: "Dermatologia", icon: "🌿", meta: "Cuida da pele", help: "Para problemas de pele, cabelo e unhas.", telehealth: true },
    { id: "ortopedia", name: "Ortopedia", icon: "🦴", meta: "Cuida de ossos e juntas", help: "Para dores e problemas nos ossos, músculos e juntas.", telehealth: false },
    { id: "psicologia", name: "Psicologia", icon: "🧠", meta: "Cuida da saúde emocional", help: "Para conversar sobre emoções, ansiedade e dificuldades do dia a dia.", telehealth: true },
    { id: "nutricao", name: "Nutrição", icon: "🥗", meta: "Cuida da alimentação", help: "Para organizar a alimentação e cuidar da saúde.", telehealth: true },
    { id: "ginecologia", name: "Ginecologia", icon: "🌸", meta: "Cuida da saúde da mulher", help: "Para prevenção e cuidados da saúde da mulher.", telehealth: false },
    { id: "neurologia", name: "Neurologia", icon: "🧠", meta: "Cuida do sistema nervoso", help: "Para avaliar cérebro, nervos, memória e movimentos.", telehealth: false }
  ];

  const PROFESSIONALS = Object.fromEntries(SPECIALTIES.map((specialty) => [specialty.id, []]));

  const DOW_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

  /* ===================================================
     Estado da aplicação (em memória, sem localStorage)
     =================================================== */
  const state = {
    step: 1,
    specialtyId: null,
    professionalId: null,
    dateISO: null,
    time: null,
    locationId: null,
    mode: null
  };

  let appointments = [];
  let doctorDirectory = [];
  let pendingCancellation = null;
  let slotLoadRequest = 0;
  const supabaseClient = window.supabase && window.SUPABASE_URL && window.SUPABASE_PUBLISHABLE_KEY
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY)
    : null;
  let currentUser = null;

  async function requireSession() {
    if (!supabaseClient) {
      showToast("A agenda está pronta, mas falta configurar a conexão com o Supabase.", "error");
      return false;
    }
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data.session) {
      window.location.replace("auth.html");
      return false;
    }
    currentUser = data.session.user;
    if (currentUser.user_metadata && currentUser.user_metadata.role === "doctor") {
      window.location.replace("doctor.html");
      return false;
    }
    const welcome = document.getElementById("userWelcome");
    const fullName = currentUser.user_metadata && currentUser.user_metadata.full_name;
    welcome.textContent = "Olá, " + (fullName || currentUser.email || "usuário");
    return true;
  }

  async function loadAppointments() {
    const { data, error } = await supabaseClient
      .from("appointments")
      .select("id, patient, mode, specialty, professional, unit, date_iso, time")
      .order("date_iso", { ascending: true })
      .order("time", { ascending: true });
    if (error) throw error;
    appointments = (data || []).map((item) => ({ ...item, dateISO: item.date_iso }));
    renderAppointments();
  }

  async function loadDoctors() {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("user_id, full_name, crm, crm_state, specialty, avatar_url, clinic_name, clinic_address, availability")
      .eq("role", "doctor")
      .order("full_name", { ascending: true });
    if (error) throw error;
    doctorDirectory = data || [];
    SPECIALTIES.forEach((specialty) => { PROFESSIONALS[specialty.id] = []; });
    doctorDirectory.forEach((doctor) => {
      const specialty = SPECIALTIES.find((item) => item.name === doctor.specialty);
      if (!specialty) return;
      PROFESSIONALS[specialty.id].push({
        id: "doctor-" + doctor.user_id,
        user_id: doctor.user_id,
        name: doctor.full_name || "Médico de demonstração — TESTE",
        crm: doctor.crm
          ? `CRM ${doctor.crm}${doctor.crm_state ? "-" + doctor.crm_state : ""}`
          : "Profissional de demonstração — TESTE",
        avatar_url: doctor.avatar_url || "",
        availability: doctor.availability || {},
        units: [{
          id: "profile-unit-" + doctor.user_id,
          name: doctor.clinic_name || "Atendimento profissional",
          address: doctor.clinic_address || "Local a confirmar"
        }]
      });
    });
  }

  /* ===================================================
     Utilidades
     =================================================== */
  function buildNextDays(count) {
    const days = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  }

  function formatDateLabel(date) {
    return { dow: DOW_LABELS[date.getDay()], dom: String(date.getDate()).padStart(2, "0") };
  }

  function isoOf(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function formatFullDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  }

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[char]);
  }

  function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.toggle("is-error", type === "error");
    toast.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 3600);
  }

  function friendlyError(error, fallback) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("permission") || message.includes("row-level") || message.includes("policy")) {
      return "Você não tem permissão para fazer isso. Entre novamente e tente outra vez.";
    }
    if (message.includes("network") || message.includes("fetch") || message.includes("failed")) {
      return "A internet parece estar instável. Confira sua conexão e tente novamente.";
    }
    return fallback;
  }

  function closeCancellationDialog(restoreFocus = true) {
    const dialog = document.getElementById("confirmDialog");
    const previousFocus = pendingCancellation?.button;
    dialog.hidden = true;
    document.body.classList.remove("dialog-open");
    pendingCancellation = null;
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus();
  }

  function openCancellationDialog(appointment, button) {
    pendingCancellation = { appointment, button };
    const dialog = document.getElementById("confirmDialog");
    const text = document.getElementById("confirmDialogText");
    text.textContent = "Você deseja realmente cancelar a consulta de " + appointment.professional + ", marcada para " + formatFullDate(appointment.dateISO) + " às " + appointment.time + "?";
    dialog.hidden = false;
    document.body.classList.add("dialog-open");
    document.getElementById("confirmDialogProceed").focus();
  }

  document.getElementById("confirmDialogCancel").addEventListener("click", () => closeCancellationDialog(true));
  document.querySelector("[data-confirm-close]").addEventListener("click", () => closeCancellationDialog(true));
  document.getElementById("confirmDialog").addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCancellationDialog(true);
  });
  document.getElementById("confirmDialogProceed").addEventListener("click", async () => {
    if (!pendingCancellation) return;
    const { appointment, button } = pendingCancellation;
    closeCancellationDialog(false);
    button.disabled = true;
    button.textContent = "Cancelando...";
    try {
      const { error } = await supabaseClient.from("appointments").delete().eq("id", appointment.id).eq("user_id", currentUser.id);
      if (error) throw error;
      appointments = appointments.filter((item) => item.id !== appointment.id);
      renderAppointments();
      showToast("Pronto! A consulta foi cancelada.");
    } catch (error) {
      button.disabled = false;
      button.textContent = "Cancelar";
      showToast(friendlyError(error, "Não foi possível cancelar a consulta. Tente novamente."), "error");
    }
  });

  const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const APPOINTMENT_DURATION_MINUTES = 60;

  function selectedProfessional() {
    const specialty = SPECIALTIES.find((item) => item.id === state.specialtyId);
    return specialty ? PROFESSIONALS[specialty.id].find((item) => item.id === state.professionalId) : null;
  }

  function timeToMinutes(value) {
    const parts = String(value || "").slice(0, 5).split(":").map(Number);
    return parts.length === 2 && parts.every(Number.isFinite) ? parts[0] * 60 + parts[1] : NaN;
  }

  function periodsForDay(pro, iso) {
    const weekday = new Date(`${iso}T12:00:00`).getDay();
    const day = pro?.availability?.[DAY_KEYS[weekday]];
    if (!day || typeof day !== "object") return [];
    if (day.morning || day.afternoon) {
      return [day.morning, day.afternoon].filter((period) => period?.enabled)
        .map((period) => ({ start: period.start, end: period.end }));
    }
    return day.enabled ? [{ start: day.start, end: day.end }] : [];
  }

  function hasScheduledHours(pro, iso) {
    return periodsForDay(pro, iso).some((period) => {
      const start = timeToMinutes(period.start);
      const end = timeToMinutes(period.end);
      return Number.isFinite(start) && Number.isFinite(end) && end - start >= APPOINTMENT_DURATION_MINUTES;
    });
  }

  /* ===================================================
     Renderização — Passo 1: Especialidade
     =================================================== */
  function renderSpecialties() {
    const grid = document.getElementById("specialtyGrid");
    grid.innerHTML = "";
    const availableSpecialties = SPECIALTIES.filter((sp) => PROFESSIONALS[sp.id]?.length);
    if (!availableSpecialties.length) {
      grid.appendChild(el("p", "booking-empty", "Ainda não há médicos cadastrados para agendamento. Volte mais tarde ou fale com a clínica."));
      return;
    }
    availableSpecialties.forEach((sp) => {
      const card = el("button", "option-card");
      card.type = "button";
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", String(state.specialtyId === sp.id));
      card.innerHTML =
        '<span class="opt-icon">' + sp.icon + '</span>' +
        '<span class="opt-name">' + sp.name + '</span>' +
        '<span class="opt-meta">' + sp.meta + '</span>' +
        '<span class="opt-help">' + sp.help + '</span>';
      card.addEventListener("click", () => {
        state.specialtyId = sp.id;
        state.professionalId = null;
        state.locationId = null;
        state.dateISO = null;
        state.time = null;
        state.mode = null;
        renderSpecialties();
        setStatus("");
      });
      grid.appendChild(card);
    });
  }

  /* ===================================================
     Renderização — Passo 2: Profissional
     =================================================== */
  function renderProfessionals() {
    const list = document.getElementById("professionalList");
    const hint = document.getElementById("specialtyHint");
    list.innerHTML = "";

    if (!state.specialtyId) {
      hint.textContent = "Volte e escolha uma especialidade primeiro.";
      return;
    }
    const specialty = SPECIALTIES.find((s) => s.id === state.specialtyId);
    hint.textContent = "Escolha um médico. Especialidade: " + specialty.name + ".";

    PROFESSIONALS[state.specialtyId].forEach((pro) => {
      const row = el("button", "professional-row");
      row.type = "button";
      row.setAttribute("role", "radio");
      row.setAttribute("aria-checked", String(state.professionalId === pro.id));
      const initials = pro.name.split(" ").filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join("");
      const unitNames = pro.units.map((u) => u.name).join(" · ");
      row.innerHTML =
        '<span class="pro-avatar" aria-hidden="true">' + escapeHTML(initials) + '</span>' +
        '<span class="pro-info">' +
        '<span class="pro-name">' + escapeHTML(pro.name) + '</span><br>' +
        '<span class="pro-meta">' + escapeHTML(pro.crm) + '</span><br>' +
        '<span class="pro-meta">Atende em: ' + escapeHTML(unitNames) + '</span>' +
        '</span>';
      row.addEventListener("click", () => {
        state.professionalId = pro.id;
        state.locationId = null;
        state.mode = null;
        state.dateISO = null;
        state.time = null;
        renderProfessionals();
        setStatus("");
      });
      list.appendChild(row);
    });
  }

  /* ===================================================
     Renderização — Passo 3: Data e horário
     =================================================== */
  function renderDates() {
    const scroller = document.getElementById("dateScroller");
    scroller.innerHTML = "";
    buildNextDays(10).forEach((date) => {
      const iso = isoOf(date);
      const { dow, dom } = formatDateLabel(date);
      const chip = el("button", "date-chip");
      chip.type = "button";
      chip.setAttribute("role", "radio");
      chip.setAttribute("aria-checked", String(state.dateISO === iso));
      chip.setAttribute("aria-label", formatFullDate(iso));
      const hasHours = hasScheduledHours(selectedProfessional(), iso);
      if (!hasHours) {
        chip.disabled = true;
        chip.setAttribute("aria-label", formatFullDate(iso) + ", sem atendimento");
      }
      chip.innerHTML = '<span class="dow">' + dow + '</span><span class="dom">' + dom + '</span>';
      chip.addEventListener("click", () => {
        state.dateISO = iso;
        state.time = null;
        renderDates();
        renderTimes();
        setStatus("");
      });
      scroller.appendChild(chip);
    });
  }

  async function renderTimes() {
    const grid = document.getElementById("timeGrid");
    const requestId = ++slotLoadRequest;
    grid.innerHTML = "";
    if (!state.dateISO) return;
    const pro = selectedProfessional();
    if (!pro?.user_id) {
      grid.appendChild(el("p", "booking-empty", "Escolha um médico cadastrado para ver os horários."));
      return;
    }
    if (!hasScheduledHours(pro, state.dateISO)) {
      grid.appendChild(el("p", "booking-empty", "Este médico não atende neste dia."));
      return;
    }
    grid.appendChild(el("p", "booking-loading", "Carregando horários disponíveis…"));
    try {
      const { data, error } = await supabaseClient.rpc("available_appointment_times", {
        p_doctor_id: pro.user_id,
        p_date: state.dateISO
      });
      if (requestId !== slotLoadRequest) return;
      if (error) throw error;
      grid.innerHTML = "";
      const times = (data || []).map((row) => String(row.slot_time).slice(0, 5));
      if (!times.length) {
        grid.appendChild(el("p", "booking-empty", "Não há horários livres para este dia. Escolha outra data."));
        return;
      }
      times.forEach((time) => {
        const chip = el("button", "time-chip");
        chip.type = "button";
        chip.textContent = time;
        chip.setAttribute("role", "radio");
        chip.setAttribute("aria-checked", String(state.time === time));
        chip.addEventListener("click", () => {
          state.time = time;
          grid.querySelectorAll(".time-chip").forEach((button) => {
            button.setAttribute("aria-checked", String(button.textContent === time));
          });
          setStatus("");
        });
        grid.appendChild(chip);
      });
    } catch (error) {
      if (requestId !== slotLoadRequest) return;
      grid.innerHTML = "";
      grid.appendChild(el("p", "booking-empty", "Não foi possível consultar os horários. Tente novamente."));
      setStatus(friendlyError(error, "Não foi possível consultar os horários do médico."));
    }
  }

  /* ===================================================
     Renderização — Passo 4: Local de atendimento
     =================================================== */
  function renderLocations() {
    const list = document.getElementById("locationList");
    const hint = document.getElementById("locationHint");
    list.innerHTML = "";

    const specialty = SPECIALTIES.find((s) => s.id === state.specialtyId);
    const pro = specialty ? PROFESSIONALS[specialty.id].find((p) => p.id === state.professionalId) : null;

    if (!pro) {
      hint.textContent = "Volte e escolha o profissional primeiro.";
      return;
    }
    hint.textContent = "Escolha uma unidade onde " + pro.name + " atende.";

    pro.units.forEach((unit) => {
      const row = el("button", "professional-row");
      row.type = "button";
      row.setAttribute("role", "radio");
      row.setAttribute("aria-checked", String(state.locationId === unit.id));
      row.innerHTML =
        '<span class="pro-avatar" aria-hidden="true">📍</span>' +
        '<span class="pro-info">' +
        '<span class="pro-name">' + unit.name + '</span><br>' +
        '<span class="pro-meta">' + unit.address + '</span>' +
        '</span>';
      row.addEventListener("click", () => {
        state.locationId = unit.id;
        renderLocations();
        setStatus("");
      });
      list.appendChild(row);
    });
  }

  /* ===================================================
     Renderização — Passo 4: formato e local
     =================================================== */
  function renderModes() {
    const list = document.getElementById("modeOptions");
    const locationChoice = document.getElementById("locationChoice");
    const modeHint = document.getElementById("modeHint");
    const specialty = SPECIALTIES.find((s) => s.id === state.specialtyId);
    list.innerHTML = "";
    if (!specialty) {
      modeHint.textContent = "Volte e escolha uma especialidade primeiro.";
      locationChoice.hidden = true;
      return;
    }

    const modes = [{
      id: "presencial",
      icon: "📍",
      name: "Presencial",
      help: "Você irá até uma unidade de atendimento."
    }];
    if (specialty.telehealth) {
      modes.push({
        id: "teleconsulta",
        icon: "💻",
        name: "Por vídeo",
        help: "Você conversa com o profissional pela internet."
      });
    }

    modeHint.textContent = specialty.telehealth
      ? "Para esta especialidade, você pode escolher uma unidade ou conversar por vídeo."
      : "Esta especialidade precisa de atendimento presencial em uma unidade.";

    modes.forEach((mode) => {
      const row = el("button", "professional-row mode-row");
      row.type = "button";
      row.setAttribute("role", "radio");
      row.setAttribute("aria-checked", String(state.mode === mode.id));
      row.innerHTML = '<span class="pro-avatar" aria-hidden="true">' + mode.icon + '</span>' +
        '<span class="pro-info"><span class="pro-name">' + mode.name + '</span><br>' +
        '<span class="pro-meta">' + mode.help + '</span></span>';
      row.addEventListener("click", () => {
        state.mode = mode.id;
        state.locationId = mode.id === "teleconsulta" ? "online" : null;
        renderModes();
      });
      list.appendChild(row);
    });

    locationChoice.hidden = state.mode !== "presencial";
    if (state.mode === "presencial") renderLocations();
  }

  /* ===================================================
     Renderização — Passo 5: Confirmação
     =================================================== */
  function renderSummary() {
    const card = document.getElementById("summaryCard");
    const specialty = SPECIALTIES.find((s) => s.id === state.specialtyId);
    const pro = specialty ? PROFESSIONALS[specialty.id].find((p) => p.id === state.professionalId) : null;
    const unit = pro ? pro.units.find((u) => u.id === state.locationId) : null;
    const locationText = state.mode === "teleconsulta"
      ? "Por vídeo — o link será enviado após a confirmação"
      : (unit ? unit.name + " — " + unit.address : "—");

    card.innerHTML =
      row("Especialidade", specialty ? specialty.name : "—") +
      row("Profissional", pro ? pro.name : "—") +
      row("Data", state.dateISO ? formatFullDate(state.dateISO) : "—") +
      row("Horário", state.time || "—") +
      row("Formato", state.mode === "teleconsulta" ? "Por vídeo" : "Presencial") +
      row("Local", locationText);

    function row(label, value) {
      return '<div class="sum-row"><span class="sum-label">' + escapeHTML(label) + '</span><span class="sum-value">' + escapeHTML(value) + '</span></div>';
    }
  }

  /* ===================================================
     Stepper: navegação
     =================================================== */
  const stepPanels = document.querySelectorAll(".step-panel");
  const stepItems = document.querySelectorAll(".step");
  const btnBack = document.getElementById("btnBack");
  const btnNext = document.getElementById("btnNext");
  const statusEl = document.getElementById("bookingStatus");

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function goToStep(n) {
    state.step = n;
    stepPanels.forEach((p) => p.classList.toggle("is-active", Number(p.dataset.panel) === n));
    stepItems.forEach((s) => {
      const idx = Number(s.dataset.step);
      s.classList.toggle("is-active", idx === n);
      s.classList.toggle("is-done", idx < n);
    });
    btnBack.disabled = n === 1;
    btnNext.textContent = n === 5 ? "Confirmar agendamento" : "Continuar";

    if (n === 2) renderProfessionals();
    if (n === 3) { renderDates(); renderTimes(); }
    if (n === 4) renderModes();
    if (n === 5) renderSummary();

    setStatus("");
    document.querySelector(".booking-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validateStep(n) {
if (n === 1 && !state.specialtyId) return "Escolha o tipo de médico que você precisa.";
    if (n === 2 && !state.professionalId) return "Escolha um médico para continuar.";
    if (n === 3 && (!state.dateISO || !state.time)) return "Escolha um dia e um horário disponíveis.";
    if (n === 4 && !state.mode) return "Escolha se a consulta será presencial ou por vídeo.";
    if (n === 4 && state.mode === "presencial" && !state.locationId) return "Escolha uma unidade para ser atendido.";
    return "";
  }

  btnNext.addEventListener("click", () => {
    if (state.step < 5) {
      const error = validateStep(state.step);
      if (error) { setStatus(error); return; }
      goToStep(state.step + 1);
      return;
    }
    // step 5: confirmar
    const nameInput = document.getElementById("patientName");
if (!nameInput.value.trim()) {
      setStatus("Digite seu nome completo para confirmar a consulta.");
      nameInput.focus();
      return;
    }
    confirmAppointment(nameInput.value.trim(), state.mode);
  });

  btnBack.addEventListener("click", () => {
    if (state.step > 1) goToStep(state.step - 1);
  });

  /* ===================================================
     Confirmação e lista de consultas
     =================================================== */
    async function confirmAppointment(name, mode) {

    const specialty = SPECIALTIES.find((s) => s.id === state.specialtyId);
    const pro = PROFESSIONALS[state.specialtyId].find((p) => p.id === state.professionalId);
    const unit = mode === "teleconsulta"
      ? { name: "Atendimento por vídeo" }
      : pro.units.find((u) => u.id === state.locationId);

    if (!unit) {
      setStatus("Escolha uma unidade antes de confirmar a consulta.");
      return;
    }

    try {
      const { data: bookedData, error } = await supabaseClient.rpc("book_appointment", {
        p_user_id: currentUser.id,
        p_doctor_id: pro.user_id,
        p_patient: name,
        p_mode: mode,
        p_specialty: specialty.name,
        p_professional: pro.name,
        p_unit: unit.name,
        p_date: state.dateISO,
        p_time: state.time,
        p_location_id: null,
        p_slot_id: null
      });
      if (error) throw error;
      const bookedAppointment = Array.isArray(bookedData) ? bookedData[0] : bookedData;
      let emailPending = false;
      if (bookedAppointment?.id) {
        try {
          const { data: emailResult, error: emailInvokeError } = await supabaseClient.functions.invoke("appointment-emails", {
            body: { appointment_id: bookedAppointment.id, event: "CONFIRMACAO" }
          });
          emailPending = Boolean(emailInvokeError || emailResult?.failed);
        } catch (_) {
          emailPending = true; // O cron processará a confirmação pendente.
        }
      }
      await loadAppointments();
      if (emailPending) showToast("Consulta marcada. O e-mail de confirmação ficou na fila para nova tentativa.", "error");
      else showToast("Pronto! Sua consulta foi marcada com " + pro.name + ".");
    } catch (error) {
      const reason = String(error?.message || "").toLowerCase();
      if (reason.includes("slot_already_booked") || reason.includes("slot_unavailable")) {
        setStatus("Esse horário acabou de ficar indisponível. Escolha outro horário.");
        await renderTimes();
      } else {
        setStatus(friendlyError(error, "Não foi possível marcar a consulta. Verifique sua internet e tente novamente."));
      }
      return;
    }

    // reset do formulário para um novo agendamento
    state.specialtyId = null;
    state.professionalId = null;
    state.dateISO = null;
    state.time = null;
    state.locationId = null;
    state.mode = null;
    document.getElementById("patientName").value = "";
    renderSpecialties();
    goToStep(1);

    document.getElementById("minhas-consultas").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderAppointments() {
    const list = document.getElementById("appointmentsList");
    const empty = document.getElementById("emptyState");
    list.innerHTML = "";

    if (appointments.length === 0) {
      empty.classList.remove("is-hidden");
      return;
    }
    empty.classList.add("is-hidden");

    appointments.forEach((appt) => {
      const date = new Date(appt.dateISO + "T00:00:00");
      const { dow, dom } = formatDateLabel(date);
      const card = el("article", "appointment-card");
      card.innerHTML =
        '<div class="appt-date"><span class="dow">' + dow + '</span><span class="dom">' + dom + '</span></div>' +
        '<div class="appt-info">' +
        '<div class="appt-specialty">' + appt.specialty + ' · ' + appt.time + '</div>' +
        '<div class="appt-meta">' + appt.professional + ' — ' + appt.unit + '</div>' +
        '<div class="appt-meta">Paciente: ' + appt.patient + '</div>' +
        '</div>' +
        '<span class="appt-badge">' + (appt.mode === "teleconsulta" ? "Teleconsulta" : "Presencial") + '</span>';

      const cancelBtn = el("button", "appt-cancel", "Cancelar consulta");
      cancelBtn.type = "button";
      cancelBtn.setAttribute("aria-label", "Cancelar consulta de " + appt.professional + " em " + formatFullDate(appt.dateISO));
      cancelBtn.addEventListener("click", () => openCancellationDialog(appt, cancelBtn));
      card.appendChild(cancelBtn);
      list.appendChild(card);
    });
  }



  /* ===================================================
     Menu mobile
     =================================================== */
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("main-nav");
  menuToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  /* ===================================================
     Inicialização
     =================================================== */
  async function init() {
    // Mostra a primeira etapa imediatamente; a rede não deve deixar a tela vazia.
    renderSpecialties();
    renderAppointments();
    goToStep(1);
    if (!(await requireSession())) return;
    try {
      await loadDoctors();
      renderSpecialties();
    } catch (error) {
      showToast("Não foi possível carregar médicos cadastrados. Você ainda pode escolher uma opção.", "error");
    }
    try {
      await loadAppointments();
    } catch (error) {
      showToast("Não foi possível carregar suas consultas. Confira sua internet e tente novamente.", "error");
    }
  }

  document.getElementById("logoutButton").addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    window.location.replace("auth.html");
  });

  document.addEventListener("DOMContentLoaded", init);
})();
