-- ============================================================
-- グループ機能（同一グループ間だけで情報共有する）
-- ============================================================
-- 対象: users, points, chronology, handover_threads, location_history
-- 除外: chronology_reactions / handover_replies は親（chronology_id /
--       thread_id）経由でグループが決まるため、group_id列は追加しない
-- adminロール: role='admin' のユーザーは全グループを横断して閲覧できる。
--       admin昇格はここでは行わない。運用者が個別にUPDATEすること
--       （下の「使い方」参照）
-- ============================================================

-- ------------------------------------------------------------
-- 1. groupsテーブル（招待コード方式）
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_at BIGINT NOT NULL
);

-- ------------------------------------------------------------
-- 2. group_id列の追加
-- ------------------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id);
ALTER TABLE chronology ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id);
ALTER TABLE handover_threads ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id);
ALTER TABLE location_history ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id);

ALTER TABLE points ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id);

-- pointsは今までnameだけがPRIMARY KEYだったため、異なるグループが同じ
-- 地点名を使うと上書きし合ってしまう。id列を新しいPRIMARY KEYにし、
-- (group_id, name)の組み合わせでユニークにする
ALTER TABLE points ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE points DROP CONSTRAINT IF EXISTS points_pkey;
ALTER TABLE points ADD PRIMARY KEY (id);
ALTER TABLE points DROP CONSTRAINT IF EXISTS points_group_id_name_key;
ALTER TABLE points ADD CONSTRAINT points_group_id_name_key UNIQUE (group_id, name);

-- ------------------------------------------------------------
-- 3. 検索用インデックス
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_chronology_group ON chronology (group_id);
CREATE INDEX IF NOT EXISTS idx_handover_threads_group ON handover_threads (group_id);
CREATE INDEX IF NOT EXISTS idx_location_history_group ON location_history (group_id);

-- ============================================================
-- 使い方
-- ============================================================
--
-- ① グループを作る（invite_codeが新規登録画面の「合言葉」になる）:
--
--   INSERT INTO groups (name, invite_code, created_at)
--   VALUES ('本部', 'ここに招待コードを設定', extract(epoch from now())*1000);
--
-- ② 既存ユーザー・既存データの移行:
--    このマイグレーション適用直後は、既存の全ユーザー・地点・
--    クロノロジー等の group_id が NULL になる。NULLのユーザー同士は
--    お互いに見えるが、どのグループにも属さないため実質「取り残された」
--    状態になる。①でグループを作った後、以下のように全員をそのグループへ
--    まとめて移すことを推奨する（グループを分けて再登録させたい場合は
--    このUPDATEは不要）:
--
--   UPDATE users SET group_id = (SELECT id FROM groups WHERE invite_code='ここに設定したコード') WHERE group_id IS NULL;
--   UPDATE points SET group_id = (SELECT id FROM groups WHERE invite_code='ここに設定したコード') WHERE group_id IS NULL;
--   UPDATE chronology SET group_id = (SELECT id FROM groups WHERE invite_code='ここに設定したコード') WHERE group_id IS NULL;
--   UPDATE handover_threads SET group_id = (SELECT id FROM groups WHERE invite_code='ここに設定したコード') WHERE group_id IS NULL;
--   UPDATE location_history SET group_id = (SELECT id FROM groups WHERE invite_code='ここに設定したコード') WHERE group_id IS NULL;
--
--   ※ サーバー側はメモリにユーザー・地点・クロノロジーをキャッシュしているため、
--     上のUPDATEを実行した後はRenderでサーバーを再起動して読み直させること。
--
-- ③ 管理者（全グループ横断で閲覧できる）にする:
--
--   UPDATE users SET role = 'admin' WHERE user_id = 'ここに対象のuser_id';
--
--   ※ roleはクライアントから送られてきた値を一切信用しないようサーバー側で
--     修正済みなので、admin昇格は必ずこのようにDBを直接操作して行うこと。
-- ============================================================
