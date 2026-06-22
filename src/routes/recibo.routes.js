const express = require('express');
const router = express.Router();

const {
  previsualizarReciboReserva,
  generarReciboReserva,
  obtenerRecibosReserva,
  obtenerReciboDetalle,
  descargarReciboPdf
} = require('../controllers/recibo.controller');
const {
  verificarToken
} = require('../middlewares/auth.middleware');

const {
  permitirRoles
} = require('../middlewares/roles.middleware');

router.get(
  '/reservas/:reserva_id/preview',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  previsualizarReciboReserva
);

router.post(
  '/reservas/:reserva_id/generar',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  generarReciboReserva
);

router.get(
  '/reservas/:reserva_id',
  verificarToken,
  obtenerRecibosReserva
);

router.get(
  '/:recibo_id/pdf',
  verificarToken,
  descargarReciboPdf
);

router.get(
  '/:recibo_id',
  verificarToken,
  obtenerReciboDetalle
);

module.exports = router;