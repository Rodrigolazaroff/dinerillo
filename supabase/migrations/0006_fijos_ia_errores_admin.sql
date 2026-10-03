-- ═══════════════════════════════════════════════════════════════════
-- Dinerillo · 0006 · gastos fijos, tope de la IA, errores y administración
-- ═══════════════════════════════════════════════════════════════════

-- ── gastos fijos ────────────────────────────────────────────────────
-- Lo que se paga todos los meses: el alquiler, Netflix, la luz. Los de monto
-- fijo se cargan solos el día que tocan; los que varían (la luz) piden
-- confirmar el monto. Cada mes se carga como un gasto común con `fijo_id`.
create table public.gastos_fijos (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  descripcion   text not null check (char_length(descripcion) between 1 and 80),
  monto         numeric(14, 2) not null check (monto > 0),
  categoria_id  text,
  dia           integer not null default 1 check (dia between 1 and 31),
  compartido    boolean not null default false,
  pago          text not null default 'yo' check (pago in ('yo', 'pareja')),
  mi_pct        numeric(5, 2) not null default 50 check (mi_pct between 0 and 100),
  automatico    boolean not null default true,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (user_id, id),
  foreign key (user_id, categoria_id) references public.categorias (user_id, id)
    on delete set null (categoria_id)
);
create index on public.gastos_fijos (user_id);

alter table public.gastos add column fijo_id text;
alter table public.div_gastos add column fijo_id text;

-- Un fijo se carga una sola vez por mes, aunque la app esté abierta en dos lados.
create unique index gastos_un_fijo_por_mes
  on public.gastos (user_id, fijo_id, periodo) where fijo_id is not null and deleted_at is null;
create unique index div_gastos_un_fijo_por_mes
  on public.div_gastos (user_id, fijo_id, periodo) where fijo_id is not null and deleted_at is null;

-- ── cada uso de la IA (para el tope diario y para ver cuánto se gasta) ──
create table public.ia_usos (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo            text not null check (tipo in ('texto', 'archivo')),
  tokens_entrada  integer not null default 0,
  tokens_salida   integer not null default 0,
  created_at      timestamptz not null default now()
);
create index on public.ia_usos (user_id, created_at);
create index on public.ia_usos (created_at);

-- ── errores de la app (los ve el administrador) ─────────────────────
create table public.errores (
  id          bigint generated always as identity primary key,
  user_id     uuid default auth.uid() references auth.users (id) on delete cascade,
  origen      text not null check (origen in ('cliente', 'server')),
  mensaje     text not null check (char_length(mensaje) <= 500),
  detalle     text not null default '' check (char_length(detalle) <= 4000),
  ruta        text not null default '' check (char_length(ruta) <= 300),
  navegador   text not null default '' check (char_length(navegador) <= 300),
  created_at  timestamptz not null default now()
);
create index on public.errores (created_at);

-- ── administradores ─────────────────────────────────────────────────
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ── seguridad ───────────────────────────────────────────────────────
alter table public.gastos_fijos enable row level security;
create policy gastos_fijos_propias on public.gastos_fijos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.gastos_fijos to authenticated;

-- Los usos de la IA: cada uno ve y suma los suyos; nadie los edita.
alter table public.ia_usos enable row level security;
create policy ia_usos_propios on public.ia_usos for select to authenticated
  using (user_id = (select auth.uid()));
create policy ia_usos_cargar on public.ia_usos for insert to authenticated
  with check (user_id = (select auth.uid()));
grant select, insert on public.ia_usos to authenticated;

-- Los errores: cada uno puede reportar los suyos, pero no leerlos.
alter table public.errores enable row level security;
create policy errores_reportar on public.errores for insert to authenticated
  with check (user_id = (select auth.uid()));
grant insert on public.errores to authenticated;

-- Admins: cada uno puede saber si es admin, nadie puede hacerse admin.
alter table public.admins enable row level security;
create policy admins_yo on public.admins for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.admins to authenticated;

-- ── funciones ───────────────────────────────────────────────────────
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Cuántas veces se usó la IA hoy entre todos: el tope global que cuida la cuenta.
create or replace function public.ia_usos_hoy_total()
returns bigint language sql stable security definer set search_path = '' as $$
  select count(*) from public.ia_usos where created_at > now() - interval '1 day';
$$;

-- El panel de administración: métricas de uso, nunca los montos de nadie.
create or replace function public.admin_resumen()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'solo administradores' using errcode = '42501';
  end if;
  return json_build_object(
    'usuarios',    (select count(*) from auth.users),
    'nuevos_7d',   (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'activos_7d',  (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'ia_hoy',      (select count(*) from public.ia_usos where created_at > now() - interval '1 day'),
    'ia_7d',       (select count(*) from public.ia_usos where created_at > now() - interval '7 days'),
    'tokens_7d',   (select coalesce(sum(tokens_entrada + tokens_salida), 0) from public.ia_usos
                     where created_at > now() - interval '7 days'),
    'errores_24h', (select count(*) from public.errores where created_at > now() - interval '1 day')
  );
end $$;

create or replace function public.admin_usuarios()
returns table (email text, creado timestamptz, ultimo_ingreso timestamptz, proveedor text, ia_7d bigint, onboarding text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'solo administradores' using errcode = '42501';
  end if;
  return query
    select u.email::text, u.created_at, u.last_sign_in_at,
           coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
           (select count(*) from public.ia_usos i
             where i.user_id = u.id and i.created_at > now() - interval '7 days'),
           (select a.valor from public.ajustes a where a.user_id = u.id and a.clave = 'onboarding')
      from auth.users u
     order by u.created_at desc
     limit 200;
end $$;

create or replace function public.admin_errores()
returns table (id bigint, creado timestamptz, email text, origen text, mensaje text, detalle text, ruta text, navegador text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'solo administradores' using errcode = '42501';
  end if;
  return query
    select e.id, e.created_at, u.email::text, e.origen, e.mensaje, e.detalle, e.ruta, e.navegador
      from public.errores e left join auth.users u on u.id = e.user_id
     order by e.created_at desc
     limit 100;
end $$;

revoke all on function public.es_admin() from public, anon;
revoke all on function public.ia_usos_hoy_total() from public, anon;
revoke all on function public.admin_resumen() from public, anon;
revoke all on function public.admin_usuarios() from public, anon;
revoke all on function public.admin_errores() from public, anon;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.ia_usos_hoy_total() to authenticated;
grant execute on function public.admin_resumen() to authenticated;
grant execute on function public.admin_usuarios() to authenticated;
grant execute on function public.admin_errores() to authenticated;

-- El dueño de la app.
insert into public.admins (user_id)
  select id from auth.users where email = 'rodrigolazaroff@gmail.com'
  on conflict do nothing;
