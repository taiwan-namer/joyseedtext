# 圖中「剩餘人數」如何對應庫存（查明報告，未改程式）

本文件說明課程頁「選擇日期與時間」彈窗裡 **「剩餘 X 人」** 的資料來源與計算方式，以及與後台庫存的對應關係。**僅查明、不修改程式。**

---

## 一、圖中區塊的 UI 來源

- **位置**：課程詳情頁（`/course/[slug]`）→ 點「選擇日期與時間」→ 彈窗底部「2026-03-26 12:00」右側的 **「剩餘 2 人」**。
- **元件**：`DateTimeModal`（定義在 `app/course/[slug]/page.tsx` 約 48–276 行）。

顯示邏輯（約 256–260 行）：

```ts
{displayRemaining !== null
  ? displayRemaining > 0
    ? `剩餘 ${displayRemaining} 人`
    : "已額滿"
  : "剩餘名額：—"}
```

也就是：**畫面上的「剩餘 X 人」= 變數 `displayRemaining`。**

---

## 二、`displayRemaining` 怎麼來

在 `DateTimeModal` 內（約 125–129 行）：

```ts
const slotRemaining =
  dateStr && selectedTime && slotRemainingList.length > 0
    ? slotRemainingList.find((s) => s.date === dateStr && s.time === selectedTime)?.remaining ?? null
    : null;
const displayRemaining = slotRemaining !== null ? slotRemaining : remainingCapacity ?? null;
```

- **優先**：目前選的「日期 + 時段」在 `slotRemainingList` 裡找到一筆，用該筆的 **`remaining`** → 即 `slotRemaining`。
- **沒有才用**：`remainingCapacity`（課程的整課名額，來自 `course.capacity`）。

所以：
- 有 `slotRemainingList` 且該日該時段有資料時，**「剩餘 X 人」= 該場次的 `remaining`**。
- 沒有時才用整課的 `remainingCapacity`。

---

## 三、`slotRemainingList` 的來源與時機

- **誰給的**：父層課程頁的 state `slotRemainingList`，經 props 傳給 `DateTimeModal`（約 625 行）。
- **誰填的**：`useEffect`（約 382–390 行）：**每次「打開」日期時間彈窗時** 會呼叫：

  ```ts
  getSlotRemainingCounts(course.id).then((res) => {
    if (!cancelled && res.success) setSlotRemainingList(res.slots);
    else if (!cancelled) setSlotRemainingList([]);
  });
  ```

- **條件**：`dateTimeModalOpen === true` 且 `course` 有 `id`（來自 DB 的課程）。
- **結論**：畫面上的「剩餘 X 人」對應的是 **「打開彈窗當下」** 由 `getSlotRemainingCounts(course.id)` 回傳的該課程各場次 `remaining`，**不是** 即時輪詢。

---

## 四、`getSlotRemainingCounts(classId)` 如何算「剩餘」（庫存對應）

**檔案**：`app/actions/bookingActions.ts`，約 336–411 行。

### 4.1 讀取的資料

| 來源 | 用途 |
|------|------|
| **classes**（單筆） | `class_id = classId`、`merchant_id = 目前店家`；欄位：`capacity`, `scheduled_slots`, `class_date`, `class_time`。 |
| **bookings** | `class_id = classId`、`merchant_id`、**status 僅限 `paid` 或 `completed`**；欄位：`slot_date`, `slot_time`。 |

也就是：**只會看「這門課」的「已付款／已完成」訂單**，不會算 unpaid 或別門課。

### 4.2 每場次的「名額」與「已報名」

- **場次列表**：由 `classes.scheduled_slots`（及若有 `class_date` / `class_time`）展開成多個「日期 + 時間」。
- **每場次名額 capacity**：
  - 若該筆 `scheduled_slots[i].capacity` 為數字且 ≥ 1 → 用 **該場次自己的 capacity**。
  - 否則 → 用 **classes.capacity**（整課預設名額）。
- **已報名數**：對每個「日期 + 時間」key（`slot_date` 正規化為 YYYY-MM-DD、`slot_time` 為 HH:MM），數 **bookings** 裡 `status in ('paid','completed')` 的筆數。

### 4.3 剩餘

```ts
remaining = max(0, capacity - booked)
```

- **key**：`date`（YYYY-MM-DD）+ `time`（HH:MM），與「選擇日期與時間」的 `dateStr`、`selectedTime` 一致。
- 回傳型別：`SlotRemaining[]`，每筆 `{ date, time, capacity, remaining }`。

因此：**圖中「剩餘 2 人」= 該課程、該日、該時段在「打開彈窗時」的那次查詢裡，用「該場次 capacity − 已付款/已完成人數」算出來的 `remaining`。**

---

## 五、後台庫存（報名進度／點名簿）用什麼

後台「報名進度查詢」主要用：

- **getRollcallDatesWithCounts**：每個「日期」一筆，該日 **所有課程、所有時段** 加總的「已報名數」與「總名額」。
- **getRollcallSessionsByDate(slotDate)**：選定某日後，列出該日 **每一堂課、每一時段** 的「已報名／總名額」。

與前台對齊的點：

- 已報名數：同樣只算 **bookings 的 status in ('paid','completed')**。
- 每場次名額：同樣會用 **scheduled_slots[].capacity**（有且 ≥1）或 **classes.capacity**（後台已改為與前台一致）。

所以：**同一門課、同一日期、同一時段**，理論上應為：

- 後台該場次「總名額」= 前台該場次的 `capacity`
- 後台該場次「已報名」= 前台用來算 `remaining` 的 `booked`
- **後台「剩餘」= 總名額 − 已報名 = 前台的 `remaining`**

---

## 六、對應關係整理（圖中「剩餘 X 人」↔ 後台庫存）

| 項目 | 圖中「剩餘 X 人」 | 後台庫存（同一課程、同一日、同一時段） |
|------|-------------------|----------------------------------------|
| **資料來源** | `getSlotRemainingCounts(course.id)` 回傳的 `slotRemainingList` 中，`date === dateStr && time === selectedTime` 的 `remaining` | 報名進度 → 選日期 → 該日場次列表中，該課程、該時段的那一行的「總名額 − 已報名」 |
| **讀取的表** | **classes**（該課程）、**bookings**（該課程、status paid/completed） | 同上（classes + bookings，paid/completed） |
| **名額定義** | 該場次：`scheduled_slots[].capacity` 或 `classes.capacity` | 同：per-slot capacity 或 class capacity |
| **已報名** | 該 class_id + 該 slot_date + 該 slot_time 的 paid/completed 筆數 | 同上 |
| **更新時機** | **僅在「打開」日期時間彈窗時** 呼叫一次，之後不自動更新 | 每次進入／重整報名進度頁時重新查詢 |

---

## 七、若「圖中剩餘」與後台仍對不起來，可檢查的點

1. **是否同一門課、同一日、同一時段**  
   後台「報名進度」是「先選日期 → 再展開該日所有課程與時段」。要對應的是：**同一課程、同一天、同一個時間** 的那一列，不是該日的加總。

2. **彈窗是「快照」**  
   「剩餘 X 人」是**打開彈窗當下**的結果。若在開著彈窗時後台有新的付款或完成，需關閉彈窗再打開才會看到新數字。

3. **課程來源是否一致**  
   課程頁的 `course` 來自 `getCourseById(slug)`；若畫面上看到的課程和後台報名進度選的課程不是同一筆（例如 slug/id 對錯），就會對不起來。

4. **scheduled_slots 的 capacity**  
   若該場次在後台有設「每場名額」，需確認 `classes.scheduled_slots` 裡該筆有 `capacity` 且 ≥ 1；前台與後台現在都會用這個 per-slot capacity。

5. **時區／日期格式**  
   `slot_date`、`dateStr` 皆為 YYYY-MM-DD；`slot_time`、`selectedTime` 為 HH:MM。若 DB 或前後台有一方用不同格式，key 會對不上，剩餘就會錯。

---

## 八、結論（僅查明、未改程式）

- **圖中「剩餘 X 人」** = 該課程、該日、該時段在 **打開彈窗時** 由 `getSlotRemainingCounts(course.id)` 算出的 **該場次 `remaining`**（或沒有時用整課 `remainingCapacity`）。
- **庫存對應**：同一課程、同一日、同一時段下，與後台「報名進度 → 該日 → 該場次」的「總名額 − 已報名」應一致；資料都來自 **classes + bookings（paid/completed）**，且後台已改為使用與前台相同的 per-slot capacity 邏輯。
- 若仍不一致，可依第七節逐項檢查（同一課程/日/時段、快照時機、scheduled_slots.capacity、日期時間格式等）。

以上為僅查明、未修改任何程式之對應說明。
