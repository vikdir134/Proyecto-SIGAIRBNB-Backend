const express = require('express');
const router = express.Router();

const {
  registrar,
  login,
  obtenerMiPerfil,
  verificarEmail,
    solicitarRecuperacionPassword,
  restablecerPassword
} = require('../controllers/auth.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

router.post('/register', registrar);
router.post('/login', login);
router.post('/verify-email', verificarEmail);
router.get('/me', verificarToken, obtenerMiPerfil);
router.post('/forgot-password', solicitarRecuperacionPassword);
router.post('/reset-password', restablecerPassword);


module.exports = router;