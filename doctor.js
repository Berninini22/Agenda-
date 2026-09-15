(() => {
  "use strict";

  const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
  const DAY_LABELS = {
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
    sunday: "Domingo"
  };
  const DEFAULT_AVAILABILITY = {
    monday: { enabled: true, start: "08:00", end: "18:00" },
    tuesday: { enabled: true, start: "08:00", end: "18:00" },
    wednesday: { enabled: true, start: "08:00", end: "18:00" },
    thursday: { enabled: true, start: "08:00", end: "18:00" },
    friday: { enabled: true, start: "08:00", end: "18:00" },
    saturday: { enabled: false, start: "08:00", end: "12:00" },
    sunday: { enabled: false, start: "08:00", end: "12:00" }
  };

  let currentUser = null;
  let profile = null;
  let appointments = [];

  const $ = (selector) => document.querySelector(selector);

  function showToast(text, type = "success") {
    const toast = $("#toast");
    toast.textContent = text;
    toast.classList.toggle("is-error", type === "error");
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 3600);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[character]));
  }

  function initials(name) {
    return String(name || "DR").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "DR";
  }

  function todayISO() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function formatDate(iso, options = { weekday: "short", day: "2-digit", month: "short" }) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", options);
  }

  function formatLongDate(iso) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  }

  function defaultProfileFromUser() {
    const metadata = currentUser.user_metadata || {};
    return {
      user_id: currentUser.id,
      role: "doctor",
      full_name: metadata.full_name || currentUser.email || "Médico Agenda+",
      crm: metadata.crm || "",
      crm_state: metadata.crm_state || "",
      specialty: metadata.specialty || "Clínico Geral",
      phone: metadata.phone || "",
      avatar_url: metadata.avatar_url || "",
      availability: DEFAULT_AVAILABILITY
    };
  }

  async function loadProfile() {
    const { data, error } = await supabaseClient.from("profiles").select("*").eq("user_id", currentUser.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      const fallback = defaultProfileFromUser();
      const result = await supabaseClient.from("profiles").upsert(fallback, { onConflict: "user_id" }).select().single();
      if (result.error) throw result.error;
      profile = result.data;
    } else {
      profile = data;
      const metadata = currentUser.user_metadata || {};
      if (profile.role !== "doctor" && metadata.role !== "doctor") {
        window.location.replace("index.html");
        return false;
      }
    }
    return true;
  }

  async function loadAppointments() {
    let result = await supabaseClient
      .from("appointments")
      .select("id, patient, mode, specialty, professional, unit, date_iso, time")
      .eq("doctor_id", currentUser.id)
      .order("date_iso", { ascending: true })
      .order("time", { ascending: true });

    // Compatibilidade para consultas antigas criadas antes da migração do doctor_id.
    if (result.error && profile?.full_name) {
      result = await supabaseClient
        .from("appointments")
        .select("id, patient, mode, specialty, professional, unit, date_iso, time")
        .eq("professional", profile.full_name)
        .order("date_iso", { ascending: true })
        .order("time", { ascending: true });
    }
    if (result.error) throw result.error;
    appointments = result.data || [];
    renderDashboard();
  }

  function renderProfile() {
    const name = profile.full_name || "Médico Agenda+";
    const specialty = profile.specialty || "Especialidade não informada";
    $("#doctorName").textContent = name.split(" ")[0];
    $("#doctorWelcome").textContent = `Dr(a). ${name}`;
    $("#profileName").textContent = name;
    $("#profileSpecialty").textContent = specialty;
    $("#doctorAvatar").textContent = initials(name);
    if (profile.avatar_url) {
      $("#doctorAvatar").style.backgroundImage = `url("${profile.avatar_url}")`;
      $("#doctorAvatar").classList.add("has-photo");
      $("#doctorAvatar").textContent = "";
    }

    const crm = profile.crm ? `CRM ${profile.crm}${profile.crm_state ? `-${profile.crm_state}` : ""}` : "CRM ainda não informado";
    $("#profileDetails").innerHTML = `
      <div class="profile-detail"><span class="detail-icon" aria-hidden="true">ID</span><span><small>Registro profissional</small><strong>${escapeHTML(crm)}</strong></span></div>
      <div class="profile-detail"><span class="detail-icon" aria-hidden="true">@</span><span><small>E-mail</small><strong>${escapeHTML(currentUser.email || "—")}</strong></span></div>
      ${profile.phone ? `<div class="profile-detail"><span class="detail-icon" aria-hidden="true">☎</span><span><small>Telefone</small><strong>${escapeHTML(profile.phone)}</strong></span></div>` : ""}
    `;
  }

  function readAvailability() {
    const raw = profile?.availability && typeof profile.availability === "object" ? profile.availability : {};
    return Object.fromEntries(Object.keys(DEFAULT_AVAILABILITY).map((day) => [day, { ...DEFAULT_AVAILABILITY[day], ...(raw[day] || {}) }]));
  }

  function applyAvailability() {
    const availability = readAvailability();
    document.querySelectorAll(".availability-row").forEach((row) => {
      const value = availability[row.dataset.day];
      const inputs = row.querySelectorAll("input");
      inputs[0].checked = Boolean(value.enabled);
      inputs[1].value = value.start || "08:00";
      inputs[2].value = value.end || "18:00";
      row.classList.toggle("is-disabled", !value.enabled);
    });
    updateAvailabilityCount();
  }

  function updateAvailabilityCount() {
    const active = [...document.querySelectorAll('.availability-row input[type="checkbox"]')].filter((input) => input.checked).length;
    $("#availabilityCount").textContent = `${active} ${active === 1 ? "dia" : "dias"}`;
    $("#activeDaysCount").textContent = String(active);
  }

  function readFormAvailability() {
    return Object.fromEntries([...document.querySelectorAll(".availability-row")].map((row) => {
      const inputs = row.querySelectorAll("input");
      return [row.dataset.day, { enabled: inputs[0].checked, start: inputs[1].value || "08:00", end: inputs[2].value || "18:00" }];
    }));
  }

  function renderDashboard() {
    const today = todayISO();
    const upcoming = appointments.filter((appointment) => appointment.date_iso >= today);
    const nextSevenDays = new Date(`${today}T00:00:00`);
    nextSevenDays.setDate(nextSevenDays.getDate() + 7);
    const nextSevenISO = nextSevenDays.toISOString().slice(0, 10);
    $("#todayCount").textContent = String(upcoming.filter((appointment) => appointment.date_iso === today).length);
    $("#weekCount").textContent = String(upcoming.filter((appointment) => appointment.date_iso <= nextSevenISO).length);
    $("#lastSync").textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

    const next = upcoming[0];
    const nextTitle = $("#nextAppointmentTitle");
    const nextStatus = $("#nextAppointmentStatus");
    const nextContent = $("#nextAppointmentContent");
    if (next) {
      nextTitle.textContent = next.date_iso === today ? "Atendimento de hoje" : "Seu próximo atendimento";
      nextStatus.textContent = "Confirmada";
      nextStatus.className = "appointment-status-pill is-confirmed";
      nextContent.innerHTML = `
        <div class="next-date-block"><strong>${escapeHTML(next.time)}</strong><span>${escapeHTML(formatDate(next.date_iso))}</span></div>
        <div class="next-patient"><span class="patient-avatar">${escapeHTML(initials(next.patient))}</span><div><strong>${escapeHTML(next.patient)}</strong><span>${escapeHTML(next.mode === "teleconsulta" ? "Teleconsulta" : "Atendimento presencial")} · ${escapeHTML(next.unit || "Local a confirmar")}</span></div></div>
        <span class="next-specialty">${escapeHTML(next.specialty || "Consulta")}</span>
      `;
    } else {
      nextTitle.textContent = "Sua agenda está livre";
      nextStatus.textContent = "Disponível";
      nextStatus.className = "appointment-status-pill";
      nextContent.innerHTML = '<div class="next-appointment-placeholder"><span class="placeholder-icon" aria-hidden="true">✦</span><p>Quando um paciente agendar com você, o atendimento aparecerá aqui.</p></div>';
    }

    const list = $("#doctorAppointmentsList");
    const empty = $("#doctorEmptyState");
    list.innerHTML = "";
    if (upcoming.length === 0) {
      empty.classList.remove("is-hidden");
      return;
    }
    empty.classList.add("is-hidden");
    upcoming.forEach((appointment) => {
      const article = document.createElement("article");
      article.className = "doctor-appointment-row";
      const date = new Date(`${appointment.date_iso}T00:00:00`);
      article.innerHTML = `
        <div class="doctor-appt-date"><span>${escapeHTML(date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""))}</span><strong>${escapeHTML(String(date.getDate()).padStart(2, "0"))}</strong></div>
        <div class="doctor-appt-info"><strong>${escapeHTML(appointment.patient)}</strong><span>${escapeHTML(appointment.specialty || "Consulta")} · ${escapeHTML(appointment.time)}</span><small>${escapeHTML(appointment.mode === "teleconsulta" ? "Teleconsulta" : appointment.unit || "Atendimento presencial")}</small></div>
        <span class="doctor-appt-status">${escapeHTML(appointment.status || "Confirmada")}</span>
      `;
      list.appendChild(article);
    });
  }

  async function saveAvailability(event) {
    event.preventDefault();
    const button = $("#saveAvailability");
    const availability = readFormAvailability();
    if (Object.values(availability).some((day) => day.enabled && day.start >= day.end)) {
      showToast("Confira os horários. A hora de início precisa ser antes da hora de fim.", "error");
      return;
    }
    button.disabled = true;
    button.textContent = "Salvando seus horários...";
    try {
      const { data, error } = await supabaseClient.from("profiles").update({ availability }).eq("user_id", currentUser.id).select().single();
      if (error) throw error;
      profile = data || { ...profile, availability };
      updateAvailabilityCount();
      showToast("Pronto! Seus horários foram salvos.");
    } catch (error) {
      showToast("Não foi possível salvar seus horários. Confira sua internet e tente novamente.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Salvar meus horários";
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Escolha uma foto JPG, PNG ou WebP.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("A foto é muito grande. Escolha uma imagem com até 5 MB.", "error");
      return;
    }
    const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${currentUser.id}/${Date.now()}.${extension}`;
    try {
      const { error: uploadError } = await supabaseClient.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabaseClient.storage.from("avatars").getPublicUrl(path);
      const { error: profileError } = await supabaseClient.from("profiles").update({ avatar_url: data.publicUrl }).eq("user_id", currentUser.id);
      if (profileError) throw profileError;
      profile.avatar_url = data.publicUrl;
      renderProfile();
      showToast("Pronto! Sua foto foi atualizada.");
    } catch (error) {
      showToast("Não foi possível enviar a foto. Confira sua internet e tente novamente.", "error");
    } finally {
      event.target.value = "";
    }
  }

  function setupEvents() {
    $("#availabilityForm").addEventListener("submit", saveAvailability);
    $("#avatarInput").addEventListener("change", uploadAvatar);
    $("#refreshAppointments").addEventListener("click", async () => {
      try {
        await loadAppointments();
        showToast("Pronto! Suas consultas foram atualizadas.");
      } catch (error) {
        showToast("Não foi possível atualizar as consultas. Confira sua internet e tente novamente.", "error");
      }
    });
    document.querySelectorAll('.availability-row input[type="checkbox"]').forEach((input) => input.addEventListener("change", () => {
      input.closest(".availability-row").classList.toggle("is-disabled", !input.checked);
      updateAvailabilityCount();
    }));
    $("#logoutButton").addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.replace("auth.html");
    });
  }

  async function init() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data.session) {
      window.location.replace("auth.html");
      return;
    }
    currentUser = data.session.user;
    const metadata = currentUser.user_metadata || {};
    if (metadata.role !== "doctor") {
      const profileResult = await supabaseClient.from("profiles").select("role").eq("user_id", currentUser.id).maybeSingle();
      if (profileResult.data?.role !== "doctor") {
        window.location.replace("index.html");
        return;
      }
    }
    try {
      if (!(await loadProfile())) return;
      renderProfile();
      applyAvailability();
      const now = new Date();
      $("#todayLabel").textContent = now.toLocaleDateString("pt-BR", { weekday: "long" });
      $("#heroDate").textContent = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
      setupEvents();
      await loadAppointments();
    } catch (error) {
      showToast("Não foi possível abrir sua agenda. Confira a internet e verifique se o banco foi configurado no Supabase.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
