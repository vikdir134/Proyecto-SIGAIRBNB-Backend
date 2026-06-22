const express = require('express');
const router = express.Router();

const {
  obtenerBloqueosPorInmueble,
  crearBloqueoDisponibilidad,
  eliminarBloqueoDisponibilidad,
  obtenerCalendarioDisponibilidad,
  editarBloqueoDisponibilidad,
  obtenerInmueblesParaDisponibilidad
} = require('../controllers/disponibilidad.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

/*
  HU06 - Calendario de Disponibilidad
  (get)Lista los bloqueos activos de disponibilidad de un inmueble.
  (post)Registra un bloqueo manual de fechas para un inmueble.
*/
router.get('/inmuebles/:inmueble_id/bloqueos', verificarToken, obtenerBloqueosPorInmueble);
router.get('/inmuebles/:inmueble_id/calendario', verificarToken, obtenerCalendarioDisponibilidad);
router.get('/inmuebles', verificarToken, obtenerInmueblesParaDisponibilidad);
router.post('/bloqueos', verificarToken, crearBloqueoDisponibilidad);
router.delete('/bloqueos/:bloqueo_id', verificarToken, eliminarBloqueoDisponibilidad);
router.put('/bloqueos/:bloqueo_id', verificarToken, editarBloqueoDisponibilidad);

module.exports = router;