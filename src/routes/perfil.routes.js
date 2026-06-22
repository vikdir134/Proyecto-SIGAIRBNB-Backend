const express = require('express');
const router = express.Router();

const {
  obtenerMiPerfil,
  actualizarMiPerfil,
  actualizarMisNotificaciones
} = require('../controllers/perfil.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

// Obtener perfil del usuario autenticado
router.get('/', verificarToken, obtenerMiPerfil);

// Actualizar datos básicos del perfil
router.put('/', verificarToken, actualizarMiPerfil);

// Actualizar configuración de notificaciones
router.put('/notificaciones', verificarToken, actualizarMisNotificaciones);

module.exports = router;