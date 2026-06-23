const express = require('express');
const router = express.Router();

const {
  solicitarReserva,
  obtenerMisSolicitudesReserva,
  obtenerSolicitudesGestion,
  aprobarSolicitudReserva,
  rechazarSolicitudReserva,
  obtenerEventosReservaGestion,
  obtenerDetalleMiSolicitudReserva,
  obtenerVettingInquilinoGestion,
  registrarEvaluacionInquilinoGestion,
  obtenerEvaluacionesInquilinoGestion,
  obtenerResumenVettingGestion,
  confirmarCheckinReserva,
  confirmarCheckoutReserva,
  solicitarExtensionReserva,
  aprobarSolicitudExtension,
  rechazarSolicitudExtension,
  cancelarReservaInquilino
} = require('../controllers/reserva.controller');

const {
  verificarToken,
  autorizarRoles
} = require('../middlewares/auth.middleware');

/*
  HU09 - Solicitudes propias del cliente
*/
router.get(
  '/mis-solicitudes',
  verificarToken,
  obtenerMisSolicitudesReserva
);

router.patch(
  '/:reserva_id/cancelar',
  verificarToken,
  cancelarReservaInquilino
);

router.post(
  '/solicitudes',
  verificarToken,
  solicitarReserva
);

router.get(
  '/mis-solicitudes/:reserva_id',
  verificarToken,
  obtenerDetalleMiSolicitudReserva
);

/*
  Gestión de reservas
  ADMIN y SECRETARIO pueden consultar reservas.
*/
router.get(
  '/gestion/solicitudes',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  obtenerSolicitudesGestion
);

router.get(
  '/gestion/solicitudes/:reserva_id/eventos',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  obtenerEventosReservaGestion
);

/*
  HU10 y HU11
  ADMIN y SECRETARIO pueden revisar vetting, evaluar,
  aprobar o rechazar solicitudes.
*/
router.get(
  '/gestion/vetting/resumen',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  obtenerResumenVettingGestion
);

router.get(
  '/gestion/solicitudes/:reserva_id/vetting',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  obtenerVettingInquilinoGestion
);

router.get(
  '/gestion/solicitudes/:reserva_id/evaluaciones',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  obtenerEvaluacionesInquilinoGestion
);

router.post(
  '/gestion/solicitudes/:reserva_id/evaluacion',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  registrarEvaluacionInquilinoGestion
);

router.patch(
  '/gestion/solicitudes/:reserva_id/aprobar',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  aprobarSolicitudReserva
);

router.patch(
  '/gestion/solicitudes/:reserva_id/rechazar',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  rechazarSolicitudReserva
);

/*
  HU12 - Control de ocupación
  ADMIN y SECRETARIO pueden confirmar check-in y check-out.
*/
router.patch(
  '/gestion/solicitudes/:reserva_id/checkin',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  confirmarCheckinReserva
);

router.patch(
  '/gestion/solicitudes/:reserva_id/checkout',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  confirmarCheckoutReserva
);

/*
  HU13 - Solicitud de Extensión
  El inquilino autenticado solicita ampliar la fecha final
  de una reserva aprobada o activa.
*/
router.post(
  '/mis-solicitudes/:reserva_id/extensiones',
  verificarToken,
  solicitarExtensionReserva
);

/*
  Aprobar solicitud de extensión
  Disponible para ADMIN o SECRETARIO.
*/
router.put(
  '/gestion/extensiones/:solicitud_extension_id/aprobar',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  aprobarSolicitudExtension
);

/*
  Rechazar solicitud de extensión
  Disponible para ADMIN o SECRETARIO.
*/
router.put(
  '/gestion/extensiones/:solicitud_extension_id/rechazar',
  verificarToken,
  autorizarRoles('ADMIN', 'SECRETARIO'),
  rechazarSolicitudExtension
);

module.exports = router;