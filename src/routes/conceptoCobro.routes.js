const express = require('express');
const router = express.Router();

const {
  listarConceptos,
  crearConcepto,
  actualizarConcepto,
  cambiarEstadoConcepto
} = require('../controllers/conceptoCobro.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

const {
  permitirRoles
} = require('../middlewares/roles.middleware');

router.get(
  '/',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  listarConceptos
);

router.post(
  '/',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  crearConcepto
);

router.put(
  '/:concepto_cobro_id',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  actualizarConcepto
);

router.patch(
  '/:concepto_cobro_id/estado',
  verificarToken,
  permitirRoles('ADMIN', 'SECRETARIO'),
  cambiarEstadoConcepto
);

module.exports = router;