require('dotenv').config();
const express = require('express');
const jwt = require("jsonwebtoken");
const ytSearch = require('youtube-search');
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
        try {
            let msgData = jwt.verify(msg, process.env.SOCKET_AUTH);
            socket.nickname = msgData.email;

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
            let postData = {
                roomId: msgData.roomId,
                sender: {
                    email: msgData.email,
                    name: msgData.name,
                    image: msgData.image
                },
                announcement: `${msgData.name} left the room`
            }

            socket.to(msgData.roomId).emit('message-recieve', postData);
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

            let postData = {
                roomId: joineeData.roomId,
                sender: {
                    email: joineeData.email,
                    name: joineeData.name,
                    image: joineeData.image
                },
                announcement: `${joineeData.name} entered the room`
            }

            socket.to(joineeData.roomId).emit('message-recieve', postData);
        
        } catch (err) {
            console.log(err);
            socket.disconnect();

        }
    });

    socket.on('start-stream', msg => {
        try {
            let streamData = jwt.verify(msg, process.env.SOCKET_AUTH);
            ytSearch(streamData.searchWords, { maxResults: 1, key: process.env.YT_API_KEY }, (err, results) => {
                socket.to(streamData.roomId).emit('stream-started', results[0]);
            });

        } catch (err) {
            socket.disconnect();

        }

    });
});

httpServer.listen(process.env.PORT || 3001, () => console.log('Server started'));