const express = require('express');
const router = express.Router();

const {
  asignarSecretario,
  obtenerSecretariosEmpresa,
  revocarSecretario,
  eliminarSecretarioRevocado,
  reactivarSecretario
} = require('../controllers/secretario.controller');

const {
  verificarToken,
  autorizarRoles
} = require('../middlewares/auth.middleware');

/*
  Solo un ADMIN puede asignar secretarios a su empresa.
*/
router.post(
  '/asignaciones',
  verificarToken,
  autorizarRoles('ADMIN'),
  asignarSecretario
);

router.get(
  '/asignaciones',
  verificarToken,
  autorizarRoles('ADMIN'),
  obtenerSecretariosEmpresa
);

router.patch(
  '/asignaciones/:empresa_secretario_id/revocar',
  verificarToken,
  autorizarRoles('ADMIN'),
  revocarSecretario
);

router.delete(
  '/asignaciones/:empresa_secretario_id',
  verificarToken,
  autorizarRoles('ADMIN'),
  eliminarSecretarioRevocado
);

router.patch(
  '/asignaciones/:empresa_secretario_id/reactivar',
  verificarToken,
  autorizarRoles('ADMIN'),
  reactivarSecretario
);

module.exports = router;