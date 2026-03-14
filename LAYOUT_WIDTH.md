# 首頁寬度：置中 vs 全螢幕

## 為什麼 [joyseedisland.com](https://www.joyseedisland.com/) 看起來是全螢幕寬度，而 [model-5lqo.vercel.app](https://model-5lqo.vercel.app/) 是置中畫面？

- **童趣島 (joyseedisland)**：許多區塊（例如輪播、課程）的**內容**可能使用較大的 `max-width` 或接近全寬的容器，或沒有像我們一樣用 `max-w-7xl` 限制，所以視覺上較接近全螢幕。
- **本站 (model)**：刻意使用 **max-w-7xl（1280px）** 並 **mx-auto** 讓主內容置中，左右留白，是常見的「內容區置中、兩側留白」版型。

也就是說：差異來自 **CSS 的 max-width 與容器寬度**，不是資料庫或後台設定。

## 本站哪裡控制寬度？

- **前台首頁**：`app/page.tsx`
  - `<header>` 內層：`max-w-7xl mx-auto px-4`
  - `<main>`：`max-w-7xl`
  - 各區塊內的容器也多為 `max-w-7xl mx-auto`
- **Tailwind**：`max-w-7xl` = 1280px

若要改成「更寬」或「全螢幕」：

1. **改寬一點**：把 `max-w-7xl` 改成 `max-w-screen-2xl`（1536px）或自訂 `max-w-[1440px]`。
2. **全螢幕**：把主內容的 `max-w-7xl` 拿掉，改成 `w-full` 或 `max-w-full`，並依需要加 `px-4` 做左右留白。

修改後儲存、部署，前台就會變成較寬或全螢幕的版型。
