//=====================
// 初期設定
//=====================

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");


const app = express();

const server = http.createServer(app);

const io = new Server(server);


app.use(express.static("public"));


//=====================
// Supabase PostgreSQL
//=====================



const pool = new Pool({

    connectionString:
        process.env.DATABASE_URL,

    ssl:{
        rejectUnauthorized:false
    },

    family:4

});




// 接続確認

pool.connect()
.then(client=>{

    console.log(
        "Supabase PostgreSQL connected"
    );

    client.release();

})
.catch(err=>{

    console.log(
        "Database connection error",
        err
    );

});




//=====================
// ユーザー情報（メモリ）
//=====================

let users = {};




//=====================
// 起動時復元
//=====================

async function loadUsers(){


try{


const result = await pool.query(

"SELECT * FROM current_users"

);



result.rows.forEach(row=>{


users[row.name]={

    name:row.name,

    lat:row.lat,

    lon:row.lon,

    water:row.water,

    fuel:row.fuel,

    destination:row.destination,

    lastUpdate:row.lastupdate,

    online:false

};


});


console.log(

"復元ユーザー数:",
Object.keys(users).length

);



}

catch(err){


console.log(

"復元エラー:",
err

);


}


}




// 起動時読み込み

loadUsers();

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

async(data)=>{


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

try{


await pool.query(

`

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

VALUES

($1,$2,$3,$4,$5,$6,$7,$8)


ON CONFLICT(name)

DO UPDATE SET


lat=EXCLUDED.lat,

lon=EXCLUDED.lon,

water=EXCLUDED.water,

fuel=EXCLUDED.fuel,

destination=EXCLUDED.destination,

lastUpdate=EXCLUDED.lastUpdate,

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


}
catch(err){

console.log(
"current_users保存エラー:",
err
);

}





//=====================
// 履歴保存
//=====================

try{


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
created

)

VALUES

($1,$2,$3,$4,$5,$6,$7)

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


}
catch(err){

console.log(
"history保存エラー:",
err
);

}




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

async(name)=>{


console.log(

"削除要求:",
name

);



delete users[name];



try{


await pool.query(

"DELETE FROM current_users WHERE name=$1",

[name]

);



console.log(

"削除完了:",
name

);



}
catch(err){

console.log(
"削除エラー:",
err
);

}



io.emit(

"locations",

users

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