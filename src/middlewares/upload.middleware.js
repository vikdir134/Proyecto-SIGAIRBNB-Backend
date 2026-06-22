const multer = require('multer');
const path = require('path');

const storageFotoInmueble = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads', 'inmuebles'));
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    const nombreBase = path.basename(file.originalname, extension);

    const nombreLimpio = nombreBase
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');

    const nombreFinal = `${Date.now()}-${nombreLimpio}${extension}`;

    cb(null, nombreFinal);
  }
});

const filtroImagen = (req, file, cb) => {
  const tiposPermitidos = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg'
  ];

  if (!tiposPermitidos.includes(file.mimetype)) {
    return cb(new Error('Solo se permiten imágenes JPG, JPEG, PNG o WEBP'));
  }

  cb(null, true);
};

const uploadFotoInmueble = multer({
  storage: storageFotoInmueble,
  fileFilter: filtroImagen,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = {
  uploadFotoInmueble
};