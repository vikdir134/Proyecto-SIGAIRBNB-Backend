jest.mock('../../src/models/reserva.model', () => ({
  obtenerPublicacionReservablePorId: jest.fn(),
  buscarConflictosReserva: jest.fn(),
  crearSolicitudReserva: jest.fn(),
  listarSolicitudesPorInquilino: jest.fn(),
  listarSolicitudesGestionEmpresa: jest.fn(),
  obtenerSolicitudGestionPorId: jest.fn(),
  buscarConflictosAprobacionReserva: jest.fn(),
  aprobarSolicitudReservaPorId: jest.fn(),
  rechazarSolicitudReservaPorId: jest.fn(),
  listarEventosReservaGestion: jest.fn(),
  obtenerSolicitudInquilinoPorId: jest.fn(),
  listarEventosReservaInquilino: jest.fn(),
  obtenerVettingInquilinoReservaGestion: jest.fn(),
  registrarEvaluacionInquilinoReservaGestion: jest.fn(),
  obtenerUltimaEvaluacionInquilinoPorReserva: jest.fn(),
  registrarEventoReservaSimple: jest.fn(),
  listarEvaluacionesInquilinoReservaGestion: jest.fn(),
  registrarEvaluacionConEventoReservaGestion: jest.fn(),
  confirmarCheckinReservaGestion: jest.fn(),
  confirmarCheckoutReservaGestion: jest.fn(),
  obtenerReservaExtensibleInquilinoPorId: jest.fn(),
  obtenerSolicitudExtensionPendientePorReserva: jest.fn(),
  buscarConflictosExtensionReserva: jest.fn(),
  crearSolicitudExtensionReserva: jest.fn(),
  obtenerExtensionPendienteReservaGestion: jest.fn(),
  aprobarSolicitudExtensionReservaGestion: jest.fn(),
  rechazarSolicitudExtensionReservaGestion: jest.fn(),
  obtenerReservaParaCancelacionInquilino: jest.fn(),
  cancelarReservaPorInquilino: jest.fn(),
  obtenerEstadoFinancieroReserva: jest.fn()
}));

jest.mock('../../src/models/notificacion.model', () => ({
  crearNotificacion: jest.fn()
}));

const reservaModel = require('../../src/models/reserva.model');
const notificacionModel = require('../../src/models/notificacion.model');

const {
  cancelarReservaInquilino
} = require('../../src/controllers/reserva.controller');

const crearResponseMock = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
};

const crearRequestMock = ({
  reserva_id = '15',
  body = {},
  usuario = {
    usuario_id: 8,
    empresa_id: 6,
    correo: 'inquilino@test.com',
    roles: ['CLIENTE']
  }
} = {}) => ({
  params: {
    reserva_id
  },
  body,
  usuario
});

describe('HU14 - cancelarReservaInquilino', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('retorna 400 si el ID de reserva no es válido', async () => {
    const req = crearRequestMock({
      reserva_id: 'abc'
    });

    const res = crearResponseMock();

    await cancelarReservaInquilino(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El ID de la reserva no es válido'
    });

    expect(
      reservaModel.obtenerReservaParaCancelacionInquilino
    ).not.toHaveBeenCalled();

    expect(
      reservaModel.cancelarReservaPorInquilino
    ).not.toHaveBeenCalled();
  });

  test('retorna 404 si la reserva no existe o no pertenece al inquilino', async () => {
    reservaModel.obtenerReservaParaCancelacionInquilino.mockResolvedValue(null);

    const req = crearRequestMock({
      reserva_id: '15'
    });

    const res = crearResponseMock();

    await cancelarReservaInquilino(req, res);

    expect(
      reservaModel.obtenerReservaParaCancelacionInquilino
    ).toHaveBeenCalledWith(15, 8);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'No se encontró la reserva o no pertenece al inquilino autenticado'
    });

    expect(
      reservaModel.cancelarReservaPorInquilino
    ).not.toHaveBeenCalled();
  });

  test('retorna 409 si la reserva no está en estado cancelable', async () => {
    reservaModel.obtenerReservaParaCancelacionInquilino.mockResolvedValue({
      reserva_id: 15,
      inquilino_id: 8,
      estado_reserva: 'ACTIVA'
    });

    const req = crearRequestMock({
      reserva_id: '15'
    });

    const res = crearResponseMock();

    await cancelarReservaInquilino(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'La reserva no puede cancelarse porque se encuentra en estado ACTIVA',
      estado_actual: 'ACTIVA'
    });

    expect(
      reservaModel.obtenerEstadoFinancieroReserva
    ).not.toHaveBeenCalled();

    expect(
      reservaModel.cancelarReservaPorInquilino
    ).not.toHaveBeenCalled();
  });

  test('retorna 409 si la reserva ya tiene una boleta pagada', async () => {
    reservaModel.obtenerReservaParaCancelacionInquilino.mockResolvedValue({
      reserva_id: 15,
      inquilino_id: 8,
      estado_reserva: 'APROBADA'
    });

    reservaModel.obtenerEstadoFinancieroReserva.mockResolvedValue({
      recibo_id: 20,
      estado_recibo: 'PAGADO',
      total: 500,
      saldo_pendiente: 0,
      tiene_pago_confirmado: 1
    });

    const req = crearRequestMock({
      reserva_id: '15'
    });

    const res = crearResponseMock();

    await cancelarReservaInquilino(req, res);

    expect(
      reservaModel.obtenerEstadoFinancieroReserva
    ).toHaveBeenCalledWith(15);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      codigo: 'RESERVA_CON_RECIBO_PAGADO',
      mensaje:
        'La reserva ya tiene una boleta pagada. No puede cancelarse directamente. Debe solicitar revisión al administrador.',
      recibo: {
        recibo_id: 20,
        estado_recibo: 'PAGADO',
        total: 500,
        saldo_pendiente: 0
      }
    });

    expect(
      reservaModel.cancelarReservaPorInquilino
    ).not.toHaveBeenCalled();
  });

  test('cancela correctamente una reserva SOLICITADA sin crear notificación si no hay anfitrión', async () => {
    reservaModel.obtenerReservaParaCancelacionInquilino.mockResolvedValue({
      reserva_id: 15,
      empresa_id: 6,
      inmueble_id: 3,
      inquilino_id: 8,
      estado_reserva: 'SOLICITADA',
      nombre_inmueble: 'Departamento 101',
      codigo_inmueble: 'DEP-101',
      anfitrion_usuario_id: null
    });

    reservaModel.obtenerEstadoFinancieroReserva.mockResolvedValue(null);

    reservaModel.cancelarReservaPorInquilino.mockResolvedValue({
      reserva_id: 15,
      inmueble_id: 3,
      inquilino_id: 8,
      estado_reserva: 'CANCELADA',
      motivo_cancelacion: 'Cambio de planes',
      cancelado_por_usuario_id: 8
    });

    const req = crearRequestMock({
      reserva_id: '15',
      body: {
        motivo: '  Cambio de planes  '
      }
    });

    const res = crearResponseMock();

    await cancelarReservaInquilino(req, res);

    expect(
      reservaModel.cancelarReservaPorInquilino
    ).toHaveBeenCalledWith({
      reserva_id: 15,
      usuario_id: 8,
      motivo: 'Cambio de planes'
    });

    expect(
      notificacionModel.crearNotificacion
    ).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Reserva cancelada correctamente',
      reserva: {
        reserva_id: 15,
        inmueble_id: 3,
        inquilino_id: 8,
        estado_reserva: 'CANCELADA',
        motivo_cancelacion: 'Cambio de planes',
        cancelado_por_usuario_id: 8
      },
      notificacion: null
    });
  });

  test('cancela correctamente una reserva APROBADA y crea notificación al anfitrión', async () => {
    reservaModel.obtenerReservaParaCancelacionInquilino.mockResolvedValue({
      reserva_id: 18,
      empresa_id: 6,
      inmueble_id: 4,
      inquilino_id: 8,
      estado_reserva: 'APROBADA',
      nombre_inmueble: 'Local Comercial 2',
      codigo_inmueble: 'LOC-002',
      anfitrion_usuario_id: 3
    });

    reservaModel.obtenerEstadoFinancieroReserva.mockResolvedValue({
      recibo_id: 30,
      estado_recibo: 'EMITIDO',
      total: 700,
      saldo_pendiente: 700,
      tiene_pago_confirmado: 0
    });

    reservaModel.cancelarReservaPorInquilino.mockResolvedValue({
      reserva_id: 18,
      inmueble_id: 4,
      inquilino_id: 8,
      estado_reserva: 'CANCELADA',
      motivo_cancelacion: 'Ya no ocuparé el inmueble',
      cancelado_por_usuario_id: 8
    });

    notificacionModel.crearNotificacion.mockResolvedValue({
      notificacion_id: 100,
      usuario_destino_id: 3,
      tipo_notificacion: 'RESERVA_CANCELADA_INQUILINO',
      titulo: 'Reserva cancelada'
    });

    const req = crearRequestMock({
      reserva_id: '18',
      body: {
        motivo: 'Ya no ocuparé el inmueble'
      }
    });

    const res = crearResponseMock();

    await cancelarReservaInquilino(req, res);

    expect(
      reservaModel.cancelarReservaPorInquilino
    ).toHaveBeenCalledWith({
      reserva_id: 18,
      usuario_id: 8,
      motivo: 'Ya no ocuparé el inmueble'
    });

    expect(
      notificacionModel.crearNotificacion
    ).toHaveBeenCalledWith({
      empresa_id: 6,
      usuario_origen_id: 8,
      usuario_destino_id: 3,
      tipo_notificacion: 'RESERVA_CANCELADA_INQUILINO',
      titulo: 'Reserva cancelada',
      mensaje:
        'El inquilino canceló la reserva del inmueble Local Comercial 2.',
      referencia_tipo: 'RESERVA',
      referencia_id: 18
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Reserva cancelada correctamente',
      reserva: {
        reserva_id: 18,
        inmueble_id: 4,
        inquilino_id: 8,
        estado_reserva: 'CANCELADA',
        motivo_cancelacion: 'Ya no ocuparé el inmueble',
        cancelado_por_usuario_id: 8
      },
      notificacion: {
        notificacion_id: 100,
        usuario_destino_id: 3,
        tipo_notificacion: 'RESERVA_CANCELADA_INQUILINO',
        titulo: 'Reserva cancelada'
      }
    });
  });

  test('envía motivo null cuando el motivo viene vacío', async () => {
    reservaModel.obtenerReservaParaCancelacionInquilino.mockResolvedValue({
      reserva_id: 19,
      empresa_id: 6,
      inmueble_id: 5,
      inquilino_id: 8,
      estado_reserva: 'SOLICITADA',
      nombre_inmueble: 'Habitación A',
      codigo_inmueble: 'HAB-A',
      anfitrion_usuario_id: null
    });

    reservaModel.obtenerEstadoFinancieroReserva.mockResolvedValue(null);

    reservaModel.cancelarReservaPorInquilino.mockResolvedValue({
      reserva_id: 19,
      estado_reserva: 'CANCELADA',
      motivo_cancelacion: null
    });

    const req = crearRequestMock({
      reserva_id: '19',
      body: {
        motivo: '     '
      }
    });

    const res = crearResponseMock();

    await cancelarReservaInquilino(req, res);

    expect(
      reservaModel.cancelarReservaPorInquilino
    ).toHaveBeenCalledWith({
      reserva_id: 19,
      usuario_id: 8,
      motivo: null
    });

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('retorna 500 si ocurre un error inesperado', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    reservaModel.obtenerReservaParaCancelacionInquilino.mockRejectedValue(
      new Error('Error simulado de base de datos')
    );

    const req = crearRequestMock({
      reserva_id: '15'
    });

    const res = crearResponseMock();

    await cancelarReservaInquilino(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al cancelar la reserva',
      error: 'Error simulado de base de datos'
    });

    consoleErrorMock.mockRestore();
  });
});