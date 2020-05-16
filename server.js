const fs = require('fs')
var express = require('express')
var path = require('path')
var app = express()

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
  res.sendFile("index.html")
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