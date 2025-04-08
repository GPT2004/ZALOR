const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/multer');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const Message = require('../models/Message');

router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { receiverId, content, isGroup } = req.body;
    const senderId = req.user.id;

    let messageContent = content;
    let messageType = 'text';

    // Nếu có file được upload (ảnh hoặc video)
    if (req.file) {
      const resourceType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: `zalor/${resourceType}s`,
        resource_type: resourceType,
      });
      messageContent = result.secure_url;
      messageType = resourceType;
      fs.unlinkSync(req.file.path);
    }

    // Tạo tin nhắn mới
    const message = new Message({
      senderId,
      receiverId,
      content: messageContent,
      type: messageType,
      isGroup: isGroup === 'true',
    });

    await message.save();

    // Populate senderId để đảm bảo dữ liệu đầy đủ khi emit
    const populatedMessage = await Message.findById(message._id).populate('senderId', 'name avatar');

    // Gửi tin nhắn qua Socket.IO
    const io = req.app.get('socketio');
    const roomId = isGroup === 'true' ? receiverId : [senderId, receiverId].sort().join('-');
    
    // Emit đến tất cả thành viên trong phòng, trừ người gửi
    io.to(roomId).emit('receiveMessage', populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (err) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Lấy lịch sử tin nhắn
router.get('/:receiverId', authMiddleware, async (req, res) => {
  try {
    const receiverId = req.params.receiverId;
    const userId = req.user.id;

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId, isGroup: false },
        { senderId: receiverId, receiverId: userId, isGroup: false },
        { receiverId, isGroup: true },
      ],
    })
      .populate('senderId', 'name avatar')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Thu hồi tin nhắn
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });

    if (message.senderId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    message.isRecalled = true;
    await message.save();

    // Thông báo qua Socket.IO
    const io = req.app.get('socketio');
    const roomId = message.isGroup ? message.receiverId : [message.senderId, message.receiverId].sort().join('-');
    io.to(roomId).emit('messageRecalled', message._id);

    res.json({ msg: 'Message recalled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Chỉnh sửa tin nhắn
router.put('/:messageId', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });

    if (message.senderId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    message.content = content;
    message.updatedAt = Date.now();
    await message.save();

    // Thông báo qua Socket.IO
    const io = req.app.get('socketio');
    const roomId = message.isGroup ? message.receiverId : [message.senderId, message.receiverId].sort().join('-');
    io.to(roomId).emit('messageEdited', message);

    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;