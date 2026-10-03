# デビューまであと1ステージ

スマホのブラウザで遊べる、2〜4人用のオンライン対戦ゲームです（CPUも追加できます）。
プレイヤーはオーディション番組の練習生。全員同じ課題曲でステージ点を競い、全5課題で一番票を集めた人がデビュー（勝ち）です。
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
2. 1人が「🎲作成」でルームIDを作って入室 → 待機室の「🔗 招待リンクを送る」でLINEなどに送る
3. ほかの人はリンクを開いて名前を入れて入室（人数が足りなければ「＋ CPUを追加」）
4. 各自「タイプ」（ボーカル型・ダンス型・ラップ型・オールラウンダー）を選ぶ
5. ホストが「番組スタート」

### 1つの課題の流れ（全5課題）
1. **課題曲の発表**：全員が同じ曲で勝負。曲ごとに重視される能力が違う（後半ほど難しい曲）
2. **チーム決め**：候補の練習生から、得票が少ない人から順に指名（第1課題はソロ）
3. **練習**：練習カードを2枚まで使って能力アップ。「パート奪い」「悪魔の編集」でライバルの邪魔もできる（本番まで相手にはヒミツ）
4. **本番**：ステージ点の高い順に順位が決まり、票が入る（4人なら 10万／6万／3万／1万、最終課題は2倍）。本番ハプニングも起きる

- 難しい曲（★★は7以上、★★★は10以上）はメイン能力が足りないとミス連発
- 5課題が終わって一番票を集めた人がデビュー（勝ち）
- 途中でページを閉じても、**同じルームID・同じ名前**で入り直せば自分の席に戻れます
- 止まっている人がいたら、ホストが「飛ばす」「全員待たずに開始」で進められます

ルールや数値を変えたいときは `js/game.js`（得点計算・CPUの動き）、`js/cards.js`（課題・曲・カード・ハプニング・練習生）を編集してください。
