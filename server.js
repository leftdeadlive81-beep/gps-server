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
// Supabase
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

let points = {};

let chronology = [];




//=====================
// 地点データ復元
//=====================

async function loadPoints(){

    try{


        const result =
        await pool.query(
            "SELECT * FROM points ORDER BY created"
        );


        result.rows.forEach(point=>{


            points[point.name]={

                name:point.name,

                type:point.type,

                lat:point.lat,

                lon:point.lon,

                created:point.created

            };


        });


        console.log(
            "地点復元:",
            Object.keys(points)
        );


    }
    catch(err){


        console.error(
            "地点復元エラー",
            err
        );


    }

}




//=====================
// クロノロジー復元
//=====================

async function loadChronology(){

    try{


        const result =
        await pool.query(
            "SELECT * FROM chronology ORDER BY id DESC LIMIT 100"
        );


        chronology =
        result.rows.reverse().map(row=>{


            return {

              
time:
new Date(
    Number(row.created)
)
.toLocaleString(
"ja-JP",
{
    timeZone:"Asia/Tokyo",
    hour12:false
}
),



                message:
                (row.user_name
                ?
                "["+row.user_name+"] "
                :
                "")
                +
                row.message

            };


        });



        console.log(
            "クロノロジー復元:",
            chronology.length
        );


    }
    catch(err){


        console.error(
            "クロノロジー復元エラー",
            err
        );


    }

}





//=====================
// ユーザー復元
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


                utmZone:user.utmZone,

                utmE:user.utmE,

                utmN:user.utmN,


                water:user.water,

                fuel:user.fuel,


                destination:user.destination,


                iconType:
                user.iconType || "person",


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




// 初期送信

socket.emit(
"locations",
users
);


socket.emit(
"points",
points
);


socket.emit(
"chronology",
chronology
);





//=====================
// 地点登録
//=====================

socket.on(
"addPoint",

async(point)=>{


try{


await pool.query(

`

INSERT INTO points

(
name,
type,
lat,
lon,
created
)

VALUES

($1,$2,$3,$4,$5)

ON CONFLICT(name)

DO UPDATE SET

type=$2,
lat=$3,
lon=$4,
created=$5

`

,

[

point.name,

point.type || "point",

point.lat,

point.lon,

Date.now()

]

);



points[point.name]=point;



io.emit(
"points",
points
);



console.log(
"地点登録:",
point.name
);


}
catch(err){


console.error(
"地点保存エラー",
err
);


}


}

);







//=====================
// 位置情報受信
//=====================

socket.on(
"location",

async(data)=>{


const now=Date.now();


const user={


name:data.name,

lat:data.lat,

lon:data.lon,


utmZone:data.utmZone || "52S",

utmE:data.utmE,

utmN:data.utmN,


water:data.water,

fuel:data.fuel,


destination:data.destination,


iconType:
data.iconType || "person",


online:true,


lastUpdate:now


};



users[data.name]=user;



try{


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

utmZone=$4,

utmE=$5,

utmN=$6,

water=$7,

fuel=$8,

destination=$9,

online=$10,

lastUpdate=$11

`

,

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

`

,

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



io.emit(
"locations",
users
);



}

);







//=====================
// クロノロジー登録
//=====================

socket.on(
"addChronology",

async(data)=>{


const now=Date.now();


const item={


time:
new Date(now)
.toLocaleString(
"ja-JP",
{
    timeZone:"Asia/Tokyo",
    hour12:false
}
),


message:
(data.user
?
"["+data.user+"] "
:
"")
+
data.message


};



chronology.unshift(item);



if(chronology.length>100){

chronology.pop();

}





try{


await pool.query(

`

INSERT INTO chronology

(

user_name,
message,
created

)

VALUES

($1,$2,$3)

`

,

[

data.user || "",

data.message,

now

]

);


}
catch(err){


console.error(
"クロノロジー保存エラー",
err
);


}




io.emit(
"chronology",
chronology
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
// 起動
//=====================

const PORT =
process.env.PORT || 10000;



async function startServer(){


await loadUsers();


await loadPoints();


await loadChronology();



server.listen(

PORT,

()=>{


console.log(
"server start port:",
PORT
);


}

);


}



startServer();