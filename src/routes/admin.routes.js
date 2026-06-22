const express = require('express');
const router = express.Router();
const {
  obtenerUsuariosEmpresa,
  inactivarUsuario,
  reactivarUsuario
} = require('../controllers/admin.controller');
const {
  verificarToken,
  autorizarRoles
} = require('../middlewares/auth.middleware');

/*
  Rutas exclusivas para ADMIN.
  Solo usuarios con rol ADMIN pueden acceder.
*/
router.get('/usuarios', verificarToken, autorizarRoles('ADMIN'), obtenerUsuariosEmpresa);

router.patch('/usuarios/:usuario_id/inactivar', verificarToken, autorizarRoles('ADMIN'), inactivarUsuario);

router.patch('/usuarios/:usuario_id/reactivar', verificarToken, autorizarRoles('ADMIN'), reactivarUsuario);
module.exports = router;