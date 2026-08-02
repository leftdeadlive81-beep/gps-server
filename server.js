const express = require("express");
const app = express();

app.use(express.static("public"));


const http = require("http");

const sqlite3 = require("sqlite3").verbose();


const db = new sqlite3.Database("gps.db");



// テーブル作成
db.serialize(()=>{

    db.run(`
    CREATE TABLE IF NOT EXISTS locations(

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        name TEXT,

        lat REAL,

        lon REAL,

        fuel INTEGER,

        money INTEGER,

        equipment INTEGER,

        time DATETIME DEFAULT CURRENT_TIMESTAMP

    )
    `);


});



const server = http.createServer(app);


const io = require("socket.io")(server);



let users={};




// 接続
io.on("connection",socket=>{


console.log("接続:",socket.id);



// GPS受信

socket.on("location",data=>{



users[socket.id]=data;




db.run(

`
INSERT INTO locations
(
name,
lat,
lon,
fuel,
money,
equipment
)

VALUES(?,?,?,?,?,?)

`,

[

data.name,

data.lat,

data.lon,

data.fuel,

data.money,

data.equipment


]


);




// 全員へ配信

io.emit(
"locations",
users
);



});




// 切断

socket.on("disconnect",()=>{


delete users[socket.id];


io.emit(
"locations",
users
);


});



});





// 履歴取得

app.get("/history",(req,res)=>{


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





server.listen(3000,()=>{


console.log(
"http server start"
);


});
