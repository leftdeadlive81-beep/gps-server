const express = require("express");
const app = express();

app.use(express.static("public"));

const http = require("http");
const server = http.createServer(app);

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("gps.db");

const io = require("socket.io")(server);


//=====================
// DB作成
//=====================

db.serialize(()=>{

    db.run(`
    CREATE TABLE IF NOT EXISTS locations(

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
// 現在ユーザー
//=====================

let users = {};



//=====================
// SQLite復元
//=====================

db.all(

`
SELECT *
FROM locations
WHERE id IN
(
 SELECT MAX(id)
 FROM locations
 GROUP BY name
)
`,

[],

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

lastUpdate:
new Date(row.time).getTime(),


online:false


};


});


console.log(
"復元ユーザー数:",
rows.length
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


lastUpdate:
Date.now(),


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


console.log(
"切断:",
socket.id
);


// 削除しない
// オフライン判定で管理


});


});





//=====================
// オンライン監視
//=====================

setInterval(()=>{


const now =
Date.now();



Object.keys(users)
.forEach((name)=>{


if(

now - users[name].lastUpdate

>

5 * 60 * 1000

){


users[name].online=false;


}else{


users[name].online=true;


}


});



io.emit(
"locations",
users
);


},60000);





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
ORDER BY time DESC

`,

[],

(err,rows)=>{


if(err){

res.status(500)
.send(err.message);

return;

}


res.json(rows);


});


});




//=====================
// Render
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


}

);