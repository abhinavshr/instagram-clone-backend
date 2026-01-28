const multer = require('multer');

const storage = multer.diskStorage({});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, 
});

module.exports = upload.array('media', 10);
