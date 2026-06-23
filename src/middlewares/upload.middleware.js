// src/middlewares/upload.middleware.js
const multer = require('multer');

const storageFotoInmueble = multer.memoryStorage();

const filtroImagen = (req, file, cb) => {
  const tiposPermitidos = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg'
  ];

  if (!tiposPermitidos.includes(file.mimetype)) {
    return cb(new Error('Solo se permiten imágenes JPG, JPEG, PNG o WEBP.'), false);
  }

  cb(null, true);
};

const uploadFotoInmueble = multer({
  storage: storageFotoInmueble,
  fileFilter: filtroImagen,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB por imagen
    files: 10
  }
});

module.exports = {
  uploadFotoInmueble
};