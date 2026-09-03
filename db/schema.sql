-- Схема базы «Тапшырма».
--
-- Полный эквивалент db/schema.ts. Существует отдельно потому, что
-- drizzle-kit требует Node, а первое развёртывание делается из браузера:
-- этот файл вставляется в SQL-редактор Neon целиком.
--
-- После установки Node схемой управляет drizzle-kit (npm run db:push),
-- и тогда правки вносятся в db/schema.ts, а этот файл пересобирается.

create type user_role as enum ('initiator', 'drafter', 'lawyer', 'secretary', 'head');
create type doc_status as enum ('draft', 'revision', 'review', 'checked', 'approved');

create table organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  short_name    text not null default '',
  address       text not null default '',
  head_name     text not null default '',
  head_position text not null default '',
  created_at    timestamptz not null default now()
);

create table users (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  email         text not null,
  password_hash text not null,
  full_name     text not null default '',
  "position"    text not null default '',
  role          user_role not null default 'drafter',
  created_at    timestamptz not null default now()
);

create unique index users_email_uq on users (email);

create table documents (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations (id) on delete cascade,
  title      text not null default '',
  okgz_code  text not null default '',
  status     doc_status not null default 'draft',
  created_by uuid not null references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_org_idx on documents (org_id, updated_at);

-- Версия хранит снимок модели целиком: документ можно восстановить ровно
-- в том виде, в каком он был утверждён, даже если код шаблона изменился.
create table document_versions (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  version     integer not null,
  model       jsonb not null,
  note        text not null default '',
  created_by  uuid not null references users (id),
  created_at  timestamptz not null default now()
);

create unique index document_versions_uq on document_versions (document_id, version);
