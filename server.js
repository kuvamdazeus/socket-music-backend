require('dotenv').config();
const express = require('express');
const jwt = require("jsonwebtoken");
const app = express();

const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.get('/', (_, res) => res.status(200).json({ status: true, message: 'Server working' }));

io.of('/chat-room').on("connection", (socket) => {
    socket.on('want-to-join', msg => {
        // console.log(io.of('/chat-room').adapter.rooms['room']); // key to participants
        // io.of('/chat-room').adapter.rooms.get(msgData.roomId).has('vjh2v34') // key to room membership check
        try {
            let msgData = jwt.verify(msg, process.env.SOCKET_AUTH);

            if (io.of('/chat-room').adapter.rooms.get(msgData.roomId)?.size > 0) {
                socket.to(msgData.roomId).emit('new-joinee', { ...msgData, joineeId: socket.id });
                
            } else {
                socket.join(msgData.roomId);
                socket.emit('permitted');

                let room = io.of('/chat-room').adapter.rooms.get(msgData.roomId);
                socket.to(msgData.roomId).emit('members-update', room);

            }
        
        } catch (err) {
            console.log(err);
            socket.disconnect();

        }
    });

    socket.on('new-message', msg => {
        try {
            let msgData = jwt.verify(msg, process.env.SOCKET_AUTH); 
            socket.to(msgData.roomId).emit('message-recieve', msgData);
            
        } catch (err) {
            console.log(err);
            socket.disconnect();

        }
    });

    socket.on('user-left', msg => {
        try {
            let msgData = jwt.verify(msg, process.env.SOCKET_AUTH);
            socket.to(msgData.roomId).emit('announcement', msgData);
            socket.leave(msgData.roomId);
        
        } finally {
            socket.disconnect();

        }
    });

    socket.on('permit', msg => {
        try {
            let joineeData = jwt.verify(msg, process.env.SOCKET_AUTH);
            let joineeSocket = io.of('/chat-room').sockets.get(joineeData.joineeId);

            joineeSocket.join(joineeData.roomId);
            joineeSocket.emit('permitted');
            socket.to(joineeData.roomId).emit('user-joined', joineeData);
        
        } catch (err) {
            console.log(err);
            socket.disconnect();

        }
    });
});

httpServer.listen(process.env.PORT || 3001, () => console.log('Server started'));