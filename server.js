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
// Socket.IO
//=====================

const io = require("socket.io")(server);


// 現在接続中＋復元データ
let users={};



//=====================
// 起動時 SQLite復元
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

destination:row.destination


};


});


console.log(
"復元ユーザー数:",
rows.length
);


}

);




//=====================
// 接続
//=====================

io.on(
"connection",
(socket)=>{


console.log(
"接続:",
socket.id
);


// 接続直後に現在情報を送信

socket.emit(
"locations",
users
);



socket.on(
"location",
(data)=>{


// 名前をキーにする

users[data.name]=data;



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


// DB保持のため削除しない


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
// Render PORT
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