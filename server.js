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
// ・国土交通省GIS
// ・交通規制3日ごと自動更新
// ・接続中全端末へ自動配信
//
// ※ JARTICは使用しません
// ※ adm-zipは使用しません
// ※ ZIP展開はNode.js標準 zlib
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
// 交通規制自動更新
//============================================================

const TRAFFIC_UPDATE_INTERVAL =
    3 * 24 * 60 * 60 * 1000;


//============================================================
// 国土交通省
// 令和8年熊本地震 通れるマップ
//============================================================

const MLIT_TRAFFIC_PAGE =
    "https://www.mlit.go.jp/road/saigai/r8kumamoto/index.html";


//============================================================
// テストデータ
//============================================================
//
// 国土交通省GIS取得に失敗した場合に使用。
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

                            hour12: false
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
    // ページ掲載順の最後を最新として採用
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

        data.type ===
        "FeatureCollection"

        ||

        data.type ===
        "Feature"

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

            // GeoJSONでないJSONは無視

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
// GeoJSON → trafficRegulations
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


    const geojson =
        mergeGeoJSON(
            geoJsonEntries
        );


    logGeoJSONProperties(
        geojson
    );


    const regulations =
        geoJSONToTrafficArray(
            geojson
        );


    console.log(
        "国土交通省道路規制:",
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
// Deflate → zlib.inflateRawSync()
//============================================================

function extractZipEntries(buffer) {

    const entries = [];


    //========================================================
    // End of Central Directory
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
            buffer.readUInt32LE(
                offset
            )
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

                data =
                    Buffer.from(
                        compressedData
                    );

            }

            else if (
                compressionMethod === 8
            ) {

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

async function fetchTrafficRegulations() {

    try {

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


        return result.regulations;

    }
    catch (err) {

        console.error(
            "国土交通省交通規制取得エラー:",
            err
        );


        console.log(
            "交通規制テストデータを使用します"
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