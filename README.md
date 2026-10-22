# 小朋友下樓梯 NS-SHAFT Online

1997 年經典小遊戲《小朋友下樓梯》的網頁復刻版，加上全服排行榜、幽靈殘影對戰和 LINE 分享。

## 玩法

- **← / →** 或 **A / D**（手機按畫面下方按鈕）左右移動，一直往下走，別被天花板的尖刺夾到，也別掉出畫面
- 地板種類：一般、尖刺（扣血）、彈簧床、左右輸送帶、假地板（踩了會翻掉）
- **📅 同圖競技**：所有人玩同一張地圖，可以和排行榜上其他人的 👻 殘影一起跑
- **🎲 隨機地圖**：經典模式，每局隨機，不會留下殘影
- 死掉後可以上傳成績、產生戰績圖、用 LINE 傳給朋友挑戰

## 執行方式

純靜態網頁，有兩種跑法：

**1. 直接開（GitHub Pages 或任何靜態主機）**：排行榜存在 Firebase Realtime Database。

**2. 本機伺服器**：需要 Node.js，不用裝任何套件。

```bash
node server.js          # http://localhost:3081，可用 PORT 環境變數改 port
```

如果要用 `server.js` 自己存排行榜（存在 `shaft_leaderboard.json`），把 `game.js` 裡的 `FIREBASE_DB_URL` 改成空字串 `''`。

## Firebase 設定

1. 在 Firebase Console 建一個 Realtime Database
2. 把資料庫網址填進 `game.js` 的 `FIREBASE_DB_URL`
3. 到 Realtime Database →「規則」，貼上 `database.rules.json` 的內容並發布。這份規則讓玩家只能新增成績，不能修改或刪除別人的紀錄

資料結構：`/records/<id>` 存成績，`/ghosts/<id>` 另外存殘影軌跡，讓排行榜下載量保持很小。

殘影每 0.1 秒記一格，上限 30 分鐘（18000 格，約 216 KB）；只有能進前 50 名的成績才會上傳殘影。規則會拒絕超過 18000 格的殘影。

## 更新後記得

改了 `game.js` 或 `style.css` 之後，把 `index.html` 裡的 `?v=2` 往上加一，玩家的手機才會抓到新版，不會繼續用快取的舊檔。

## 管理員

長按版本號 3 秒會開啟管理員面板，用 Google 登入後可以在排行榜上刪除紀錄、清理孤兒殘影。真正的權限由 `database.rules.json` 裡的管理員 UID 控制（把 `REPLACE_WITH_ADMIN_UID` 換成自己的 UID 再發布）。
