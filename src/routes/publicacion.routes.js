const express = require('express');
const router = express.Router();

const {
  listarPublicacionesPublicas,
  obtenerDetallePublicacion,
  obtenerInmueblesPublicablesGestion,
  crearPublicacionGestion,
  subirFotoPublicacion,
  publicarPublicacionGestion,
  eliminarBorradorPublicacionGestion,
  eliminarPublicacionGestion
} = require('../controllers/publicacion.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

const {
  uploadFotoInmueble
} = require('../middlewares/upload.middleware');

/*
  HU08 - Publicación de Inmueble
  Rutas internas de gestión.
  Deben ir antes de las rutas públicas.
*/

router.get(
  '/gestion/inmuebles-publicables',
  verificarToken,
  obtenerInmueblesPublicablesGestion
);

router.post(
  '/gestion',
  verificarToken,
  crearPublicacionGestion
);

router.post(
  '/gestion/:publicacion_id/fotos',
  verificarToken,
  uploadFotoInmueble.single('foto'),
  subirFotoPublicacion
);

router.patch(
  '/gestion/:publicacion_id/publicar',
  verificarToken,
  publicarPublicacionGestion
);


router.delete(
  '/gestion/:publicacion_id/borrador',
  verificarToken,
  eliminarBorradorPublicacionGestion
);
router.delete(
  '/gestion/:publicacion_id',
  verificarToken,
  eliminarPublicacionGestion
);

/*
  HU07 - Búsqueda y Navegación
  Rutas públicas para mostrar publicaciones en el Home.
*/

router.get('/', listarPublicacionesPublicas);

router.get('/:publicacion_id', obtenerDetallePublicacion);

module.exports = router;