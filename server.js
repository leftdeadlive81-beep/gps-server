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


//=====================
// 現在状態テーブル
//=====================

db.run(`

CREATE TABLE IF NOT EXISTS current_users (

name TEXT PRIMARY KEY,

lat REAL,

lon REAL,

water INTEGER,

fuel INTEGER,

destination TEXT,

lastUpdate INTEGER,

online INTEGER

)

`);


//=====================
// 履歴テーブル
//=====================

db.run(`

CREATE TABLE IF NOT EXISTS location_history (

id INTEGER PRIMARY KEY AUTOINCREMENT,

name TEXT,

lat REAL,

lon REAL,

water INTEGER,

fuel INTEGER,

destination TEXT,

created INTEGER

)

`);




//=====================
// ユーザー情報（メモリ）
//=====================

let users = {};




//=====================
// 起動時復元
//=====================

db.all(

"SELECT * FROM current_users",

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

lastUpdate:row.lastUpdate,

online:false

};


});


console.log(

"復元ユーザー数:",

Object.keys(users).length

);


}

);






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


const now = Date.now();



// メモリ更新

users[data.name]={

name:data.name,

lat:data.lat,

lon:data.lon,

water:data.water,

fuel:data.fuel,

destination:data.destination,

lastUpdate:now,

online:true

};





//=====================
// 現在状態保存
//=====================


db.run(`

INSERT INTO current_users

(

name,

lat,

lon,

water,

fuel,

destination,

lastUpdate,

online

)

VALUES(?,?,?,?,?,?,?,?)


ON CONFLICT(name)

DO UPDATE SET


lat=excluded.lat,

lon=excluded.lon,

water=excluded.water,

fuel=excluded.fuel,

destination=excluded.destination,

lastUpdate=excluded.lastUpdate,

online=1


`,

[

data.name,

data.lat,

data.lon,

data.water,

data.fuel,

data.destination,

now,

1

]

);






//=====================
// 履歴保存
//=====================


db.run(`

INSERT INTO location_history

(

name,

lat,

lon,

water,

fuel,

destination,

created

)

VALUES(?,?,?,?,?,?,?)

`,

[

data.name,

data.lat,

data.lon,

data.water,

data.fuel,

data.destination,

now

]

);






// 全員へ通知

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




// 現在状態削除

db.run(

"DELETE FROM current_users WHERE name = ?",

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


}

);
