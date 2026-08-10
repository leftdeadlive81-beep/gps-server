# Version 2.5 バックアップ（2026-08-10 時点）

このフォルダは `v2.5` タグ時点のソースコードのコピーです。
（`server.js` / `public/index.html` / `public/manual.html` / `package.json` / `package-lock.json`）

`database-export.json` は 2026-08-10 時点のSupabaseデータ（users / current_users /
points / chronology）のスナップショットです。取得後、エクスポート用の一時APIは
削除済みです。

## 含まれないもの

- 交通規制データ（trafficRegulations）はDBに保存しておらず国交省サイトから
  自動再取得する仕組みのため、バックアップ対象外です（戻す必要もありません）。
- `location_history`（GPS履歴ログ）は容量が大きくなるため対象外です。
- `.env`（DB接続情報）や `.pem` 鍵ファイルは含まれません（元々gitにも含めていません）。

## 復元方法（推奨・安全な方法：新しいコミットとして戻す）

作業ディレクトリで以下を実行すると、mainブランチの履歴を壊さずに2.5時点の内容へ戻せます。

```
git checkout v2.5 -- server.js public/index.html public/manual.html package.json package-lock.json
git commit -m "Restore to v2.5"
git push origin main
```

または、このフォルダのファイルをそのまま該当箇所へ上書きコピーしても同じ内容に戻せます。

```
cp backup/v2.5/server.js server.js
cp backup/v2.5/index.html public/index.html
cp backup/v2.5/manual.html public/manual.html
cp backup/v2.5/package.json package.json
cp backup/v2.5/package-lock.json package-lock.json
git add server.js public/index.html public/manual.html package.json package-lock.json
git commit -m "Restore to v2.5"
git push origin main
```

## Renderへの反映

Renderは `main` ブランチの更新を検知して自動デプロイする設定になっているため、
上記のコミットをpushすれば、通常はそのまま2.5相当の内容が本番に反映されます。

## タグからの確認

`git checkout v2.5` で、2.5時点の全ファイルを直接確認することもできます
（ブランチを移動するので、確認後は `git checkout main` で戻してください）。

## データの復元（database-export.json）

データも2.5時点へ戻したい場合は、有効なDB接続情報（`DATABASE_URL`）が必要です。
以下のようなNode.jsスクリプトを、正しい接続情報が使える環境（Render上や、
`.env` を最新化したローカル）で実行してください。

```js
// restore-data.js （一時的に作成して実行し、終わったら削除してよい）
require("dotenv").config();
const { Pool } = require("pg");
const data = require("./backup/v2.5/database-export.json");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  for (const u of data.users) {
    await pool.query(
      `INSERT INTO users (user_id, display_name, account_name, role, unit, rank, vehicle, vehicle_type, icon, phone, status, status_next, health, destination, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (user_id) DO UPDATE SET display_name=EXCLUDED.display_name, account_name=EXCLUDED.account_name,
         role=EXCLUDED.role, unit=EXCLUDED.unit, rank=EXCLUDED.rank, vehicle=EXCLUDED.vehicle,
         vehicle_type=EXCLUDED.vehicle_type, icon=EXCLUDED.icon, phone=EXCLUDED.phone, status=EXCLUDED.status,
         status_next=EXCLUDED.status_next, health=EXCLUDED.health, destination=EXCLUDED.destination, updated_at=EXCLUDED.updated_at`,
      [u.user_id, u.display_name, u.account_name, u.role, u.unit, u.rank, u.vehicle, u.vehicle_type,
       u.icon, u.phone, u.status, u.status_next, u.health, u.destination, u.created_at, u.updated_at]
    );
  }

  for (const p of data.points) {
    await pool.query(
      `INSERT INTO points (name, type, lat, lon, created) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (name) DO UPDATE SET type=EXCLUDED.type, lat=EXCLUDED.lat, lon=EXCLUDED.lon, created=EXCLUDED.created`,
      [p.name, p.type, p.lat, p.lon, p.created]
    );
  }

  for (const c of data.chronology) {
    await pool.query(
      `INSERT INTO chronology (user_name, message, created) VALUES ($1,$2,$3)`,
      [c.user_name, c.message, c.created]
    );
  }

  // current_users は users 登録後、アプリ側の再登録（GPS開始など）で
  // 自然に復元されるため、通常は個別復元しなくてよい。
  console.log("復元完了");
  await pool.end();
})();
```

`node restore-data.js` で実行し、完了したらこのスクリプトは削除してください。
