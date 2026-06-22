const express = require('express');
const router = express.Router();

const {
  obtenerMisRecibosPendientes,
  obtenerDetalleReciboParaPago,
  pagarReciboOnline,
  obtenerMisPagos
} = require('../controllers/pago.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

/*
  HU16 - Procesamiento de Pago Online
  El inquilino autenticado puede consultar sus recibos pendientes,
  revisar el detalle de un recibo y procesar un pago online simulado.
*/

// Listar recibos pendientes del inquilino autenticado
router.get('/mis-recibos-pendientes', verificarToken, obtenerMisRecibosPendientes);

// Obtener detalle de un recibo antes de pagar
router.get('/recibos/:recibo_id', verificarToken, obtenerDetalleReciboParaPago);

// Procesar pago online simulado de un recibo
router.post('/recibos/:recibo_id/pagar-online', verificarToken, pagarReciboOnline);

// Historial de pagos del inquilino autenticado
router.get('/mis-pagos', verificarToken, obtenerMisPagos);

module.exports = router;