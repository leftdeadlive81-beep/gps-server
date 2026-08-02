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



//=====================
// ユーザー削除
//=====================

socket.on(
"deleteUser",
(name)=>{

console.log("削除要求:",name);


// メモリから削除

delete users[name];


// SQLiteから削除

db.run(

"DELETE FROM locations WHERE name = ?",

[name],

(err)=>{

if(err){

console.log(err);

return;

}


console.log("削除完了:",name);


// 全員へ通知

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

// オフライン判定で管理

});

});