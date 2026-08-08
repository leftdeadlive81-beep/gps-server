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
// ・交通規制実データ取得
// ・交通規制5分ごと自動更新
// ・接続中全端末へ自動配信
//
// 交通規制データ
// TRAFFIC_API_URL に公開JSON / GeoJSON取得先を設定
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
// 交通規制設定
//============================================================

// 5分
const TRAFFIC_UPDATE_INTERVAL =
    5 * 60 * 1000;


//------------------------------------------------------------
// 実データ取得先
//
// Render等の環境変数に設定する:
//
// TRAFFIC_API_URL=https://取得先...
//
// URLが未設定の場合は、既存のテストデータを使用。
//------------------------------------------------------------

const TRAFFIC_API_URL =
    process.env.TRAFFIC_API_URL || "";


//============================================================
// 熊本県範囲
//============================================================
//
// 実データが全国分を返す場合に熊本県付近だけを抽出する。
// 厳密な県境判定ではなく、まず熊本県を包含する範囲で
// 絞り込む方式。
//============================================================

const KUMAMOTO_BOUNDS = {

    minLat: 32.0,

    maxLat: 33.2,

    minLon: 129.9,

    maxLon: 131.3

};


//============================================================
// 熊本県内判定
//============================================================

function isKumamotoLocation(
    lat,
    lon
) {

    if (
        typeof lat !== "number" ||
        typeof lon !== "number"
    ) {

        return false;

    }


    return (

        lat >= KUMAMOTO_BOUNDS.minLat &&

        lat <= KUMAMOTO_BOUNDS.maxLat &&

        lon >= KUMAMOTO_BOUNDS.minLon &&

        lon <= KUMAMOTO_BOUNDS.maxLon

    );

}


//============================================================
// 数値変換
//============================================================

function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    const n =
        Number(value);


    if (Number.isNaN(n)) {

        return null;

    }


    return n;

}


//============================================================
// 交通規制種別を整理
//============================================================

function normalizeTrafficType(
    value
) {

    if (!value) {

        return "交通規制";

    }


    const text =
        String(value);


    if (
        text.includes("通行止") ||
        text.includes("全面通行止")
    ) {

        return "通行止め";

    }


    if (
        text.includes("片側") ||
        text.includes("交互")
    ) {

        return "片側交互通行";

    }


    if (
        text.includes("車線") ||
        text.includes("車線規制")
    ) {

        return "車線規制";

    }


    if (
        text.includes("工事")
    ) {

        return "道路工事";

    }


    return text;

}


//============================================================
// GeoJSON座標から代表座標を取得
//============================================================

function getGeoJSONPoint(
    geometry
) {

    if (!geometry) {

        return null;

    }


    const coordinates =
        geometry.coordinates;


    if (!coordinates) {

        return null;

    }


    //--------------------------------------------------------
    // Point
    //--------------------------------------------------------

    if (
        geometry.type === "Point"
    ) {

        if (
            Array.isArray(coordinates) &&
            coordinates.length >= 2
        ) {

            return {

                lon:
                    Number(
                        coordinates[0]
                    ),

                lat:
                    Number(
                        coordinates[1]
                    )

            };

        }

    }


    //--------------------------------------------------------
    // LineString / MultiPoint
    //--------------------------------------------------------

    if (
        geometry.type === "LineString" ||
        geometry.type === "MultiPoint"
    ) {

        if (
            Array.isArray(coordinates) &&
            coordinates.length > 0
        ) {

            const index =
                Math.floor(
                    coordinates.length / 2
                );


            const p =
                coordinates[index];


            if (
                Array.isArray(p) &&
                p.length >= 2
            ) {

                return {

                    lon:
                        Number(p[0]),

                    lat:
                        Number(p[1])

                };

            }

        }

    }


    //--------------------------------------------------------
    // MultiLineString
    //--------------------------------------------------------

    if (
        geometry.type === "MultiLineString"
    ) {

        if (
            Array.isArray(coordinates) &&
            coordinates.length > 0 &&
            Array.isArray(
                coordinates[0]
            )
        ) {

            const line =
                coordinates[
                    Math.floor(
                        coordinates.length / 2
                    )
                ];


            if (
                Array.isArray(line) &&
                line.length > 0
            ) {

                const p =
                    line[
                        Math.floor(
                            line.length / 2
                        )
                    ];


                if (
                    Array.isArray(p) &&
                    p.length >= 2
                ) {

                    return {

                        lon:
                            Number(p[0]),

                        lat:
                            Number(p[1])

                    };

                }

            }

        }

    }


    //--------------------------------------------------------
    // Polygon / MultiPolygon
    //--------------------------------------------------------

    function searchNested(
        value
    ) {

        if (
            Array.isArray(value)
        ) {

            if (
                value.length >= 2 &&
                typeof value[0] === "number" &&
                typeof value[1] === "number"
            ) {

                return {

                    lon:
                        Number(value[0]),

                    lat:
                        Number(value[1])

                };

            }


            for (
                const child of value
            ) {

                const result =
                    searchNested(child);


                if (result) {

                    return result;

                }

            }

        }


        return null;

    }


    return searchNested(
        coordinates
    );

}


//============================================================
// 交通規制1件をプッたん形式へ変換
//============================================================

function normalizeTrafficItem(
    item,
    index
) {

    if (!item) {

        return null;

    }


    //--------------------------------------------------------
    // GeoJSON Feature
    //--------------------------------------------------------

    let properties =
        item.properties || item;


    let lat =
        toNumber(
            item.lat ??
            item.latitude ??
            properties.lat ??
            properties.latitude
        );


    let lon =
        toNumber(
            item.lon ??
            item.lng ??
            item.longitude ??
            properties.lon ??
            properties.lng ??
            properties.longitude
        );


    //--------------------------------------------------------
    // GeoJSON geometry
    //--------------------------------------------------------

    if (
        (
            lat === null ||
            lon === null
        ) &&
        item.geometry
    ) {

        const point =
            getGeoJSONPoint(
                item.geometry
            );


        if (point) {

            lat =
                point.lat;

            lon =
                point.lon;

        }

    }


    if (
        lat === null ||
        lon === null
    ) {

        return null;

    }


    //--------------------------------------------------------
    // 熊本県付近だけ採用
    //--------------------------------------------------------

    if (
        !isKumamotoLocation(
            lat,
            lon
        )
    ) {

        return null;

    }


    //--------------------------------------------------------
    // 各種項目
    //--------------------------------------------------------

    const route =
        properties.route ??
        properties.roadName ??
        properties.road_name ??
        properties.路線名 ??
        properties.路線 ??
        properties.name ??
        "道路";


    const rawType =
        properties.type ??
        properties.regulationType ??
        properties.regulation_type ??
        properties.規制種別 ??
        properties.規制内容 ??
        properties.status ??
        "交通規制";


    const reason =
        properties.reason ??
        properties.cause ??
        properties.原因 ??
        properties.理由 ??
        "";


    const section =
        properties.section ??
        properties.sectionName ??
        properties.区間 ??
        properties.規制区間 ??
        "";


    const start =
        properties.start ??
        properties.startTime ??
        properties.start_time ??
        properties.開始日時 ??
        "";


    const end =
        properties.end ??
        properties.endTime ??
        properties.end_time ??
        properties.終了日時 ??
        "";


    const id =
        properties.id ??
        item.id ??
        (
            "traffic-" +
            index
        );


    return {

        id: String(id),

        lat: lat,

        lon: lon,

        route:
            String(route),

        type:
            normalizeTrafficType(
                rawType
            ),

        reason:
            String(reason),

        section:
            String(section),

        start:
            String(start),

        end:
            String(end),

        source:
            "公開交通規制データ",

        updated:
            new Date()
                .toISOString()

    };

}


//============================================================
// 配列データを変換
//============================================================

function normalizeTrafficData(
    data
) {

    let items = [];


    //--------------------------------------------------------
    // GeoJSON FeatureCollection
    //--------------------------------------------------------

    if (
        data &&
        data.type ===
            "FeatureCollection" &&
        Array.isArray(
            data.features
        )
    ) {

        items =
            data.features;

    }


    //--------------------------------------------------------
    // GeoJSON Feature
    //--------------------------------------------------------

    else if (
        data &&
        data.type === "Feature"
    ) {

        items = [data];

    }


    //--------------------------------------------------------
    // 通常の配列
    //--------------------------------------------------------

    else if (
        Array.isArray(data)
    ) {

        items = data;

    }


    //--------------------------------------------------------
    // { data: [...] }
    //--------------------------------------------------------

    else if (
        data &&
        Array.isArray(
            data.data
        )
    ) {

        items =
            data.data;

    }


    //--------------------------------------------------------
    // { results: [...] }
    //--------------------------------------------------------

    else if (
        data &&
        Array.isArray(
            data.results
        )
    ) {

        items =
            data.results;

    }


    const result = [];


    items.forEach(
        (item, index) => {

            const normalized =
                normalizeTrafficItem(
                    item,
                    index
                );


            if (normalized) {

                result.push(
                    normalized
                );

            }

        }
    );


    return result;

}


//============================================================
// 交通規制取得
//============================================================
//
// TRAFFIC_API_URL が設定されていれば実データを取得。
// 未設定の場合はテストデータ。
//============================================================

async function fetchTrafficRegulations() {

    //--------------------------------------------------------
    // 実データURLなし
    //--------------------------------------------------------

    if (
        !TRAFFIC_API_URL
    ) {

        console.log(
            "TRAFFIC_API_URL 未設定"
        );

        console.log(
            "交通規制テストデータを使用します"
        );


        return [

            {

                id:
                    "test-traffic-1",

                lat:
                    32.803,

                lon:
                    130.707,

                route:
                    "テスト道路",

                type:
                    "通行止め",

                reason:
                    "道路工事",

                section:
                    "テスト区間",

                start:
                    new Date()
                        .toLocaleString(
                            "ja-JP",
                            {
                                timeZone:
                                    "Asia/Tokyo",

                                hour12:
                                    false
                            }
                        ),

                end:
                    "",

                source:
                    "プッたんテストデータ",

                updated:
                    new Date()
                        .toISOString()

            }

        ];

    }


    //--------------------------------------------------------
    // 実データ取得
    //--------------------------------------------------------

    try {

        console.log(
            "交通規制実データ取得:",
            TRAFFIC_API_URL
        );


        const response =
            await fetch(
                TRAFFIC_API_URL,
                {

                    headers: {

                        "User-Agent":
                            "Puttan/2.3"

                    }

                }
            );


        if (
            !response.ok
        ) {

            throw new Error(
                "HTTP " +
                response.status
            );

        }


        const data =
            await response.json();


        const regulations =
            normalizeTrafficData(
                data
            );


        console.log(
            "実データ取得:",
            regulations.length,
            "件"
        );


        return regulations;

    }
    catch (err) {

        console.error(
            "交通規制実データ取得エラー:",
            err
        );


        //----------------------------------------------------
        // 実データ取得失敗時は既存データを維持
        //----------------------------------------------------

        if (
            Array.isArray(
                trafficRegulations
            ) &&
            trafficRegulations.length > 0
        ) {

            console.log(
                "前回取得済み交通規制データを維持します"
            );


            return trafficRegulations;

        }


        return [];

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


        //----------------------------------------------------
        // 全端末へ配信
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

                                hour12:
                                    false

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

                    //------------------------------------------------
                    // 現在位置更新
                    //------------------------------------------------

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


                    //------------------------------------------------
                    // 位置履歴保存
                    //------------------------------------------------

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
                        new Date(now)
                            .toLocaleString(
                                "ja-JP",
                                {

                                    timeZone:
                                        "Asia/Tokyo",

                                    hour12:
                                        false

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


//============================================================
// 起動
//============================================================

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
                "現在位置自動共有君 Version 2.3"
            );

            console.log(
                "server start port:",
                PORT
            );

            console.log(
                "交通規制自動更新:",
                "5分ごと"
            );


            if (
                TRAFFIC_API_URL
            ) {

                console.log(
                    "交通規制実データURL:",
                    TRAFFIC_API_URL
                );

            }
            else {

                console.log(
                    "交通規制実データURL: 未設定"
                );

                console.log(
                    "現在はテストデータを使用"
                );

            }


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