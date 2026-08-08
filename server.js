//============================================================
// 現在位置自動共有君 Version 2.3
// server.js
//
// 実データ対応版
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
// ・JARTIC交通規制オープンデータ
// ・熊本県交通規制
// ・交通規制5分ごと自動更新
// ・接続中全端末へ自動配信
//============================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

const AdmZip = require("adm-zip");

const app = express();

const server = http.createServer(app);

const io = new Server(server);

app.use(express.static("public"));


//============================================================
// PostgreSQL / Supabase
//============================================================

const pool = new Pool({

    connectionString:
        process.env.DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    }

});


//============================================================
// メモリ
//============================================================

let users = {};

let points = {};

let chronology = [];

let trafficRegulations = [];


//============================================================
// 交通規制更新間隔
//============================================================

// 5分

const TRAFFIC_UPDATE_INTERVAL =
    5 * 60 * 1000;


//============================================================
// JARTIC
//============================================================
//
// 熊本県コード
// 43 = 熊本県
//
// JARTICの交通規制オープンデータは
// 都道府県別ZIPとして公開されている。
//============================================================

const JARTIC_BASE_URL =
    "https://www.jartic.or.jp";

const JARTIC_OPENDATA_URL =
    "https://www.jartic.or.jp/service/opendata/";

const KUMAMOTO_PREF_CODE =
    "43";


//============================================================
// HTTP GET
//============================================================

function httpGet(url) {

    return new Promise(
        (resolve, reject) => {

            https.get(
                url,
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 Puttan/2.3"
                    }
                },
                res => {

                    if (
                        res.statusCode >= 300 &&
                        res.statusCode < 400 &&
                        res.headers.location
                    ) {

                        const redirect =
                            new URL(
                                res.headers.location,
                                url
                            ).toString();

                        res.resume();

                        httpGet(
                            redirect
                        )
                        .then(resolve)
                        .catch(reject);

                        return;

                    }


                    if (
                        res.statusCode !== 200
                    ) {

                        res.resume();

                        reject(
                            new Error(
                                "HTTP " +
                                res.statusCode +
                                ": " +
                                url
                            )
                        );

                        return;

                    }


                    const chunks = [];


                    res.on(
                        "data",
                        chunk => {

                            chunks.push(chunk);

                        }
                    );


                    res.on(
                        "end",
                        () => {

                            resolve(
                                Buffer.concat(
                                    chunks
                                )
                            );

                        }
                    );

                }
            )
            .on(
                "error",
                reject
            );

        }
    );

}


//============================================================
// URLからHTML取得
//============================================================

async function getHtml(url) {

    const buffer =
        await httpGet(url);

    return buffer.toString(
        "utf8"
    );

}


//============================================================
// JARTIC公開ページから
// 熊本県ZIP URLを探す
//============================================================

async function findKumamotoZipUrl() {

    console.log(
        "JARTIC熊本県交通規制ZIP検索開始"
    );


    const html =
        await getHtml(
            JARTIC_OPENDATA_URL
        );


    //========================================================
    // hrefを抽出
    //========================================================

    const links = [];


    const regex =
        /href\s*=\s*["']([^"']+)["']/gi;


    let match;


    while (
        (match = regex.exec(html))
        !== null
    ) {

        links.push(
            match[1]
        );

    }


    //========================================================
    // 熊本県らしいリンクを探す
    //========================================================

    const candidates =
        links.filter(
            href => {

                const lower =
                    href.toLowerCase();

                return (
                    lower.includes(
                        "kumamoto"
                    )
                    ||
                    lower.includes(
                        "熊本"
                    )
                    ||
                    lower.includes(
                        "43"
                    )
                );

            }
        );


    console.log(
        "JARTIC候補URL:",
        candidates
    );


    //========================================================
    // ZIPを優先
    //========================================================

    const zipCandidate =
        candidates.find(
            href =>
                href
                    .toLowerCase()
                    .includes(".zip")
        );


    if (zipCandidate) {

        return new URL(
            zipCandidate,
            JARTIC_BASE_URL
        ).toString();

    }


    //========================================================
    // 熊本県リンク先をさらに確認
    //========================================================

    for (
        const candidate
        of candidates
    ) {

        try {

            const absolute =
                new URL(
                    candidate,
                    JARTIC_BASE_URL
                ).toString();


            if (
                absolute
                    .toLowerCase()
                    .includes(".zip")
            ) {

                return absolute;

            }

        }
        catch (err) {

            // 次候補へ

        }

    }


    throw new Error(
        "JARTIC公開ページから熊本県ZIPを取得できませんでした"
    );

}


//============================================================
// CSV解析用
//============================================================

function parseCsvLine(line) {

    const result = [];

    let current = "";

    let quoted = false;


    for (
        let i = 0;
        i < line.length;
        i++
    ) {

        const ch =
            line[i];


        if (ch === '"') {

            if (
                quoted &&
                line[i + 1] === '"'
            ) {

                current += '"';

                i++;

            }
            else {

                quoted =
                    !quoted;

            }

        }
        else if (
            ch === "," &&
            !quoted
        ) {

            result.push(
                current
            );

            current = "";

        }
        else {

            current += ch;

        }

    }


    result.push(
        current
    );


    return result;

}


//============================================================
// CSVをオブジェクト化
//============================================================

function csvToObjects(csv) {

    const lines =
        csv
            .replace(
                /^\uFEFF/,
                ""
            )
            .split(/\r?\n/)
            .filter(
                line =>
                    line.trim() !== ""
            );


    if (
        lines.length < 2
    ) {

        return [];

    }


    const headers =
        parseCsvLine(
            lines[0]
        )
        .map(
            h =>
                h
                    .trim()
                    .replace(
                        /^"|"$/g,
                        ""
                    )
        );


    const result = [];


    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        const values =
            parseCsvLine(
                lines[i]
            );


        const row = {};


        headers.forEach(
            (header, index) => {

                row[header] =
                    values[index] ||
                    "";

            }
        );


        result.push(
            row
        );

    }


    return result;

}


//============================================================
// オブジェクトから値を探す
//============================================================

function findField(
    row,
    names
) {

    const keys =
        Object.keys(row);


    for (
        const name
        of names
    ) {

        if (
            row[name] !== undefined
        ) {

            return row[name];

        }

    }


    for (
        const key
        of keys
    ) {

        const normalized =
            key
                .toLowerCase()
                .replace(
                    /[\s_\-]/g,
                    ""
                );


        for (
            const name
            of names
        ) {

            const target =
                name
                    .toLowerCase()
                    .replace(
                        /[\s_\-]/g,
                        ""
                    );


            if (
                normalized === target
            ) {

                return row[key];

            }

        }

    }


    return "";

}


//============================================================
// 数値化
//============================================================

function toNumber(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;

    }


    const n =
        Number(
            String(value)
                .replace(
                    /,/g,
                    ""
                )
                .trim()
        );


    if (
        Number.isNaN(n)
    ) {

        return null;

    }


    return n;

}


//============================================================
// 交通規制1件を
// プッたん用データへ変換
//============================================================

function normalizeTrafficRow(row) {

    const lat =
        toNumber(
            findField(
                row,
                [
                    "緯度",
                    "latitude",
                    "lat",
                    "Latitude",
                    "LAT"
                ]
            )
        );


    const lon =
        toNumber(
            findField(
                row,
                [
                    "経度",
                    "longitude",
                    "lon",
                    "Longitude",
                    "LON"
                ]
            )
        );


    const route =
        findField(
            row,
            [
                "路線名",
                "道路名",
                "route",
                "RouteName",
                "道路名称"
            ]
        );


    const type =
        findField(
            row,
            [
                "規制種別",
                "規制内容",
                "type",
                "restriction",
                "規制"
            ]
        );


    const reason =
        findField(
            row,
            [
                "規制理由",
                "reason",
                "理由"
            ]
        );


    const section =
        findField(
            row,
            [
                "規制区間",
                "区間",
                "section",
                "規制場所",
                "場所"
            ]
        );


    const start =
        findField(
            row,
            [
                "規制開始日時",
                "開始日時",
                "start",
                "開始"
            ]
        );


    const end =
        findField(
            row,
            [
                "規制終了日時",
                "終了日時",
                "end",
                "終了"
            ]
        );


    return {

        lat: lat,

        lon: lon,

        route:
            route ||
            "道路情報",

        type:
            type ||
            "交通規制",

        reason:
            reason ||
            "",

        section:
            section ||
            "",

        start:
            start ||
            "",

        end:
            end ||
            "",

        source:
            "JARTIC"

    };

}


//============================================================
// JARTIC ZIP取得
//============================================================

async function fetchJarticTraffic() {

    console.log(
        "JARTIC交通規制取得開始"
    );


    const zipUrl =
        await findKumamotoZipUrl();


    console.log(
        "熊本県ZIP:",
        zipUrl
    );


    const zipBuffer =
        await httpGet(
            zipUrl
        );


    const tempFile =
        path.join(
            os.tmpdir(),
            "jartic_kumamoto.zip"
        );


    fs.writeFileSync(
        tempFile,
        zipBuffer
    );


    const zip =
        new AdmZip(
            tempFile
        );


    const entries =
        zip.getEntries();


    console.log(
        "ZIP内ファイル数:",
        entries.length
    );


    const regulations = [];


    for (
        const entry
        of entries
    ) {

        if (
            entry.isDirectory
        ) {

            continue;

        }


        const name =
            entry.entryName
                .toLowerCase();


        if (
            !(
                name.endsWith(".csv") ||
                name.endsWith(".txt")
            )
        ) {

            continue;

        }


        const buffer =
            entry.getData();


        let text;


        //====================================================
        // UTF-8を優先
        //====================================================

        text =
            buffer.toString(
                "utf8"
            );


        //====================================================
        // CSVらしくない場合はShift-JIS
        //====================================================

        if (
            !text.includes(",") &&
            buffer.length > 0
        ) {

            try {

                const iconv =
                    require("iconv-lite");

                text =
                    iconv.decode(
                        buffer,
                        "Shift_JIS"
                    );

            }
            catch (err) {

                console.log(
                    "Shift-JIS変換不可:",
                    err.message
                );

            }

        }


        try {

            const rows =
                csvToObjects(
                    text
                );


            console.log(
                "CSV解析:",
                entry.entryName,
                rows.length,
                "件"
            );


            rows.forEach(
                row => {

                    const item =
                        normalizeTrafficRow(
                            row
                        );


                    //================================================
                    // 緯度経度が取れるものを採用
                    //================================================

                    if (
                        item.lat !== null &&
                        item.lon !== null
                    ) {

                        regulations.push(
                            item
                        );

                    }

                }
            );

        }
        catch (err) {

            console.error(
                "CSV解析エラー:",
                entry.entryName,
                err
            );

        }

    }


    try {

        fs.unlinkSync(
            tempFile
        );

    }
    catch (err) {

        // 無視

    }


    console.log(
        "JARTIC交通規制取得終了:",
        regulations.length,
        "件"
    );


    return regulations;

}


//============================================================
// 交通規制テストデータ
//============================================================
//
// 実データ取得に失敗しても
// 既存の🚧テスト表示を維持する。
//============================================================

function getTrafficTestData() {

    return [

        {

            lat: 32.803,

            lon: 130.707,

            route: "国道○号",

            type: "通行止め",

            reason: "道路工事",

            section:
                "○○交差点～○○交差点",

            start:
                new Date()
                    .toLocaleString(
                        "ja-JP",
                        {
                            timeZone:
                                "Asia/Tokyo",

                            hour12: false
                        }
                    ),

            end: "",

            source:
                "TEST"

        }

    ];

}


//============================================================
// 交通規制取得
//============================================================

async function fetchTrafficRegulations() {

    try {

        console.log(
            "JARTIC交通規制取得開始"
        );


        const regulations =
            await fetchJarticTraffic();


        if (
            !Array.isArray(
                regulations
            )
        ) {

            throw new Error(
                "交通規制データが配列ではありません"
            );

        }


        return regulations;

    }
    catch (err) {

        console.error(
            "JARTIC交通規制取得エラー:",
            err
        );


        console.log(
            "既存のテスト交通規制を使用します"
        );


        return getTrafficTestData();

    }

}


//============================================================
// 交通規制更新
//============================================================

async function updateTrafficRegulations() {

    try {

        console.log(
            "================================"
        );

        console.log(
            "交通規制情報 更新開始"
        );


        const regulations =
            await fetchTrafficRegulations();


        if (
            !Array.isArray(
                regulations
            )
        ) {

            console.error(
                "交通規制データが配列ではありません"
            );

            return;

        }


        trafficRegulations =
            regulations;


        console.log(
            "交通規制:",
            trafficRegulations.length,
            "件"
        );


        //====================================================
        // 接続中の全端末へ配信
        //====================================================

        io.emit(
            "trafficRegulations",
            trafficRegulations
        );


        console.log(
            "交通規制を全端末へ配信しました"
        );


        console.log(
            "交通規制情報 更新終了"
        );

        console.log(
            "================================"
        );

    }
    catch (err) {

        console.error(
            "交通規制更新エラー:",
            err
        );

    }

}


//============================================================
// 地点復元
//============================================================

async function loadPoints() {

    try {

        const result =
            await pool.query(
                "SELECT * FROM points ORDER BY created"
            );


        result.rows.forEach(
            point => {

                points[point.name] =
                    point;

            }
        );


        console.log(
            "地点復元:",
            Object.keys(points)
        );

    }
    catch (err) {

        console.error(
            "地点復元エラー",
            err
        );

    }

}


//============================================================
// クロノロジー復元
//============================================================

async function loadChronology() {

    try {

        const result =
            await pool.query(
                "SELECT * FROM chronology ORDER BY id DESC LIMIT 100"
            );


        chronology =
            result.rows.map(
                row => ({

                    time:
                        new Date(
                            Number(
                                row.created
                            )
                        ).toLocaleString(
                            "ja-JP",
                            {
                                timeZone:
                                    "Asia/Tokyo",

                                hour12: false
                            }
                        ),

                    message:
                        (
                            row.user_name
                                ?
                                "[" +
                                row.user_name +
                                "] "
                                :
                                ""
                        )
                        +
                        row.message

                })
            );


        console.log(
            "クロノロジー復元:",
            chronology.length
        );

    }
    catch (err) {

        console.error(
            "クロノロジー復元エラー",
            err
        );

    }

}


//============================================================
// ユーザー復元
//============================================================

async function loadUsers() {

    try {

        const result =
            await pool.query(
                "SELECT * FROM current_users"
            );


        result.rows.forEach(
            user => {

                users[user.name] = {

                    name:
                        user.name,

                    lat:
                        user.lat,

                    lon:
                        user.lon,

                    utmZone:
                        user.utmzone,

                    utmE:
                        user.utme,

                    utmN:
                        user.utmn,

                    water:
                        user.water,

                    fuel:
                        user.fuel,

                    destination:
                        user.destination,

                    iconType:
                        user.icontype ||
                        "1",

                    online:
                        false,

                    lastUpdate:
                        user.lastupdate

                };

            }
        );


        console.log(
            "復元ユーザー:",
            Object.keys(users)
        );

    }
    catch (err) {

        console.error(
            "DB復元エラー",
            err
        );

    }

}


//============================================================
// Socket.IO
//============================================================

io.on(
    "connection",
    socket => {

        console.log(
            "接続:",
            socket.id
        );


        //====================================================
        // 初期データ送信
        //====================================================

        socket.emit(
            "locations",
            users
        );


        socket.emit(
            "points",
            points
        );


        socket.emit(
            "chronology",
            chronology
        );


        socket.emit(
            "trafficRegulations",
            trafficRegulations
        );


        //====================================================
        // 地点登録
        //====================================================

        socket.on(
            "addPoint",

            async point => {

                try {

                    console.log(
                        "地点受信:",
                        point
                    );


                    const created =
                        Date.now();


                    await pool.query(

                        `
                        INSERT INTO points
                        (
                            name,
                            type,
                            lat,
                            lon,
                            created
                        )

                        VALUES
                        ($1,$2,$3,$4,$5)

                        ON CONFLICT(name)

                        DO UPDATE SET

                            type=$2,
                            lat=$3,
                            lon=$4,
                            created=$5
                        `,

                        [

                            point.name,

                            point.type ||
                                "point",

                            point.lat,

                            point.lon,

                            created

                        ]

                    );


                    points[point.name] = {

                        name:
                            point.name,

                        type:
                            point.type ||
                            "point",

                        lat:
                            point.lat,

                        lon:
                            point.lon,

                        created:
                            created

                    };


                    io.emit(
                        "points",
                        points
                    );


                    console.log(
                        "地点登録:",
                        point.name
                    );

                }
                catch (err) {

                    console.error(
                        "地点保存エラー",
                        err
                    );

                }

            }
        );


        //====================================================
        // ユーザー登録
        //====================================================

        socket.on(
            "registerUser",

            async data => {

                try {

                    const now =
                        Date.now();


                    const oldUser =
                        users[data.name];


                    const user = {

                        name:
                            data.name,

                        lat:
                            oldUser
                                ?
                                oldUser.lat
                                :
                                null,

                        lon:
                            oldUser
                                ?
                                oldUser.lon
                                :
                                null,

                        utmZone:
                            oldUser
                                ?
                                oldUser.utmZone
                                :
                                "52S",

                        utmE:
                            oldUser
                                ?
                                oldUser.utmE
                                :
                                null,

                        utmN:
                            oldUser
                                ?
                                oldUser.utmN
                                :
                                null,

                        water:
                            Number(
                                data.water
                            ) || 0,

                        fuel:
                            Number(
                                data.fuel
                            ) || 0,

                        destination:
                            data.destination ||
                            "",

                        iconType:
                            data.iconType ||
                            "1",

                        online:
                            true,

                        lastUpdate:
                            now

                    };


                    users[data.name] =
                        user;


                    await pool.query(

                        `
                        INSERT INTO current_users
                        (
                            name,
                            lat,
                            lon,
                            utmZone,
                            utmE,
                            utmN,
                            water,
                            fuel,
                            destination,
                            iconType,
                            online,
                            lastUpdate
                        )

                        VALUES
                        (
                            $1,$2,$3,$4,$5,$6,
                            $7,$8,$9,$10,$11,$12
                        )

                        ON CONFLICT(name)

                        DO UPDATE SET

                            lat=$2,
                            lon=$3,
                            utmZone=$4,
                            utmE=$5,
                            utmN=$6,
                            water=$7,
                            fuel=$8,
                            destination=$9,
                            iconType=$10,
                            online=$11,
                            lastUpdate=$12
                        `,

                        [

                            user.name,

                            user.lat,

                            user.lon,

                            user.utmZone,

                            user.utmE,

                            user.utmN,

                            user.water,

                            user.fuel,

                            user.destination,

                            user.iconType,

                            1,

                            now

                        ]

                    );


                    console.log(
                        "ユーザー登録:",
                        data.name
                    );


                    io.emit(
                        "locations",
                        users
                    );

                }
                catch (err) {

                    console.error(
                        "ユーザー登録エラー",
                        err
                    );

                }

            }
        );


        //====================================================
        // 位置情報受信
        //====================================================

        socket.on(
            "location",

            async data => {

                if (
                    !users[data.name]
                ) {

                    console.log(
                        "未登録GPS拒否:",
                        data.name
                    );

                    return;

                }


                const now =
                    Date.now();


                const user = {

                    name:
                        data.name,

                    lat:
                        data.lat,

                    lon:
                        data.lon,

                    utmZone:
                        data.utmZone ||
                        "52S",

                    utmE:
                        data.utmE,

                    utmN:
                        data.utmN,

                    water:
                        data.water,

                    fuel:
                        data.fuel,

                    destination:
                        data.destination,

                    iconType:
                        data.iconType ||
                        "1",

                    online:
                        true,

                    lastUpdate:
                        now

                };


                users[data.name] =
                    user;


                try {

                    //========================================
                    // 現在位置更新
                    //========================================

                    await pool.query(

                        `
                        UPDATE current_users

                        SET

                            lat=$2,
                            lon=$3,
                            utmZone=$4,
                            utmE=$5,
                            utmN=$6,
                            water=$7,
                            fuel=$8,
                            destination=$9,
                            iconType=$10,
                            online=$11,
                            lastUpdate=$12

                        WHERE name=$1
                        `,

                        [

                            user.name,

                            user.lat,

                            user.lon,

                            user.utmZone,

                            user.utmE,

                            user.utmN,

                            user.water,

                            user.fuel,

                            user.destination,

                            user.iconType,

                            1,

                            now

                        ]

                    );


                    //========================================
                    // 位置履歴保存
                    //========================================

                    await pool.query(

                        `
                        INSERT INTO location_history
                        (
                            name,
                            lat,
                            lon,
                            water,
                            fuel,
                            destination
                        )

                        VALUES
                        ($1,$2,$3,$4,$5,$6)
                        `,

                        [

                            user.name,

                            user.lat,

                            user.lon,

                            user.water,

                            user.fuel,

                            user.destination

                        ]

                    );

                }
                catch (err) {

                    console.error(
                        "DB保存エラー",
                        err
                    );

                }


                io.emit(
                    "locations",
                    users
                );

            }
        );


        //====================================================
        // クロノロジー
        //====================================================

        socket.on(
            "addChronology",

            async data => {

                const now =
                    Date.now();


                const item = {

                    time:
                        new Date(
                            now
                        ).toLocaleString(
                            "ja-JP",
                            {
                                timeZone:
                                    "Asia/Tokyo",

                                hour12: false
                            }
                        ),

                    message:
                        (
                            data.user
                                ?
                                "[" +
                                data.user +
                                "] "
                                :
                                ""
                        )
                        +
                        data.message

                };


                chronology.unshift(
                    item
                );


                if (
                    chronology.length > 100
                ) {

                    chronology.pop();

                }


                try {

                    await pool.query(

                        `
                        INSERT INTO chronology
                        (
                            user_name,
                            message,
                            created
                        )

                        VALUES
                        ($1,$2,$3)
                        `,

                        [

                            data.user ||
                                "",

                            data.message,

                            now

                        ]

                    );

                }
                catch (err) {

                    console.error(
                        "クロノロジー保存エラー",
                        err
                    );

                }


                io.emit(
                    "chronology",
                    chronology
                );

            }
        );


        //====================================================
        // ユーザー削除
        //====================================================

        socket.on(
            "deleteUser",

            async name => {

                delete users[name];


                try {

                    await pool.query(

                        "DELETE FROM current_users WHERE name=$1",

                        [name]

                    );

                }
                catch (err) {

                    console.error(
                        "削除エラー",
                        err
                    );

                }


                io.emit(
                    "locations",
                    users
                );


                socket.emit(
                    "userDeleted",
                    name
                );

            }
        );


        //====================================================
        // 地点削除
        //====================================================

        socket.on(
            "deletePoint",

            async name => {

                delete points[name];


                try {

                    await pool.query(

                        "DELETE FROM points WHERE name=$1",

                        [name]

                    );

                }
                catch (err) {

                    console.error(
                        "地点削除エラー",
                        err
                    );

                }


                io.emit(
                    "points",
                    points
                );


                console.log(
                    "地点削除:",
                    name
                );

            }
        );


        //====================================================
        // 手動交通規制更新
        //====================================================

        socket.on(
            "updateTrafficRegulations",

            regulations => {

                if (
                    !Array.isArray(
                        regulations
                    )
                ) {

                    console.log(
                        "交通規制データが配列ではありません"
                    );

                    return;

                }


                trafficRegulations =
                    regulations;


                io.emit(
                    "trafficRegulations",
                    trafficRegulations
                );


                console.log(
                    "交通規制手動更新:",
                    trafficRegulations.length,
                    "件"
                );

            }
        );


        //====================================================
        // 切断
        //====================================================

        socket.on(
            "disconnect",

            () => {

                console.log(
                    "切断:",
                    socket.id
                );

            }
        );

    }
);


//============================================================
// サーバー起動
//============================================================

const PORT =
    process.env.PORT || 10000;


async function startServer() {

    await loadUsers();

    await loadPoints();

    await loadChronology();


    server.listen(

        PORT,

        async () => {

            console.log(
                "================================"
            );

            console.log(
                "server start port:",
                PORT
            );

            console.log(
                "交通規制自動更新:",
                "5分ごと"
            );

            console.log(
                "交通規制データ:",
                "JARTIC 熊本県"
            );

            console.log(
                "================================"
            );


            //================================================
            // 起動直後に1回取得
            //================================================

            await updateTrafficRegulations();


            //================================================
            // 5分ごとに自動更新
            //================================================

            setInterval(

                updateTrafficRegulations,

                TRAFFIC_UPDATE_INTERVAL

            );

        }

    );

}


startServer();