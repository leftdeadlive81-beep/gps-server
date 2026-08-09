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

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    transports: ["polling", "websocket"],
    allowUpgrades: true,
    pingInterval: 25000,
    pingTimeout: 60000
});

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
// 交通規制 自動更新間隔
//============================================================

const TRAFFIC_UPDATE_INTERVAL =
    3 * 24 * 60 * 60 * 1000;


//============================================================
// 国土交通省
//============================================================
//
// 国土交通省
// 「令和8年熊本地震 通れるマップ」
//
// 最新GISデータをページから自動検出する。
//============================================================

const MLIT_TRAFFIC_PAGE =
    "https://www.mlit.go.jp/road/saigai/r8kumamoto/index.html";


//============================================================
// 熊本県の概略範囲
//============================================================
//
// 全国GISデータが提供された場合に備え、
// 熊本県周辺だけを抽出するための範囲。
//
// ※最終的にはGeoJSONの座標を利用して判定する。
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
//
// 国交省データ取得に失敗した場合でも
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
// HTTP GET Buffer
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
            text.includes("時点データ") ||
            /\.zip(?:[?#].*)?$/i.test(href)
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
    // 最後の候補を最新データとして採用
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
// 座標が熊本県概略範囲内か
//============================================================

function isKumamotoCoordinate(
    lon,
    lat
) {

    if (
        !Number.isFinite(lon) ||
        !Number.isFinite(lat)
    ) {

        return false;

    }


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

function getGeometryRepresentativeCoordinate(
    geometry
) {

    if (!geometry) {

        return null;

    }


    //========================================================
    // Point
    //========================================================

    if (
        geometry.type === "Point"
    ) {

        const c =
            geometry.coordinates;


        if (
            Array.isArray(c) &&
            c.length >= 2
        ) {

            return {

                lon:
                    Number(c[0]),

                lat:
                    Number(c[1])

            };

        }

    }


    //========================================================
    // LineString
    //========================================================

    if (
        geometry.type === "LineString"
    ) {

        const coordinates =
            geometry.coordinates;


        if (
            Array.isArray(coordinates) &&
            coordinates.length > 0
        ) {

            const middle =
                coordinates[
                    Math.floor(
                        coordinates.length / 2
                    )
                ];


            return {

                lon:
                    Number(middle[0]),

                lat:
                    Number(middle[1])

            };

        }

    }


    //========================================================
    // MultiLineString
    //========================================================

    if (
        geometry.type === "MultiLineString"
    ) {

        const lines =
            geometry.coordinates;


        const allCoordinates = [];


        for (
            const line
            of lines || []
        ) {

            for (
                const coordinate
                of line || []
            ) {

                allCoordinates.push(
                    coordinate
                );

            }

        }


        if (
            allCoordinates.length > 0
        ) {

            const middle =
                allCoordinates[
                    Math.floor(
                        allCoordinates.length / 2
                    )
                ];


            return {

                lon:
                    Number(middle[0]),

                lat:
                    Number(middle[1])

            };

        }

    }


    //========================================================
    // Polygon
    //========================================================

    if (
        geometry.type === "Polygon"
    ) {

        const ring =
            geometry.coordinates?.[0];


        if (
            Array.isArray(ring) &&
            ring.length > 0
        ) {

            const middle =
                ring[
                    Math.floor(
                        ring.length / 2
                    )
                ];


            return {

                lon:
                    Number(middle[0]),

                lat:
                    Number(middle[1])

            };

        }

    }


    //========================================================
    // MultiPolygon
    //========================================================

    if (
        geometry.type === "MultiPolygon"
    ) {

        const firstPolygon =
            geometry.coordinates?.[0];

        const ring =
            firstPolygon?.[0];


        if (
            Array.isArray(ring) &&
            ring.length > 0
        ) {

            const middle =
                ring[
                    Math.floor(
                        ring.length / 2
                    )
                ];


            return {

                lon:
                    Number(middle[0]),

                lat:
                    Number(middle[1])

            };

        }

    }


    return null;

}


//============================================================
// GeoJSON Featureが熊本県内か
//============================================================

//============================================================
// GeoJSON Featureが
// 「熊本県」かつ「実際の通行規制あり」か判定
//============================================================

function isActualTrafficRegulationFeature(feature) {

    if (!feature) {

        return false;

    }


    const properties =
        feature.properties || {};


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


    for (
        const value
        of prefectureCandidates
    ) {

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {

            prefectureFound = true;


            const text =
                String(value).trim();


            if (
                text.includes("熊本")
            ) {

                isKumamoto = true;

            }


            break;

        }

    }


    //========================================================
    // 都道府県情報がある場合
    //========================================================

    if (
        prefectureFound &&
        !isKumamoto
    ) {

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


    for (
        const value
        of codeCandidates
    ) {

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {

            const code =
                String(value).trim();


            if (
                code !== "43" &&
                code !== "43.0"
            ) {

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

        const coordinate =
            getGeometryRepresentativeCoordinate(
                feature.geometry
            );


        if (!coordinate) {

            return false;

        }


        if (
            !isKumamotoCoordinate(
                coordinate.lon,
                coordinate.lat
            )
        ) {

            return false;

        }

    }


    //========================================================
    // ③ 実際の交通規制が存在するか
    //========================================================
    //
    // 国交省GISには道路データ等も含まれるため、
    // 「規制開始_内容」または「規制内容」が
    // 実際に設定されているFeatureだけを採用する。
    //
    //========================================================

    const regulationStartContent =
        String(
            properties.規制開始_内容 ??
            ""
        ).trim();


    const regulationContent =
        String(
            properties.規制内容 ??
            ""
        ).trim();


    const regulationType =
        String(
            properties.規制種別 ??
            ""
        ).trim();


    const regulationReason =
        String(
            properties.規制理由 ??
            ""
        ).trim();


    //========================================================
    // 規制内容が存在するもの
    //========================================================

    const hasRegulationContent =

        regulationStartContent !== "" ||

        regulationContent !== "";


    //========================================================
    // 規制種別・理由だけ存在する場合も対象
    //========================================================

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

        regulationStartContent +
        " " +
        regulationContent +
        " " +
        regulationType

    );


    if (
        combinedText.includes("解除")
    ) {

        return false;

    }


    return true;

}


//============================================================
// FeatureCollection統合
//============================================================
//
// 全国GeoJSONが入っていても、
// 熊本県内のFeatureだけを残す。
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

              if (
    !isActualTrafficRegulationFeature(
        feature
    )
) {
    continue;
}


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

           if (
    !isActualTrafficRegulationFeature(
        geojson
    )
) {
    continue;
}

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
        "国交省GeoJSON 熊本県抽出結果"
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
// GeoJSON → 既存trafficRegulations互換データ
//============================================================

function geoJSONToTrafficArray(geojson) {

    const result = [];


    for (
        let i = 0;
        i < geojson.features.length;
        i++
    ) {

        const feature =
            geojson.features[i];


        //====================================================
        // 実際の交通規制だけ
        //====================================================

        if (
            !isActualTrafficRegulationFeature(
                feature
            )
        ) {

            continue;

        }


        const geometry =
            feature.geometry;


        if (!geometry) {

            continue;

        }


        const coordinate =
            getGeometryRepresentativeCoordinate(
                geometry
            );


        if (!coordinate) {

            continue;

        }


        const properties =
            feature.properties || {};


        const route =

            properties.路線名 ||

            properties.路線 ||

            properties.道路名 ||

            properties.route_name ||

            properties.road_name ||

            properties.ROUTE_NAME ||

            "道路";


        //====================================================
        // 「規制開始_内容」を最優先
        //====================================================

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

            id:
                String(id),

            lat:
                coordinate.lat,

            lon:
                coordinate.lon,

            route:
                String(route),

            type:
                String(type),

            reason:
                String(reason),

            section:
                String(section),

            start:
                String(start),

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


    //========================================================
    // 最新ZIP URL取得
    //========================================================

    const zipUrl =
        await findMlitLatestGeoJsonZipUrl();


    //========================================================
    // ZIP取得
    //========================================================

    const zipBuffer =
        await httpGetBuffer(
            zipUrl
        );


    console.log(
        "国交省GIS ZIP取得:",
        zipBuffer.length,
        "bytes"
    );


    //========================================================
    // ZIP展開
    //========================================================

    const entries =
        extractZipEntries(
            zipBuffer
        );


    console.log(
        "ZIP内ファイル数:",
        entries.length
    );


    //========================================================
    // GeoJSON検索
    //========================================================

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
    // 熊本県だけに絞って統合
    //========================================================

    const geojson =
        mergeGeoJSON(
            geoJsonEntries
        );


    //========================================================
    // 内容確認
    //========================================================

    logGeoJSONProperties(
        geojson
    );


    //========================================================
    // 既存交通規制データへ変換
    //========================================================

    const regulations =
        geoJSONToTrafficArray(
            geojson
        );


    console.log(
        "国交省 熊本県道路規制:",
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
// adm-zip等の外部ライブラリを使用せず、
// ZIP中央ディレクトリを直接解析する。
// DeflateはNode.js標準 zlib.inflateRawSync()で展開。
//============================================================

function extractZipEntries(buffer) {

    const entries = [];


    //========================================================
    // End of Central Directory を後ろから探す
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
// JARTICは一切使用しない。
// 国土交通省GISのみを使用する。
//============================================================

async function fetchTrafficRegulations() {

    try {

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
            "国土交通省 熊本県交通規制:",
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
            "熊本県交通規制:",
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
//============================================================
// ユーザー復元
//============================================================

async function loadUsers() {

    try {

        const result =
            await pool.query(
                "SELECT * FROM users ORDER BY user_id"
            );


        result.rows.forEach(
            user => {

                users[
                    user.user_id
                ] = {

                    //========================================
                    // ユーザー基本情報
                    //========================================

                    user_id:
                        user.user_id,

                    display_name:
                        user.display_name,

                    account_name:
                        user.account_name,

                    role:
                        user.role || "user",

                    unit:
                        user.unit || "",

                    rank:
                        user.rank || "",

                    vehicle:
                        user.vehicle || "",

                    vehicle_type:
                        user.vehicle_type || "",

                    icon:
                        user.icon || "1",

                    phone:
                        user.phone || "",

                    status:
                        user.status || "",

                    status_next:
                        user.status_next || "",

                    health:
                        user.health || "",

                    destination:
                        user.destination || "",

                    //========================================
                    // 現在位置
                    //========================================

                    lat:
                        null,

                    lon:
                        null,

                    utmZone:
                        "52S",

                    utmE:
                        null,

                    utmN:
                        null,

                    //========================================
                    // 現在状態
                    //========================================

                    movement:
                        "",

                    online:
                        false,

                    lastUpdate:
                        null,

                    //========================================
                    // 物資
                    //========================================

                    water:
                        0,

                    fuel:
                        0

                };

            }
        );


        //====================================================
        // current_usersから現在位置・状態を復元
        //====================================================

        const currentResult =
            await pool.query(
                "SELECT * FROM current_users"
            );


        currentResult.rows.forEach(
            current => {

                const user =
                    users[
                        current.user_id
                    ];


                if (!user) {

                    return;

                }


                user.lat =
                    current.lat;

                user.lon =
                    current.lon;

                user.utmZone =
                    current.utmzone ||
                    "52S";

                user.utmE =
                    current.utme;

                user.utmN =
                    current.utmn;

                user.destination =
                    current.destination ||
                    user.destination;

                user.water =
                    current.water || 0;

                user.fuel =
                    current.fuel || 0;

                user.icon =
                    current.icontype ||
                    user.icon ||
                    "1";

                user.online =
                    Boolean(
                        current.online
                    );

                user.lastUpdate =
                    current.lastupdate;

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


            //================================================
            // user_id 必須
            //================================================

            if (
                !data ||
                !data.user_id
            ) {

                console.log(
                    "ユーザー登録拒否: user_idなし"
                );

                return;

            }


            const userId =
                String(
                    data.user_id
                ).trim();


            //================================================
            // 既存ユーザー
            //================================================

            const oldUser =
                users[
                    userId
                ];


            //================================================
            // ユーザー情報
            //================================================

            const user = {

                //============================================
                // ユーザー基本情報
                //============================================

                user_id:
                    userId,

                display_name:
                    data.display_name ||
                    (
                        oldUser
                            ?
                            oldUser.display_name
                            :
                            ""
                    ),

                account_name:
                    data.account_name ||
                    (
                        oldUser
                            ?
                            oldUser.account_name
                            :
                            ""
                    ),

                role:
                    data.role ||
                    (
                        oldUser
                            ?
                            oldUser.role
                            :
                            "user"
                    ),

                unit:
                    data.unit ||
                    (
                        oldUser
                            ?
                            oldUser.unit
                            :
                            ""
                    ),

                rank:
                    data.rank ||
                    (
                        oldUser
                            ?
                            oldUser.rank
                            :
                            ""
                    ),

                vehicle:
                    data.vehicle ||
                    (
                        oldUser
                            ?
                            oldUser.vehicle
                            :
                            ""
                    ),

                vehicle_type:
                    data.vehicle_type ||
                    (
                        oldUser
                            ?
                            oldUser.vehicle_type
                            :
                            ""
                    ),

                icon:
                    data.icon ||
                    (
                        oldUser
                            ?
                            oldUser.icon
                            :
                            "1"
                    ),

                phone:
                    data.phone ||
                    (
                        oldUser
                            ?
                            oldUser.phone
                            :
                            ""
                    ),

                status:
                    data.status ||
                    (
                        oldUser
                            ?
                            oldUser.status
                            :
                            ""
                    ),

                status_next:
                    data.status_next ||
                    (
                        oldUser
                            ?
                            oldUser.status_next
                            :
                            ""
                    ),

                health:
                    data.health ||
                    (
                        oldUser
                            ?
                            oldUser.health
                            :
                            ""
                    ),

                destination:
                    data.destination ||
                    (
                        oldUser
                            ?
                            oldUser.destination
                            :
                            ""
                    ),

                //============================================
                // 現在位置
                //============================================

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

                //============================================
                // 状態
                //============================================

                movement:
                    data.movement ||
                    (
                        oldUser
                            ?
                            oldUser.movement
                            :
                            ""
                    ),

                online:
                    true,

                lastUpdate:
                    now,

                //============================================
                // 物資
                //============================================

                water:
                    Number(
                        data.water
                    ) ||
                    0,

                fuel:
                    Number(
                        data.fuel
                    ) ||
                    0

            };


            //================================================
            // メモリ更新
            //================================================

            users[
                userId
            ] =
                user;


            //================================================
            // users テーブル
            //================================================

            await pool.query(

                `
                INSERT INTO users
                (
                    user_id,
                    display_name,
                    account_name,
                    role,
                    unit,
                    rank,
                    vehicle,
                    vehicle_type,
                    icon,
                    phone,
                    status,
                    status_next,
                    health,
                    destination,
                    updated_at
                )

                VALUES
                (
                    $1,$2,$3,$4,$5,$6,$7,
                    $8,$9,$10,$11,$12,$13,$14,$15
                )

                ON CONFLICT(user_id)

                DO UPDATE SET

                    display_name=$2,
                    account_name=$3,
                    role=$4,
                    unit=$5,
                    rank=$6,
                    vehicle=$7,
                    vehicle_type=$8,
                    icon=$9,
                    phone=$10,
                    status=$11,
                    status_next=$12,
                    health=$13,
                    destination=$14,
                    updated_at=$15
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

                    now

                ]

            );


            //================================================
            // current_users
            //================================================

            await pool.query(

                `
                INSERT INTO current_users
                (
                    user_id,
                    name,
                    lat,
                    lon,
                    utmzone,
                    utme,
                    utmn,
                    water,
                    fuel,
                    destination,
                    icontype,
                    online,
                    lastupdate,
                    device_id
                )

                VALUES
                (
                    $1,$2,$3,$4,$5,$6,$7,
                    $8,$9,$10,$11,$12,$13,$14
                )

                ON CONFLICT(user_id)

                DO UPDATE SET

                    name=$2,
                    lat=$3,
                    lon=$4,
                    utmzone=$5,
                    utme=$6,
                    utmn=$7,
                    water=$8,
                    fuel=$9,
                    destination=$10,
                    icontype=$11,
                    online=$12,
                    lastupdate=$13,
                    device_id=$14
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


            console.log(
                "ユーザー登録:",
                user.user_id,
                user.display_name
            );


            //================================================
            // 全端末へ配信
            //================================================

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
//
// ・user_idを基準にGPSを管理
// ・未登録ユーザーのGPSは拒否
// ・緯度 / 経度をチェック
// ・UTM座標対応
// ・current_usersへ現在位置を保存
// ・location_historyへ位置履歴を保存
// ・全接続端末へリアルタイム配信
//
// ※ ユーザー登録時の基本情報はGPS更新で消さない
// ※ Web版・アプリ版の両方から同じlocationイベントを使用可能
//
//====================================================

socket.on(
    "location",
    async data => {

        try {

            //================================================
            // ① GPSデータ存在確認
            //================================================

            if (
                !data ||
                typeof data !== "object"
            ) {

                console.log(
                    "GPS受信拒否: データなし"
                );

                return;

            }


            //================================================
            // ② user_id取得
            //================================================
            //
            // 基本はuser_idを使用。
            // 旧クライアントとの互換性のため
            // data.nameも予備として使用。
            //
            //================================================

            const userId =
                String(
                    data.user_id ||
                    data.name ||
                    ""
                ).trim();


            if (!userId) {

                console.log(
                    "GPS受信拒否: user_idなし"
                );

                return;

            }


            //================================================
            // ③ 登録ユーザー確認
            //================================================

            const oldUser =
                users[userId];


            if (!oldUser) {

                console.log(
                    "未登録GPS拒否:",
                    userId
                );

                return;

            }


            //================================================
            // ④ 現在時刻
            //================================================

            const now =
                Date.now();


            //================================================
            // ⑤ 表示名
            //================================================

            const displayName =
                String(
                    oldUser.display_name ||
                    data.display_name ||
                    data.name ||
                    userId
                ).trim();


            //================================================
            // ⑥ 緯度・経度
            //================================================

            const lat =
                Number(
                    data.lat
                );


            const lon =
                Number(
                    data.lon
                );


            //================================================
            // ⑦ GPS座標チェック
            //================================================

            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lon)
            ) {

                console.log(
                    "GPS受信拒否: 座標不正",
                    {
                        user_id:
                            userId,

                        lat:
                            data.lat,

                        lon:
                            data.lon
                    }
                );

                return;

            }


            //================================================
            // 緯度範囲チェック
            //================================================

            if (
                lat < -90 ||
                lat > 90
            ) {

                console.log(
                    "GPS受信拒否: 緯度範囲外",
                    lat
                );

                return;

            }


            //================================================
            // 経度範囲チェック
            //================================================

            if (
                lon < -180 ||
                lon > 180
            ) {

                console.log(
                    "GPS受信拒否: 経度範囲外",
                    lon
                );

                return;

            }


            //================================================
            // ⑧ UTM
            //================================================

            const utmZone =
                String(
                    data.utmZone ||
                    oldUser.utmZone ||
                    "52S"
                );


            const utmEValue =
                Number(
                    data.utmE
                );


            const utmNValue =
                Number(
                    data.utmN
                );


            const utmE =
                Number.isFinite(
                    utmEValue
                )
                    ?
                    utmEValue
                    :
                    (
                        oldUser.utmE ??
                        null
                    );


            const utmN =
                Number.isFinite(
                    utmNValue
                )
                    ?
                    utmNValue
                    :
                    (
                        oldUser.utmN ??
                        null
                    );


            //================================================
            // ⑨ 物資情報
            //================================================

            const waterValue =
                Number(
                    data.water
                );


            const fuelValue =
                Number(
                    data.fuel
                );


            const water =
                Number.isFinite(
                    waterValue
                )
                    ?
                    waterValue
                    :
                    (
                        Number(
                            oldUser.water
                        ) || 0
                    );


            const fuel =
                Number.isFinite(
                    fuelValue
                )
                    ?
                    fuelValue
                    :
                    (
                        Number(
                            oldUser.fuel
                        ) || 0
                    );


            //================================================
            // ⑩ 行動・目的地
            //================================================

            const movement =
                data.movement ??
                oldUser.movement ??
                "";


            const destination =
                data.destination ??
                oldUser.destination ??
                "";


            //================================================
            // ⑪ アイコン
            //================================================

            const iconType =
                String(
                    data.iconType ||
                    data.icon ||
                    oldUser.icon ||
                    "1"
                );


            //================================================
            // ⑫ メモリ上のユーザー情報更新
            //================================================
            //
            // spreadでoldUserを残すことで、
            //
            // display_name
            // account_name
            // role
            // unit
            // rank
            // vehicle
            // vehicle_type
            // phone
            // status
            // status_next
            // health
            //
            // などをGPS更新で消さない。
            //
            //================================================

            users[userId] = {

                ...oldUser,

                user_id:
                    userId,

                name:
                    displayName,

                display_name:
                    displayName,

                lat:
                    lat,

                lon:
                    lon,

                utmZone:
                    utmZone,

                utmE:
                    utmE,

                utmN:
                    utmN,

                movement:
                    movement,

                destination:
                    destination,

                water:
                    water,

                fuel:
                    fuel,

                icon:
                    iconType,

                iconType:
                    iconType,

                online:
                    true,

                lastUpdate:
                    now

            };


            //================================================
            // ⑬ usersテーブル更新
            //================================================
            //
            // GPS受信時にusersテーブル全体を更新せず、
            // GPSに関連する項目だけ更新する。
            //
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

                [

                    userId,

                    destination,

                    iconType,

                    now

                ]

            );


            //================================================
            // ⑭ current_users更新
            //================================================
            //
            // まず既存ユーザーをUPDATEする。
            //
            //================================================

            const currentResult =
                await pool.query(

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

                        data.device_id ||
                        userId

                    ]

                );


            //================================================
            // ⑮ current_usersに存在しない場合
            //================================================
            //
            // UPDATE対象がなかった場合はINSERT。
            //
            //================================================

            if (
                currentResult.rowCount === 0
            ) {

                await pool.query(

                    `
                    INSERT INTO current_users
                    (
                        user_id,
                        name,
                        lat,
                        lon,
                        utmzone,
                        utme,
                        utmn,
                        water,
                        fuel,
                        destination,
                        icontype,
                        online,
                        lastupdate,
                        device_id
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11,
                        $12,
                        $13,
                        $14
                    )

                    ON CONFLICT(user_id)

                    DO UPDATE SET

                        name =
                            EXCLUDED.name,

                        lat =
                            EXCLUDED.lat,

                        lon =
                            EXCLUDED.lon,

                        utmzone =
                            EXCLUDED.utmzone,

                        utme =
                            EXCLUDED.utme,

                        utmn =
                            EXCLUDED.utmn,

                        water =
                            EXCLUDED.water,

                        fuel =
                            EXCLUDED.fuel,

                        destination =
                            EXCLUDED.destination,

                        icontype =
                            EXCLUDED.icontype,

                        online =
                            EXCLUDED.online,

                        lastupdate =
                            EXCLUDED.lastupdate,

                        device_id =
                            EXCLUDED.device_id
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

                        data.device_id ||
                        userId

                    ]

                );

            }


            //================================================
            // ⑯ GPS位置履歴保存
            //================================================
            //
            // location_historyに1件保存。
            //
            //================================================

            await pool.query(

                `
                INSERT INTO location_history
                (
                    name,
                    lat,
                    lon,
                    water,
                    fuel,
                    destination,
                    created,
                    user_id
                )

                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                )
                `,

                [

                    displayName,

                    lat,

                    lon,

                    water,

                    fuel,

                    destination,

                    now,

                    userId

                ]

            );


            //================================================
            // ⑰ 全端末へ最新位置を配信
            //================================================

            io.emit(
                "locations",
                users
            );


            //================================================
            // ⑱ サーバーログ
            //================================================

            console.log(
                "GPS更新:",
                userId,
                displayName,
                lat,
                lon
            );

        }
        catch (err) {

            //================================================
            // GPS処理全体のエラー
            //================================================

            console.error(
                "GPS位置情報保存エラー:",
                err
            );

        }

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
                "国土交通省GIS"
            );

            console.log(
                "対象地域:",
                "熊本県"
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