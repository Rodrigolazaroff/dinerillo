-- ═══════════════════════════════════════════════════════════════════
-- Dinerillo · 0008 · sugerencias sin seguimiento
-- ═══════════════════════════════════════════════════════════════════

-- La persona manda el texto y se desentiende: no hay tipo, estado ni respuesta.
-- El admin las lee en /admin y el análisis semanal toma las que llegaron desde
-- el informe anterior (por fecha, sin marcar nada en la base).
drop function if exists public.admin_mejora_responder(bigint, text, text);
drop function if exists public.admin_mejoras();

alter table public.mejoras
  drop column tipo,
  drop column estado,
  drop column respuesta,
  drop column revisada_at;

revoke all on public.mejoras from anon, authenticated;
-- Leer las propias solo sirve para contar el tope diario.
grant select on public.mejoras to authenticated;
grant insert (texto) on public.mejoras to authenticated;

create function public.admin_mejoras()
returns table (id bigint, creado timestamptz, email text, texto text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'solo administradores' using errcode = '42501';
  end if;
  return query
    select m.id, m.created_at, u.email::text, m.texto
      from public.mejoras m left join auth.users u on u.id = m.user_id
     order by m.created_at desc
     limit 200;
end $$;

revoke all on function public.admin_mejoras() from public, anon;
grant execute on function public.admin_mejoras() to authenticated;
