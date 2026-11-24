-- Refinamento da RPC de disponibilidade: filtra horários já passados no dia
-- corrente e remove candidatos que se sobrepõem entre turnos ou reservas.
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
  v_candidates text[] := array[]::text[];
  v_selected text[] := array[]::text[];
  v_candidate text;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_now time := (now() at time zone 'America/Sao_Paulo')::time;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  if p_date < v_today then
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

  if v_day ? 'morning' or v_day ? 'afternoon' then
    v_periods := jsonb_build_array(v_day -> 'morning', v_day -> 'afternoon');
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
      if (p_date > v_today or v_current > v_now)
        and not exists (
          select 1
            from public.appointments as appointment
           where appointment.doctor_id = p_doctor_id
             and appointment.date_iso = p_date
             and lower(coalesce(appointment.status, 'confirmada')) not in ('cancelada', 'canceled', 'cancelled')
             and appointment.time::time < (v_current + interval '60 minutes')::time
             and appointment.time::time + interval '60 minutes' > v_current
        ) then
        v_candidates := array_append(v_candidates, to_char(v_current, 'HH24:MI'));
      end if;
      v_current := (v_current + interval '60 minutes')::time;
    end loop;
  end loop;

  -- A manhã e a tarde podem ter intervalos personalizados que se cruzam.
  -- Em caso de sobreposição, mantém o primeiro início cronológico disponível.
  for v_candidate in
    select distinct candidate
      from unnest(v_candidates) as candidates(candidate)
     order by candidate
  loop
    if not exists (
      select 1
        from unnest(v_selected) as selected(slot)
       where selected.slot::time < (v_candidate::time + interval '60 minutes')::time
         and selected.slot::time + interval '60 minutes' > v_candidate::time
    ) then
      v_selected := array_append(v_selected, v_candidate);
    end if;
  end loop;

  return query
    select selected.slot
      from unnest(v_selected) as selected(slot)
     order by selected.slot;
end;
$$;
