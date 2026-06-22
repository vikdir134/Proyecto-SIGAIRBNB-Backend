const express = require('express');
const router = express.Router();

const {
  obtenerMisNotificaciones,
  obtenerContadorNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas
} = require('../controllers/notificacion.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

router.get('/', verificarToken, obtenerMisNotificaciones);

router.get('/contador/no-leidas', verificarToken, obtenerContadorNoLeidas);

router.patch('/:notificacion_id/leer', verificarToken, marcarComoLeida);

router.patch('/leer-todas', verificarToken, marcarTodasComoLeidas);

module.exports = router;