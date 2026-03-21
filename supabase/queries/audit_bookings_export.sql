-- =============================================================================
-- 用途：在 Supabase「SQL Editor」查出 / 匯出訂單（bookings），排查「下單站台 CLIENT_ID 不一致」
-- 匯出：查詢結果右上角可 Download CSV，或全選複製到試算表
-- =============================================================================

-- (1) 最近已付款／完成的訂單 + 課程名稱 + 庫存課所屬商家（看出訂單落在哪個 merchant_id）
select
  b.id,
  b.created_at,
  b.status,
  b.payment_method,
  b.order_amount,
  b.merchant_id as booking_merchant_id,
  b.class_creator_merchant_id,
  b.sold_via_merchant_id,
  b.member_email,
  b.parent_name,
  b.parent_phone,
  b.slot_date,
  b.slot_time,
  b.class_id,
  c.title as class_title,
  c.merchant_id as class_row_merchant_id,
  b.line_pay_transaction_id,
  b.ecpay_merchant_trade_no,
  b.newebpay_merchant_order_no
from public.bookings b
left join public.classes c on c.id = b.class_id
where b.status in ('paid', 'completed')
order by b.created_at desc
limit 100;

-- (2) 若你知道購買人信箱，改成實際信箱後執行（精準找單）
-- select b.*, c.title as class_title
-- from public.bookings b
-- left join public.classes c on c.id = b.class_id
-- where b.member_email ilike '%你的信箱關鍵字%'
-- order by b.created_at desc;

-- (3) 看近期訂單分佈在哪些 merchant_id（對照 Vercel 的 NEXT_PUBLIC_CLIENT_ID）
-- select b.merchant_id, b.sold_via_merchant_id, count(*) as cnt
-- from public.bookings b
-- where b.created_at > now() - interval '30 days'
-- group by 1, 2
-- order by cnt desc;

-- (4) 同時查「還沒轉成訂單」的線上待付款（callback 沒跑完會卡在這）
-- select p.*, c.title as class_title
-- from public.pending_payments p
-- left join public.classes c on c.id = p.class_id
-- order by p.created_at desc
-- limit 50;

-- =============================================================================
-- (5) 僅在確認要讓「某後台 CLIENT_ID」能看到跨庫存訂單時：補 sold_via（請替換 UUID / 商家 id）
-- 後台篩選為：merchant_id = 你的 CLIENT_ID OR sold_via_merchant_id = 你的 CLIENT_ID
-- 下列為範本，執行前務必備份並確認 booking id 正確
-- =============================================================================
-- update public.bookings
-- set sold_via_merchant_id = '你的官網_NEXT_PUBLIC_CLIENT_ID'
-- where id in (
--   '第一筆訂單-uuid'::uuid,
--   '第二筆訂單-uuid'::uuid
-- );
