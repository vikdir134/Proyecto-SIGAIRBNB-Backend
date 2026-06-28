jest.mock('../../src/models/reserva.model', () => ({
  obtenerSolicitudGestionPorId: jest.fn(),
  confirmarCheckinReservaGestion: jest.fn(),
  confirmarCheckoutReservaGestion: jest.fn()
}));

jest.mock('../../src/models/notificacion.model', () => ({
  crearNotificacion: jest.fn()
}));

const reservaModel = require('../../src/models/reserva.model');

const {
  confirmarCheckinReserva,
  confirmarCheckoutReserva
} = require('../../src/controllers/reserva.controller');

const crearMockResponse = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
};

describe('HU12 - Control de ocupación de reserva', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('HU12-BE-01: Debe confirmar check-in de una reserva APROBADA', async () => {
    reservaModel.obtenerSolicitudGestionPorId.mockResolvedValue({
      reserva_id: 15,
      inmueble_id: 6,
      inquilino_id: 8,
      estado_reserva: 'APROBADA'
    });

    reservaModel.confirmarCheckinReservaGestion.mockResolvedValue({
      reserva: {
        reserva_id: 15,
        estado_reserva: 'ACTIVA',
        fecha_checkin: '2026-06-28T00:00:00.000Z',
        checkin_confirmado_por: 1
      },
      evento: {
        reserva_evento_id: 100,
        tipo_evento: 'CHECKIN',
        descripcion: 'El gestor confirmó el check-in del inquilino.'
      }
    });

    const req = {
      usuario: {
        usuario_id: 1,
        roles: ['SECRETARIO']
      },
      params: {
        reserva_id: '15'
      }
    };

    const res = crearMockResponse();

    await confirmarCheckinReserva(req, res);

    expect(reservaModel.obtenerSolicitudGestionPorId).toHaveBeenCalledWith(
      1,
      15
    );

    expect(reservaModel.confirmarCheckinReservaGestion).toHaveBeenCalledWith({
      usuario_publicador_id: 1,
      reserva_id: 15,
      gestor_id: 1
    });

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Check-in confirmado correctamente',
      reserva: {
        reserva_id: 15,
        estado_reserva: 'ACTIVA',
        fecha_checkin: '2026-06-28T00:00:00.000Z',
        checkin_confirmado_por: 1
      },
      evento: {
        reserva_evento_id: 100,
        tipo_evento: 'CHECKIN',
        descripcion: 'El gestor confirmó el check-in del inquilino.'
      }
    });
  });

  test('HU12-BE-02: No debe confirmar check-in si la reserva no está APROBADA', async () => {
    reservaModel.obtenerSolicitudGestionPorId.mockResolvedValue({
      reserva_id: 15,
      inmueble_id: 6,
      inquilino_id: 8,
      estado_reserva: 'SOLICITADA'
    });

    const req = {
      usuario: {
        usuario_id: 1,
        roles: ['SECRETARIO']
      },
      params: {
        reserva_id: '15'
      }
    };

    const res = crearMockResponse();

    await confirmarCheckinReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Solo se puede confirmar check-in de una reserva APROBADA',
      estado_actual: 'SOLICITADA'
    });

    expect(reservaModel.confirmarCheckinReservaGestion).not.toHaveBeenCalled();
  });

  test('HU12-BE-03: No debe permitir check-in de una reserva propia', async () => {
    reservaModel.obtenerSolicitudGestionPorId.mockResolvedValue({
      reserva_id: 15,
      inmueble_id: 6,
      inquilino_id: 1,
      estado_reserva: 'APROBADA'
    });

    const req = {
      usuario: {
        usuario_id: 1,
        roles: ['SECRETARIO']
      },
      params: {
        reserva_id: '15'
      }
    };

    const res = crearMockResponse();

    await confirmarCheckinReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No puedes confirmar el check-in de tu propia reserva'
    });

    expect(reservaModel.confirmarCheckinReservaGestion).not.toHaveBeenCalled();
  });

  test('HU12-BE-04: Debe devolver 404 si la reserva no existe o no pertenece al gestor', async () => {
    reservaModel.obtenerSolicitudGestionPorId.mockResolvedValue(null);

    const req = {
      usuario: {
        usuario_id: 1,
        roles: ['ADMIN']
      },
      params: {
        reserva_id: '999'
      }
    };

    const res = crearMockResponse();

    await confirmarCheckinReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(404);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'La reserva no existe o no pertenece a tus publicaciones'
    });

    expect(reservaModel.confirmarCheckinReservaGestion).not.toHaveBeenCalled();
  });

  test('HU12-BE-05: Debe rechazar check-in con ID inválido', async () => {
    const req = {
      usuario: {
        usuario_id: 1,
        roles: ['SECRETARIO']
      },
      params: {
        reserva_id: 'abc'
      }
    };

    const res = crearMockResponse();

    await confirmarCheckinReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El ID de la reserva no es válido'
    });

    expect(reservaModel.obtenerSolicitudGestionPorId).not.toHaveBeenCalled();
    expect(reservaModel.confirmarCheckinReservaGestion).not.toHaveBeenCalled();
  });

  test('HU12-BE-06: Debe confirmar check-out de una reserva ACTIVA', async () => {
    reservaModel.obtenerSolicitudGestionPorId.mockResolvedValue({
      reserva_id: 15,
      inmueble_id: 6,
      inquilino_id: 8,
      estado_reserva: 'ACTIVA'
    });

    reservaModel.confirmarCheckoutReservaGestion.mockResolvedValue({
      reserva: {
        reserva_id: 15,
        estado_reserva: 'FINALIZADA',
        fecha_checkout: '2026-06-28T00:00:00.000Z',
        checkout_confirmado_por: 1
      },
      evento: {
        reserva_evento_id: 101,
        tipo_evento: 'CHECKOUT',
        descripcion: 'El gestor confirmó el check-out del inquilino.'
      }
    });

    const req = {
      usuario: {
        usuario_id: 1,
        roles: ['SECRETARIO']
      },
      params: {
        reserva_id: '15'
      }
    };

    const res = crearMockResponse();

    await confirmarCheckoutReserva(req, res);

    expect(reservaModel.obtenerSolicitudGestionPorId).toHaveBeenCalledWith(
      1,
      15
    );

    expect(reservaModel.confirmarCheckoutReservaGestion).toHaveBeenCalledWith({
      usuario_publicador_id: 1,
      reserva_id: 15,
      gestor_id: 1
    });

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Check-out confirmado correctamente',
      reserva: {
        reserva_id: 15,
        estado_reserva: 'FINALIZADA',
        fecha_checkout: '2026-06-28T00:00:00.000Z',
        checkout_confirmado_por: 1
      },
      evento: {
        reserva_evento_id: 101,
        tipo_evento: 'CHECKOUT',
        descripcion: 'El gestor confirmó el check-out del inquilino.'
      }
    });
  });

  test('HU12-BE-07: No debe confirmar check-out si la reserva no está ACTIVA', async () => {
    reservaModel.obtenerSolicitudGestionPorId.mockResolvedValue({
      reserva_id: 15,
      inmueble_id: 6,
      inquilino_id: 8,
      estado_reserva: 'APROBADA'
    });

    const req = {
      usuario: {
        usuario_id: 1,
        roles: ['ADMIN']
      },
      params: {
        reserva_id: '15'
      }
    };

    const res = crearMockResponse();

    await confirmarCheckoutReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Solo se puede confirmar check-out de una reserva ACTIVA',
      estado_actual: 'APROBADA'
    });

    expect(reservaModel.confirmarCheckoutReservaGestion).not.toHaveBeenCalled();
  });

  test('HU12-BE-08: No debe permitir check-out de una reserva propia', async () => {
    reservaModel.obtenerSolicitudGestionPorId.mockResolvedValue({
      reserva_id: 15,
      inmueble_id: 6,
      inquilino_id: 1,
      estado_reserva: 'ACTIVA'
    });

    const req = {
      usuario: {
        usuario_id: 1,
        roles: ['SECRETARIO']
      },
      params: {
        reserva_id: '15'
      }
    };

    const res = crearMockResponse();

    await confirmarCheckoutReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No puedes confirmar el check-out de tu propia reserva'
    });

    expect(reservaModel.confirmarCheckoutReservaGestion).not.toHaveBeenCalled();
  });
});