const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 定义允许的文件类型
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_AUDIO = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];

// 存储配置：上传到 uploads 文件夹，按年/月归类，使用 UUID 重命名
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', '..', 'uploads'));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, uuidv4() + ext);
    }
});

// 文件过滤器
function fileFilter(req, file, cb) {
    if (ALLOWED_IMAGE.includes(file.mimetype) || ALLOWED_AUDIO.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件类型，仅允许图片（jpg/png/gif/webp）和音频（mp3/wav/ogg/webm）'), false);
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,  // 10MB 总限制，图片可单独限制 5MB，但此处统一10MB
    }
});

module.exports = upload;