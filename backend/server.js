const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const friendsRoutes = require('./routes/friends');
const usersRoutes = require('./routes/users');
const groupsRoutes = require('./routes/groups');
const messageRoutes = require('./routes/messages');
const User = require('./models/User');
process.env.LANG = 'en_US.UTF-8';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL 
      : 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  path: '/socket.io',
});

app.set('socketio', io);

// Middleware
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));
// Route wildcard để phục vụ index.html cho tất cả các route không phải API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Routes
console.log('Registering routes:');
app.use('/api/auth', authRoutes);
logRoutes(authRoutes, '/api/auth');
app.use('/api/friends', friendsRoutes);
logRoutes(friendsRoutes, '/api/friends');
app.use('/api/users', usersRoutes);
logRoutes(usersRoutes, '/api/users');
app.use('/api/groups', groupsRoutes);
logRoutes(groupsRoutes, '/api/groups');
app.use('/api/messages', messageRoutes);
logRoutes(messageRoutes, '/api/messages');

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('userConnected', async (userId) => {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { isOnline: true },
        { new: true }
      );
      if (!user) {
        console.error(`User with ID ${userId} not found`);
        return;
      }
      socket.userId = userId;
      io.emit('userStatus', { userId, isOnline: true });
      console.log(`User ${userId} is online`);
    } catch (err) {
      console.error('Error updating online status:', err);
    }
  });

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.userId || 'unknown'} joined room: ${roomId}`);
  });

  socket.on('disconnect', async () => {
    try {
      if (socket.userId) {
        const user = await User.findByIdAndUpdate(
          socket.userId,
          { isOnline: false },
          { new: true }
        );
        if (!user) {
          console.error(`User with ID ${socket.userId} not found`);
          return;
        }
        io.emit('userStatus', { userId: socket.userId, isOnline: false });
        console.log(`User ${socket.userId} is offline`);
      }
    } catch (err) {
      console.error('Error updating offline status:', err);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));