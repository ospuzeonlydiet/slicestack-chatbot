-- SliceStack Studio — leads table
-- Run this in the Supabase SQL editor (Database → SQL Editor → New query)

create table if not exists leads (
  id                  bigserial primary key,
  created_at          timestamptz not null default now(),
  source              text        not null default 'Website Chatbot',
  interest            text,                          -- app | voice | automate | unsure
  problem_description text,
  contact_email       text,
  contact_phone       text,
  lead_score          int         not null default 0, -- 0-5
  chat_history        jsonb,
  status              text        not null default 'new'
                        check (status in ('new', 'contacted', 'qualified', 'closed', 'dead'))
);

-- Indexes
create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_status_idx     on leads (status);
create index if not exists leads_score_idx      on leads (lead_score desc);

-- Row-level security: service key can do everything; anon key gets nothing
alter table leads enable row level security;

create policy "service role full access"
  on leads
  using (auth.role() = 'service_role');
