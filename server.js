//============================================================
// 現在位置自動共有君 Version 2.3
// server.js
//
// ①～⑫ 適用版
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
// ・熊本県交通規制実データ対応
// ・交通規制5分ごと自動更新
// ・接続中全端末へ自動配信
//============================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");

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

// 5分 = 5 × 60 × 1000 ms

const TRAFFIC_UPDATE_INTERVAL =
    5 * 60 * 1000;


//============================================================
// 熊本県交通規制データ
//============================================================
//
// JARTICの交通規制オープンデータを利用する場合、
// Render等の環境変数に以下を設定する。
//
// JARTIC_KUMAMOTO_CSV_URL
//
// 例:
//
// JARTIC_KUMAMOTO_CSV_URL
// = 実際に取得する熊本県CSVのURL
//
// ※JARTICのデータは月次更新。
// ※5分ごとの処理は、取得先データが更新された場合に
//   プッたん側へ再配信するためのもの。
//============================================================


//============================================================
// CSV解析
//============================================================
//
// JARTIC CSVは
//
// ・Shift-JIS
// ・CSV
// ・全項目ダブルクォーテーション
//
// の形式。
// 外部CSVライブラリに依存しない簡易CSVパーサー。
//============================================================

function parseCSVLine(line) {

    const result = [];

    let current = "";

    let insideQuotes = false;


    for (
        let i = 0;
        i < line.length;
        i++
    ) {

        const char =
            line[i];


        if (char === '"') {

            if (
                insideQuotes &&
                line[i + 1] === '"'
            ) {

                current += '"';

                i++;

            }
            else {

                insideQuotes =
                    !insideQuotes;

            }

        }
        else if (
            char === "," &&
            !insideQuotes
        ) {

            result.push(current);

            current = "";

        }
        else {

            current += char;

        }

    }


    result.push(current);


    return result;

}


//============================================================
// CSV全体解析
//============================================================

function parseCSV(text) {

    const lines =
        text
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .split("\n");


    if (lines.length < 2) {

        return [];

    }


    const headers =
        parseCSVLine(
            lines[0]
        );


    const rows = [];


    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        if (
            !lines[i].trim()
        ) {

            continue;

        }


        const values =
            parseCSVLine(
                lines[i]
            );


        const row = {};


        headers.forEach(
            (header, index) => {

                row[
                    header.trim()
                ] =
                    values[index] || "";

            }
        );


        rows.push(row);

    }


    return rows;

}


//============================================================
// CSV文字コード変換
//============================================================
//
// Node.js標準機能だけではShift-JIS変換ができないため、
// TextDecoderを利用。
//============================================================

function decodeShiftJIS(buffer) {

    try {

        const decoder =
            new TextDecoder(
                "shift_jis"
            );


        return decoder.decode(
            buffer
        );

    }
    catch (err) {

        console.error(
            "Shift-JIS変換エラー:",
            err
        );


        return buffer.toString(
            "utf8"
        );

    }

}


//============================================================
// 座標文字列解析
//============================================================
//
// JARTICの座標は
//
// 緯度 経度
//
// の形式で登録される。
// 複数座標は ; 区切り。
//============================================================

function parseCoordinates(value) {

    if (!value) {

        return [];

    }


    const result = [];


    const parts =
        String(value)
            .split(";");


    parts.forEach(
        part => {

            const numbers =
                part
                    .trim()
                    .split(/\s+/);


            if (
                numbers.length < 2
            ) {

                return;

            }


            const lat =
                Number(
                    numbers[0]
                );


            const lon =
                Number(
                    numbers[1]
                );


            if (
                Number.isFinite(lat) &&
                Number.isFinite(lon)
            ) {

                result.push({

                    lat: lat,

                    lon: lon

                });

            }

        }
    );


    return result;

}


//============================================================
// 熊本県交通規制データ変換
//============================================================
//
// JARTICのCSVは170項目の拡張版標準フォーマット。
// 項目名は公開仕様に従っているため、
// 必要な項目を名前で取得する方式にしている。
//============================================================

function convertTrafficRows(rows) {

    const result = [];


    rows.forEach(
        (row, index) => {

            const regulationType =
                row["共通規制種別コード"] ||
                row["交通規制種別"] ||
                row["規制種別"] ||
                "";


            const route =
                row["路線名(代表)"] ||
                row["路線名"] ||
                "";


            const location =
                row["規制場所の経度緯度"] ||
                row["規制地点の経度緯度"] ||
                "";


            const coordinates =
                parseCoordinates(
                    location
                );


            //
            // 座標が存在しないデータもあるため、
            // 座標がなくても一覧表示対象にはする。
            //

            let lat = null;

            let lon = null;


            if (
                coordinates.length > 0
            ) {

                lat =
                    coordinates[0].lat;

                lon =
                    coordinates[0].lon;

            }


            const condition =
                row["規制条件"] ||
                "";


            const startDate =
                row["対象期間 1_開始"] ||
                "";


            const endDate =
                row["対象期間 1_終了"] ||
                "";


            const startTime =
                row["規制時間 1_開始"] ||
                "";


            const endTime =
                row["規制時間 1_終了"] ||
                "";


            result.push({

                id:
                    "jartic-" +
                    index,

                source:
                    "JARTIC",

                prefecture:
                    "熊本県",

                route:
                    route,

                type:
                    regulationType,

                lat:
                    lat,

                lon:
                    lon,

                coordinates:
                    coordinates,

                condition:
                    condition,

                startDate:
                    startDate,

                endDate:
                    endDate,

                startTime:
                    startTime,

                endTime:
                    endTime

            });

        }
    );


    return result;

}


//============================================================
// 実データ取得
//============================================================

async function fetchRealTrafficRegulations() {

    const url =
        process.env.JARTIC_KUMAMOTO_CSV_URL;


    if (!url) {

        console.log(
            "JARTIC_KUMAMOTO_CSV_URL が未設定です"
        );


        return null;

    }


    try {

        console.log(
            "熊本県交通規制実データ取得開始"
        );


        console.log(
            url
        );


        const response =
            await fetch(
                url
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );

        }


        const buffer =
            await response.arrayBuffer();


        const text =
            decodeShiftJIS(
                Buffer.from(
                    buffer
                )
            );


        const rows =
            parseCSV(
                text
            );


        console.log(
            "交通規制CSV:",
            rows.length,
            "件"
        );


        const regulations =
            convertTrafficRows(
                rows
            );


        console.log(
            "熊本県交通規制:",
            regulations.length,
            "件"
        );


        return regulations;

    }
    catch (err) {

        console.error(
            "熊本県交通規制取得エラー:",
            err
        );


        return null;

    }

}


//============================================================
// 交通規制取得
//============================================================
//
// 実データが設定されていれば実データ。
// 未設定の場合は既存のテストデータを使用。
//============================================================

async function fetchTrafficRegulations() {

    const realData =
        await fetchRealTrafficRegulations();


    if (
        Array.isArray(realData)
    ) {

        return realData;

    }


    //--------------------------------------------------------
    // 実データ未設定時のテストデータ
    //--------------------------------------------------------

    console.log(
        "交通規制テストデータを使用します"
    );


    return [

        {

            id:
                "test-001",

            source:
                "TEST",

            prefecture:
                "熊本県",

            lat:
                32.803,

            lon:
                130.707,

            route:
                "国道○号",

            type:
                "通行止め",

            reason:
                "道路工事",

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
                    )

        }

    ];

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


        //----------------------------------------------------
        // 接続中の全端末へ配信
        //----------------------------------------------------

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

                points[
                    point.name
                ] =
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
    (socket) => {

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

            async (point) => {

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


                    points[
                        point.name
                    ] = {

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

            async (data) => {

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

            async (data) => {

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

            async (data) => {

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

                            data.user || "",

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

            async (name) => {

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

            async (name) => {

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

            (regulations) => {

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
