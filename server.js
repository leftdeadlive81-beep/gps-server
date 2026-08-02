const express = require("express");
const app = express();

app.use(express.static("public"));


const http = require("http");
const server = http.createServer(app);


const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("gps.db");



//=====================
// DB作成
//=====================

db.serialize(()=>{


    db.run(`
        DROP TABLE IF EXISTS locations
    `);


    db.run(`
        CREATE TABLE locations(

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT,

            lat REAL,

            lon REAL,

            water INTEGER,

            fuel INTEGER,

            destination TEXT,

            time DATETIME DEFAULT CURRENT_TIMESTAMP

        )
    `);


});




//=====================
// Socket.IO
//=====================

const io = require("socket.io")(server);


let users={};



io.on(
"connection",
(socket)=>{


console.log(
"接続:",
socket.id
);



socket.on(
"location",
(data)=>{


users[socket.id]=data;



db.run(

`
INSERT INTO locations
(
name,
lat,
lon,
water,
fuel,
destination
)

VALUES
(?,?,?,?,?,?)

`,

[

data.name,

data.lat,

data.lon,

data.water,

data.fuel,

data.destination

]


);



io.emit(
"locations",
users
);



});





socket.on(
"disconnect",
()=>{


delete users[socket.id];


io.emit(
"locations",
users
);


});


});




//=====================
// 履歴取得
//=====================

app.get(
"/history",
(req,res)=>{


db.all(

`
SELECT *
FROM locations
ORDER BY time

`,

[],


(err,rows)=>{


if(err){

res.status(500)
.send(err.message);

return;

}


res.json(rows);


}


);


});




//=====================
// Render用PORT
//=====================

const PORT =
process.env.PORT || 3000;



server.listen(
PORT,
()=>{


console.log(
"http server start port:",
PORT
);


});