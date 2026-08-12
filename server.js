//============================================================
// Puttan Version 2.69
// server.js
//
// ・PostgreSQL / Supabase
// ・ユーザー登録
// ・GPS位置情報
// ・UTM座標
// ・アイコン4種類
// ・地点登録
// ・地点削除
// ・クロノロジー
// ・ユーザー削除
// ・交通規制情報
// ・国土交通省GISデータ
// ・熊本県内の交通規制のみ使用
// ・交通規制3日ごと自動更新
// ・接続中全端末へ自動配信
//
// ※ JARTICは使用しません
// ※ JARTIC関連コードは完全撤去
// ※ adm-zip は使用しません
// ※ ZIP展開は Node.js 標準 zlib で処理
//============================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const zlib = require("zlib");
const fs = require("fs");
const { initializeApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

const app = express();

const server = http.createServer(app);

//============================================================
// Firebase Admin（クロノロジー投稿のプッシュ通知用）
// ・サービスアカウントJSONはRenderの「Secret Files」機能で
//   /etc/secrets/firebase-service-account.json に配置する
//   （秘密情報のためgit管理はしない。ローカル開発時は環境変数
//   FIREBASE_SERVICE_ACCOUNT_JSON でも代用可）
// ・どちらも無い場合はプッシュ通知機能だけ無効化し、他の機能には影響しない
//============================================================

let firebaseMessaging = null;

try {
    const secretFilePath = "/etc/secrets/firebase-service-account.json";

    const serviceAccountJson = fs.existsSync(secretFilePath)
        ? fs.readFileSync(secretFilePath, "utf8")
        : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
        const firebaseApp = initializeApp({
            credential: cert(JSON.parse(serviceAccountJson))
        });
        firebaseMessaging = getMessaging(firebaseApp);
    }
    else {
        console.warn("Firebaseサービスアカウントが見つからないため、プッシュ通知は無効です");
    }
}
catch (err) {
    console.error("Firebase Admin初期化エラー:", err);
}

//============================================================
// Socket.IO
//============================================================

const io = new Server(server, {
    transports: ["polling", "websocket"],
    allowUpgrades: true,
    pingInterval: 25000,
    pingTimeout: 60000,
    // Puttanモバイル(Capacitor)アプリなど別オリジンからのSocket.IO接続を許可
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static("public"));
app.use(express.json());

//============================================================
// 新規アカウント登録の合言葉チェック
// ・部外者がアカウントを作れないようにする簡易的な防御。
//   Supabaseの匿名キーはクライアントに公開される性質上、この
//   チェックだけで完全に防げるものではない（ブラウザの開発者
//   ツールから直接Supabase APIを叩けば理論上は回避できる）が、
//   通りすがりの第三者による登録は防げる
// ・合言葉はRenderの環境変数 REGISTRATION_PASSCODE に設定する。
//   未設定の場合は安全側に倒し、登録を常に拒否する
//============================================================

const passcodeAttemptsByIp = new Map();
const PASSCODE_MAX_ATTEMPTS = 10;
const PASSCODE_WINDOW_MS = 15 * 60 * 1000;

app.post("/api/verify-passcode", (req, res) => {
    const ip = req.ip || "unknown";
    const now = Date.now();

    const record = passcodeAttemptsByIp.get(ip) || { count: 0, windowStart: now };
    if (now - record.windowStart > PASSCODE_WINDOW_MS) {
        record.count = 0;
        record.windowStart = now;
    }
    record.count++;
    passcodeAttemptsByIp.set(ip, record);

    if (record.count > PASSCODE_MAX_ATTEMPTS) {
        res.status(429).json({ valid: false, message: "試行回数が多すぎます。しばらくしてから再度お試しください" });
        return;
    }

    const expected = process.env.REGISTRATION_PASSCODE;
    if (!expected) {
        console.warn("REGISTRATION_PASSCODE未設定のため、新規登録を拒否しました");
        res.json({ valid: false, message: "現在、新規登録は無効化されています" });
        return;
    }

    const submitted = String((req.body && req.body.code) || "").trim();
    const valid = submitted.length > 0 && submitted === expected;

    res.json({ valid: valid });
});

//============================================================
// Nominatim (OpenStreetMap) 利用規約対応
// ・1秒あたり1リクエストまでという規約があるため、全クライアント・
//   全機能（地図中央の地名・隊員一覧の地名・住所検索）分をまとめて
//   このキューで直列化する
// ・地名は同じ座標であれば結果が変わらないため、サーバー側でも
//   キャッシュして実際のリクエスト数自体を減らす
//============================================================

let nominatimQueueTail = Promise.resolve();
const NOMINATIM_MIN_INTERVAL_MS = 1100;

function scheduleNominatimRequest(taskFn) {
    const result = nominatimQueueTail.then(() => taskFn());
    nominatimQueueTail = result
        .catch(() => {})
        .then(() => new Promise(resolve => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS)));
    return result;
}

const placeNameServerCache = {};

//============================================================
// 逆ジオコーディング（地図中央・隊員一覧の地名取得）
// ・Nominatim (OpenStreetMap) を利用規約に沿ってサーバー経由で中継
//============================================================

app.get("/api/reverse-geocode", async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        res.status(400).json({ error: "invalid lat/lon" });
        return;
    }

    const cacheKey = lat.toFixed(3) + "," + lon.toFixed(3);

    if (placeNameServerCache[cacheKey]) {
        res.json({ name: placeNameServerCache[cacheKey] });
        return;
    }

    try {
        const name = await scheduleNominatimRequest(async () => {
            const url =
                "https://nominatim.openstreetmap.org/reverse" +
                "?format=jsonv2&addressdetails=1&zoom=14" +
                "&lat=" + encodeURIComponent(lat) +
                "&lon=" + encodeURIComponent(lon) +
                "&accept-language=ja";

            const response = await fetch(url, {
                headers: { "User-Agent": "Puttan/2.6 (GPS tracking tool; contact: leftdeadlive81@gmail.com)" }
            });

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const data = await response.json();
            const address = data.address || {};

            const parts = [
                address.state,
                address.city || address.town || address.village,
                address.suburb || address.neighbourhood || address.city_district
            ].filter(Boolean);

            return parts.length ? parts.join(" ") : (data.display_name || null);
        });

        if (name) {
            placeNameServerCache[cacheKey] = name;
        }

        res.json({ name });
    }
    catch (err) {
        console.error("逆ジオコーディングエラー", err);
        res.status(502).json({ error: "reverse geocode failed" });
    }
});

//============================================================
// 住所検索（地図上の検索ボックス用）
// ・Nominatim (OpenStreetMap) を利用規約に沿ってサーバー経由で中継
//============================================================

app.get("/api/geocode", async (req, res) => {
    const query = String(req.query.q || "").trim();

    if (!query) {
        res.status(400).json({ error: "query is required" });
        return;
    }

    try {
        const results = await scheduleNominatimRequest(async () => {
            const url =
                "https://nominatim.openstreetmap.org/search" +
                "?format=jsonv2&addressdetails=1&limit=5" +
                "&countrycodes=jp&accept-language=ja" +
                "&q=" + encodeURIComponent(query);

            const response = await fetch(url, {
                headers: { "User-Agent": "Puttan/2.6 (GPS tracking tool; contact: leftdeadlive81@gmail.com)" }
            });

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const data = await response.json();

            return (Array.isArray(data) ? data : []).map(item => ({
                name: item.display_name,
                lat: Number(item.lat),
                lon: Number(item.lon)
            }));
        });

        res.json({ results });
    }
    catch (err) {
        console.error("住所検索エラー", err);
        res.status(502).json({ error: "geocode failed" });
    }
});

//============================================================
// PostgreSQL / Supabase
//============================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    // Session poolerは1接続=Postgresの専用バックエンド接続のため、
    // Supabase側で同時15接続までに制限されている。余裕を持って下回らせる
    max: 12
});

//============================================================
// メモリ
//============================================================

let users = {};
let points = {};
let chronology = [];
let trafficRegulations = [];
let announcementText = "";

// クロノロジーをメモリ保持・全端末配信する件数の上限（この1箇所を変えれば全体に反映される）
const CHRONOLOGY_LIVE_LIMIT = 100;

// 「もっと見る」で1回に取得する過去ログの件数
const CHRONOLOGY_PAGE_SIZE = 50;

// クロノロジーへのリアクション（絵文字は固定8種、DBはchronology_reactionsに保存）
const REACTION_EMOJIS = ["👍", "🙇‍♂️", "🙆‍♂️", "🙅‍♂️", "🤷‍♂️", "🫶", "🍙", "🐈"];

// { [chronologyId]: { [emoji]: [user_id, ...] } }
let chronologyReactions = {};

async function loadChronologyReactions() {
    try {
        const result = await pool.query("SELECT chronology_id, emoji, user_id FROM chronology_reactions");

        chronologyReactions = {};
        result.rows.forEach(row => {
            const id = row.chronology_id;
            if (!chronologyReactions[id]) { chronologyReactions[id] = {}; }
            if (!chronologyReactions[id][row.emoji]) { chronologyReactions[id][row.emoji] = []; }
            chronologyReactions[id][row.emoji].push(row.user_id);
        });

        console.log("リアクション復元:", result.rows.length, "件");
    }
    catch (err) {
        console.error("リアクション復元エラー", err);
    }
}

function attachReactions(item) {
    // chronologyReactions[item.id]をここで確定させ、その同じオブジェクトを
    // 参照させることで、後からtoggleReactionが同じオブジェクトを書き換えた際に
    // 既にキャッシュ済みのchronology配列側にも反映されるようにする。
    // （||{} で毎回新しい空オブジェクトを返していると、リアクションが1件も
    // 無い投稿を読み込んだ後に初めてリアクションが付いた瞬間、キャッシュ側の
    // reactionsがそれと繋がらない別オブジェクトのまま取り残され、次回接続時に
    // 送られる初期同期データでリアクションが消えて見えるバグになっていた）
    if (!chronologyReactions[item.id]) { chronologyReactions[item.id] = {}; }
    return { ...item, reactions: chronologyReactions[item.id] };
}

//============================================================
// 交通規制 自動更新間隔
//============================================================

const TRAFFIC_UPDATE_INTERVAL = 3 * 24 * 60 * 60 * 1000;

//============================================================
// 国土交通省
//============================================================

const MLIT_TRAFFIC_PAGE = "https://www.mlit.go.jp/road/saigai/r8kumamoto/index.html";

//============================================================
// 熊本県の概略範囲
//============================================================

const KUMAMOTO_BOUNDS = {
    minLon: 129.9,
    maxLon: 131.4,
    minLat: 32.0,
    maxLat: 33.2
};

//============================================================
// テストデータ
//============================================================

function getTrafficTestData() {
    return [
        {
            id: "test-traffic",
            lat: 32.803,
            lon: 130.707,
            route: "テスト道路",
            type: "通行止め",
            reason: "交通規制データ取得テスト",
            section: "テスト区間",
            start: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }),
            source: "Puttan テストデータ"
        }
    ];
}

//============================================================
// HTTP GET Buffer
//============================================================

async function httpGetBuffer(url) {
    const response = await fetch(url, {
        headers: { "User-Agent": "Puttan/2.6 traffic data client" }
    });

    if (!response.ok) {
        throw new Error("HTTP " + response.status + " " + response.statusText);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

//============================================================
// 国土交通省ページから最新GIS ZIP URLを取得
//============================================================

async function findMlitLatestGeoJsonZipUrl() {
    console.log("国土交通省 道路規制GIS URLを検索しています...");

    const response = await fetch(MLIT_TRAFFIC_PAGE, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Puttan/2.6)" }
    });

    if (!response.ok) {
        throw new Error("国交省ページ取得失敗: HTTP " + response.status);
    }

    const html = await response.text();

    console.log("国交省ページ取得:", html.length, "bytes");

    const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    const candidates = [];
    let match;

    while ((match = anchorPattern.exec(html)) !== null) {
        const href = match[1];
        const rawText = match[2];

        const text = rawText
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/\s+/g, " ")
            .trim();

        if (text.includes("時点データ") || /\.zip(?:[?#].*)?$/i.test(href)) {
            candidates.push({ text: text, href: href });
        }
    }

    console.log("国交省GIS候補:", candidates);

    if (candidates.length === 0) {
        throw new Error("国交省ページからGISデータリンクを取得できませんでした");
    }

    const selected = candidates[candidates.length - 1];

    const url = new URL(selected.href, MLIT_TRAFFIC_PAGE).href;

    console.log("================================");
    console.log("国交省GIS URL確定:");
    console.log(url);
    console.log("データ:", selected.text);
    console.log("================================");

    return url;
}

//============================================================
// GeoJSON判定
//============================================================

function isGeoJSON(data) {
    if (!data) { return false; }
    return (data.type === "FeatureCollection" || data.type === "Feature");
}

//============================================================
// ZIP内からGeoJSONを探す
//============================================================

function findGeoJSONEntries(entries) {
    const results = [];

    for (const entry of entries) {
        if (!/\.(geojson|json)$/i.test(entry.name)) { continue; }

        try {
            const text = entry.data.toString("utf8");
            const json = JSON.parse(text);

            if (isGeoJSON(json)) {
                results.push({ name: entry.name, geojson: json });
            }
        }
        catch {
            // JSONでないファイルは無視
        }
    }

    return results;
}

//============================================================
// 座標が熊本県概略範囲内か
//============================================================

function isKumamotoCoordinate(lon, lat) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) { return false; }

    return (
        lon >= KUMAMOTO_BOUNDS.minLon &&
        lon <= KUMAMOTO_BOUNDS.maxLon &&
        lat >= KUMAMOTO_BOUNDS.minLat &&
        lat <= KUMAMOTO_BOUNDS.maxLat
    );
}

//============================================================
// Geometryから代表座標を取得
//============================================================

function getGeometryRepresentativeCoordinate(geometry) {
    if (!geometry) { return null; }

    if (geometry.type === "Point") {
        const c = geometry.coordinates;
        if (Array.isArray(c) && c.length >= 2) {
            return { lon: Number(c[0]), lat: Number(c[1]) };
        }
    }

    if (geometry.type === "LineString") {
        const coordinates = geometry.coordinates;
        if (Array.isArray(coordinates) && coordinates.length > 0) {
            const middle = coordinates[Math.floor(coordinates.length / 2)];
            return { lon: Number(middle[0]), lat: Number(middle[1]) };
        }
    }

    if (geometry.type === "MultiLineString") {
        const lines = geometry.coordinates;
        const allCoordinates = [];

        for (const line of lines || []) {
            for (const coordinate of line || []) {
                allCoordinates.push(coordinate);
            }
        }

        if (allCoordinates.length > 0) {
            const middle = allCoordinates[Math.floor(allCoordinates.length / 2)];
            return { lon: Number(middle[0]), lat: Number(middle[1]) };
        }
    }

    if (geometry.type === "Polygon") {
        const ring = geometry.coordinates?.[0];
        if (Array.isArray(ring) && ring.length > 0) {
            const middle = ring[Math.floor(ring.length / 2)];
            return { lon: Number(middle[0]), lat: Number(middle[1]) };
        }
    }

    if (geometry.type === "MultiPolygon") {
        const firstPolygon = geometry.coordinates?.[0];
        const ring = firstPolygon?.[0];
        if (Array.isArray(ring) && ring.length > 0) {
            const middle = ring[Math.floor(ring.length / 2)];
            return { lon: Number(middle[0]), lat: Number(middle[1]) };
        }
    }

    return null;
}

//============================================================
// GeoJSON Featureが
// 「熊本県」かつ「実際の通行規制あり」か判定
//============================================================

function isActualTrafficRegulationFeature(feature) {
    if (!feature) { return false; }

    const properties = feature.properties || {};

    //========================================================
    // ① 熊本県判定
    //========================================================

    const prefectureCandidates = [
        properties.都道府県,
        properties.都道府県名,
        properties.県名,
        properties.prefecture,
        properties.prefecture_name,
        properties.PREF_NAME,
        properties.PREFECTURE
    ];

    let isKumamoto = false;
    let prefectureFound = false;

    for (const value of prefectureCandidates) {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            prefectureFound = true;

            const text = String(value).trim();
            if (text.includes("熊本")) {
                isKumamoto = true;
            }

            break;
        }
    }

    if (prefectureFound && !isKumamoto) {
        return false;
    }

    //========================================================
    // ② 都道府県コード
    //========================================================

    const codeCandidates = [
        properties.都道府県コード,
        properties.prefecture_code,
        properties.PREF_CODE,
        properties.PREFECTURE_CODE
    ];

    for (const value of codeCandidates) {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            const code = String(value).trim();

            if (code !== "43" && code !== "43.0") {
                return false;
            }

            isKumamoto = true;
            break;
        }
    }

    //========================================================
    // 都道府県情報が無い場合は座標で判定
    //========================================================

    if (!isKumamoto) {
        const coordinate = getGeometryRepresentativeCoordinate(feature.geometry);

        if (!coordinate) { return false; }

        if (!isKumamotoCoordinate(coordinate.lon, coordinate.lat)) {
            return false;
        }
    }

    //========================================================
    // ③ 実際の交通規制が存在するか
    //========================================================

    const regulationStartContent = String(properties.規制開始_内容 ?? "").trim();
    const regulationContent = String(properties.規制内容 ?? "").trim();
    const regulationType = String(properties.規制種別 ?? "").trim();
    const regulationReason = String(properties.規制理由 ?? "").trim();

    const hasRegulationContent =
        regulationStartContent !== "" ||
        regulationContent !== "";

    const hasRegulationInfo =
        hasRegulationContent ||
        regulationType !== "" ||
        regulationReason !== "";

    if (!hasRegulationInfo) {
        return false;
    }

    //========================================================
    // 「解除」されたデータを除外
    //========================================================

    const combinedText = (
        regulationStartContent + " " + regulationContent + " " + regulationType
    );

    if (combinedText.includes("解除")) {
        return false;
    }

    return true;
}

//============================================================
// FeatureCollection統合
//============================================================

function mergeGeoJSON(geoJsonEntries) {
    const features = [];

    for (const entry of geoJsonEntries) {
        const geojson = entry.geojson;

        if (geojson.type === "FeatureCollection") {
            for (const feature of geojson.features || []) {
                if (!isActualTrafficRegulationFeature(feature)) {
                    continue;
                }

                features.push({
                    ...feature,
                    properties: {
                        ...(feature.properties || {}),
                        _puttan_source_file: entry.name
                    }
                });
            }
        }
        else if (geojson.type === "Feature") {
            if (!isActualTrafficRegulationFeature(geojson)) {
                continue;
            }

            features.push({
                ...geojson,
                properties: {
                    ...(geojson.properties || {}),
                    _puttan_source_file: entry.name
                }
            });
        }
    }

    return { type: "FeatureCollection", features: features };
}

//============================================================
// GeoJSON properties確認
//============================================================

function logGeoJSONProperties(geojson) {
    console.log("================================");
    console.log("国交省GeoJSON 熊本県抽出結果");
    console.log("Feature数:", geojson.features.length);

    const propertyNames = new Set();

    for (const feature of geojson.features) {
        const properties = feature.properties || {};
        Object.keys(properties).forEach(key => propertyNames.add(key));
    }

    console.log("properties項目:");
    console.log(Array.from(propertyNames));

    if (geojson.features.length > 0) {
        console.log("最初のFeature:");
        console.log(JSON.stringify(geojson.features[0], null, 2));
    }

    console.log("================================");
}

//============================================================
// GeoJSON → 既存trafficRegulations互換データ
//============================================================

function geoJSONToTrafficArray(geojson) {
    const result = [];

    for (let i = 0; i < geojson.features.length; i++) {
        const feature = geojson.features[i];

        if (!isActualTrafficRegulationFeature(feature)) {
            continue;
        }

        const geometry = feature.geometry;
        if (!geometry) { continue; }

        const coordinate = getGeometryRepresentativeCoordinate(geometry);
        if (!coordinate) { continue; }

        const properties = feature.properties || {};

        const route =
            properties.路線名 ||
            properties.路線 ||
            properties.道路名 ||
            properties.route_name ||
            properties.road_name ||
            properties.ROUTE_NAME ||
            "道路";

        const type =
            properties.規制開始_内容 ||
            properties.規制内容 ||
            properties.規制種別 ||
            "道路規制";

        const reason =
            properties.規制理由 ||
            properties.原因 ||
            properties.reason ||
            "";

        const section =
            properties.規制区間 ||
            properties.区間 ||
            "";

        const start =
            properties.規制開始_日時 ||
            properties.規制開始日時 ||
            properties.開始日時 ||
            "";

        const id =
            properties.id ||
            properties.ID ||
            properties.objectid ||
            properties.OBJECTID ||
            "mlit-" + i;

        result.push({
            id: String(id),
            lat: coordinate.lat,
            lon: coordinate.lon,
            route: String(route),
            type: String(type),
            reason: String(reason),
            section: String(section),
            start: String(start),
            source: "国土交通省",
            properties: properties
        });
    }

    return result;
}

//============================================================
// 国土交通省交通規制取得
//============================================================

async function fetchMlitTrafficRegulations() {
    console.log("国土交通省 道路規制情報取得開始");

    const zipUrl = await findMlitLatestGeoJsonZipUrl();

    const zipBuffer = await httpGetBuffer(zipUrl);

    console.log("国交省GIS ZIP取得:", zipBuffer.length, "bytes");

    const entries = extractZipEntries(zipBuffer);

    console.log("ZIP内ファイル数:", entries.length);

    const geoJsonEntries = findGeoJSONEntries(entries);

    console.log("GeoJSONファイル数:", geoJsonEntries.length);

    if (geoJsonEntries.length === 0) {
        throw new Error("ZIP内にGeoJSONが見つかりません");
    }

    const geojson = mergeGeoJSON(geoJsonEntries);

    logGeoJSONProperties(geojson);

    const regulations = geoJSONToTrafficArray(geojson);

    console.log("国交省 熊本県道路規制:", regulations.length, "件");

    return { geojson: geojson, regulations: regulations };
}

//============================================================
// ZIP解析
//============================================================

function extractZipEntries(buffer) {
    const entries = [];

    let eocdOffset = -1;

    const minimumEOCD = Math.max(0, buffer.length - 65557);

    for (let i = buffer.length - 22; i >= minimumEOCD; i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) {
            eocdOffset = i;
            break;
        }
    }

    if (eocdOffset < 0) {
        throw new Error("ZIP End of Central Directory が見つかりません");
    }

    const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
    const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

    let offset = centralDirectoryOffset;

    for (let i = 0; i < totalEntries; i++) {
        if (buffer.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error("ZIP Central Directory が不正です");
        }

        const compressionMethod = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);

        const fileNameBuffer = buffer.subarray(offset + 46, offset + 46 + fileNameLength);

        let fileName;
        try {
            fileName = new TextDecoder("utf-8").decode(fileNameBuffer);
        }
        catch {
            fileName = fileNameBuffer.toString("utf8");
        }

        offset += 46 + fileNameLength + extraLength + commentLength;

        if (fileName.endsWith("/")) {
            continue;
        }

        if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
            console.log("ZIP Local Header不正:", fileName);
            continue;
        }

        const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);

        const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;

        const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

        let data;
        try {
            if (compressionMethod === 0) {
                data = Buffer.from(compressedData);
            }
            else if (compressionMethod === 8) {
                data = zlib.inflateRawSync(compressedData);
            }
            else {
                console.log("未対応ZIP圧縮方式:", compressionMethod, fileName);
                continue;
            }
        }
        catch (err) {
            console.error("ZIP展開エラー:", fileName, err);
            continue;
        }

        entries.push({
            name: fileName,
            data: data,
            compressedSize: compressedSize,
            uncompressedSize: uncompressedSize
        });
    }

    console.log("ZIP展開ファイル数:", entries.length);

    return entries;
}

//============================================================
// 交通規制取得
//============================================================

async function fetchTrafficRegulations() {
    try {
        console.log("国土交通省交通規制取得開始");

        const result = await fetchMlitTrafficRegulations();

        if (!result || !Array.isArray(result.regulations)) {
            throw new Error("国土交通省交通規制データが不正です");
        }

        console.log("国土交通省 熊本県交通規制:", result.regulations.length, "件");

        return result.regulations;
    }
    catch (err) {
        console.error("国土交通省交通規制取得エラー:", err);

        console.log("既存の交通規制テストデータを使用します");

        return getTrafficTestData();
    }
}

//============================================================
// 交通規制更新
//============================================================

async function updateTrafficRegulations() {
    try {
        console.log("================================");
        console.log("交通規制情報 更新開始");

        const regulations = await fetchTrafficRegulations();

        if (!Array.isArray(regulations)) {
            console.error("交通規制データが配列ではありません");
            return;
        }

        trafficRegulations = regulations;

        console.log("熊本県交通規制:", trafficRegulations.length, "件");

        io.emit("trafficRegulations", trafficRegulations);

        console.log("交通規制を全端末へ配信しました");

        console.log("交通規制情報 更新終了");
        console.log("================================");
    }
    catch (err) {
        console.error("交通規制更新エラー:", err);
    }
}

//============================================================
// 地点復元
//============================================================

async function loadPoints() {
    try {
        const result = await pool.query("SELECT * FROM points ORDER BY created");

        result.rows.forEach(point => {
            points[point.name] = {
                name: point.name,
                type: point.type,
                lat: point.lat,
                lon: point.lon,
                created: point.created,
                createdBy: point.created_by
            };
        });

        console.log("地点復元:", Object.keys(points));
    }
    catch (err) {
        console.error("地点復元エラー", err);
    }
}

//============================================================
// クロノロジー復元
//============================================================

async function loadChronology() {
    try {
        const result = await pool.query(
            "SELECT * FROM chronology ORDER BY id DESC LIMIT $1",
            [CHRONOLOGY_LIVE_LIMIT]
        );

        chronology = result.rows.map(row => attachReactions({
            id: row.id,
            time: new Date(Number(row.created)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }),
            user: row.user_name || "",
            message: row.message || "",
            category: row.category || "その他",
            remarks: row.remarks || "",
            photoUrl: row.photo_url || ""
        }));

        console.log("クロノロジー復元:", chronology.length);
    }
    catch (err) {
        console.error("クロノロジー復元エラー", err);
    }
}

//============================================================
// ユーザー復元
//============================================================

async function loadUsers() {
    try {
        const result = await pool.query("SELECT * FROM users ORDER BY user_id");

        result.rows.forEach(user => {
            users[user.user_id] = {
                user_id: user.user_id,
                display_name: user.display_name,
                account_name: user.account_name,
                role: user.role || "user",
                unit: user.unit || "",
                rank: user.rank || "",
                vehicle: user.vehicle || "",
                vehicle_type: user.vehicle_type || "",
                icon: user.icon || "1",
                phone: user.phone || "",
                status: user.status || "",
                status_next: user.status_next || "",
                health: user.health || "",
                destination: user.destination || "",

                lat: null,
                lon: null,
                utmZone: "52S",
                utmE: null,
                utmN: null,

                movement: "",
                online: false,
                lastUpdate: null,

                water: 0,
                fuel: 0,
                item_a: "",
                item_b: "",
                item_c: "",
                item_d: "",

                experience: 0,
                level: 1,

                pushToken: user.push_token || null
            };
        });

        const currentResult = await pool.query("SELECT * FROM current_users");

        currentResult.rows.forEach(current => {
            const user = users[current.user_id];
            if (!user) { return; }

            user.lat = current.lat;
            user.lon = current.lon;
            user.utmZone = current.utmzone || "52S";
            user.utmE = current.utme;
            user.utmN = current.utmn;
            user.destination = current.destination || user.destination;
            user.icon = current.icontype || user.icon || "1";
            user.online = Boolean(current.online);
            user.lastUpdate = current.lastupdate;
        });

        const inventoryResult = await pool.query("SELECT * FROM user_inventory");

        inventoryResult.rows.forEach(inventory => {
            const user = users[inventory.user_id];
            if (!user) { return; }

            user.water = inventory.water || 0;
            user.fuel = inventory.fuel || 0;
            user.item_a = inventory.item_a || "";
            user.item_b = inventory.item_b || "";
            user.item_c = inventory.item_c || "";
            user.item_d = inventory.item_d || "";
        });

        const gameResult = await pool.query("SELECT * FROM user_game");

        gameResult.rows.forEach(game => {
            const user = users[game.user_id];
            if (!user) { return; }

            user.experience = Number(game.experience) || 0;
            user.level = levelFromExperience(user.experience);
        });

        console.log("復元ユーザー:", Object.keys(users));
    }
    catch (err) {
        console.error("DB復元エラー", err);
    }
}

//============================================================
// 距離計算（経験値用、サーバー側で算出しユーザーは操作不可）
//============================================================

function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GPSの誤差・瞬間移動的な異常値を経験値に反映しないための上限（1回のpingあたり）
const MAX_VALID_JUMP_METERS = 5000;

function levelFromExperience(experience) {
    return Math.floor((experience || 0) / 100) + 1;
}

function formatJstDateTime(ms) {
    return new Date(ms).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
}

//============================================================
// Socket.IO
//============================================================

const viewingSockets = new Set();

function broadcastConnectionCounts() {
    io.emit("connectionCounts", {
        connections: io.engine.clientsCount,
        viewers: viewingSockets.size
    });
}

//============================================================
// オフライン自動判定
// ・切断（socket disconnect）を検知したら自動でオフライン扱い
// ・一定時間（既定20分）位置情報の更新がなければ自動でオフライン扱い
//   （GPSロストなど、接続は生きているが更新が止まったケースを検知）
//
// Puttanモバイルアプリは静止中、ネイティブの位置情報エンジンが新しい
// 座標を記録しなくなる(heartbeatイベントは出るが同期対象にならない)ため、
// 動いていない隊員が実際には正常なのに誤ってオフライン表示されないよう、
// 猶予を長めに取っている
//============================================================

const OFFLINE_STALE_MS = 20 * 60 * 1000;

// Puttanモバイル(Capacitor)アプリは画面OFF中、Socket.IOを介さずネイティブHTTPで
// 位置情報を直接送信し続ける。そのため切断イベントがREST経由の更新と競合しても、
// 直近この猶予時間内に位置情報が届いていれば即オフライン化しない
// （本当に更新が止まった場合は5分後にmarkStaleUsersOffline()が拾う）
const DISCONNECT_OFFLINE_GRACE_MS = 90 * 1000;

// 位置履歴（location_history）の保持期間。DB容量を抑えるため、
// これより古いレコードは定期的に自動削除する
const LOCATION_HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// userId -> 現在その userId に紐づいている socket 数
// （同じアカウントで複数端末/タブが繋がっていても、全部切れるまではオフラインにしない）
const socketCountByUserId = {};

// userId -> 現在そのアカウントを使用中の端末のdevice_id
// 同一ログインIDでの多端末同時ログインを防ぐため、最初にログインした端末を記録する
// （同じ端末の再接続・複数タブは device_id が同じなので許可される）
const activeDeviceIdByUserId = {};

// 1:1音声通話（WebRTC）中/呼び出し中のuserId -> 相手userId。
// サーバーは発信・応答・ICE候補・終了の合図を中継するだけで、音声そのものは
// 中継しない。このマップは同時多重発信の防止と、片方が切断した際に
// 相手へ終了を通知するために使う
const callPeerByUserId = {};

function endCallPair(userId, reason) {
    const peerId = callPeerByUserId[userId];
    if (!peerId) { return; }

    delete callPeerByUserId[userId];
    delete callPeerByUserId[peerId];

    io.to("user:" + peerId).emit("callEnd", { fromUserId: userId, reason: reason || "hangup" });
}

function associateSocketWithUser(socket, userId) {
    if (!userId || socket.userId === userId) { return; }

    if (socket.userId) {
        decrementSocketCount(socket.userId);
        socket.leave("user:" + socket.userId);
    }

    socket.userId = userId;
    socketCountByUserId[userId] = (socketCountByUserId[userId] || 0) + 1;
    socket.join("user:" + userId);
}

function decrementSocketCount(userId) {
    if (!userId || !socketCountByUserId[userId]) { return; }

    socketCountByUserId[userId] -= 1;
    if (socketCountByUserId[userId] <= 0) {
        delete socketCountByUserId[userId];
    }
}

// 1人分の更新だけを全端末へ配信する。頻繁に発生する更新（GPS位置・
// オンライン状態など）はこちらを使い、"locations"（全員分の完全なスナップ
// ショット）は新規接続時の初期同期と隊員削除時のみに限定する。
// これにより、1人の更新のたびに登録人数分のデータを全員へ送っていた
// O(N^2)的な負荷集中を避ける
function broadcastUserUpdate(userId) {
    const user = users[userId];
    if (!user) { return; }

    io.emit("locationUpdate", { userId, user });
}

async function markUserOffline(userId) {
    const user = users[userId];
    if (!user || !user.online) { return; }

    user.online = false;
    delete activeDeviceIdByUserId[userId];

    try {
        await pool.query("UPDATE current_users SET online=$2 WHERE user_id=$1", [userId, 0]);
    }
    catch (err) {
        console.error("オフライン更新エラー:", userId, err);
    }

    broadcastUserUpdate(userId);
}

async function markStaleUsersOffline() {
    const now = Date.now();

    for (const userId of Object.keys(users)) {
        const user = users[userId];
        if (!user.online) { continue; }

        const lastUpdate = Number(user.lastUpdate);
        if (!Number.isFinite(lastUpdate)) { continue; }

        if (now - lastUpdate > OFFLINE_STALE_MS) {
            user.online = false;

            try {
                await pool.query("UPDATE current_users SET online=$2 WHERE user_id=$1", [userId, 0]);
            }
            catch (err) {
                console.error("自動オフライン更新エラー:", userId, err);
            }

            broadcastUserUpdate(userId);
        }
    }
}

//====================================================
// クロノロジー投稿のプッシュ通知
// ・投稿者本人を除く、プッシュトークン登録済みの全ユーザーへ送信
//====================================================

async function sendChronologyPushNotifications(item, excludeUserId) {
    if (!firebaseMessaging) { return; }

    const tokens = Object.values(users)
        .filter(user => user.user_id !== excludeUserId && typeof user.pushToken === "string" && user.pushToken)
        .map(user => user.pushToken);

    if (tokens.length === 0) { return; }

    try {
        const response = await firebaseMessaging.sendEachForMulticast({
            tokens: tokens,
            notification: {
                title: "【" + item.category + "】" + (item.user || "クロノロジー"),
                body: item.message.slice(0, 100)
            },
            android: {
                priority: "high",
                notification: {
                    channelId: "chronology"
                }
            },
            data: {
                type: "chronology",
                chronologyId: String(item.id || "")
            }
        });

        response.responses.forEach((res, index) => {
            if (!res.success) {
                console.error("プッシュ通知送信失敗:", tokens[index], res.error && res.error.message);
            }
        });
    }
    catch (err) {
        console.error("プッシュ通知送信エラー:", err);
    }
}

setInterval(markStaleUsersOffline, 60 * 1000);

//====================================================
// 位置履歴の自動削除（保持期間より古いレコードのみ）
//====================================================

async function pruneLocationHistory() {
    try {
        const cutoff = Date.now() - LOCATION_HISTORY_RETENTION_MS;
        const result = await pool.query("DELETE FROM location_history WHERE created < $1", [cutoff]);
        if (result.rowCount > 0) {
            console.log("位置履歴の自動削除:", result.rowCount, "件");
        }
    }
    catch (err) {
        console.error("位置履歴削除エラー:", err);
    }
}

setInterval(pruneLocationHistory, 6 * 60 * 60 * 1000);

//====================================================
// GPS位置情報更新（共通処理）
//====================================================
//
// ・user_idを基準にGPSを管理
// ・未登録ユーザーのGPSは拒否
// ・緯度 / 経度をチェック
// ・UTM座標対応
// ・current_usersへ現在位置を保存
// ・location_historyへ位置履歴を保存
// ・全接続端末へリアルタイム配信
// ・Socket.IO("location")とREST(/api/mobile-location、モバイルアプリの
//   バックグラウンドHTTP自動送信用)の両方から呼ばれる共通ロジック
//
//====================================================

async function processLocationUpdate(data, socket) {
    try {
        //================================================
        // ① GPSデータ存在確認
        //================================================

        if (!data || typeof data !== "object") {
            console.log("GPS受信拒否: データなし");
            return;
        }

        //================================================
        // ② user_id取得
        //================================================

        const userId = String(data.user_id || data.name || "").trim();

        if (!userId) {
            console.log("GPS受信拒否: user_idなし");
            return;
        }

        //================================================
        // ③ 登録ユーザー確認
        //================================================

        const oldUser = users[userId];

        if (!oldUser) {
            console.log("未登録GPS拒否:", userId);
            return;
        }

        if (socket) {
            associateSocketWithUser(socket, userId);
        }

        //================================================
        // ④ 現在時刻
        //================================================

        const now = Date.now();

        //================================================
        // ⑤ 表示名
        //================================================

        const displayName = String(
            oldUser.display_name || data.display_name || data.name || userId
        ).trim();

        //================================================
        // ⑥ 緯度・経度
        //================================================

        const lat = Number(data.lat);
        const lon = Number(data.lon);

        //================================================
        // ⑦ GPS座標チェック
        //================================================

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            console.log("GPS受信拒否: 座標不正", { user_id: userId, lat: data.lat, lon: data.lon });
            return;
        }

        if (lat < -90 || lat > 90) {
            console.log("GPS受信拒否: 緯度範囲外", lat);
            return;
        }

        if (lon < -180 || lon > 180) {
            console.log("GPS受信拒否: 経度範囲外", lon);
            return;
        }

        //================================================
        // ⑧ UTM
        //================================================

        const utmZone = String(data.utmZone || oldUser.utmZone || "52S");

        const utmEValue = Number(data.utmE);
        const utmNValue = Number(data.utmN);

        const utmE = Number.isFinite(utmEValue) ? utmEValue : (oldUser.utmE ?? null);
        const utmN = Number.isFinite(utmNValue) ? utmNValue : (oldUser.utmN ?? null);

        //================================================
        // ⑧.2 進行方向・速度（GPS単位: m/s, 度。取得できない場合はnull＝停止中扱い）
        //================================================

        const speedValue = Number(data.speed);
        const speed = Number.isFinite(speedValue) && speedValue >= 0 ? speedValue : null;

        const headingValue = Number(data.heading);
        const heading = Number.isFinite(headingValue) && headingValue >= 0 ? headingValue : null;

        //================================================
        // ⑧.3 バッテリー残量（対応端末のみ。取得できない場合はnull）
        //================================================

        const batteryValue = Number(data.battery);
        const battery = Number.isFinite(batteryValue) && batteryValue >= 0 && batteryValue <= 100 ? batteryValue : null;
        const batteryCharging = Boolean(data.batteryCharging);

        //================================================
        // ⑧.5 経験値・LV（1km移動＝経験値1、サーバー側でのみ計算・ユーザー操作不可）
        //================================================

        let movedMeters = 0;
        if (Number.isFinite(oldUser.lat) && Number.isFinite(oldUser.lon)) {
            movedMeters = getDistanceMeters(oldUser.lat, oldUser.lon, lat, lon);
        }
        if (movedMeters > MAX_VALID_JUMP_METERS) {
            movedMeters = 0;
        }

        const experience = (Number(oldUser.experience) || 0) + (movedMeters / 1000);
        const level = levelFromExperience(experience);

        //================================================
        // ⑨ 物資情報（user_inventoryが正、GPS送信では変更しない）
        //================================================

        const water = Number(oldUser.water) || 0;
        const fuel = Number(oldUser.fuel) || 0;

        //================================================
        // ⑩ 行動・目的地
        //================================================

        const movement = data.movement ?? oldUser.movement ?? "";
        const destination = data.destination ?? oldUser.destination ?? "";

        //================================================
        // ⑪ アイコン
        //================================================
        // GPS送信のたびにdata側の値で上書きすると、同一アカウントを
        // 複数端末（Web版・アプリ版など）で同時に開いていた場合、片方が
        // 保持している古いアイコン値がもう片方の変更を上書きしてしまう。
        // アイコンはregisterUser（報告フォームの明示的な送信）でのみ
        // 変更されるべきなので、GPS送信では常に現在の保存値を維持する
        //================================================

        const iconType = String(oldUser.icon || "1");

        //================================================
        // ⑫ メモリ上のユーザー情報更新
        //================================================

        users[userId] = {
            ...oldUser,
            user_id: userId,
            name: displayName,
            display_name: displayName,
            lat: lat,
            lon: lon,
            utmZone: utmZone,
            utmE: utmE,
            utmN: utmN,
            speed: speed,
            heading: heading,
            battery: battery,
            batteryCharging: batteryCharging,
            movement: movement,
            destination: destination,
            water: water,
            fuel: fuel,
            icon: iconType,
            iconType: iconType,
            online: true,
            loggedOut: false,
            lastUpdate: now,
            experience: experience,
            level: level
        };

        //================================================
        // ⑬ usersテーブル更新
        //================================================

        await pool.query(
            `
            UPDATE users
            SET
                destination = $2,
                icon = $3,
                updated_at = $4
            WHERE user_id = $1
            `,
            [userId, destination, iconType, now]
        );

        // 経験値・LVはuser_gameテーブルで管理する（usersテーブルには列が無い）
        await pool.query(
            `
            INSERT INTO user_game (user_id, experience, level, updated_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT(user_id)
            DO UPDATE SET
                experience = EXCLUDED.experience,
                level = EXCLUDED.level,
                updated_at = EXCLUDED.updated_at
            `,
            [userId, Math.round(experience), level, now]
        );

        //================================================
        // ⑭ current_users更新
        //================================================

        const currentResult = await pool.query(
            `
            UPDATE current_users
            SET
                name = $2,
                lat = $3,
                lon = $4,
                utmzone = $5,
                utme = $6,
                utmn = $7,
                water = $8,
                fuel = $9,
                destination = $10,
                icontype = $11,
                online = $12,
                lastupdate = $13,
                device_id = $14
            WHERE user_id = $1
            `,
            [
                userId,
                displayName,
                lat,
                lon,
                utmZone,
                utmE,
                utmN,
                water,
                fuel,
                destination,
                iconType,
                1,
                now,
                data.device_id || userId
            ]
        );

        //================================================
        // ⑮ current_usersに存在しない場合
        //================================================

        if (currentResult.rowCount === 0) {
            await pool.query(
                `
                INSERT INTO current_users
                (
                    user_id, name, lat, lon, utmzone, utme, utmn,
                    water, fuel, destination, icontype, online, lastupdate, device_id
                )
                VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                ON CONFLICT(user_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    lat = EXCLUDED.lat,
                    lon = EXCLUDED.lon,
                    utmzone = EXCLUDED.utmzone,
                    utme = EXCLUDED.utme,
                    utmn = EXCLUDED.utmn,
                    water = EXCLUDED.water,
                    fuel = EXCLUDED.fuel,
                    destination = EXCLUDED.destination,
                    icontype = EXCLUDED.icontype,
                    online = EXCLUDED.online,
                    lastupdate = EXCLUDED.lastupdate,
                    device_id = EXCLUDED.device_id
                `,
                [
                    userId,
                    displayName,
                    lat,
                    lon,
                    utmZone,
                    utmE,
                    utmN,
                    water,
                    fuel,
                    destination,
                    iconType,
                    1,
                    now,
                    data.device_id || userId
                ]
            );
        }

        //================================================
        // ⑯ GPS位置履歴保存
        //================================================

        await pool.query(
            `
            INSERT INTO location_history
            (name, lat, lon, water, fuel, destination, created, user_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            `,
            [displayName, lat, lon, water, fuel, destination, now, userId]
        );

        //================================================
        // ⑰ 全端末へ最新位置を配信
        //================================================

        broadcastUserUpdate(userId);

        //================================================
        // ⑱ サーバーログ
        //================================================

        console.log("GPS更新:", userId, displayName, lat, lon);
    }
    catch (err) {
        console.error("GPS位置情報保存エラー:", err);
    }
}

//====================================================
// モバイルアプリ(Capacitor)のバックグラウンド位置情報用REST受信口
//====================================================
//
// @transistorsoft/capacitor-background-geolocation はスマホの画面OFF中、
// WebView(JS)が休止しSocket.IO送信が止まってしまうため、ネイティブ側の
// HTTP自動送信機能(http.url/autoSync)経由でここに直接POSTさせる。
// リクエスト形式は rootProperty:"location" 設定に対応:
// { location: { coords: { latitude, longitude }, extras: { user_id, display_name, device_id }, ... } }
//
//====================================================

app.post("/api/mobile-location", async (req, res) => {
    try {
        const location = req.body && req.body.location;
        const coords = location && location.coords;
        const extras = (location && location.extras) || {};

        if (!coords) {
            return res.sendStatus(400);
        }

        await processLocationUpdate(
            {
                user_id: extras.user_id,
                display_name: extras.display_name,
                device_id: extras.device_id,
                lat: coords.latitude,
                lon: coords.longitude
            },
            null
        );

        res.sendStatus(200);
    }
    catch (err) {
        console.error("モバイル位置情報受信エラー:", err);
        res.sendStatus(500);
    }
});

io.on("connection", socket => {
    console.log("接続:", socket.id);

    broadcastConnectionCounts();

    //====================================================
    // 初期データ
    //====================================================

    socket.emit("locations", users);
    socket.emit("points", points);
    socket.emit("chronology", chronology);
    socket.emit("trafficRegulations", trafficRegulations);
    socket.emit("announcement", announcementText);

    //====================================================
    // 地点登録
    //====================================================

    socket.on("addPoint", async point => {
        try {
            console.log("地点受信:", point);

            const created = Date.now();
            const createdBy = String(point.createdBy || "").trim() || "不明";

            await pool.query(
                `
                INSERT INTO points
                (name, type, lat, lon, created, created_by)
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT(name)
                DO UPDATE SET
                    type=$2,
                    lat=$3,
                    lon=$4,
                    created=$5,
                    created_by=$6
                `,
                [
                    point.name,
                    point.type || "point",
                    point.lat,
                    point.lon,
                    created,
                    createdBy
                ]
            );

            points[point.name] = {
                name: point.name,
                type: point.type || "point",
                lat: point.lat,
                lon: point.lon,
                created: created,
                createdBy: createdBy
            };

            io.emit("pointAdded", points[point.name]);

            console.log("地点登録:", point.name);
        }
        catch (err) {
            console.error("地点保存エラー", err);
        }
    });

    //====================================================
    // ユーザー登録
    //====================================================

    socket.on("registerUser", async data => {
        try {
            console.log("================================");
            console.log("ユーザー登録要求:", data);

            //================================================
            // データ確認
            //================================================

            if (!data || typeof data !== "object") {
                console.log("ユーザー登録拒否: dataなし");

                socket.emit("registerUserResult", {
                    success: false,
                    message: "登録データがありません"
                });

                return;
            }

            //================================================
            // user_id
            //================================================

            const userId = String(data.user_id || "").trim();

            if (userId === "") {
                console.log("ユーザー登録拒否: user_idなし");

                socket.emit("registerUserResult", {
                    success: false,
                    message: "ユーザーIDを入力してください"
                });

                return;
            }

            //================================================
            // 多端末同時ログイン拒否（先にログインした端末を優先）
            //================================================

            const deviceId = String(data.device_id || "").trim();
            const alreadyActiveDeviceId = activeDeviceIdByUserId[userId];
            const isDifferentDevice = alreadyActiveDeviceId
                && deviceId
                && alreadyActiveDeviceId !== deviceId;

            if (isDifferentDevice && (socketCountByUserId[userId] || 0) > 0) {
                console.log("ユーザー登録拒否: 別端末でログイン中", userId);

                socket.emit("registerUserResult", {
                    success: false,
                    message: "このアカウントは既に別の端末でログイン中です"
                });

                return;
            }

            if (deviceId) {
                activeDeviceIdByUserId[userId] = deviceId;
            }

            associateSocketWithUser(socket, userId);

            //================================================
            // 表示名
            //================================================

            const displayName = String(data.display_name || "").trim();

            if (displayName === "") {
                console.log("ユーザー登録拒否: display_nameなし");

                socket.emit("registerUserResult", {
                    success: false,
                    message: "表示名を入力してください"
                });

                return;
            }

            //================================================
            // account_name
            //================================================

            const accountName = String(data.account_name || "").trim();

            if (accountName === "") {
                console.log("ユーザー登録拒否: account_nameなし");

                socket.emit("registerUserResult", {
                    success: false,
                    message: "アカウント名を入力してください"
                });

                return;
            }

            //================================================
            // 現在時刻
            //================================================

            const now = Date.now();

            //================================================
            // 既存ユーザー確認
            //================================================

            const oldUser = users[userId];

            //================================================
            // account_name重複確認
            //================================================

            const existingAccount = Object.values(users).find(
                user => user.account_name === accountName && user.user_id !== userId
            );

            if (existingAccount) {
                console.log("ユーザー登録拒否: account_name重複", accountName);

                socket.emit("registerUserResult", {
                    success: false,
                    message: "このアカウント名は既に使用されています"
                });

                return;
            }

            //================================================
            // ユーザーオブジェクト作成
            //================================================

            const user = {
                user_id: userId,
                display_name: displayName,
                account_name: accountName,
                role: String(data.role || oldUser?.role || "user"),
                unit: String(data.unit || oldUser?.unit || ""),
                rank: String(data.rank || oldUser?.rank || ""),
                vehicle: String(data.vehicle || oldUser?.vehicle || ""),
                vehicle_type: String(data.vehicle_type || oldUser?.vehicle_type || ""),
                icon: String(data.icon || oldUser?.icon || "1"),
                phone: String(data.phone || oldUser?.phone || ""),
                status: String(data.status || oldUser?.status || ""),
                status_next: String(data.status_next || oldUser?.status_next || ""),
                health: String(data.health || oldUser?.health || ""),
                destination: String(data.destination || oldUser?.destination || ""),

                lat: oldUser?.lat ?? null,
                lon: oldUser?.lon ?? null,
                utmZone: oldUser?.utmZone || "52S",
                utmE: oldUser?.utmE ?? null,
                utmN: oldUser?.utmN ?? null,

                movement: data.movement || oldUser?.movement || "",
                online: true,
                loggedOut: false,
                lastUpdate: now,

                water: Number(data.water) || 0,
                fuel: Number(data.fuel) || 0,
                item_a: String(data.item_a || ""),
                item_b: String(data.item_b || ""),
                item_c: String(data.item_c || ""),
                item_d: String(data.item_d || ""),

                // 経験値・LVはサーバーが移動距離から算出する値。ここでは維持のみ行う
                experience: oldUser?.experience || 0,
                level: levelFromExperience(oldUser?.experience || 0),

                // プッシュ通知トークンはregisterPushTokenで別途登録されるため、
                // 再接続時のユーザー再構築で消さないよう引き継ぐ
                pushToken: oldUser?.pushToken || null
            };

            //================================================
            // DB users テーブル保存
            //================================================

            await pool.query(
                `
                INSERT INTO users
                (
                    user_id, display_name, account_name, role, unit, rank,
                    vehicle, vehicle_type, icon, phone, status, status_next,
                    health, destination, created_at, updated_at
                )
                VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                ON CONFLICT(user_id)
                DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    account_name = EXCLUDED.account_name,
                    role = EXCLUDED.role,
                    unit = EXCLUDED.unit,
                    rank = EXCLUDED.rank,
                    vehicle = EXCLUDED.vehicle,
                    vehicle_type = EXCLUDED.vehicle_type,
                    icon = EXCLUDED.icon,
                    phone = EXCLUDED.phone,
                    status = EXCLUDED.status,
                    status_next = EXCLUDED.status_next,
                    health = EXCLUDED.health,
                    destination = EXCLUDED.destination,
                    updated_at = EXCLUDED.updated_at
                `,
                [
                    user.user_id,
                    user.display_name,
                    user.account_name,
                    user.role,
                    user.unit,
                    user.rank,
                    user.vehicle,
                    user.vehicle_type,
                    user.icon,
                    user.phone,
                    user.status,
                    user.status_next,
                    user.health,
                    user.destination,
                    oldUser?.created_at ?? now,
                    now
                ]
            );

            //================================================
            // メモリへ保存
            //================================================

            users[userId] = {
                ...user,
                created_at: oldUser?.created_at ?? now,
                updated_at: now
            };

            //================================================
            // current_users
            //================================================

            await pool.query(
                `
                INSERT INTO current_users
                (
                    user_id, name, lat, lon, utmzone, utme, utmn,
                    water, fuel, destination, icontype, online, lastupdate, device_id
                )
                VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                ON CONFLICT(user_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    destination = EXCLUDED.destination,
                    icontype = EXCLUDED.icontype,
                    online = EXCLUDED.online,
                    lastupdate = EXCLUDED.lastupdate,
                    device_id = EXCLUDED.device_id
                `,
                [
                    user.user_id,
                    user.display_name,
                    user.lat,
                    user.lon,
                    user.utmZone,
                    user.utmE,
                    user.utmN,
                    user.water,
                    user.fuel,
                    user.destination,
                    user.icon,
                    1,
                    now,
                    user.user_id
                ]
            );

            //================================================
            // user_inventory（水・燃料・物資1〜4）
            //================================================

            await pool.query(
                `
                INSERT INTO user_inventory
                (user_id, water, fuel, item_a, item_b, item_c, item_d, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                ON CONFLICT(user_id)
                DO UPDATE SET
                    water = EXCLUDED.water,
                    fuel = EXCLUDED.fuel,
                    item_a = EXCLUDED.item_a,
                    item_b = EXCLUDED.item_b,
                    item_c = EXCLUDED.item_c,
                    item_d = EXCLUDED.item_d,
                    updated_at = EXCLUDED.updated_at
                `,
                [
                    user.user_id,
                    user.water,
                    user.fuel,
                    user.item_a,
                    user.item_b,
                    user.item_c,
                    user.item_d,
                    now
                ]
            );

            //================================================
            // 成功ログ
            //================================================

            console.log("================================");
            console.log("ユーザー登録成功");
            console.log("user_id:", user.user_id);
            console.log("display_name:", user.display_name);
            console.log("account_name:", user.account_name);
            console.log("================================");

            //================================================
            // 全端末へ配信
            //================================================

            broadcastUserUpdate(userId);

            //================================================
            // 登録元へ成功通知
            //================================================

            socket.emit("registerUserResult", {
                success: true,
                user_id: user.user_id,
                display_name: user.display_name,
                account_name: user.account_name
            });
        }
        catch (err) {
            console.error("================================");
            console.error("ユーザー登録エラー");
            console.error(err);
            console.error("================================");

            socket.emit("registerUserResult", {
                success: false,
                message: err.message || "ユーザー登録に失敗しました"
            });
        }
    });

    //====================================================
    // GPS位置情報
    //====================================================
    //
    // ・user_idを基準にGPSを管理
    // ・未登録ユーザーのGPSは拒否
    // ・緯度 / 経度をチェック
    // ・UTM座標対応
    // ・current_usersへ現在位置を保存
    // ・location_historyへ位置履歴を保存
    // ・全接続端末へリアルタイム配信
    //
    //====================================================

    socket.on("location", async data => {
        await processLocationUpdate(data, socket);
    });

    //====================================================
    // 位置履歴（指定ユーザー・指定日＝JSTの1日分の移動経路）
    //====================================================

    socket.on("getLocationHistory", async (params, callback) => {
        const userId = String((params && params.userId) || "").trim();
        const dateStr = String((params && params.date) || "").trim();

        if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            if (typeof callback === "function") { callback({ success: false, message: "パラメータが不正です" }); }
            return;
        }

        const startMs = new Date(`${dateStr}T00:00:00+09:00`).getTime();

        if (!Number.isFinite(startMs)) {
            if (typeof callback === "function") { callback({ success: false, message: "日付が不正です" }); }
            return;
        }

        const endMs = startMs + 24 * 60 * 60 * 1000;

        try {
            const result = await pool.query(
                "SELECT lat, lon, created FROM location_history WHERE user_id=$1 AND created >= $2 AND created < $3 ORDER BY created ASC",
                [userId, startMs, endMs]
            );

            const points = result.rows
                .map(row => ({ lat: Number(row.lat), lon: Number(row.lon), t: Number(row.created) }))
                .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

            if (typeof callback === "function") { callback({ success: true, points: points }); }
        }
        catch (err) {
            console.error("位置履歴取得エラー:", err);
            if (typeof callback === "function") { callback({ success: false, message: err.message }); }
        }
    });

    //====================================================
    // クロノロジー
    //====================================================

    socket.on("addChronology", async data => {
        if (!data || !String(data.message || "").trim()) {
            return;
        }

        const now = Date.now();

        const item = {
            id: null,
            time: new Date(now).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }),
            user: String(data.user || "").trim(),
            message: String(data.message || "").trim(),
            category: String(data.category || "その他").trim(),
            remarks: String(data.remarks || "").trim(),
            photoUrl: String(data.photoUrl || "").trim(),
            reactions: {}
        };

        try {
            const result = await pool.query(
                `
                INSERT INTO chronology (user_name, message, category, remarks, photo_url, created)
                VALUES ($1,$2,$3,$4,$5,$6)
                RETURNING id
                `,
                [item.user, item.message, item.category, item.remarks, item.photoUrl || null, now]
            );
            item.id = result.rows[0].id;

            // attachReactions()と同じ理由: chronologyReactionsマップ側の
            // オブジェクトをそのままitem.reactionsに参照させることで、
            // 直後にtoggleReactionが同じオブジェクトを書き換えても
            // キャッシュ済みchronology配列側に反映されるようにする
            if (!chronologyReactions[item.id]) { chronologyReactions[item.id] = {}; }
            item.reactions = chronologyReactions[item.id];
        }
        catch (err) {
            console.error("クロノロジー保存エラー", err);
        }

        chronology.unshift(item);

        if (chronology.length > CHRONOLOGY_LIVE_LIMIT) {
            chronology.pop();
        }

        io.emit("chronology", chronology);

        //================================================
        // 全体周知へ自動反映
        //================================================

        announcementText = (
            "【" + item.category + "】" +
            (item.user ? item.user + "：" : "") +
            item.message
        ).slice(0, 300);

        io.emit("announcement", announcementText);

        await sendChronologyPushNotifications(item, socket.userId);
    });

    //====================================================
    // クロノロジー削除
    //====================================================

    socket.on("deleteChronology", async chronologyId => {
        const id = Number(chronologyId);
        if (!Number.isFinite(id)) { return; }

        try {
            await pool.query("DELETE FROM chronology_reactions WHERE chronology_id=$1", [id]);
            await pool.query("DELETE FROM chronology WHERE id=$1", [id]);
        }
        catch (err) {
            console.error("クロノロジー削除エラー:", err);
            return;
        }

        chronology = chronology.filter(item => item.id !== id);
        delete chronologyReactions[id];

        io.emit("chronologyDeleted", id);
    });

    //====================================================
    // シフト引き継ぎメモ（スレッド掲示板、クロノロジーとは
    // 別テーブル handover_threads / handover_replies）
    //====================================================

    socket.on("getHandoverThreads", async (params, callback) => {
        try {
            const result = await pool.query(
                "SELECT id, title, created_by, last_activity, reply_count FROM handover_threads ORDER BY last_activity DESC LIMIT 200"
            );

            const threads = result.rows.map(row => ({
                id: row.id,
                title: row.title,
                createdBy: row.created_by,
                replyCount: row.reply_count,
                lastActivityText: formatJstDateTime(Number(row.last_activity))
            }));

            if (typeof callback === "function") { callback({ success: true, threads: threads }); }
        }
        catch (err) {
            console.error("引き継ぎスレッド一覧取得エラー:", err);
            if (typeof callback === "function") { callback({ success: false, message: err.message }); }
        }
    });

    socket.on("createHandoverThread", async (data, callback) => {
        const title = String((data && data.title) || "").trim().slice(0, 200);
        const body = String((data && data.body) || "").trim();
        const createdBy = String((data && data.user) || "").trim() || "不明";

        if (!title || !body) {
            if (typeof callback === "function") { callback({ success: false, message: "題名と内容を入力してください" }); }
            return;
        }

        const now = Date.now();

        try {
            const result = await pool.query(
                `
                INSERT INTO handover_threads (title, body, created_by, created, last_activity, reply_count)
                VALUES ($1,$2,$3,$4,$4,0)
                RETURNING id
                `,
                [title, body, createdBy, now]
            );

            const thread = {
                id: result.rows[0].id,
                title: title,
                createdBy: createdBy,
                replyCount: 0,
                lastActivityText: formatJstDateTime(now)
            };

            io.emit("handoverThreadAdded", thread);

            if (typeof callback === "function") { callback({ success: true, threadId: thread.id }); }
        }
        catch (err) {
            console.error("引き継ぎスレッド作成エラー:", err);
            if (typeof callback === "function") { callback({ success: false, message: err.message }); }
        }
    });

    socket.on("getHandoverReplies", async (params, callback) => {
        const threadId = Number(params && params.threadId);

        if (!Number.isFinite(threadId)) {
            if (typeof callback === "function") { callback({ success: false, message: "不正なスレッドIDです" }); }
            return;
        }

        try {
            const threadResult = await pool.query(
                "SELECT id, title, body, created_by, created FROM handover_threads WHERE id=$1",
                [threadId]
            );

            if (threadResult.rows.length === 0) {
                if (typeof callback === "function") { callback({ success: false, message: "スレッドが見つかりません" }); }
                return;
            }

            const row = threadResult.rows[0];
            const thread = {
                id: row.id,
                title: row.title,
                body: row.body,
                createdBy: row.created_by,
                createdText: formatJstDateTime(Number(row.created))
            };

            const repliesResult = await pool.query(
                "SELECT id, message, created_by, created FROM handover_replies WHERE thread_id=$1 ORDER BY created ASC",
                [threadId]
            );

            const replies = repliesResult.rows.map(r => ({
                id: r.id,
                message: r.message,
                createdBy: r.created_by,
                createdText: formatJstDateTime(Number(r.created))
            }));

            if (typeof callback === "function") { callback({ success: true, thread: thread, replies: replies }); }
        }
        catch (err) {
            console.error("引き継ぎスレッド取得エラー:", err);
            if (typeof callback === "function") { callback({ success: false, message: err.message }); }
        }
    });

    socket.on("addHandoverReply", async (data, callback) => {
        const threadId = Number(data && data.threadId);
        const message = String((data && data.message) || "").trim();
        const createdBy = String((data && data.user) || "").trim() || "不明";

        if (!Number.isFinite(threadId) || !message) {
            if (typeof callback === "function") { callback({ success: false, message: "パラメータが不正です" }); }
            return;
        }

        const now = Date.now();

        try {
            const insertResult = await pool.query(
                `
                INSERT INTO handover_replies (thread_id, message, created_by, created)
                VALUES ($1,$2,$3,$4)
                RETURNING id
                `,
                [threadId, message, createdBy, now]
            );

            const updateResult = await pool.query(
                `
                UPDATE handover_threads
                SET last_activity = $2, reply_count = reply_count + 1
                WHERE id = $1
                RETURNING reply_count
                `,
                [threadId, now]
            );

            if (updateResult.rows.length === 0) {
                if (typeof callback === "function") { callback({ success: false, message: "スレッドが見つかりません" }); }
                return;
            }

            const reply = {
                id: insertResult.rows[0].id,
                message: message,
                createdBy: createdBy,
                createdText: formatJstDateTime(now)
            };

            io.emit("handoverReplyAdded", {
                threadId: threadId,
                reply: reply,
                replyCount: updateResult.rows[0].reply_count,
                lastActivityText: formatJstDateTime(now)
            });

            if (typeof callback === "function") { callback({ success: true }); }
        }
        catch (err) {
            console.error("引き継ぎ返信エラー:", err);
            if (typeof callback === "function") { callback({ success: false, message: err.message }); }
        }
    });

    //====================================================
    // クロノロジー 過去ログ（もっと見る）
    //====================================================

    socket.on("loadMoreChronology", async (params, callback) => {
        const beforeId = params && Number.isFinite(Number(params.beforeId))
            ? Number(params.beforeId)
            : null;

        try {
            const result = beforeId
                ? await pool.query(
                    "SELECT * FROM chronology WHERE id < $1 ORDER BY id DESC LIMIT $2",
                    [beforeId, CHRONOLOGY_PAGE_SIZE]
                  )
                : await pool.query(
                    "SELECT * FROM chronology ORDER BY id DESC LIMIT $1",
                    [CHRONOLOGY_PAGE_SIZE]
                  );

            const items = result.rows.map(row => attachReactions({
                id: row.id,
                time: new Date(Number(row.created)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }),
                user: row.user_name || "",
                message: row.message || "",
                category: row.category || "その他",
                remarks: row.remarks || "",
                photoUrl: row.photo_url || ""
            }));

            if (typeof callback === "function") {
                callback({ success: true, items: items });
            }
        }
        catch (err) {
            console.error("過去ログ取得エラー", err);
            if (typeof callback === "function") {
                callback({ success: false, message: err.message });
            }
        }
    });

    //====================================================
    // クロノロジー リアクション（ワンタッチ絵文字レスポンス）
    //====================================================

    socket.on("toggleReaction", async data => {
        const chronologyId = data && Number.isFinite(Number(data.chronologyId)) ? Number(data.chronologyId) : null;
        const emoji = data && String(data.emoji || "");
        const userId = data && String(data.userId || "").trim();

        if (!chronologyId || !userId || !REACTION_EMOJIS.includes(emoji)) {
            return;
        }

        if (!chronologyReactions[chronologyId]) { chronologyReactions[chronologyId] = {}; }
        if (!chronologyReactions[chronologyId][emoji]) { chronologyReactions[chronologyId][emoji] = []; }

        const list = chronologyReactions[chronologyId][emoji];
        const index = list.indexOf(userId);

        try {
            if (index >= 0) {
                list.splice(index, 1);

                await pool.query(
                    "DELETE FROM chronology_reactions WHERE chronology_id=$1 AND user_id=$2 AND emoji=$3",
                    [chronologyId, userId, emoji]
                );
            }
            else {
                list.push(userId);

                await pool.query(
                    `
                    INSERT INTO chronology_reactions (chronology_id, user_id, emoji, created)
                    VALUES ($1,$2,$3,$4)
                    ON CONFLICT (chronology_id, user_id, emoji) DO NOTHING
                    `,
                    [chronologyId, userId, emoji, Date.now()]
                );
            }
        }
        catch (err) {
            console.error("リアクション更新エラー", err);
        }

        io.emit("chronologyReactionUpdate", {
            chronologyId: chronologyId,
            reactions: chronologyReactions[chronologyId]
        });
    });

    //====================================================
    // 1:1音声通話（WebRTCシグナリング中継）
    // ・音声はP2Pで直接端末間に流れるため、ここでは
    //   宛先ユーザーへ合図を転送するだけ
    //====================================================

    socket.on("callInvite", data => {
        const toUserId = String((data && data.toUserId) || "").trim();
        const fromUserId = socket.userId;

        if (!fromUserId || !toUserId || toUserId === fromUserId || !users[toUserId]) { return; }

        if (callPeerByUserId[fromUserId] || callPeerByUserId[toUserId]) {
            socket.emit("callBusy", { fromUserId: toUserId });
            return;
        }

        if (!socketCountByUserId[toUserId]) {
            socket.emit("callFailed", { toUserId: toUserId, message: "相手はオフラインです" });
            return;
        }

        callPeerByUserId[fromUserId] = toUserId;
        callPeerByUserId[toUserId] = fromUserId;

        io.to("user:" + toUserId).emit("callInvite", {
            fromUserId: fromUserId,
            fromName: String((data && data.fromName) || fromUserId),
            sdp: data && data.sdp
        });
    });

    socket.on("callAnswer", data => {
        const toUserId = String((data && data.toUserId) || "").trim();
        if (!socket.userId || !toUserId || callPeerByUserId[socket.userId] !== toUserId) { return; }

        io.to("user:" + toUserId).emit("callAnswer", {
            fromUserId: socket.userId,
            sdp: data && data.sdp
        });
    });

    socket.on("callIceCandidate", data => {
        const toUserId = String((data && data.toUserId) || "").trim();
        if (!socket.userId || !toUserId || callPeerByUserId[socket.userId] !== toUserId) { return; }

        io.to("user:" + toUserId).emit("callIceCandidate", {
            fromUserId: socket.userId,
            candidate: data && data.candidate
        });
    });

    socket.on("callBusy", data => {
        const toUserId = String((data && data.toUserId) || "").trim();
        if (!socket.userId || !toUserId) { return; }

        delete callPeerByUserId[socket.userId];
        delete callPeerByUserId[toUserId];

        io.to("user:" + toUserId).emit("callBusy", { fromUserId: socket.userId });
    });

    socket.on("callReject", data => {
        const toUserId = String((data && data.toUserId) || "").trim();
        if (!socket.userId || !toUserId) { return; }

        delete callPeerByUserId[socket.userId];
        delete callPeerByUserId[toUserId];

        io.to("user:" + toUserId).emit("callReject", { fromUserId: socket.userId });
    });

    socket.on("callEnd", () => {
        if (!socket.userId) { return; }
        endCallPair(socket.userId, "hangup");
    });

    //====================================================
    // ユーザー削除
    //====================================================
    //
    // Version 2.3.1（修正）
    // ★ クライアントはuser_idを渡すため、
    //   current_users / users とも user_id 列で検索・削除する
    // ★ users テーブル本体も削除しないと
    //   サーバー再起動時に loadUsers() で復活してしまう
    //
    //====================================================

    socket.on("deleteUser", async userId => {
        delete users[userId];

        try {
            const currentResult = await pool.query("DELETE FROM current_users WHERE user_id=$1", [userId]);
            const usersResult = await pool.query("DELETE FROM users WHERE user_id=$1", [userId]);

            console.log(
                "ユーザー削除:", userId,
                "current_users:", currentResult.rowCount, "件",
                "users:", usersResult.rowCount, "件"
            );
        }
        catch (err) {
            console.error("削除エラー:", userId, err);
        }

        io.emit("locations", users);

        // 削除された本人が接続中の場合も通知する（自動再登録を止めるため）
        io.emit("userDeleted", userId);
    });

    //====================================================
    // ログオフ（データは残し、オフライン状態にするだけ）
    //====================================================
    //
    // ログアウトは「隊員削除」とは別物。プロフィール・物資・経験値・
    // 最後の位置情報は保持したまま online フラグだけ落とす。
    // これにより再ログイン時に最後の位置がそのまま復元される。
    //
    //====================================================

    socket.on("userOffline", async userId => {
        await markUserOffline(userId);

        // 自動オフライン判定（GPS途絶・切断）とは違い、本人の意思による
        // 明示的なログアウトの時だけ、他端末の隊員一覧・地図から即座に隠す
        // （プロフィール・物資・経験値等のデータはDB上に残ったままで、
        // 次回ログイン時にそのまま復元される）
        const user = users[userId];
        if (user && !user.loggedOut) {
            user.loggedOut = true;
            broadcastUserUpdate(userId);
        }
    });

    //====================================================
    // プッシュ通知トークン登録（Puttanモバイルアプリ用）
    //====================================================

    socket.on("registerPushToken", async data => {
        const userId = String(data && data.user_id || "").trim();
        const token = String(data && data.token || "").trim();

        if (!userId || !token || !users[userId]) { return; }

        users[userId].pushToken = token;

        try {
            await pool.query("UPDATE users SET push_token=$2 WHERE user_id=$1", [userId, token]);
        }
        catch (err) {
            console.error("プッシュ通知トークン保存エラー:", userId, err);
        }
    });

    //====================================================
    // 地点削除
    //====================================================

    socket.on("deletePoint", async name => {
        delete points[name];

        try {
            await pool.query("DELETE FROM points WHERE name=$1", [name]);
        }
        catch (err) {
            console.error("地点削除エラー", err);
        }

        io.emit("pointDeleted", name);

        console.log("地点削除:", name);
    });

    //====================================================
    // 手動交通規制更新
    //====================================================

    socket.on("updateTrafficRegulations", regulations => {
        if (!Array.isArray(regulations)) {
            console.log("交通規制データが配列ではありません");
            return;
        }

        trafficRegulations = regulations;

        io.emit("trafficRegulations", trafficRegulations);

        console.log("交通規制手動更新:", trafficRegulations.length, "件");
    });

    //====================================================
    // 全体周知
    //====================================================

    socket.on("updateAnnouncement", text => {
        announcementText = String(text || "").slice(0, 300).trim();

        io.emit("announcement", announcementText);

        console.log("周知情報更新:", announcementText);
    });

    //====================================================
    // 閲覧状態（接続数・閲覧中ユーザー数の表示用）
    //====================================================

    socket.on("viewerActive", () => {
        viewingSockets.add(socket.id);
        broadcastConnectionCounts();
    });

    socket.on("viewerInactive", () => {
        viewingSockets.delete(socket.id);
        broadcastConnectionCounts();
    });

    //====================================================
    // 切断
    //====================================================

    socket.on("disconnect", () => {
        console.log("切断:", socket.id);
        viewingSockets.delete(socket.id);
        broadcastConnectionCounts();

        if (socket.userId) {
            endCallPair(socket.userId, "disconnect");

            decrementSocketCount(socket.userId);
            if (!socketCountByUserId[socket.userId]) {
                const user = users[socket.userId];
                const lastUpdate = user ? Number(user.lastUpdate) : NaN;
                const recentlyUpdated = Number.isFinite(lastUpdate)
                    && (Date.now() - lastUpdate < DISCONNECT_OFFLINE_GRACE_MS);

                if (!recentlyUpdated) {
                    markUserOffline(socket.userId);
                }
            }
        }
    });
});

//============================================================
// サーバー起動
//============================================================

const PORT = process.env.PORT || 10000;

async function startServer() {
    await loadUsers();
    await loadPoints();
    await loadChronologyReactions();
    await loadChronology();
    await pruneLocationHistory();

    server.listen(PORT, async () => {
        console.log("================================");
        console.log("server start port:", PORT);
        console.log("交通規制データ:", "国土交通省GIS");
        console.log("対象地域:", "熊本県");
        console.log("交通規制自動更新:", "3日ごと");
        console.log("ZIP処理:", "Node.js標準 zlib");
        console.log("adm-zip:", "使用しません");
        console.log("JARTIC:", "使用しません");
        console.log("================================");

        //================================================
        // 起動直後に1回取得
        //================================================

        await updateTrafficRegulations();

        //================================================
        // 3日ごとに更新
        //================================================

        setInterval(updateTrafficRegulations, TRAFFIC_UPDATE_INTERVAL);
    });
}

startServer();