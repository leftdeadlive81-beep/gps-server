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
// ・接続中全端末へ自動配信
//
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

// JARTICのオープンデータは
// 毎月更新されるため、5分ごとの取得は不要。
//
//
// ここでは1時間ごとにチェックする。
// 同じデータの場合は再配信しない。

const TRAFFIC_UPDATE_INTERVAL =
    60 * 60 * 1000;


//============================================================
// JARTIC
//============================================================
//
// JARTICは交通規制オープンデータを
// 都道府県別ZIPファイルで公開している。
//
// 現在公開されている交通規制情報は
// 2026年05月分。
//
// 熊本県も公開対象。
//============================================================

const JARTIC_OPEN_DATA_URL =
    "https://www.jartic.or.jp/service/opendata/";


//============================================================
// HTTP取得
//============================================================

async function fetchText(url) {

    const response =
        await fetch(url, {

            headers: {

                "User-Agent":
                    "Puttan-Version-2.3"

            }

        });


    if (!response.ok) {

        throw new Error(
            "HTTP " +
            response.status +
            " " +
            response.statusText
        );

    }


    return await response.text();

}


//============================================================
// JARTIC公開ページから
// 熊本県ZIPのURLを探す
//============================================================

async function findKumamotoZipUrl() {

    const html =
        await fetchText(
            JARTIC_OPEN_DATA_URL
        );


    //--------------------------------------------------------
    // 熊本県のリンクを探す
    //--------------------------------------------------------

    const links = [];

    const regex =
        /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;


    let match;


    while (
        (match = regex.exec(html))
        !== null
    ) {

        const href =
            match[1];

        const text =
            match[2]
                .replace(/<[^>]+>/g, "")
                .trim();


        if (
            text.includes("熊本県")
        ) {

            links.push(href);

        }

    }


    //--------------------------------------------------------
    // ZIPリンクを優先
    //--------------------------------------------------------

    let zip =
        links.find(
            url =>
                url
                    .toLowerCase()
                    .includes(".zip")
        );


    //--------------------------------------------------------
    // 相対URLの場合
    //--------------------------------------------------------

    if (zip) {

        return new URL(
            zip,
            JARTIC_OPEN_DATA_URL
        ).href;

    }


    //--------------------------------------------------------
    // 熊本県リンクが見つからない場合
    //--------------------------------------------------------

    throw new Error(
        "JARTIC公開ページから熊本県ZIPを取得できませんでした"
    );

}


//============================================================
// ZIP / CSV取得
//============================================================
//
// 注意：
// JARTICの交通規制データはZIP内にCSVが入っている。
// そのため本番環境では unzipper を使用する。
//
// package.json に以下を追加すること:
//
// "unzipper": "^0.12.0"
// "iconv-lite": "^0.6.3"
//============================================================

async function downloadKumamotoTrafficCSV() {

    const zipUrl =
        await findKumamotoZipUrl();


    console.log(
        "JARTIC熊本県データ:",
        zipUrl
    );


    const response =
        await fetch(zipUrl, {

            headers: {

                "User-Agent":
                    "Puttan-Version-2.3"

            }

        });


    if (!response.ok) {

        throw new Error(
            "熊本県ZIP取得失敗 HTTP " +
            response.status
        );

    }


    const arrayBuffer =
        await response.arrayBuffer();


    const buffer =
        Buffer.from(
            arrayBuffer
        );


    const unzipper =
        require("unzipper");


    const iconv =
        require("iconv-lite");


    const directory =
        await unzipper.Open.buffer(
            buffer
        );


    //--------------------------------------------------------
    // CSVを探す
    //--------------------------------------------------------

    const csvFile =
        directory.files.find(
            file =>
                file.path
                    .toLowerCase()
                    .endsWith(".csv")
        );


    if (!csvFile) {

        throw new Error(
            "熊本県ZIP内にCSVがありません"
        );

    }


    const csvBuffer =
        await csvFile.buffer();


    //--------------------------------------------------------
    // JARTIC CSVはShift-JIS
    //--------------------------------------------------------

    const csvText =
        iconv.decode(
            csvBuffer,
            "Shift_JIS"
        );


    return csvText;

}


//============================================================
// CSV解析
//============================================================
//
// JARTIC拡張版標準フォーマットは
// 項目数が多いため、ここではヘッダー名から
// 必要項目を探す。
//
//============================================================

function parseCSVLine(line) {

    const result = [];

    let current = "";

    let insideQuote = false;


    for (
        let i = 0;
        i < line.length;
        i++
    ) {

        const c =
            line[i];


        if (c === '"') {

            if (
                insideQuote &&
                line[i + 1] === '"'
            ) {

                current += '"';

                i++;

            }
            else {

                insideQuote =
                    !insideQuote;

            }

        }
        else if (
            c === "," &&
            !insideQuote
        ) {

            result.push(
                current
            );

            current = "";

        }
        else {

            current += c;

        }

    }


    result.push(
        current
    );


    return result;

}


//============================================================
// CSV全文解析
//============================================================

function parseTrafficCSV(csvText) {

    const lines =
        csvText
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
        parseCSVLine(
            lines[0]
        );


    const rows = [];


    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        const values =
            parseCSVLine(
                lines[i]
            );


        const row = {};


        headers.forEach(
            (header, index) => {

                row[header] =
                    values[index] || "";

            }
        );


        rows.push(row);

    }


    return rows;

}


//============================================================
// 数値取得
//============================================================

function findNumber(row, names) {

    for (
        const name of names
    ) {

        if (
            row[name] !== undefined &&
            row[name] !== ""
        ) {

            const n =
                Number(
                    row[name]
                );


            if (
                Number.isFinite(n)
            ) {

                return n;

            }

        }

    }


    return null;

}


//============================================================
// 文字列取得
//============================================================

function findValue(row, names) {

    for (
        const name of names
    ) {

        if (
            row[name] !== undefined &&
            row[name] !== ""
        ) {

            return row[name];

        }

    }


    return "";

}


//============================================================
// 交通規制データ変換
//============================================================

function convertTrafficRow(
    row,
    index
) {

    //--------------------------------------------------------
    // 緯度
    //--------------------------------------------------------

    const lat =
        findNumber(
            row,
            [

                "緯度",

                "latitude",

                "Latitude",

                "lat",

                "LAT"

            ]
        );


    //--------------------------------------------------------
    // 経度
    //--------------------------------------------------------

    const lon =
        findNumber(
            row,
            [

                "経度",

                "longitude",

                "Longitude",

                "lon",

                "LON"

            ]
        );


    //--------------------------------------------------------
    // 座標が取得できないデータは
    // 地図表示対象から除外
    //--------------------------------------------------------

    if (
        lat === null ||
        lon === null
    ) {

        return null;

    }


    //--------------------------------------------------------
    // 規制種別
    //--------------------------------------------------------

    const type =
        findValue(
            row,
            [

                "規制種別名称",

                "規制種別",

                "規制内容",

                "規制種別名",

                "restriction"

            ]
        );


    //--------------------------------------------------------
    // 道路名
    //--------------------------------------------------------

    const route =
        findValue(
            row,
            [

                "路線名",

                "道路名称",

                "道路名",

                "road",

                "route"

            ]
        );


    //--------------------------------------------------------
    // 規制理由
    //--------------------------------------------------------

    const reason =
        findValue(
            row,
            [

                "規制理由",

                "理由",

                "reason"

            ]
        );


    //--------------------------------------------------------
    // 規制区間
    //--------------------------------------------------------

    const section =
        findValue(
            row,
            [

                "規制区間",

                "区間",

                "規制場所",

                "場所",

                "section"

            ]
        );


    //--------------------------------------------------------
    // 開始
    //--------------------------------------------------------

    const start =
        findValue(
            row,
            [

                "規制開始日時",

                "開始日時",

                "規制開始",

                "start"

            ]
        );


    //--------------------------------------------------------
    // 終了
    //--------------------------------------------------------

    const end =
        findValue(
            row,
            [

                "規制終了日時",

                "終了日時",

                "規制終了",

                "end"

            ]
        );


    return {

        id:
            "jartic-" +
            index,

        lat:lat,

        lon:lon,

        route:
            route ||
            "道路名不明",

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
            "JARTIC",

        sourceUrl:
            JARTIC_OPEN_DATA_URL

    };

}


//============================================================
// 交通規制取得
//============================================================

async function fetchTrafficRegulations() {

    try {

        console.log(
            "================================"
        );

        console.log(
            "JARTIC交通規制取得開始"
        );


        //----------------------------------------------------
        // CSV取得
        //----------------------------------------------------

        const csvText =
            await downloadKumamotoTrafficCSV();


        //----------------------------------------------------
        // CSV解析
        //----------------------------------------------------

        const rows =
            parseTrafficCSV(
                csvText
            );


        console.log(
            "JARTIC CSV:",
            rows.length,
            "件"
        );


        //----------------------------------------------------
        // プッたん用データへ変換
        //----------------------------------------------------

        const regulations = [];


        rows.forEach(
            (row, index) => {

                const item =
                    convertTrafficRow(
                        row,
                        index
                    );


                if (item) {

                    regulations.push(
                        item
                    );

                }

            }
        );


        console.log(
            "地図表示可能:",
            regulations.length,
            "件"
        );


        return regulations;

    }
    catch (err) {

        console.error(
            "JARTIC交通規制取得エラー:",
            err
        );


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
            !Array.isArray(regulations)
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

                                hour12:false

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
                    // 位置履歴
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

            async data => {

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

                                    hour12:false

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

                    return;

                }


                trafficRegulations =
                    regulations;


                io.emit(
                    "trafficRegulations",
                    trafficRegulations
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
                "JARTIC交通規制:",
                "実データ"
            );

            console.log(
                "================================"
            );


            //------------------------------------------------
            // 起動直後に取得
            //------------------------------------------------

            await updateTrafficRegulations();


            //------------------------------------------------
            // 定期更新
            //------------------------------------------------

            setInterval(

                updateTrafficRegulations,

                TRAFFIC_UPDATE_INTERVAL

            );

        }

    );

}


startServer();