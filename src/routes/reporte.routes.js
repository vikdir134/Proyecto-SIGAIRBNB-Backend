const express = require('express');

const {
  obtenerReporteFinancieroMensual,
  obtenerDetalleMovimientosMensuales
} = require('../controllers/reporte.controller');

const {
  verificarToken,
  autorizarRoles
} = require('../middlewares/auth.middleware');

const router = express.Router();

router.get(
  '/financiero-mensual',
  verificarToken,
  autorizarRoles('SECRETARIO', 'ADMIN', 'ADMIN_EMPRESA'),
  obtenerReporteFinancieroMensual
);

router.get(
  '/financiero-mensual/detalle',
  verificarToken,
  autorizarRoles('SECRETARIO', 'ADMIN', 'ADMIN_EMPRESA'),
  obtenerDetalleMovimientosMensuales
);

module.exports = router;