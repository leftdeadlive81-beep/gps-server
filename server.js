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


const db = new sqlite3.Database(
"database.db"
);




//=====================
// 現在ユーザー
//=====================


db.run(`

CREATE TABLE IF NOT EXISTS current_users (

name TEXT PRIMARY KEY,

lat REAL,

lon REAL,

water INTEGER,

fuel INTEGER,

destination TEXT,

iconType TEXT,

lastUpdate INTEGER,

online INTEGER

)

`);





//=====================
// 履歴
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

iconType TEXT,

created INTEGER

)

`);








//=====================
// メモリ
//=====================


let users={};






//=====================
// 起動時 SQLite復元
//=====================


db.all(

"SELECT * FROM current_users",

[],

(err,rows)=>{


if(err){

console.error(err);

return;

}



rows.forEach(user=>{


users[user.name]={


name:user.name,


lat:user.lat,


lon:user.lon,


water:user.water,


fuel:user.fuel,


destination:user.destination,


iconType:user.iconType || "person",


lastUpdate:user.lastUpdate,


online:false


};


});



console.log(

"復元ユーザー:",

Object.keys(users)

);



}

);








//=====================
// Socket接続
//=====================


io.on(

"connection",

(socket)=>{


console.log(

"接続:",

socket.id

);




// 接続時送信


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


let now=Date.now();




let user={


name:data.name,


lat:data.lat,


lon:data.lon,


water:data.water,


fuel:data.fuel,


destination:data.destination,


iconType:data.iconType || "person",


lastUpdate:now,


online:true


};





// メモリ更新


users[data.name]=user;






//=====================
// 現在状態保存
//=====================


db.run(

`

INSERT INTO current_users

(

name,

lat,

lon,

water,

fuel,

destination,

iconType,

lastUpdate,

online

)

VALUES (?,?,?,?,?,?,?,?,?)



ON CONFLICT(name)

DO UPDATE SET


lat=excluded.lat,

lon=excluded.lon,

water=excluded.water,

fuel=excluded.fuel,

destination=excluded.destination,

iconType=excluded.iconType,

lastUpdate=excluded.lastUpdate,

online=excluded.online


`,

[


user.name,


user.lat,


user.lon,


user.water,


user.fuel,


user.destination,


user.iconType,


user.lastUpdate,


1


]


);







//=====================
// 履歴保存
//=====================


db.run(

`

INSERT INTO location_history

(

name,

lat,

lon,

water,

fuel,

destination,

iconType,

created

)

VALUES (?,?,?,?,?,?,?,?)

`,

[


user.name,


user.lat,


user.lon,


user.water,


user.fuel,


user.destination,


user.iconType,


now


]


);








io.emit(

"locations",

users

);



}

);










//=====================
// ユーザー削除
//=====================


socket.on(

"deleteUser",

(name)=>{


delete users[name];



db.run(

"DELETE FROM current_users WHERE name=?",

[name]

);



io.emit(

"locations",

users

);



}

);










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


}

);



}

);








//=====================
// Render用PORT
//=====================


const PORT =

process.env.PORT || 10000;





server.listen(

PORT,

()=>{


console.log(

"server start port:",

PORT

);


}

);