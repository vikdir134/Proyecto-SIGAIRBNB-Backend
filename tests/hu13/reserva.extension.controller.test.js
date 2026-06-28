jest.mock('../../src/models/reserva.model', () => ({
  obtenerReservaExtensibleInquilinoPorId: jest.fn(),
  obtenerSolicitudExtensionPendientePorReserva: jest.fn(),
  buscarConflictosExtensionReserva: jest.fn(),
  crearSolicitudExtensionReserva: jest.fn(),
  aprobarSolicitudExtensionReservaGestion: jest.fn(),
  rechazarSolicitudExtensionReservaGestion: jest.fn()
}));

jest.mock('../../src/models/notificacion.model', () => ({
  crearNotificacion: jest.fn()
}));

const reservaModel = require('../../src/models/reserva.model');

const {
  solicitarExtensionReserva,
  aprobarSolicitudExtension,
  rechazarSolicitudExtension
} = require('../../src/controllers/reserva.controller');

const crearMockResponse = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
};

describe('HU13 - Solicitud de extensión de reserva', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('BE-HU13-01: Debe permitir solicitar extensión con datos válidos', async () => {
    reservaModel.obtenerReservaExtensibleInquilinoPorId.mockResolvedValue({
      reserva_id: 17,
      inmueble_id: 6,
      inquilino_id: 8,
      empresa_id: 6,
      estado_reserva: 'APROBADA',
      fecha_inicio: '2026-07-09',
      fecha_fin: '2026-07-10',
      codigo_inmueble: 'LOC-101',
      nombre_inmueble: 'Local 101',
      titulo_publicacion: 'Local comercial'
    });

    reservaModel.obtenerSolicitudExtensionPendientePorReserva.mockResolvedValue(null);

    reservaModel.buscarConflictosExtensionReserva.mockResolvedValue({
      bloqueos: [],
      reservas: []
    });

    reservaModel.crearSolicitudExtensionReserva.mockResolvedValue({
      solicitud_extension: {
        solicitud_extension_id: 1,
        reserva_id: 17,
        solicitante_usuario_id: 8,
        nueva_fecha_fin: '2026-07-13',
        motivo: 'Necesito quedarme unos días más',
        estado: 'PENDIENTE'
      },
      evento: {
        reserva_evento_id: 100,
        reserva_id: 17,
        tipo_evento: 'EXTENSION',
        descripcion: 'El inquilino envió una solicitud de extensión de la reserva.'
      }
    });

    const req = {
      usuario: {
        usuario_id: 8
      },
      params: {
        reserva_id: '17'
      },
      body: {
        nueva_fecha_fin: '2026-07-13',
        motivo: 'Necesito quedarme unos días más'
      }
    };

    const res = crearMockResponse();

    await solicitarExtensionReserva(req, res);

    expect(reservaModel.obtenerReservaExtensibleInquilinoPorId).toHaveBeenCalledWith(
      8,
      17
    );

    expect(reservaModel.obtenerSolicitudExtensionPendientePorReserva).toHaveBeenCalledWith(
      17
    );

    expect(reservaModel.buscarConflictosExtensionReserva).toHaveBeenCalledWith({
      empresa_id: 6,
      inmueble_id: 6,
      reserva_id: 17,
      fecha_fin_actual: '2026-07-10',
      nueva_fecha_fin: '2026-07-13'
    });

    expect(reservaModel.crearSolicitudExtensionReserva).toHaveBeenCalledWith({
      reserva_id: 17,
      solicitante_usuario_id: 8,
      nueva_fecha_fin: '2026-07-13',
      motivo: 'Necesito quedarme unos días más'
    });

    expect(res.status).toHaveBeenCalledWith(201);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Solicitud de extensión enviada correctamente',
      reserva: {
        reserva_id: 17,
        inmueble_id: 6,
        estado_reserva: 'APROBADA',
        fecha_inicio: '2026-07-09',
        fecha_fin_actual: '2026-07-10',
        codigo_inmueble: 'LOC-101',
        nombre_inmueble: 'Local 101',
        titulo_publicacion: 'Local comercial'
      },
      solicitud_extension: {
        solicitud_extension_id: 1,
        reserva_id: 17,
        solicitante_usuario_id: 8,
        nueva_fecha_fin: '2026-07-13',
        motivo: 'Necesito quedarme unos días más',
        estado: 'PENDIENTE'
      },
      evento: {
        reserva_evento_id: 100,
        reserva_id: 17,
        tipo_evento: 'EXTENSION',
        descripcion: 'El inquilino envió una solicitud de extensión de la reserva.'
      }
    });
  });

  test('BE-HU13-02: Debe rechazar solicitud con ID de reserva inválido', async () => {
    const req = {
      usuario: {
        usuario_id: 8
      },
      params: {
        reserva_id: 'abc'
      },
      body: {
        nueva_fecha_fin: '2026-07-13',
        motivo: 'Motivo válido'
      }
    };

    const res = crearMockResponse();

    await solicitarExtensionReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El ID de la reserva no es válido'
    });

    expect(reservaModel.obtenerReservaExtensibleInquilinoPorId).not.toHaveBeenCalled();
  });

  test('BE-HU13-03: Debe rechazar nueva fecha con formato incorrecto', async () => {
    const req = {
      usuario: {
        usuario_id: 8
      },
      params: {
        reserva_id: '17'
      },
      body: {
        nueva_fecha_fin: '13/07/2026',
        motivo: 'Motivo válido'
      }
    };

    const res = crearMockResponse();

    await solicitarExtensionReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'La nueva fecha de finalización debe tener formato YYYY-MM-DD'
    });

    expect(reservaModel.obtenerReservaExtensibleInquilinoPorId).not.toHaveBeenCalled();
  });

  test('BE-HU13-04: Debe rechazar motivo mayor a 500 caracteres', async () => {
    const req = {
      usuario: {
        usuario_id: 8
      },
      params: {
        reserva_id: '17'
      },
      body: {
        nueva_fecha_fin: '2026-07-13',
        motivo: 'a'.repeat(501)
      }
    };

    const res = crearMockResponse();

    await solicitarExtensionReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El motivo de la extensión no puede superar los 500 caracteres'
    });

    expect(reservaModel.obtenerReservaExtensibleInquilinoPorId).not.toHaveBeenCalled();
  });

  test('BE-HU13-05: Debe devolver 404 si la reserva no existe o no pertenece al inquilino', async () => {
    reservaModel.obtenerReservaExtensibleInquilinoPorId.mockResolvedValue(null);

    const req = {
      usuario: {
        usuario_id: 8
      },
      params: {
        reserva_id: '99'
      },
      body: {
        nueva_fecha_fin: '2026-07-13',
        motivo: 'Motivo válido'
      }
    };

    const res = crearMockResponse();

    await solicitarExtensionReserva(req, res);

    expect(reservaModel.obtenerReservaExtensibleInquilinoPorId).toHaveBeenCalledWith(
      8,
      99
    );

    expect(res.status).toHaveBeenCalledWith(404);

    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'La reserva no existe, no pertenece a tu usuario o no se encuentra disponible para solicitar una extensión'
    });

    expect(reservaModel.crearSolicitudExtensionReserva).not.toHaveBeenCalled();
  });

  test('BE-HU13-06: Debe rechazar si la nueva fecha no es posterior a la fecha final actual', async () => {
    reservaModel.obtenerReservaExtensibleInquilinoPorId.mockResolvedValue({
      reserva_id: 17,
      inmueble_id: 6,
      inquilino_id: 8,
      empresa_id: 6,
      estado_reserva: 'APROBADA',
      fecha_inicio: '2026-07-09',
      fecha_fin: '2026-07-10'
    });

    const req = {
      usuario: {
        usuario_id: 8
      },
      params: {
        reserva_id: '17'
      },
      body: {
        nueva_fecha_fin: '2026-07-10',
        motivo: 'Motivo válido'
      }
    };

    const res = crearMockResponse();

    await solicitarExtensionReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'La nueva fecha de finalización debe ser posterior a la fecha final actual',
      fecha_fin_actual: '2026-07-10',
      nueva_fecha_fin: '2026-07-10'
    });

    expect(reservaModel.obtenerSolicitudExtensionPendientePorReserva).not.toHaveBeenCalled();
    expect(reservaModel.crearSolicitudExtensionReserva).not.toHaveBeenCalled();
  });

  test('BE-HU13-07: Debe rechazar si ya existe una solicitud pendiente', async () => {
    const solicitudPendiente = {
      solicitud_extension_id: 5,
      reserva_id: 17,
      estado: 'PENDIENTE',
      nueva_fecha_fin: '2026-07-13'
    };

    reservaModel.obtenerReservaExtensibleInquilinoPorId.mockResolvedValue({
      reserva_id: 17,
      inmueble_id: 6,
      inquilino_id: 8,
      empresa_id: 6,
      estado_reserva: 'APROBADA',
      fecha_inicio: '2026-07-09',
      fecha_fin: '2026-07-10'
    });

    reservaModel.obtenerSolicitudExtensionPendientePorReserva.mockResolvedValue(
      solicitudPendiente
    );

    const req = {
      usuario: {
        usuario_id: 8
      },
      params: {
        reserva_id: '17'
      },
      body: {
        nueva_fecha_fin: '2026-07-13',
        motivo: 'Motivo válido'
      }
    };

    const res = crearMockResponse();

    await solicitarExtensionReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(409);

    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'Ya existe una solicitud de extensión pendiente para esta reserva',
      solicitud_extension_pendiente: solicitudPendiente
    });

    expect(reservaModel.buscarConflictosExtensionReserva).not.toHaveBeenCalled();
    expect(reservaModel.crearSolicitudExtensionReserva).not.toHaveBeenCalled();
  });

  test('BE-HU13-08: Debe rechazar si existen conflictos de disponibilidad', async () => {
    const bloqueo = {
      bloqueo_disponibilidad_id: 10,
      fecha_inicio: '2026-07-11',
      fecha_fin: '2026-07-12',
      motivo: 'Mantenimiento'
    };

    reservaModel.obtenerReservaExtensibleInquilinoPorId.mockResolvedValue({
      reserva_id: 17,
      inmueble_id: 6,
      inquilino_id: 8,
      empresa_id: 6,
      estado_reserva: 'APROBADA',
      fecha_inicio: '2026-07-09',
      fecha_fin: '2026-07-10'
    });

    reservaModel.obtenerSolicitudExtensionPendientePorReserva.mockResolvedValue(null);

    reservaModel.buscarConflictosExtensionReserva.mockResolvedValue({
      bloqueos: [bloqueo],
      reservas: []
    });

    const req = {
      usuario: {
        usuario_id: 8
      },
      params: {
        reserva_id: '17'
      },
      body: {
        nueva_fecha_fin: '2026-07-13',
        motivo: 'Motivo válido'
      }
    };

    const res = crearMockResponse();

    await solicitarExtensionReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(409);

    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'No se puede solicitar la extensión porque el inmueble no está disponible durante todo el periodo adicional',
      fecha_fin_actual: '2026-07-10',
      nueva_fecha_fin: '2026-07-13',
      bloqueos_solapados: [bloqueo],
      reservas_solapadas: []
    });

    expect(reservaModel.crearSolicitudExtensionReserva).not.toHaveBeenCalled();
  });

  test('BE-HU13-09: Debe aprobar una solicitud de extensión pendiente', async () => {
    reservaModel.aprobarSolicitudExtensionReservaGestion.mockResolvedValue({
      codigo: 'OK',
      solicitud_extension: {
        solicitud_extension_id: 1,
        reserva_id: 17,
        estado: 'APROBADA',
        nueva_fecha_fin: '2026-07-13'
      },
      reserva: {
        reserva_id: 17,
        fecha_fin: '2026-07-13'
      },
      evento: {
        reserva_evento_id: 200,
        tipo_evento: 'EXTENSION'
      }
    });

    const req = {
      usuario: {
        usuario_id: 1
      },
      params: {
        solicitud_extension_id: '1'
      },
      body: {
        comentario_decision: 'Extensión aprobada'
      }
    };

    const res = crearMockResponse();

    await aprobarSolicitudExtension(req, res);

    expect(reservaModel.aprobarSolicitudExtensionReservaGestion).toHaveBeenCalledWith({
      usuario_gestor_id: 1,
      solicitud_extension_id: 1,
      comentario_decision: 'Extensión aprobada'
    });

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Solicitud de extensión aprobada correctamente',
      solicitud_extension: {
        solicitud_extension_id: 1,
        reserva_id: 17,
        estado: 'APROBADA',
        nueva_fecha_fin: '2026-07-13'
      },
      reserva: {
        reserva_id: 17,
        fecha_fin: '2026-07-13'
      },
      evento: {
        reserva_evento_id: 200,
        tipo_evento: 'EXTENSION'
      }
    });
  });

  test('BE-HU13-10: Debe rechazar aprobación con ID inválido', async () => {
    const req = {
      usuario: {
        usuario_id: 1
      },
      params: {
        solicitud_extension_id: 'abc'
      },
      body: {
        comentario_decision: 'Comentario válido'
      }
    };

    const res = crearMockResponse();

    await aprobarSolicitudExtension(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El ID de la solicitud de extensión no es válido'
    });

    expect(reservaModel.aprobarSolicitudExtensionReservaGestion).not.toHaveBeenCalled();
  });

  test('BE-HU13-11: Debe devolver 404 si la solicitud a aprobar no existe o ya no está pendiente', async () => {
    reservaModel.aprobarSolicitudExtensionReservaGestion.mockResolvedValue({
      codigo: 'NO_DISPONIBLE'
    });

    const req = {
      usuario: {
        usuario_id: 1
      },
      params: {
        solicitud_extension_id: '99'
      },
      body: {
        comentario_decision: 'Comentario válido'
      }
    };

    const res = crearMockResponse();

    await aprobarSolicitudExtension(req, res);

    expect(res.status).toHaveBeenCalledWith(404);

    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'La solicitud de extensión no existe, no pertenece a tus inmuebles o ya no está pendiente'
    });
  });

  test('BE-HU13-12: Debe rechazar aprobación si aparece conflicto de disponibilidad', async () => {
    const reservaSolapada = {
      reserva_id: 44,
      fecha_inicio: '2026-07-11',
      fecha_fin: '2026-07-15'
    };

    reservaModel.aprobarSolicitudExtensionReservaGestion.mockResolvedValue({
      codigo: 'CONFLICTO_DISPONIBILIDAD',
      bloqueos: [],
      reservas: [reservaSolapada]
    });

    const req = {
      usuario: {
        usuario_id: 1
      },
      params: {
        solicitud_extension_id: '1'
      },
      body: {
        comentario_decision: 'Comentario válido'
      }
    };

    const res = crearMockResponse();

    await aprobarSolicitudExtension(req, res);

    expect(res.status).toHaveBeenCalledWith(409);

    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'No se puede aprobar la extensión porque el inmueble ya no está disponible durante todo el periodo adicional',
      bloqueos_solapados: [],
      reservas_solapadas: [reservaSolapada]
    });
  });

  test('BE-HU13-13: Debe rechazar correctamente una solicitud de extensión', async () => {
    reservaModel.rechazarSolicitudExtensionReservaGestion.mockResolvedValue({
      solicitud_extension: {
        solicitud_extension_id: 1,
        reserva_id: 17,
        estado: 'RECHAZADA',
        comentario_decision: 'No hay disponibilidad'
      },
      evento: {
        reserva_evento_id: 201,
        tipo_evento: 'EXTENSION',
        descripcion: 'La solicitud de extensión de la reserva fue rechazada.'
      }
    });

    const req = {
      usuario: {
        usuario_id: 1
      },
      params: {
        solicitud_extension_id: '1'
      },
      body: {
        comentario_decision: 'No hay disponibilidad'
      }
    };

    const res = crearMockResponse();

    await rechazarSolicitudExtension(req, res);

    expect(reservaModel.rechazarSolicitudExtensionReservaGestion).toHaveBeenCalledWith({
      usuario_gestor_id: 1,
      solicitud_extension_id: 1,
      comentario_decision: 'No hay disponibilidad'
    });

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Solicitud de extensión rechazada correctamente',
      solicitud_extension: {
        solicitud_extension_id: 1,
        reserva_id: 17,
        estado: 'RECHAZADA',
        comentario_decision: 'No hay disponibilidad'
      },
      evento: {
        reserva_evento_id: 201,
        tipo_evento: 'EXTENSION',
        descripcion: 'La solicitud de extensión de la reserva fue rechazada.'
      }
    });
  });

  test('BE-HU13-14: Debe rechazar si no se ingresa motivo de rechazo', async () => {
    const req = {
      usuario: {
        usuario_id: 1
      },
      params: {
        solicitud_extension_id: '1'
      },
      body: {
        comentario_decision: ''
      }
    };

    const res = crearMockResponse();

    await rechazarSolicitudExtension(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Debes ingresar el motivo del rechazo'
    });

    expect(reservaModel.rechazarSolicitudExtensionReservaGestion).not.toHaveBeenCalled();
  });

  test('BE-HU13-15: Debe rechazar motivo de rechazo mayor a 500 caracteres', async () => {
    const req = {
      usuario: {
        usuario_id: 1
      },
      params: {
        solicitud_extension_id: '1'
      },
      body: {
        comentario_decision: 'a'.repeat(501)
      }
    };

    const res = crearMockResponse();

    await rechazarSolicitudExtension(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El motivo del rechazo no puede superar los 500 caracteres'
    });

    expect(reservaModel.rechazarSolicitudExtensionReservaGestion).not.toHaveBeenCalled();
  });

  test('BE-HU13-16: Debe devolver 404 si la solicitud a rechazar no existe o ya no está pendiente', async () => {
    reservaModel.rechazarSolicitudExtensionReservaGestion.mockResolvedValue(null);

    const req = {
      usuario: {
        usuario_id: 1
      },
      params: {
        solicitud_extension_id: '99'
      },
      body: {
        comentario_decision: 'No procede la extensión'
      }
    };

    const res = crearMockResponse();

    await rechazarSolicitudExtension(req, res);

    expect(res.status).toHaveBeenCalledWith(404);

    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'La solicitud de extensión no existe, no pertenece a tus inmuebles o ya no está pendiente'
    });
  });
});