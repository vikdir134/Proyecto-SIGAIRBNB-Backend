const express = require('express');
const router = express.Router();

const {
  obtenerDatosFormularioGasto,
  listarGastos,
  registrarGasto
} = require('../controllers/mantenimiento.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

const {
  permitirRoles
} = require('../middlewares/roles.middleware');

/*
  HU18 - Registro de Gastos de Mantenimiento
  Como secretario quiero registrar gastos asociados a reparaciones o servicios
  para el control financiero.
*/

router.get(
  '/formulario',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  obtenerDatosFormularioGasto
);

router.get(
  '/gastos',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  listarGastos
);

router.post(
  '/gastos',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  registrarGasto
);

module.exports = router;