# Version 2.5 バックアップ（2026-08-10 時点）

このフォルダは `v2.5` タグ時点のソースコードのコピーです。
（`server.js` / `public/index.html` / `public/manual.html` / `package.json` / `package-lock.json`）

## 含まれないもの

- **Supabaseのデータベース内容**（users / current_users / points / chronology / traffic_regulations 等）は含まれません。
  コードを2.5に戻しても、登録済みユーザーや地点データなどは元に戻りません。
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
