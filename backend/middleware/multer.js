const multer = require('multer');
const path = require('path');

// Cấu hình nơi lưu trữ file tạm thời
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'temp/'); // Lưu file tạm vào thư mục temp
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// Cấu hình multer
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|mp4|mov/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ hỗ trợ file ảnh (jpeg, jpg, png) hoặc video (mp4, mov)!'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // Giới hạn kích thước file: 10MB
});

module.exports = upload;