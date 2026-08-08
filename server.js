//============================================================
// 現在位置自動共有君 Version 2.3
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
// ・国土交通省「令和8年熊本地震 通れるマップ」GIS
// ・交通規制3日ごと自動更新
// ・接続中全端末へ自動配信
//
// ※ JARTICは使用しません
// ※ adm-zip は使用しません
// ※ ZIP展開は Node.js 標準 zlib で処理
//============================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const zlib = require("zlib");

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
// 交通規制自動更新間隔
//============================================================

const TRAFFIC_UPDATE_INTERVAL =
    3 * 24 * 60 * 60 * 1000;


//============================================================
// 国土交通省
// 「令和8年熊本地震 通れるマップ」
//============================================================

const MLIT_TRAFFIC_PAGE =
    "https://www.mlit.go.jp/road/saigai/r8kumamoto/index.html";


//============================================================
// 交通規制テストデータ
//============================================================
//
// 実データ取得に失敗した場合でも、
// 既存の🚧表示機能を壊さない。
//============================================================

function getTrafficTestData() {

    return [

        {

            id:
                "test-traffic",

            lat:
                32.803,

            lon:
                130.707,

            route:
                "テスト道路",

            type:
                "通行止め",

            reason:
                "交通規制データ取得テスト",

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

            source:
                "プッたん テストデータ"

        }

    ];

}


//============================================================
// HTTP GET
//============================================================

async function httpGetBuffer(url) {

    const response =
        await fetch(
            url,
            {

                headers: {

                    "User-Agent":
                        "Puttan/2.3 traffic data client"

                }

            }
        );


    if (!response.ok) {

        throw new Error(
            "HTTP " +
            response.status +
            " " +
            response.statusText
        );

    }


    const arrayBuffer =
        await response.arrayBuffer();


    return Buffer.from(
        arrayBuffer
    );

}


//============================================================
// 国土交通省ページから最新GIS ZIP URLを取得
//============================================================

async function findMlitLatestGeoJsonZipUrl() {

    console.log(
        "国土交通省 道路規制GIS URLを検索しています..."
    );


    const response =
        await fetch(
            MLIT_TRAFFIC_PAGE,
            {

                headers: {

                    "User-Agent":
                        "Mozilla/5.0 (compatible; Puttan/2.3)"

                }

            }
        );


    if (!response.ok) {

        throw new Error(
            "国交省ページ取得失敗: HTTP " +
            response.status
        );

    }


    const html =
        await response.text();


    console.log(
        "国交省ページ取得:",
        html.length,
        "bytes"
    );


    //========================================================
    // aタグを取得
    //========================================================

    const anchorPattern =
        /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;


    const candidates = [];

    let match;


    while (
        (match =
            anchorPattern.exec(html))
        !== null
    ) {

        const href =
            match[1];

        const rawText =
            match[2];


        const text =
            rawText
                .replace(
                    /<[^>]+>/g,
                    " "
                )
                .replace(
                    /&nbsp;/gi,
                    " "
                )
                .replace(
                    /&amp;/gi,
                    "&"
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        //====================================================
        // 「時点データ」のリンクを候補にする
        //====================================================

        if (
            text.includes("時点データ")
        ) {

            candidates.push({

                text:
                    text,

                href:
                    href

            });

        }

    }


    console.log(
        "国交省GIS候補:",
        candidates
    );


    if (
        candidates.length === 0
    ) {

        throw new Error(
            "国交省ページからGISデータリンクを取得できませんでした"
        );

    }


    //========================================================
    // 最後の時点データを採用
    //========================================================

    const selected =
        candidates[
            candidates.length - 1
        ];


    const url =
        new URL(
            selected.href,
            MLIT_TRAFFIC_PAGE
        ).href;


    console.log(
        "================================"
    );

    console.log(
        "国交省GIS URL確定:"
    );

    console.log(
        url
    );

    console.log(
        "データ:",
        selected.text
    );

    console.log(
        "================================"
    );


    return url;

}


//============================================================
// GeoJSON判定
//============================================================

function isGeoJSON(data) {

    if (!data) {

        return false;

    }


    return (
        data.type === "FeatureCollection" ||
        data.type === "Feature"
    );

}


//============================================================
// ZIP内からGeoJSONを探す
//============================================================

function findGeoJSONEntries(entries) {

    const results = [];


    for (
        const entry
        of entries
    ) {

        if (
            !/\.(geojson|json)$/i.test(
                entry.name
            )
        ) {

            continue;

        }


        try {

            const text =
                entry.data.toString(
                    "utf8"
                );


            const json =
                JSON.parse(
                    text
                );


            if (
                isGeoJSON(json)
            ) {

                results.push({

                    name:
                        entry.name,

                    geojson:
                        json

                });

            }

        }
        catch {

            // JSONでないファイルは無視

        }

    }


    return results;

}


//============================================================
// FeatureCollection統合
//============================================================

function mergeGeoJSON(
    geoJsonEntries
) {

    const features = [];


    for (
        const entry
        of geoJsonEntries
    ) {

        const geojson =
            entry.geojson;


        if (
            geojson.type ===
            "FeatureCollection"
        ) {

            for (
                const feature
                of geojson.features || []
            ) {

                features.push({

                    ...feature,

                    properties: {

                        ...(feature.properties || {}),

                        _puttan_source_file:
                            entry.name

                    }

                });

            }

        }

        else if (
            geojson.type ===
            "Feature"
        ) {

            features.push({

                ...geojson,

                properties: {

                    ...(geojson.properties || {}),

                    _puttan_source_file:
                        entry.name

                }

            });

        }

    }


    return {

        type:
            "FeatureCollection",

        features:
            features

    };

}


//============================================================
// GeoJSON properties確認
//============================================================

function logGeoJSONProperties(
    geojson
) {

    console.log(
        "================================"
    );

    console.log(
        "国交省GeoJSON properties確認"
    );

    console.log(
        "Feature数:",
        geojson.features.length
    );


    const propertyNames =
        new Set();


    for (
        const feature
        of geojson.features
    ) {

        const properties =
            feature.properties || {};


        Object.keys(
            properties
        )
        .forEach(
            key =>
                propertyNames.add(
                    key
                )
        );

    }


    console.log(
        "properties項目:"
    );


    console.log(
        Array.from(
            propertyNames
        )
    );


    //========================================================
    // 最初のFeature
    //========================================================

    if (
        geojson.features.length > 0
    ) {

        console.log(
            "最初のFeature:"
        );

        console.log(
            JSON.stringify(
                geojson.features[0],
                null,
                2
            )
        );

    }


    console.log(
        "================================"
    );

}


//============================================================
// GeoJSON → trafficRegulations互換データ
//============================================================

function geoJSONToTrafficArray(
    geojson
) {

    const result = [];


    for (
        let i = 0;
        i < geojson.features.length;
        i++
    ) {

        const feature =
            geojson.features[i];


        const geometry =
            feature.geometry;


        if (!geometry) {

            continue;

        }


        let lat = null;

        let lon = null;


        //====================================================
        // Point
        //====================================================

        if (
            geometry.type ===
            "Point"
        ) {

            const coordinates =
                geometry.coordinates;


            if (
                Array.isArray(
                    coordinates
                ) &&
                coordinates.length >= 2
            ) {

                lon =
                    Number(
                        coordinates[0]
                    );

                lat =
                    Number(
                        coordinates[1]
                    );

            }

        }


        //====================================================
        // LineString
        //====================================================

        else if (
            geometry.type ===
            "LineString"
        ) {

            const coordinates =
                geometry.coordinates;


            if (
                coordinates.length > 0
            ) {

                const middle =
                    coordinates[
                        Math.floor(
                            coordinates.length / 2
                        )
                    ];


                lon =
                    Number(
                        middle[0]
                    );

                lat =
                    Number(
                        middle[1]
                    );

            }

        }


        //====================================================
        // MultiLineString
        //====================================================

        else if (
            geometry.type ===
            "MultiLineString"
        ) {

            const lines =
                geometry.coordinates;


            if (
                lines.length > 0 &&
                lines[0].length > 0
            ) {

                const middle =
                    lines[0][
                        Math.floor(
                            lines[0].length / 2
                        )
                    ];


                lon =
                    Number(
                        middle[0]
                    );

                lat =
                    Number(
                        middle[1]
                    );

            }

        }


        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
        ) {

            continue;

        }


        const properties =
            feature.properties || {};


        result.push({

            id:
                properties.id ||
                properties.ID ||
                properties.objectid ||
                "mlit-" + i,

            lat:
                lat,

            lon:
                lon,

            route:
                properties.路線名 ||
                properties.路線 ||
                properties.道路名 ||
                properties.route_name ||
                properties.road_name ||
                "道路",

            type:
                properties.規制内容 ||
                properties.規制種別 ||
                properties.規制名称 ||
                properties.regulation_type ||
                "道路規制",

            reason:
                properties.規制理由 ||
                properties.原因 ||
                properties.reason ||
                "",

            section:
                properties.規制区間 ||
                properties.区間 ||
                properties.section ||
                "",

            start:
                properties.規制開始日時 ||
                properties.開始日時 ||
                properties.start ||
                "",

            source:
                "国土交通省",

            properties:
                properties

        });

    }


    return result;

}


//============================================================
// 国土交通省交通規制取得
//============================================================

async function fetchMlitTrafficRegulations() {

    console.log(
        "国土交通省 道路規制情報取得開始"
    );


    const zipUrl =
        await findMlitLatestGeoJsonZipUrl();


    const zipBuffer =
        await httpGetBuffer(
            zipUrl
        );


    console.log(
        "国交省GIS ZIP取得:",
        zipBuffer.length,
        "bytes"
    );


    const entries =
        extractZipEntries(
            zipBuffer
        );


    console.log(
        "ZIP内ファイル数:",
        entries.length
    );


    const geoJsonEntries =
        findGeoJSONEntries(
            entries
        );


    console.log(
        "GeoJSONファイル数:",
        geoJsonEntries.length
    );


    if (
        geoJsonEntries.length === 0
    ) {

        throw new Error(
            "ZIP内にGeoJSONが見つかりません"
        );

    }


    //========================================================
    // 複数GeoJSONを統合
    //========================================================

    const geojson =
        mergeGeoJSON(
            geoJsonEntries
        );


    //========================================================
    // properties確認
    //========================================================

    logGeoJSONProperties(
        geojson
    );


    const regulations =
        geoJSONToTrafficArray(
            geojson
        );


    console.log(
        "国交省道路規制:",
        regulations.length,
        "件"
    );


    return {

        geojson:
            geojson,

        regulations:
            regulations

    };

}


//============================================================
// ZIP解析
//============================================================
//
// 外部ライブラリは使用しない。
// ZIP中央ディレクトリを直接解析する。
// DeflateはNode.js標準 zlib.inflateRawSync() で展開。
//============================================================

function extractZipEntries(buffer) {

    const entries = [];


    //========================================================
    // End of Central Directoryを後ろから探す
    //========================================================

    let eocdOffset = -1;


    const minimumEOCD =
        Math.max(
            0,
            buffer.length - 65557
        );


    for (
        let i = buffer.length - 22;
        i >= minimumEOCD;
        i--
    ) {

        if (
            buffer.readUInt32LE(i)
            ===
            0x06054b50
        ) {

            eocdOffset =
                i;

            break;

        }

    }


    if (
        eocdOffset < 0
    ) {

        throw new Error(
            "ZIP End of Central Directory が見つかりません"
        );

    }


    const totalEntries =
        buffer.readUInt16LE(
            eocdOffset + 10
        );


    const centralDirectorySize =
        buffer.readUInt32LE(
            eocdOffset + 12
        );


    const centralDirectoryOffset =
        buffer.readUInt32LE(
            eocdOffset + 16
        );


    let offset =
        centralDirectoryOffset;


    for (
        let i = 0;
        i < totalEntries;
        i++
    ) {

        if (
            buffer.readUInt32LE(offset)
            !==
            0x02014b50
        ) {

            throw new Error(
                "ZIP Central Directory が不正です"
            );

        }


        const compressionMethod =
            buffer.readUInt16LE(
                offset + 10
            );


        const compressedSize =
            buffer.readUInt32LE(
                offset + 20
            );


        const uncompressedSize =
            buffer.readUInt32LE(
                offset + 24
            );


        const fileNameLength =
            buffer.readUInt16LE(
                offset + 28
            );


        const extraLength =
            buffer.readUInt16LE(
                offset + 30
            );


        const commentLength =
            buffer.readUInt16LE(
                offset + 32
            );


        const localHeaderOffset =
            buffer.readUInt32LE(
                offset + 42
            );


        const fileNameBuffer =
            buffer.subarray(
                offset + 46,
                offset +
                46 +
                fileNameLength
            );


        let fileName;


        try {

            fileName =
                new TextDecoder(
                    "utf-8"
                )
                .decode(
                    fileNameBuffer
                );

        }
        catch {

            fileName =
                fileNameBuffer.toString(
                    "utf8"
                );

        }


        offset +=
            46 +
            fileNameLength +
            extraLength +
            commentLength;


        //====================================================
        // ディレクトリは無視
        //====================================================

        if (
            fileName.endsWith("/")
        ) {

            continue;

        }


        //====================================================
        // Local File Header
        //====================================================

        if (
            buffer.readUInt32LE(
                localHeaderOffset
            )
            !==
            0x04034b50
        ) {

            console.log(
                "ZIP Local Header不正:",
                fileName
            );

            continue;

        }


        const localFileNameLength =
            buffer.readUInt16LE(
                localHeaderOffset + 26
            );


        const localExtraLength =
            buffer.readUInt16LE(
                localHeaderOffset + 28
            );


        const dataStart =
            localHeaderOffset +
            30 +
            localFileNameLength +
            localExtraLength;


        const compressedData =
            buffer.subarray(

                dataStart,

                dataStart +
                compressedSize

            );


        let data;


        try {

            if (
                compressionMethod === 0
            ) {

                // Stored
                data =
                    Buffer.from(
                        compressedData
                    );

            }

            else if (
                compressionMethod === 8
            ) {

                // Deflate
                data =
                    zlib.inflateRawSync(
                        compressedData
                    );

            }

            else {

                console.log(
                    "未対応ZIP圧縮方式:",
                    compressionMethod,
                    fileName
                );

                continue;

            }

        }

        catch (err) {

            console.error(
                "ZIP展開エラー:",
                fileName,
                err
            );

            continue;

        }


        entries.push({

            name:
                fileName,

            data:
                data,

            compressedSize:
                compressedSize,

            uncompressedSize:
                uncompressedSize

        });

    }


    console.log(
        "ZIP展開ファイル数:",
        entries.length
    );


    return entries;

}


//============================================================
// 交通規制取得
//============================================================
//
// JARTICは使用しない。
// 国土交通省GISのみを使用する。
//============================================================

async function fetchTrafficRegulations() {

    try {

        console.log(
            "================================"
        );

        console.log(
            "国土交通省交通規制取得開始"
        );


        const result =
            await fetchMlitTrafficRegulations();


        if (
            !result ||
            !Array.isArray(
                result.regulations
            )
        ) {

            throw new Error(
                "国土交通省交通規制データが不正です"
            );

        }


        console.log(
            "国土交通省交通規制:",
            result.regulations.length,
            "件"
        );


        return result.regulations;

    }

    catch (err) {

        console.error(
            "国土交通省交通規制取得エラー:",
            err
        );


        console.log(
            "既存の交通規制テストデータを使用します"
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
                        )
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

                users[
                    user.name
                ] = {

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
        // 初期データ
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
            async data => {

                try {

                    const now =
                        Date.now();


                    const oldUser =
                        users[
                            data.name
                        ];


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
                            ) ||
                            0,

                        fuel:
                            Number(
                                data.fuel
                            ) ||
                            0,

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


                    users[
                        data.name
                    ] =
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
        // GPS位置情報
        //====================================================

        socket.on(
            "location",
            async data => {

                if (
                    !users[
                        data.name
                    ]
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


                users[
                    data.name
                ] =
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
                    // 位置履歴
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
                        )
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
                    chronology.length >
                    100
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

                delete users[
                    name
                ];


                try {

                    await pool.query(

                        "DELETE FROM current_users WHERE name=$1",

                        [
                            name
                        ]

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

                delete points[
                    name
                ];


                try {

                    await pool.query(

                        "DELETE FROM points WHERE name=$1",

                        [
                            name
                        ]

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
    process.env.PORT ||
    10000;


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
                "交通規制データ:",
                "国土交通省 熊本県 通れるマップ GIS"
            );

            console.log(
                "交通規制自動更新:",
                "3日ごと"
            );

            console.log(
                "ZIP処理:",
                "Node.js標準 zlib"
            );

            console.log(
                "adm-zip:",
                "使用しません"
            );

            console.log(
                "JARTIC:",
                "使用しません"
            );

            console.log(
                "================================"
            );


            //================================================
            // 起動直後に1回取得
            //================================================

            await updateTrafficRegulations();


            //================================================
            // 3日ごとに更新
            //================================================

            setInterval(

                updateTrafficRegulations,

                TRAFFIC_UPDATE_INTERVAL

            );

        }

    );

}


startServer();