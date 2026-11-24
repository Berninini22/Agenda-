-- Agenda+: horários ofertados a partir da disponibilidade salva pelo médico.
-- A duração atual de cada consulta é de 60 minutos; o primeiro início é
-- arredondado para o próximo intervalo de 15 minutos quando necessário.

create or replace function public.available_appointment_times(
  p_doctor_id uuid,
  p_date date
) returns table(slot_time text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_availability jsonb;
  v_day jsonb;
  v_day_key text;
  v_periods jsonb;
  v_period jsonb;
  v_start time;
  v_end time;
  v_current time;
  v_minutes integer;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  if p_date < (now() at time zone 'America/Sao_Paulo')::date then
    return;
  end if;

  select profile.availability
    into v_availability
    from public.profiles as profile
   where profile.user_id = p_doctor_id
     and profile.role = 'doctor';

  if not found then
    return;
  end if;

  v_day_key := case extract(isodow from p_date)::integer
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    when 6 then 'saturday'
    else 'sunday'
  end;
  v_day := v_availability -> v_day_key;

  if v_day is null or jsonb_typeof(v_day) <> 'object' then
    return;
  end if;

  -- Formato atual: turnos morning/afternoon independentes.
  if v_day ? 'morning' or v_day ? 'afternoon' then
    v_periods := jsonb_build_array(v_day -> 'morning', v_day -> 'afternoon');
  -- Compatibilidade com perfis antigos que guardavam um único intervalo diário.
  elsif lower(coalesce(v_day ->> 'enabled', 'false')) = 'true' then
    v_periods := jsonb_build_array(jsonb_build_object(
      'enabled', true,
      'start', v_day ->> 'start',
      'end', v_day ->> 'end'
    ));
  else
    return;
  end if;

  for v_period in select value from jsonb_array_elements(v_periods) as item(value)
  loop
    if v_period is null or lower(coalesce(v_period ->> 'enabled', 'false')) <> 'true' then
      continue;
    end if;

    v_start := nullif(v_period ->> 'start', '')::time;
    v_end := nullif(v_period ->> 'end', '')::time;
    if v_start is null or v_end is null or v_end <= v_start then
      continue;
    end if;

    v_minutes := ceil((extract(hour from v_start) * 60 + extract(minute from v_start)) / 15.0)::integer * 15;
    if v_minutes >= 1440 then
      continue;
    end if;
    v_current := make_time(v_minutes / 60, v_minutes % 60, 0);

    while v_current + interval '60 minutes' <= v_end loop
      if not exists (
        select 1
          from public.appointments as appointment
         where appointment.doctor_id = p_doctor_id
           and appointment.date_iso = p_date
           and left(btrim(appointment.time), 5) = to_char(v_current, 'HH24:MI')
           and lower(coalesce(appointment.status, 'confirmada')) not in ('cancelada', 'canceled', 'cancelled')
      ) then
        return query select to_char(v_current, 'HH24:MI');
      end if;
      v_current := (v_current + interval '60 minutes')::time;
    end loop;
  end loop;
end;
$$;

revoke all on function public.available_appointment_times(uuid, date) from public;
grant execute on function public.available_appointment_times(uuid, date) to authenticated;

create or replace function public.book_appointment(
  p_user_id uuid,
  p_doctor_id uuid,
  p_patient text,
  p_mode text,
  p_specialty text,
  p_professional text,
  p_unit text,
  p_date date,
  p_time time,
  p_location_id bigint default null,
  p_slot_id bigint default null
) returns public.appointments
language plpgsql
security invoker
set search_path = public
as $$
declare
  booked public.appointments;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;
  if p_mode not in ('presencial', 'teleconsulta') then
    raise exception 'invalid_mode';
  end if;
  if p_date < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'date_in_past';
  end if;
  if p_doctor_id is null or not exists (
    select 1 from public.profiles where user_id = p_doctor_id and role = 'doctor'
  ) then
    raise exception 'doctor_unavailable';
  end if;
  if not exists (
    select 1
      from public.available_appointment_times(p_doctor_id, p_date) as available
     where available.slot_time = to_char(p_time, 'HH24:MI')
  ) then
    raise exception 'slot_unavailable';
  end if;
  if p_location_id is not null and not exists (
    select 1 from public.doctor_locations
     where doctor_id = p_doctor_id and location_id = p_location_id
  ) then
    raise exception 'location_not_assigned';
  end if;

  insert into public.appointments(
    user_id, doctor_id, patient, mode, specialty, professional, unit,
    date_iso, time, location_id, slot_id, status
  ) values (
    p_user_id, p_doctor_id, p_patient, p_mode, p_specialty, p_professional, p_unit,
    p_date, to_char(p_time, 'HH24:MI'), p_location_id, p_slot_id, 'Confirmada'
  ) returning * into booked;

  return booked;
exception
  when unique_violation then
    raise exception 'slot_already_booked';
end;
$$;

revoke all on function public.book_appointment(uuid, uuid, text, text, text, text, text, date, time, bigint, bigint) from public;
grant execute on function public.book_appointment(uuid, uuid, text, text, text, text, text, date, time, bigint, bigint) to authenticated;

comment on function public.available_appointment_times(uuid, date) is
  'Returns only unbooked one-hour start times within the doctor weekly profile availability; never returns appointment or patient data.';
