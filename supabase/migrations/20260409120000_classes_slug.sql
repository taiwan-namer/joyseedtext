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

-- 課程列表 RPC 一併回傳 slug（與前台 /course/{slug} 連結一致；同一 repo 各分站共用此 migration）
create or replace function public.list_classes_for_merchant_page(
  p_merchant_id text,
  p_page integer default 1,
  p_page_size integer default 12,
  p_search text default null,
  p_marketplace_category text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_min_age integer default null,
  p_max_age integer default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lim int := greatest(1, least(coalesce(nullif(p_page_size, 0), 12), 100));
  v_off int := (greatest(coalesce(nullif(p_page, 0), 1), 1) - 1) * v_lim;
  v_total int;
  v_rows json;
  v_start date := coalesce(p_start_date, '-infinity'::date);
  v_end date := coalesce(p_end_date, 'infinity'::date);
begin
  if p_merchant_id is null or btrim(p_merchant_id) = '' then
    return json_build_object('total', 0, 'rows', '[]'::json);
  end if;

  with filtered as (
    select c.*
    from classes c
    where c.merchant_id = btrim(p_merchant_id)
      and (
        p_search is null
        or length(btrim(p_search)) = 0
        or c.title ilike '%' || btrim(p_search) || '%'
      )
      and (
        p_marketplace_category is null
        or length(btrim(p_marketplace_category)) = 0
        or c.marketplace_category = btrim(p_marketplace_category)
      )
      and (
        (p_start_date is null and p_end_date is null)
        or (
          (c.class_date is not null and c.class_date between v_start and v_end)
          or exists (
            select 1
            from jsonb_array_elements(coalesce(c.scheduled_slots, '[]'::jsonb)) slot
            where (slot->>'date') is not null
              and length(trim(slot->>'date')) >= 10
              and (substring(trim(slot->>'date'), 1, 10))::date between v_start and v_end
          )
        )
      )
      and (
        (p_min_age is null and p_max_age is null)
        or (
          to_jsonb(coalesce(c.sidebar_option, array[]::text[])) ? '3'
          or (
            to_jsonb(coalesce(c.sidebar_option, array[]::text[])) ? '0'
            and p_min_age is not null
            and p_max_age is not null
            and p_min_age <= 3
            and p_max_age >= 0
          )
          or (
            to_jsonb(coalesce(c.sidebar_option, array[]::text[])) ? '1'
            and p_min_age is not null
            and p_max_age is not null
            and p_min_age <= 6
            and p_max_age >= 3
          )
          or (
            to_jsonb(coalesce(c.sidebar_option, array[]::text[])) ? '2'
            and p_min_age is not null
            and p_max_age is not null
            and p_min_age <= 9
            and p_max_age >= 6
          )
          or exists (
            select 1
            from unnest(coalesce(c.sidebar_option, array[]::text[])) as elem
            cross join lateral (
              select regexp_match(elem, '^__range:([0-9]+):([0-9]+)$') as arr
            ) r
            where r.arr is not null
              and cardinality(r.arr) >= 2
              and p_min_age is not null
              and p_max_age is not null
              and least(r.arr[1]::int, r.arr[2]::int) <= p_max_age
              and greatest(r.arr[1]::int, r.arr[2]::int) >= p_min_age
          )
        )
      )
  ),
  counted as (select count(*)::int as c from filtered),
  paged as (
    select
      f.id,
      f.slug,
      f.title,
      f.price,
      f.sale_price,
      f.capacity,
      f.image_url,
      f.sidebar_option,
      f.marketplace_category,
      f.store_category,
      f.city_region,
      f.city_district,
      f.class_date,
      f.scheduled_slots
    from filtered f
    order by f.id asc
    limit v_lim offset v_off
  )
  select
    coalesce((select c from counted), 0),
    coalesce(
      (select json_agg(row_to_json(p) order by p.id) from paged p),
      '[]'::json
    )
  into v_total, v_rows;

  return json_build_object('total', v_total, 'rows', v_rows);
end;
$$;
