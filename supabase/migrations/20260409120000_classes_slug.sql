-- 課程前台網址：/course/{slug}；舊 UUID 網址仍可由前台解析
alter table public.classes add column if not exists slug text;

-- 既有資料：title 轉小寫英數連字 + id 之 md5 前 8 碼，確保唯一
update public.classes c
set slug = coalesce(
  nullif(
    trim(
      both '-'
      from lower(
        regexp_replace(
          regexp_replace(coalesce(c.title, 'course'), '\s+', '-', 'g'),
          '[^a-z0-9-]+',
          '-',
          'g'
        )
      )
    ),
    ''
  ),
  'course'
) || '-' || substr(md5(c.id::text), 1, 8)
where c.slug is null;

create unique index if not exists idx_classes_slug on public.classes (slug);

alter table public.classes alter column slug set not null;

comment on column public.classes.slug is '前台唯一網址片段，例如 /course/kids-baking-class；勿使用保留字 booking';
