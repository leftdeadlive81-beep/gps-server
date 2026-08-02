//=====================
// 初期設定
//=====================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();

const app = express();

const server = http.createServer(app);

const io = new Server(server);


app.use(express.static("public"));


//=====================
// SQLite
//=====================

const db = new sqlite3.Database("./gps.db");


// テーブル作成

db.run(`
CREATE TABLE IF NOT EXISTS locations
(
id INTEGER PRIMARY KEY AUTOINCREMENT,

name TEXT,

lat REAL,

lon REAL,

water INTEGER,

fuel INTEGER,

destination TEXT,

time INTEGER
)
`);



//=====================
// ユーザー情報
//=====================

let users = {};


//=====================
// 起動時データ復元
//=====================

db.all(

"SELECT * FROM locations",

(err,rows)=>{

if(err){

console.log(err);

return;

}


rows.forEach((row)=>{

users[row.name]={

name:row.name,

lat:row.lat,

lon:row.lon,

water:row.water,

fuel:row.fuel,

destination:row.destination,

lastUpdate:row.time,

online:false

};

});


console.log(
"復元ユーザー数:",
Object.keys(users).length
);


});



//=====================
// Socket.IO
//=====================

io.on(
"connection",
(socket)=>{


console.log(
"接続:",
socket.id
);


// 接続時に現在状態送信

socket.emit(
"locations",
users
);




//=====================
// 位置情報受信
//=====================

socket.on(

"location",

(data)=>{


users[data.name]={

name:data.name,

lat:data.lat,

lon:data.lon,

water:data.water,

fuel:data.fuel,

destination:data.destination,

lastUpdate:Date.now(),

online:true

};



// SQLite保存

db.run(

`
INSERT INTO locations
(
name,
lat,
lon,
water,
fuel,
destination,
time
)

VALUES
(?,?,?,?,?,?,?)

`,

[

data.name,

data.lat,

data.lon,

data.water,

data.fuel,

data.destination,

Date.now()

]

);



io.emit(

"locations",

users

);


});






//=====================
// ユーザー削除
//=====================


socket.on(

"deleteUser",

(name)=>{


console.log(

"削除要求:",

name

);


// メモリ削除

delete users[name];



// SQLite削除

db.run(

"DELETE FROM locations WHERE name = ?",

[name],

(err)=>{


if(err){

console.log(err);

return;

}


console.log(

"削除完了:",

name

);


io.emit(

"locations",

users

);


}

);


});






//=====================
// 切断
//=====================


socket.on(

"disconnect",

()=>{


console.log(

"切断:",

socket.id

);


});


});






//=====================
// サーバー起動
//=====================

const PORT = process.env.PORT || 3000;


server.listen(

PORT,

()=>{


console.log(

"http server start port:",

PORT

);


});