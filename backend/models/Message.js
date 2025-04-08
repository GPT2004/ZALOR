const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Có thể là userId hoặc groupId
  isGroup: { type: Boolean, default: false },
  type: { type: String, enum: ['text', 'image', 'video', 'emoji'], default: 'text' },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  isRecalled: { type: Boolean, default: false }, // Đánh dấu tin nhắn đã thu hồi
});

module.exports = mongoose.model('Message', messageSchema);