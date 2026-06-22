const express = require('express');
const router = express.Router();

const {
  obtenerDatosFormularioIngreso,
  listarRecibosPendientes,
  listarIngresos,
  registrarIngreso
} = require('../controllers/ingresoAlquiler.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

const {
  permitirRoles
} = require('../middlewares/roles.middleware');

/*
  HU19 - Registro de Ingresos de Alquiler
  Como secretario quiero registrar los ingresos por rentas cobradas
  para cuadrar la tesorería.
*/

// Datos para cargar el formulario:
// categorías de ingreso, cuentas/cajas de la empresa y recibos pendientes
router.get(
  '/formulario',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  obtenerDatosFormularioIngreso
);

// Listar recibos pendientes de cobro de la empresa
router.get(
  '/recibos-pendientes',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  listarRecibosPendientes
);

// Listar ingresos de alquiler registrados de la empresa
router.get(
  '/ingresos',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  listarIngresos
);

// Registrar ingreso de alquiler
router.post(
  '/ingresos',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  registrarIngreso
);

module.exports = router;