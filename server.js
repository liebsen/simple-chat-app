const fs = require('fs')
var express = require('express')
var path = require('path')
var app = express()
var cors = require('cors')

var allowedOrigins = [
  'https://localhost:5000',
  'https://comino.herokuapp.com'
]

app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true)
    if(allowedOrigins.indexOf(origin) === -1){
      var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.'
      return callback(new Error(msg), false)
    }
    return callback(null, true)
  }
}))

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
}

if (process.env.SSL) {
  var http = require('https').Server(options, app)
} else {
  var http = require('http').Server(app)
}

var io = require('socket.io')(http, { origins: '*:*', pingInterval: 15000})

app.use(express.static(path.join(__dirname, 'public')))

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'))
})

app.get("/r/:room", (req, res) => {
  res.sendFile(path.join(__dirname, 'public/room.html'))
})

let activeSockets = []

io.on('connection', socket => {
  const existingSocket = activeSockets.find(
    existingSocket => existingSocket === socket.id
  )

  if (!existingSocket) {
    activeSockets.push(socket.id)

    socket.emit("update-user-list", {
      users: activeSockets.filter(
        existingSocket => existingSocket !== socket.id
      )
    });

    socket.broadcast.emit("update-user-list", {
      users: [socket.id]
    })
  }

  socket.on("join-room", data => {
    console.log("join room " + data.room)
    socket.join(data.room)
  }) 

  socket.on("leave-room", data => {
    console.log("leave room " + data.id)
    socket.to(data.room).emit("room-left", {
      id: data.id
    })
  }) 

  socket.on("call-user", data => {
    socket.to(data.to).emit("call-made", {
      offer: data.offer,
      socket: socket.id
    })
  })

  socket.on("make-answer", data => {
    socket.to(data.to).emit("answer-made", {
      socket: socket.id,
      answer: data.answer
    })
  })

  socket.on("reject-call", data => {
    socket.to(data.from).emit("call-rejected", {
      socket: socket.id
    })
  })

  socket.on("disconnect", () => {
    activeSockets = activeSockets.filter(
      existingSocket => existingSocket !== socket.id
    )
    socket.broadcast.emit("remove-user", {
      socketId: socket.id
    })
  })
})

var server = http.listen(process.env.PORT, function () { //run http and web socket server
  console.log(`Server running at http://localhost:${process.env.PORT}`)
})