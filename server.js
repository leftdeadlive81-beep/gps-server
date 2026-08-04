const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");


const app = express();

const server = http.createServer(app);

const io = new Server(server);


app.use(express.static("public"));



//=====================
// Supabase
//=====================


const supabase = createClient(

    process.env.SUPABASE_URL,

    process.env.SUPABASE_KEY

);




//=====================
// メモリ
//=====================


let users = {};





//=====================
// 起動時 Supabase復元
//=====================


async function loadUsers(){


    const {data,error}=await supabase

    .from("current_users")

    .select("*");



    if(error){

        console.error(
            "Supabase読み込みエラー",
            error
        );

        return;

    }




    data.forEach(user=>{


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

async(data)=>{


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
// 現在位置保存
//=====================


const {error}=await supabase

.from("current_users")

.upsert({

name:user.name,

lat:user.lat,

lon:user.lon,

water:user.water,

fuel:user.fuel,

destination:user.destination,

iconType:user.iconType,

lastUpdate:user.lastUpdate,

online:true

});



if(error){

console.error(
"current_users保存エラー",
error
);

}








//=====================
// 履歴保存
//=====================


const {error:historyError}=await supabase

.from("location_history")

.insert({

name:user.name,

lat:user.lat,

lon:user.lon,

water:user.water,

fuel:user.fuel,

destination:user.destination,

iconType:user.iconType,

created:now

});



if(historyError){

console.error(
"履歴保存エラー",
historyError
);

}







// 全員へ配信


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

async(name)=>{


delete users[name];




await supabase

.from("current_users")

.delete()

.eq(

"name",

name

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
// Render PORT
//=====================


const PORT=

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