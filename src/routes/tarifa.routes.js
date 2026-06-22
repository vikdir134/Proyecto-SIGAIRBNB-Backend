const express = require('express');
const router = express.Router();

const {
  listarIPC,
  registrarIPC,
  listarInmuebles,
  previsualizarAplicacionIPC,
  aplicarIPC,
  listarHistorialTarifas
} = require('../controllers/tarifa.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

router.get('/ipc', verificarToken, listarIPC);
router.post('/ipc', verificarToken, registrarIPC);

router.get('/inmuebles', verificarToken, listarInmuebles);

router.post('/previsualizar-ipc', verificarToken, previsualizarAplicacionIPC);
router.post('/aplicar-ipc', verificarToken, aplicarIPC);

router.get('/inmueble/:id/historial', verificarToken, listarHistorialTarifas);

module.exports = router;