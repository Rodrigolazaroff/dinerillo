-- ═══════════════════════════════════════════════════════════════════
-- Dinerillo · 0001 · el módulo de alquileres
--
-- Las mismas tablas que tenía la Sheet, ahora con tipos de verdad.
-- Cada fila es de un usuario y solo ese usuario la ve: lo hace cumplir
-- la base (RLS), no la pantalla.
--
-- Decisiones que vienen de la Sheet y se mantienen:
--   - `id` es un ULID que genera el server. Es la clave para editar y borrar.
--   - Borrar es escribir `deleted_at`. El borrado físico pasa solo al vaciar
--     la papelera.
--   - Las condiciones viven en cada contrato, no en la app.
-- ═══════════════════════════════════════════════════════════════════

-- ── propiedades ─────────────────────────────────────────────────────
create table public.alq_propiedades (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 60),
  direccion   text not null default '',
  tipo        text not null default 'casa'
              check (tipo in ('casa', 'local', 'departamento', 'cochera', 'otro')),
  nota        text not null default '',
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  -- Para que un contrato solo pueda colgar de una propiedad del mismo usuario.
  unique (user_id, id)
);

-- ── contratos ───────────────────────────────────────────────────────
create table public.alq_contratos (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  propiedad_id      text not null,
  inquilino         text not null check (char_length(inquilino) between 1 and 80),
  telefono          text not null default '',
  email             text not null default '',
  fecha_inicio      date not null,
  meses             integer not null check (meses between 1 and 600),
  ajuste_tipo       text not null default 'porcentaje' check (ajuste_tipo in ('porcentaje', 'ninguno')),
  alquiler_inicial  numeric(14, 2) not null check (alquiler_inicial >= 0),
  aumento_pct       numeric(8, 3) not null default 0 check (aumento_pct between 0 and 1000),
  aumento_meses     integer not null default 1 check (aumento_meses between 1 and 120),
  comision_pct      numeric(6, 3) not null default 0 check (comision_pct between 0 and 100),
  mora_pct_diario   numeric(6, 3) not null default 0 check (mora_pct_diario between 0 and 100),
  dia_vencimiento   integer not null default 10 check (dia_vencimiento between 1 and 31),
  prorrateo_pct     numeric(6, 3) not null default 0 check (prorrateo_pct between 0 and 100),
  deposito          numeric(14, 2) not null default 0 check (deposito >= 0),
  nota              text not null default '',
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (user_id, id),
  foreign key (user_id, propiedad_id) references public.alq_propiedades (user_id, id)
);

-- ── importes fijados a mano: le ganan a la proyección ───────────────
create table public.alq_fijados (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contrato_id  text not null,
  periodo      text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  monto        numeric(14, 2) not null check (monto >= 0),
  nota         text not null default '',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  foreign key (user_id, contrato_id) references public.alq_contratos (user_id, id)
);

-- ── cobros ──────────────────────────────────────────────────────────
create table public.alq_cobros (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contrato_id  text not null,
  periodo      text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  fecha_cobro  date not null,
  importe      numeric(14, 2) not null check (importe >= 0),
  nota         text not null default '',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  foreign key (user_id, contrato_id) references public.alq_contratos (user_id, id)
);

-- ── boletas que se reparten entre los inquilinos ────────────────────
-- Agua, inmobiliario y similares: se carga el total una vez y cada contrato
-- se lleva su prorrateo. Los gastos que nadie reintegra no viven acá.
create table public.alq_boletas (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo          text not null
                check (tipo in ('agua', 'inmobiliario', 'expensas', 'luz', 'gas', 'abl', 'otro')),
  periodo       text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  fecha         date,
  -- null = la boleta cubre todas las propiedades
  propiedad_id  text,
  monto         numeric(14, 2) not null check (monto >= 0),
  nota          text not null default '',
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  foreign key (user_id, propiedad_id) references public.alq_propiedades (user_id, id)
);

-- ── ajustes por usuario (precarga de formularios y preferencias) ────
create table public.ajustes (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave    text not null check (char_length(clave) between 1 and 80),
  valor    text not null default '',
  primary key (user_id, clave)
);

-- ── índices para las lecturas por usuario y las claves foráneas ─────
create index on public.alq_propiedades (user_id);
create index on public.alq_contratos (user_id, propiedad_id);
create index on public.alq_fijados (user_id, contrato_id);
create index on public.alq_cobros (user_id, contrato_id);
create index on public.alq_boletas (user_id, propiedad_id);

-- ── seguridad: cada uno ve y toca solo lo suyo ──────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'alq_propiedades', 'alq_contratos', 'alq_fijados', 'alq_cobros', 'alq_boletas', 'ajustes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_propias', t
    );
    -- El proyecto no expone tablas nuevas por defecto: se habilitan a mano,
    -- solo para usuarios logueados. `anon` no ve nada.
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
