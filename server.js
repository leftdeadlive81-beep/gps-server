const express = require("express");
const app = express();

app.use(express.static("public"));

const http = require("http");
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("gps.db");


// テーブル作成
db.serialize(() => {

    db.run(`
    CREATE TABLE IF NOT EXISTS locations(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        lat REAL,
        lon REAL,
        money INTEGER DEFAULT 0,
        fuel INTEGER DEFAULT 0,
        equipment INTEGER DEFAULT 0,
        time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `);

});


// HTTPサーバー
const server = http.createServer(app);


// Socket.IO
const io = require("socket.io")(server);


// 接続中ユーザー
let users = {};



io.on("connection", socket => {

    console.log("接続:", socket.id);



    // GPS情報受信
    socket.on("location", data => {


        // 現在位置保存
        users[socket.id] = data;



        // DB保存
        db.run(
        `
        INSERT INTO locations
        (
            name,
            lat,
            lon,
            money,
            fuel,
            equipment
        )
        VALUES(?,?,?,?,?,?)
        `,
        [
            data.name,
            data.lat,
            data.lon,
            data.money || 0,
            data.fuel || 0,
            data.equipment || 0
        ]);



        // 全員へ送信
        io.emit("locations", users);


    });



    // 切断
    socket.on("disconnect", () => {


        delete users[socket.id];


        io.emit("locations", users);


    });



});



// 履歴取得
app.get("/history", (req,res)=>{


    db.all(
        `
        SELECT *
        FROM locations
        ORDER BY time
        `,
        [],
        (err,rows)=>{


            if(err){

                res.status(500).send(err.message);
                return;

            }


            res.json(rows);


        }
    );


});



// Render対応
const PORT = process.env.PORT || 3000;


server.listen(PORT,()=>{

    console.log("http server start port:" + PORT);

});