-- ==============================================================================
-- ISET N° 57 - Configuración de Supabase (Autenticación, Roles y Contenido JSON)
-- ==============================================================================
-- Ejecutá este script en el "SQL Editor" de tu proyecto en Supabase (https://supabase.com).
-- Crea automáticamente las tablas de perfiles, roles, contenido JSON, políticas de seguridad
-- y el bucket para subida de imágenes. Es 100% IDEMPOTENTE (podés ejecutarlo varias veces).
-- ==============================================================================
-- ⚠️ PASO OBLIGATORIO EN EL PANEL DE SUPABASE (PARA QUE LOS USUARIOS INGRESEN DE INMEDIATO):
-- 1. En tu proyecto de Supabase, andá al menú lateral izquierdo -> Authentication.
-- 2. Hacé clic en "Providers" -> desplegá "Email".
-- 3. DESACTIVÁ la casilla "Confirm email" (Confirmar correo electrónico).
-- 4. Hacé clic en "Save" (Guardar).
-- De esta forma, cuando un visitante o docente se registre en producción, su cuenta quedará
-- activa inmediatamente sin requerir configuración de servidor SMTP ni validación por email.
-- ==============================================================================

-- 1. Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- 2. Tabla de perfiles de usuario
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text default '',
  role text not null default 'visitante' check (role in ('visitante', 'admin', 'superuser')),
  carreras text[] default '{}', -- IDs de carreras asignadas: 'digitales', 'higiene', 'enfermeria', 'simulacion'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar Row Level Security (RLS) en perfiles
alter table public.profiles enable row level security;

-- Políticas para profiles (con drop previo para evitar errores si ya existen):

-- Lectura de perfiles: los usuarios autenticados pueden leer perfiles para saber roles
drop policy if exists "Los usuarios autenticados pueden leer perfiles" on public.profiles;
create policy "Los usuarios autenticados pueden leer perfiles"
  on public.profiles for select
  to authenticated
  using (true);

-- Permitir inserción de perfiles al registrarse (tanto vía trigger como por cliente)
drop policy if exists "Permitir inserción de perfiles al registrarse" on public.profiles;
create policy "Permitir inserción de perfiles al registrarse"
  on public.profiles for insert
  to authenticated, anon
  with check (true);

-- Los usuarios pueden actualizar su propio perfil básico (nombre)
drop policy if exists "Los usuarios pueden actualizar su propio perfil" on public.profiles;
create policy "Los usuarios pueden actualizar su propio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Solo los superusuarios pueden actualizar roles y carreras de otros usuarios
drop policy if exists "Superusuarios pueden actualizar roles" on public.profiles;
create policy "Superusuarios pueden actualizar roles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'superuser'
    )
  );

-- 3. Función y Trigger automático al registrarse un nuevo usuario
-- Asigna 'superuser' si es pedro.bolig@gamil.com / pedro.bolig@gmail.com o si es el primer usuario registrado.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  is_first boolean;
  assigned_role text := 'visitante';
begin
  select not exists (select 1 from public.profiles) into is_first;

  if lower(new.email) in ('pedro.bolig@gamil.com', 'pedro.bolig@gmail.com') or is_first then
    assigned_role := 'superuser';
  end if;

  insert into public.profiles (id, email, full_name, role, carreras)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    assigned_role,
    case when assigned_role = 'superuser' then array['digitales', 'higiene', 'enfermeria', 'simulacion'] else array[]::text[] end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);

  return new;
end;
$$ language plpgsql security definer;

-- Trigger que se dispara cuando un usuario se registra en auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Sincronizar retroactivamente usuarios existentes en auth.users que aún no tengan perfil en public.profiles
insert into public.profiles (id, email, full_name, role, carreras)
select 
  u.id, 
  u.email, 
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  case 
    when lower(u.email) in ('pedro.bolig@gamil.com', 'pedro.bolig@gmail.com') then 'superuser' 
    else 'visitante' 
  end,
  case 
    when lower(u.email) in ('pedro.bolig@gamil.com', 'pedro.bolig@gmail.com') then array['digitales', 'higiene', 'enfermeria', 'simulacion'] 
    else array[]::text[] 
  end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 4. Tabla de contenido del sitio (almacena el JSON de data y materias sincronizado en tiempo real)
create table if not exists public.site_content (
  id text primary key, -- 'data' o 'materias'
  content jsonb not null,
  version integer default 1,
  updated_by uuid references auth.users,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.site_content enable row level security;

-- Cualquiera (incluso visitantes anónimos) puede leer el contenido del sitio
drop policy if exists "Lectura pública de site_content" on public.site_content;
create policy "Lectura pública de site_content"
  on public.site_content for select
  to anon, authenticated
  using (true);

-- Solo usuarios autenticados con rol 'admin' o 'superuser' pueden modificar contenido
drop policy if exists "Admins y Superusers pueden actualizar site_content" on public.site_content;
create policy "Admins y Superusers pueden actualizar site_content"
  on public.site_content for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superuser')
    )
  );

-- Habilitar Supabase Realtime para site_content y profiles
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_content'
  ) then
    alter publication supabase_realtime add table public.site_content;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;

-- 5. Tabla de Auditoría y Registro de Sincronizaciones (Offline & Online Sync Log)
create table if not exists public.site_sync_log (
  id uuid primary key default uuid_generate_v4(),
  section text not null, -- 'data', 'materias'
  updated_by uuid references auth.users,
  sync_source text not null default 'online' check (sync_source in ('online', 'offline_sync', 'manual')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.site_sync_log enable row level security;

drop policy if exists "Admins y Superusers pueden leer logs de sincronización" on public.site_sync_log;
create policy "Admins y Superusers pueden leer logs de sincronización"
  on public.site_sync_log for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superuser')
    )
  );

drop policy if exists "Admins y Superusers pueden registrar logs de sincronización" on public.site_sync_log;
create policy "Admins y Superusers pueden registrar logs de sincronización"
  on public.site_sync_log for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superuser')
    )
  );

-- 6. Bucket de almacenamiento para subida de imágenes (Storage)
insert into storage.buckets (id, name, public)
values ('iset-assets', 'iset-assets', true)
on conflict (id) do nothing;

-- Políticas de Storage para iset-assets:
-- Lectura pública de imágenes
drop policy if exists "Imágenes públicas para todos" on storage.objects;
create policy "Imágenes públicas para todos"
  on storage.objects for select
  to public
  using (bucket_id = 'iset-assets');

-- Subida de imágenes solo para admins y superusers
drop policy if exists "Admins y superusers pueden subir imágenes" on storage.objects;
create policy "Admins y superusers pueden subir imágenes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'iset-assets' and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superuser')
    )
  );
