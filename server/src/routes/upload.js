const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');

// POST /api/v1/upload
router.post('/', upload.single('file'), (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请选择文件' });
        }
        // 生成带协议和主机名的完整 URL
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const url = `${baseUrl}/uploads/${req.file.filename}`;
        res.json({
            url,
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    } catch (err) {
        next(err);
    }
});

// 统一处理 multer 的错误
router.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '文件大小超过限制' });
    }
    if (err.message === '不支持的文件类型，仅允许图片（jpg/png/gif/webp）和音频（mp3/wav/ogg/webm）') {
        return res.status(400).json({ error: err.message });
    }
    next(err);
});

module.exports = router;