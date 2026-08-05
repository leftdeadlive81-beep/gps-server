const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");


const app = express();

const server = http.createServer(app);

const io = new Server(server);


app.use(express.static("public"));



//=====================
// PostgreSQL
// Supabase Transaction Pooler
//=====================


const pool = new Pool({

    connectionString:
        process.env.DATABASE_URL,

    ssl:{
        rejectUnauthorized:false
    }

});




//=====================
// メモリ
//=====================

let users = {};




//=====================
// 起動時 DB復元
//=====================


async function loadUsers(){


    try{


        const result =
        await pool.query(

            "SELECT * FROM current_users"

        );



        result.rows.forEach(user=>{


            users[user.name]={


                name:user.name,

                lat:user.lat,

                lon:user.lon,

                water:user.water,

                fuel:user.fuel,

                destination:user.destination,

                online:false,

                lastUpdate:user.lastUpdate


            };


        });



        console.log(

            "復元ユーザー:",

            Object.keys(users)

        );



    }

    catch(err){


        console.error(

            "DB復元エラー",

            err

        );


    }


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


    const now = Date.now();



    const user={


    name:data.name,

    lat:data.lat,

    lon:data.lon,


    // UTM座標

    utmZone:data.utmZone || "52S",

    utmE:data.utmE,

    utmN:data.utmN,


    water:data.water,

    fuel:data.fuel,

    destination:data.destination,


    iconType:data.iconType || "person",


    online:true,

    lastUpdate:now


};





    users[data.name]=user;






    try{


        //=====================
        // 現在位置保存
        //=====================


        await pool.query(

        `

        INSERT INTO current_users

        (
name,
lat,
lon,
utmZone,
utmE,
utmN,
water,
fuel,
destination,
online,
lastUpdate
)


        VALUES

        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)



        ON CONFLICT(name)

        DO UPDATE SET


        lat=$2,

        lon=$3,

        water=$4,

        fuel=$5,

        destination=$6,

        online=$7,

        lastUpdate=$8


        `,


        [
    user.name,
    user.lat,
    user.lon,
    user.utmZone,
    user.utmE,
    user.utmN,
    user.water,
    user.fuel,
    user.destination,
    1,
    now
]

        );







        //=====================
        // 履歴保存
        //=====================


        await pool.query(

        `

        INSERT INTO location_history

        (

        name,

        lat,

        lon,

        water,

        fuel,

        destination

        )


        VALUES

        ($1,$2,$3,$4,$5,$6)


        `,


        [

        user.name,

        user.lat,

        user.lon,

        user.water,

        user.fuel,

        user.destination

        ]

        );



    }


    catch(err){


        console.error(

            "DB保存エラー",

            err

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



    try{


        await pool.query(

        "DELETE FROM current_users WHERE name=$1",

        [name]

        );


    }

    catch(err){


        console.error(

            "削除エラー",

            err

        );


    }




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

async()=>{


console.log(

"切断:",

socket.id

);


}

);



}

);








//=====================
// Render
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