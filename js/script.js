(function () {
  "use strict";

  /* ===================================================
     Dados mockados (simulam um back-end)
     =================================================== */
  const SPECIALTIES = [
    { id: "clinico", name: "Clínico Geral", icon: "🩺", meta: "Avaliação geral" },
    { id: "cardio", name: "Cardiologia", icon: "❤️", meta: "Coração e circulação" },
    { id: "pediatria", name: "Pediatria", icon: "🧒", meta: "Crianças e adolescentes" },
    { id: "dermato", name: "Dermatologia", icon: "🌿", meta: "Pele, cabelo e unhas" },
    { id: "ortopedia", name: "Ortopedia", icon: "🦴", meta: "Ossos e articulações" }
  ];

  /* Cada profissional pode atender em mais de uma unidade */
  const UNITS = {
    centro: { id: "centro", name: "Unidade Centro", address: "Av. Paulista, 1200 — Centro" },
    norte: { id: "norte", name: "Unidade Norte", address: "Rua Voluntários da Pátria, 450 — Norte" },
    sul: { id: "sul", name: "Unidade Sul", address: "Av. Interlagos, 980 — Sul" }
  };

  const PROFESSIONALS = {
    clinico: [
      { id: "p1", name: "Dr. Marcos Vieira", crm: "CRM 12345-SP", units: [UNITS.centro, UNITS.norte] },
      { id: "p2", name: "Dra. Beatriz Nunes", crm: "CRM 22110-SP", units: [UNITS.norte] }
    ],
    cardio: [
      { id: "p3", name: "Dra. Helena Duarte", crm: "CRM 33456-SP", units: [UNITS.centro, UNITS.sul] },
      { id: "p4", name: "Dr. Otávio Ramos", crm: "CRM 44120-SP", units: [UNITS.sul] }
    ],
    pediatria: [
      { id: "p5", name: "Dra. Camila Prado", crm: "CRM 55678-SP", units: [UNITS.norte, UNITS.centro] }
    ],
    dermato: [
      { id: "p6", name: "Dr. Felipe Costa", crm: "CRM 66789-SP", units: [UNITS.centro] },
      { id: "p7", name: "Dra. Renata Lima", crm: "CRM 77234-SP", units: [UNITS.sul, UNITS.norte] }
    ],
    ortopedia: [
      { id: "p8", name: "Dr. André Silveira", crm: "CRM 88345-SP", units: [UNITS.sul, UNITS.centro] }
    ]
  };

  const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
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
    locationId: null
  };

  let appointments = [];
  let doctorDirectory = [];
  const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
  let currentUser = null;

  async function requireSession() {
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
      .select("user_id, full_name, crm, crm_state, specialty, avatar_url, clinic_name, clinic_address")
      .eq("role", "doctor")
      .order("full_name", { ascending: true });
    if (error) return;
    doctorDirectory = data || [];
    doctorDirectory.forEach((doctor) => {
      const specialty = SPECIALTIES.find((item) => item.name === doctor.specialty);
      if (!specialty || PROFESSIONALS[specialty.id].some((item) => item.user_id === doctor.user_id)) return;
      PROFESSIONALS[specialty.id].push({
        id: "doctor-" + doctor.user_id,
        user_id: doctor.user_id,
        name: doctor.full_name || "Médico Agenda+",
        crm: doctor.crm ? "CRM " + doctor.crm + (doctor.crm_state ? "-" + doctor.crm_state : "") : "CRM não informado",
        avatar_url: doctor.avatar_url || "",
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
    return date.toISOString().slice(0, 10);
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

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  /* Slots indisponíveis simulados, determinísticos por data */
  function unavailableSlotsFor(iso) {
    const seed = iso.split("-").join("");
    const n = parseInt(seed, 10) % TIME_SLOTS.length;
    return new Set([TIME_SLOTS[n], TIME_SLOTS[(n + 3) % TIME_SLOTS.length]]);
  }

  /* ===================================================
     Renderização — Passo 1: Especialidade
     =================================================== */
  function renderSpecialties() {
    const grid = document.getElementById("specialtyGrid");
    grid.innerHTML = "";
    SPECIALTIES.forEach((sp) => {
      const card = el("button", "option-card");
      card.type = "button";
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", String(state.specialtyId === sp.id));
      card.innerHTML =
        '<span class="opt-icon">' + sp.icon + '</span>' +
        '<span class="opt-name">' + sp.name + '</span>' +
        '<span class="opt-meta">' + sp.meta + '</span>';
      card.addEventListener("click", () => {
        state.specialtyId = sp.id;
        state.professionalId = null;
        state.locationId = null;
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
    hint.textContent = "Profissionais disponíveis em " + specialty.name + ":";

    PROFESSIONALS[state.specialtyId].forEach((pro) => {
      const row = el("button", "professional-row");
      row.type = "button";
      row.setAttribute("role", "radio");
      row.setAttribute("aria-checked", String(state.professionalId === pro.id));
      const initials = pro.name.split(" ").filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join("");
      const unitNames = pro.units.map((u) => u.name).join(" · ");
      row.innerHTML =
        '<span class="pro-avatar" aria-hidden="true">' + initials + '</span>' +
        '<span class="pro-info">' +
        '<span class="pro-name">' + pro.name + '</span><br>' +
        '<span class="pro-meta">' + pro.crm + '</span><br>' +
        '<span class="pro-meta">Atende em: ' + unitNames + '</span>' +
        '</span>';
      row.addEventListener("click", () => {
        state.professionalId = pro.id;
        state.locationId = null;
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

  function renderTimes() {
    const grid = document.getElementById("timeGrid");
    grid.innerHTML = "";
    if (!state.dateISO) return;
    const unavailable = unavailableSlotsFor(state.dateISO);
    TIME_SLOTS.forEach((time) => {
      const chip = el("button", "time-chip", time);
      chip.type = "button";
      chip.setAttribute("role", "radio");
      const isUnavailable = unavailable.has(time);
      chip.setAttribute("aria-checked", String(state.time === time));
      if (isUnavailable) {
        chip.disabled = true;
        chip.setAttribute("aria-label", time + ", indisponível");
      } else {
        chip.addEventListener("click", () => {
          state.time = time;
          renderTimes();
          setStatus("");
        });
      }
      grid.appendChild(chip);
    });
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
    hint.textContent = "Locais em que " + pro.name + " atende:";

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
     Renderização — Passo 5: Confirmação
     =================================================== */
  function renderSummary() {
    const card = document.getElementById("summaryCard");
    const specialty = SPECIALTIES.find((s) => s.id === state.specialtyId);
    const pro = specialty ? PROFESSIONALS[specialty.id].find((p) => p.id === state.professionalId) : null;
    const unit = pro ? pro.units.find((u) => u.id === state.locationId) : null;

    card.innerHTML =
      row("Especialidade", specialty ? specialty.name : "—") +
      row("Profissional", pro ? pro.name : "—") +
      row("Data", state.dateISO ? formatFullDate(state.dateISO) : "—") +
      row("Horário", state.time || "—") +
      row("Local", unit ? unit.name + " — " + unit.address : "—");

    function row(label, value) {
      return '<div class="sum-row"><span class="sum-label">' + label + '</span><span class="sum-value">' + value + '</span></div>';
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
    if (n === 4) renderLocations();
    if (n === 5) renderSummary();

    setStatus("");
    document.querySelector(".booking-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validateStep(n) {
    if (n === 1 && !state.specialtyId) return "Escolha uma especialidade para continuar.";
    if (n === 2 && !state.professionalId) return "Escolha um profissional para continuar.";
    if (n === 3 && (!state.dateISO || !state.time)) return "Escolha a data e o horário para continuar.";
    if (n === 4 && !state.locationId) return "Escolha o local de atendimento para continuar.";
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
      setStatus("Digite o nome do paciente para confirmar.");
      nameInput.focus();
      return;
    }
    confirmAppointment(nameInput.value.trim(), document.getElementById("patientMode").value);
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
    const unit = pro.units.find((u) => u.id === state.locationId);

    try {
      const { error } = await supabaseClient.from("appointments").insert({
        user_id: currentUser.id,
        patient: name,
        mode: mode,
        specialty: specialty.name,
        professional: pro.name,
        doctor_id: pro.user_id || null,
        unit: unit.name,
        date_iso: state.dateISO,
        time: state.time
      });
      if (error) throw error;
      await loadAppointments();
      showToast("Consulta agendada com " + pro.name + " em " + unit.name + "!");
    } catch (error) {
      setStatus(error.message);
      return;
    }

    // reset do formulário para um novo agendamento
    state.specialtyId = null;
    state.professionalId = null;
    state.dateISO = null;
    state.time = null;
    state.locationId = null;
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

      const cancelBtn = el("button", "appt-cancel", "Cancelar");
      cancelBtn.type = "button";
      cancelBtn.addEventListener("click", async () => {
        cancelBtn.disabled = true;
        try {
          const { error } = await supabaseClient.from("appointments").delete().eq("id", appt.id).eq("user_id", currentUser.id);
          if (error) throw error;
          appointments = appointments.filter((a) => a.id !== appt.id);
          renderAppointments();
          showToast("Consulta cancelada.");
        } catch (error) {
          cancelBtn.disabled = false;
          showToast(error.message);
        }
      });
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
    if (!(await requireSession())) return;
    await loadDoctors();
    renderSpecialties();
    renderAppointments();
    try {
      await loadAppointments();
    } catch (error) {
      showToast("Não foi possível carregar suas consultas.");
    }
    goToStep(1);
  }

  document.getElementById("logoutButton").addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    window.location.replace("auth.html");
  });

  document.addEventListener("DOMContentLoaded", init);
})();