-- ═══════════════════════════════════════════════════════════════════
-- Dinerillo · 0005 · lo que ahorraste y borrar la cuenta
--
-- Lo que entra menos lo que sale es lo que te quedó, no lo que ahorraste:
-- puede estar en la cuenta o en efectivo. Un ahorro es plata que apartaste a
-- propósito (un plazo fijo, dólares, un FCI) y se carga aparte. Lo que te
-- quedó y no ahorraste es lo disponible.
--
-- Se puede ahorrar en otra moneda: como los cobros, guarda el tipo de cambio
-- del día para pasarlo a pesos y que no se mueva después.
-- ═══════════════════════════════════════════════════════════════════

create table public.ahorros (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha        date not null,
  periodo      text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  monto        numeric(14, 2) not null check (monto > 0),
  moneda       text not null default 'ARS' check (moneda ~ '^[A-Z]{3}$'),
  tipo_cambio  numeric(14, 4) not null default 1 check (tipo_cambio > 0),
  nota         text not null default '',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index on public.ahorros (user_id, periodo);

alter table public.ahorros enable row level security;
create policy ahorros_propias on public.ahorros for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.ahorros to authenticated;

-- ── borrar la cuenta ────────────────────────────────────────────────
-- Cualquiera puede crearse una cuenta, así que cualquiera tiene que poder
-- borrarla. Borra el usuario de Auth y, por el `on delete cascade` de cada
-- tabla, todos sus datos. Solo se puede borrar a uno mismo: auth.uid().
create or replace function public.eliminar_mi_cuenta()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;
