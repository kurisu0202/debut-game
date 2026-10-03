# デビューまであと1ステージ

スマホのブラウザで遊べる、2〜4人用のオンライン対戦カードゲームです。
HTML/CSS/JavaScript だけで作られていて（ビルド不要）、通信には Firebase Realtime Database、公開には GitHub Pages を使います。**どちらも無料枠で動きます。**

```
index.html            画面の土台
style.css             デザイン
js/main.js            画面表示・タップ操作
js/game.js            ゲームルール（得点計算など）
js/cards.js           カードデータ（練習生・レッスン・イベント・テーマ・ハプニング）
js/store.js           通信（Firebase／ローカルテスト）
js/firebase-config.js Firebaseの接続設定 ← ここを書き換える
database.rules.json   Firebaseのセキュリティルール（コピペ用）
```

---

## 0. まずローカルで動作確認（Firebase不要）

`js/firebase-config.js` が初期状態のままだと **ローカルテストモード** で動きます。
同じブラウザで複数のタブを開くと、タブ同士で対戦できます。

ES Modules を使っているため、ファイルをダブルクリックで開くのではなく、簡易サーバー経由で開いてください。

```bash
# このフォルダで（どちらか）
npx serve .
python -m http.server 8000
```

ブラウザで `http://localhost:8000`（serve なら表示されたURL）を開き、タブを2〜3個開いて、別々の名前・同じルームIDで入室します。

---

## 1. Firebase の設定（無料の Spark プラン）

1. https://console.firebase.google.com/ を開き、Googleアカウントでログイン
2. 「プロジェクトを作成」→ 好きな名前（例：`debut-game`）→ Googleアナリティクスはオフでも可 → 作成
   - 料金プランは **Spark（無料）** のままでOK。クレジットカード登録は不要です
3. 左メニュー「構築」→「**Realtime Database**」→「データベースを作成」
   - ロケーション：`asia-southeast1`（シンガポール）が日本から近くておすすめ
   - セキュリティルール：「**ロックモード**で開始」を選択（あとで書き換えます）
4. Realtime Database の「**ルール**」タブを開き、このフォルダの `database.rules.json` の中身を丸ごと貼り付けて「公開」
5. 歯車アイコン「プロジェクトの設定」→「全般」→ 下の「マイアプリ」で **ウェブ（`</>`）** アイコンをクリック
   - アプリのニックネームを入力して登録（Firebase Hosting のチェックは不要）
   - 表示される `const firebaseConfig = { ... }` の中身をコピー
6. `js/firebase-config.js` の値を、コピーした値に置き換える

   ```js
   export const firebaseConfig = {
     apiKey: "AIza....",
     authDomain: "debut-game.firebaseapp.com",
     databaseURL: "https://debut-game-default-rtdb.asia-southeast1.firebasedatabase.app",
     projectId: "debut-game",
     storageBucket: "debut-game.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef123456",
   };
   ```

   > `databaseURL` が表示されない場合は、Realtime Database の「データ」タブ上部に出ているURL（`https://〜.firebasedatabase.app`）を貼ってください。

7. ローカルで開き直し、入室画面の下が「● オンライン（Firebase接続）」になっていれば成功です。

### 補足
- Web用の `apiKey` は公開されても問題ない値です（GitHubに載せてOK）。アクセス制御は手順4のルールで行います。
- このルールは「`rooms/ルームID/data` に文字列を書くことだけ許可」するものです。ログイン機能のない簡易版なので、**ルームIDを知っている人は誰でも部屋の中身を読み書きできます**。仲間内で遊ぶ前提です。
- 無料枠（同時接続100・保存1GB・転送10GB/月）に対して、このゲームの1部屋は数十KB程度なので十分収まります。
- 古い部屋のデータは Realtime Database の「データ」タブから `rooms` ごと削除して掃除できます。

---

## 2. GitHub Pages で公開（無料）

### A. ブラウザだけでやる方法（簡単）
1. https://github.com/ で「New repository」→ 名前（例：`debut-game`）→ **Public** → 作成
2. 「uploading an existing file」をクリックし、このフォルダの中身（`index.html`, `style.css`, `js` フォルダ など）をまとめてドラッグ＆ドロップ →「Commit changes」
3. リポジトリの「Settings」→ 左メニュー「Pages」
   - Source：**Deploy from a branch**
   - Branch：`main` ／ `/ (root)` → Save
4. 1〜2分待つと `https://あなたのユーザー名.github.io/debut-game/` で公開されます

### B. git コマンドでやる方法
```bash
cd "このフォルダ"
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/debut-game.git
git push -u origin main
```
その後、上の手順3と同じく Settings → Pages で `main` / `(root)` を選択します。

### 更新するとき
ファイルを書き換えて、もう一度アップロード（または `git add . && git commit -m "update" && git push`）すると、1〜2分で反映されます。
スマホで反映されない場合はページを再読み込みしてください。

---

## 3. 遊び方
1. 公開URLをスマホで開く
2. 1人が「🎲作成」でルームIDを作って入室 → ロビーの「🔗 招待リンクを共有」でLINEなどに送る
3. 他の人はリンクを開いて名前を入れて入室（またはルームIDを手入力）
4. 好きなら「＋ 練習生を作る」でオリジナル練習生を山札に追加
5. ホストが「ゲーム開始」

- 途中でページを閉じても、**同じルームID・同じ名前**で入り直せば自分の席に戻れます
- 誰かが応答しなくなったら、ホストは「スキップ」「未決定を自動選択」「全員を待たずに進める」で進行できます

---

## ルールの解釈（原案で決まっていなかった部分）
| 項目 | このアプリでの扱い |
|---|---|
| 初期配布 | 練習生30枚（＋オリジナル）から各自2人をグループへ。残りの練習生は山札に戻してシャッフル |
| 手番順 | 開始プレイヤーはランダム。週ごとに1人ずつずれる |
| 手札上限 | なし。山札が尽きたら捨て札をシャッフルして山札に |
| オールラウンダー | 出演したときにステージ点+1 |
| センター | 一緒に出演した他のメンバー全員に+1（センター2人なら互いに+1） |
| ワールドツアー発表 | 全員1枚＋グループの海外メンバー1人につき1枚追加 |
| 熱愛報道 | 公開時にランダム1事務所−2、翌週の開始時に+4（最終週なら最終集計で+4） |
| サバイバル番組 | 使った次の週のステージに出演不可 |
| 引き抜き交渉 | 自分のグループが5人だと使えない。手札が他にないときは渡さなくてよい |
| 電撃カムバック | ×1.5（端数切り捨て）。2枚使えば×2.25 |
| ファン獲得2倍 | 順位によるファンのみ2倍（テーマ＋ハプニングで最大×4）。リーダー・ペンライトのボーナスは倍にならない |
| 逆走 | 前週の順位が最下位（全員同点の場合は該当なし） |
| 月末評価 | 能力合計が最高タイでも成功 |

ルールを変えたいときは `js/game.js`、カードの数値は `js/cards.js` を編集してください。
