const express = require("express");
const app = express();

app.use(express.static("public"));

const http = require("http");
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("gps.db");


db.serialize(()=>{

    db.run(`
    CREATE TABLE IF NOT EXISTS locations(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        lat REAL,
        lon REAL,
        time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `);

});


const server = http.createServer(app);


const io = require("socket.io")(server);



let users={};



io.on("connection",socket=>{


console.log("接続:",socket.id);



socket.on("location",data=>{


users[socket.id]=data;



db.run(
"INSERT INTO locations(name,lat,lon) VALUES(?,?,?)",
[
data.name,
data.lat,
data.lon
]
);



io.emit("locations",users);



});





socket.on("disconnect",()=>{


delete users[socket.id];


io.emit("locations",users);


});


});





app.get("/history",(req,res)=>{


db.all(
"SELECT * FROM locations ORDER BY time",
[],
(err,rows)=>{


if(err){

res.status(500).send(err.message);

return;

}


res.json(rows);


});


});






server.listen(3000,()=>{
    console.log("http server start");
});