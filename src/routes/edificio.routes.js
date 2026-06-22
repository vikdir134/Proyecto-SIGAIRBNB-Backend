const express = require('express');
const router = express.Router(); 

const {
  crearEdificio,
  obtenerEdificios,
  crearPisoLocal,
  obtenerUnidadesPorEdificio,
  obtenerUnidadPorId,

  // HU05 - Mantenimiento de Datos
  obtenerInmueblesMantenimiento,
  obtenerInmuebleMantenimientoPorId,
  darBajaInmueble,
  actualizarInmueble,
  obtenerCatalogoCaracteristicas,
  obtenerCaracteristicasDeInmueble,
  actualizarCaracteristicasDeInmueble
} = require('../controllers/edificio.controller');

const {
  verificarToken
} = require('../middlewares/auth.middleware');

router.post('/', verificarToken, crearEdificio);
router.get('/', verificarToken, obtenerEdificios);

/*
  HU04 - Registrar Piso/Local
  Registra una unidad asociada obligatoriamente a un edificio.
  En BD se inserta en catalog.Inmueble con:
  tipo_inmueble = 'PISO' o 'LOCAL'
  edificio_id = ID del edificio padre
*/
router.post('/unidades', verificarToken, crearPisoLocal);
router.get('/unidades/:unidad_id', verificarToken, obtenerUnidadPorId);

/*
  HU05 - Mantenimiento de Datos
  Permite listar, consultar, editar y dar de baja lógica a inmuebles.
*/
router.get('/mantenimiento/caracteristicas', verificarToken, obtenerCatalogoCaracteristicas);

router.get('/mantenimiento/inmuebles', verificarToken, obtenerInmueblesMantenimiento);
router.get('/mantenimiento/inmuebles/:inmueble_id', verificarToken, obtenerInmuebleMantenimientoPorId);
router.patch('/mantenimiento/inmuebles/:inmueble_id/baja', verificarToken, darBajaInmueble);
router.put('/mantenimiento/inmuebles/:inmueble_id', verificarToken, actualizarInmueble);

router.get('/mantenimiento/inmuebles/:inmueble_id/caracteristicas', verificarToken, obtenerCaracteristicasDeInmueble);
router.put('/mantenimiento/inmuebles/:inmueble_id/caracteristicas', verificarToken, actualizarCaracteristicasDeInmueble);

router.get('/:edificio_id/unidades', verificarToken, obtenerUnidadesPorEdificio);

module.exports = router;