-- ═══════════════════════════════════════════════════════════════════
-- Dinerillo · 0007 · ideas y mejoras de los usuarios
-- ═══════════════════════════════════════════════════════════════════

-- Lo que la gente propone, critica o comenta desde /mejoras. Una vez por
-- semana se analiza (`revisada_at`) y el admin le pone un estado y, si quiere,
-- una respuesta que la persona ve en la misma pantalla.
create table public.mejoras (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo         text not null check (tipo in ('idea', 'problema', 'critica', 'otro')),
  texto        text not null check (char_length(texto) between 3 and 1000),
  estado       text not null default 'nueva'
                 check (estado in ('nueva', 'la_hacemos', 'hecha', 'no_por_ahora')),
  respuesta    text not null default '' check (char_length(respuesta) <= 1000),
  revisada_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on public.mejoras (user_id, created_at);
create index on public.mejoras (created_at);

-- Cada uno manda y ve las suyas. El estado y la respuesta no los toca: solo
-- puede escribir el tipo y el texto.
alter table public.mejoras enable row level security;
create policy mejoras_propias_ver on public.mejoras for select to authenticated
  using (user_id = (select auth.uid()));
create policy mejoras_propias_mandar on public.mejoras for insert to authenticated
  with check (user_id = (select auth.uid()));
-- Supabase da todo por defecto en las tablas nuevas: se saca y se da lo justo.
revoke all on public.mejoras from anon, authenticated;
grant select on public.mejoras to authenticated;
grant insert (tipo, texto) on public.mejoras to authenticated;

-- ── funciones del admin ─────────────────────────────────────────────
create or replace function public.admin_mejoras()
returns table (id bigint, creado timestamptz, email text, tipo text, texto text,
               estado text, respuesta text, revisada timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'solo administradores' using errcode = '42501';
  end if;
  return query
    select m.id, m.created_at, u.email::text, m.tipo, m.texto, m.estado, m.respuesta, m.revisada_at
      from public.mejoras m left join auth.users u on u.id = m.user_id
     order by m.created_at desc
     limit 200;
end $$;

create or replace function public.admin_mejora_responder(p_id bigint, p_estado text, p_respuesta text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'solo administradores' using errcode = '42501';
  end if;
  update public.mejoras
     set estado = p_estado, respuesta = coalesce(p_respuesta, ''), revisada_at = coalesce(revisada_at, now())
   where id = p_id;
end $$;

revoke all on function public.admin_mejoras() from public, anon;
revoke all on function public.admin_mejora_responder(bigint, text, text) from public, anon;
grant execute on function public.admin_mejoras() to authenticated;
grant execute on function public.admin_mejora_responder(bigint, text, text) to authenticated;
