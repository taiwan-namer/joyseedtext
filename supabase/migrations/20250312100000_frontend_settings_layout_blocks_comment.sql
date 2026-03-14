-- 僅更新 frontend_settings 欄位說明，不新增欄位（layout_blocks 存於同一 jsonb 內）
comment on column store_settings.frontend_settings is '前台設定（JSONB）：含 heroImageUrl, heroTitle, carouselItems, layout_order, fullWidthImageUrl, layout_blocks。layout_blocks 為畫布區塊陣列，每筆 { id, order, heightPx, backgroundImageUrl }，用於首頁版面順序、區塊高度與背景圖。';
