jest.mock('../../src/models/recibo.model', () => ({
  obtenerVistaPreviaReciboReservaGestion: jest.fn(),
  generarReciboReservaGestion: jest.fn(),
  listarRecibosReservaAutorizados: jest.fn(),
  obtenerReciboCompletoAutorizado: jest.fn()
}));

jest.mock('../../src/models/notificacion.model', () => ({
  crearNotificacion: jest.fn()
}));

jest.mock('../../src/utils/generarReciboPdf', () => ({
  generarReciboPdfBuffer: jest.fn()
}));

const reciboModel = require('../../src/models/recibo.model');

const {
  generarReciboPdfBuffer
} = require('../../src/utils/generarReciboPdf');

const {
  previsualizarReciboReserva,
  generarReciboReserva,
  obtenerRecibosReserva,
  obtenerReciboDetalle,
  descargarReciboPdf
} = require('../../src/controllers/recibo.controller');

const crearResponseMock = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);

  return res;
};

const crearRequestMock = ({
  params = {},
  body = {},
  query = {},
  usuario = {
    usuario_id: 3,
    empresa_id: 6,
    correo: 'admin@test.com',
    roles: ['ADMIN']
  }
} = {}) => ({
  params,
  body,
  query,
  usuario
});

describe('HU15 - recibo.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('CP-HU15-BE-01 retorna 401 al previsualizar si el usuario autenticado no es válido', async () => {
    const req = crearRequestMock({
      params: {
        reserva_id: '15'
      },
      usuario: null
    });

    const res = crearResponseMock();

    await previsualizarReciboReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Usuario autenticado no válido'
    });

    expect(
      reciboModel.obtenerVistaPreviaReciboReservaGestion
    ).not.toHaveBeenCalled();
  });

  test('CP-HU15-BE-02 retorna 400 al previsualizar si el ID de reserva no es válido', async () => {
    const req = crearRequestMock({
      params: {
        reserva_id: 'abc'
      }
    });

    const res = crearResponseMock();

    await previsualizarReciboReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El identificador de la reserva no es válido'
    });

    expect(
      reciboModel.obtenerVistaPreviaReciboReservaGestion
    ).not.toHaveBeenCalled();
  });

  test('CP-HU15-BE-03 genera correctamente la vista previa de la boleta', async () => {
    reciboModel.obtenerVistaPreviaReciboReservaGestion.mockResolvedValue({
      ok: true,
      reserva: {
        reserva_id: 15,
        estado_reserva: 'APROBADA',
        inquilino_id: 8
      },
      conceptos: [
        {
          concepto_cobro_id: 1,
          codigo_concepto: 'RENTA',
          descripcion: 'Renta de reserva',
          importe: 1000
        }
      ],
      subtotal: 1000,
      igv_total: 180,
      total: 1180,
      dias_reserva: 5,
      fecha_vencimiento: '2026-07-15'
    });

    const req = crearRequestMock({
      params: {
        reserva_id: '15'
      }
    });

    const res = crearResponseMock();

    await previsualizarReciboReserva(req, res);

    expect(
      reciboModel.obtenerVistaPreviaReciboReservaGestion
    ).toHaveBeenCalledWith({
      usuario_gestor_id: 3,
      reserva_id: 15
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Vista previa de boleta generada correctamente',
      reserva: {
        reserva_id: 15,
        estado_reserva: 'APROBADA',
        inquilino_id: 8
      },
      conceptos: [
        {
          concepto_cobro_id: 1,
          codigo_concepto: 'RENTA',
          descripcion: 'Renta de reserva',
          importe: 1000
        }
      ],
      subtotal: 1000,
      igv_total: 180,
      total: 1180,
      dias_reserva: 5,
      fecha_vencimiento: '2026-07-15'
    });
  });

  test('CP-HU15-BE-04 retorna 409 si ya existe una boleta para la reserva', async () => {
    reciboModel.obtenerVistaPreviaReciboReservaGestion.mockResolvedValue({
      ok: false,
      codigo: 'RECIBO_EXISTENTE',
      mensaje: 'La reserva ya tiene una boleta generada',
      recibo: {
        recibo_id: 20,
        estado_recibo: 'EMITIDO'
      },
      detalles: [
        {
          recibo_detalle_id: 1,
          descripcion: 'Renta de reserva'
        }
      ]
    });

    const req = crearRequestMock({
      params: {
        reserva_id: '15'
      }
    });

    const res = crearResponseMock();

    await previsualizarReciboReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'La reserva ya tiene una boleta generada',
      codigo: 'RECIBO_EXISTENTE',
      estado_actual: undefined,
      recibo: {
        recibo_id: 20,
        estado_recibo: 'EMITIDO'
      },
      detalles: [
        {
          recibo_detalle_id: 1,
          descripcion: 'Renta de reserva'
        }
      ]
    });
  });

  test('CP-HU15-BE-05 retorna 400 al generar boleta si el ID de reserva no es válido', async () => {
    const req = crearRequestMock({
      params: {
        reserva_id: 'abc'
      }
    });

    const res = crearResponseMock();

    await generarReciboReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El identificador de la reserva no es válido.'
    });

    expect(
      reciboModel.generarReciboReservaGestion
    ).not.toHaveBeenCalled();
  });

  test('CP-HU15-BE-06 genera correctamente la boleta digital', async () => {
    reciboModel.generarReciboReservaGestion.mockResolvedValue({
      ok: true,
      recibo: {
        recibo_id: 25,
        reserva_id: 15,
        estado_recibo: 'EMITIDO',
        subtotal: 1000,
        igv_total: 180,
        total: 1180
      },
      detalles: [
        {
          recibo_detalle_id: 1,
          descripcion: 'Renta de reserva',
          importe: 1000
        }
      ]
    });

    const req = crearRequestMock({
      params: {
        reserva_id: '15'
      },
      body: {
        observaciones: 'Boleta generada desde gestión',
        conceptos_editados: [
          {
            concepto_cobro_id: 1,
            importe: 1000
          }
        ]
      }
    });

    const res = crearResponseMock();

    await generarReciboReserva(req, res);

    expect(
      reciboModel.generarReciboReservaGestion
    ).toHaveBeenCalledWith({
      usuario_gestor_id: 3,
      reserva_id: 15,
      observaciones: 'Boleta generada desde gestión',
      conceptos_editados: [
        {
          concepto_cobro_id: 1,
          importe: 1000
        }
      ]
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Boleta digital generada correctamente.',
      recibo: {
        recibo_id: 25,
        reserva_id: 15,
        estado_recibo: 'EMITIDO',
        subtotal: 1000,
        igv_total: 180,
        total: 1180
      },
      detalles: [
        {
          recibo_detalle_id: 1,
          descripcion: 'Renta de reserva',
          importe: 1000
        }
      ]
    });
  });

  test('CP-HU15-BE-07 retorna 404 si la reserva no existe al generar boleta', async () => {
    reciboModel.generarReciboReservaGestion.mockResolvedValue({
      ok: false,
      codigo: 'RESERVA_NO_ENCONTRADA',
      mensaje: 'No se encontró la reserva o no tienes permiso para gestionarla'
    });

    const req = crearRequestMock({
      params: {
        reserva_id: '99'
      }
    });

    const res = crearResponseMock();

    await generarReciboReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró la reserva o no tienes permiso para gestionarla'
    });
  });

  test('CP-HU15-BE-08 retorna 409 si la reserva tiene un estado no permitido', async () => {
    reciboModel.generarReciboReservaGestion.mockResolvedValue({
      ok: false,
      codigo: 'ESTADO_NO_PERMITIDO',
      mensaje: 'Solo se puede generar boleta para reservas aprobadas o activas',
      estado_actual: 'SOLICITADA'
    });

    const req = crearRequestMock({
      params: {
        reserva_id: '15'
      }
    });

    const res = crearResponseMock();

    await generarReciboReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Solo se puede generar boleta para reservas aprobadas o activas',
      estado_actual: 'SOLICITADA'
    });
  });

  test('CP-HU15-BE-09 retorna 400 si la fecha de vencimiento ya expiró', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    reciboModel.generarReciboReservaGestion.mockRejectedValue(
      new Error('FECHA_VENCIMIENTO_RESERVA_EXPIRADA')
    );

    const req = crearRequestMock({
      params: {
        reserva_id: '15'
      }
    });

    const res = crearResponseMock();

    await generarReciboReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'No se puede generar la boleta porque la fecha de vencimiento ya expiró.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU15-BE-10 lista correctamente las boletas de una reserva autorizada', async () => {
    reciboModel.listarRecibosReservaAutorizados.mockResolvedValue([
      {
        recibo_id: 25,
        reserva_id: 15,
        estado_recibo: 'EMITIDO',
        total: 1180
      }
    ]);

    const req = crearRequestMock({
      params: {
        reserva_id: '15'
      },
      usuario: {
        usuario_id: 8,
        empresa_id: 6,
        roles: ['CLIENTE']
      }
    });

    const res = crearResponseMock();

    await obtenerRecibosReserva(req, res);

    expect(
      reciboModel.listarRecibosReservaAutorizados
    ).toHaveBeenCalledWith({
      usuario_id: 8,
      reserva_id: 15
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Boletas de la reserva obtenidas correctamente',
      recibos: [
        {
          recibo_id: 25,
          reserva_id: 15,
          estado_recibo: 'EMITIDO',
          total: 1180
        }
      ]
    });
  });

  test('CP-HU15-BE-11 obtiene correctamente el detalle de una boleta', async () => {
    reciboModel.obtenerReciboCompletoAutorizado.mockResolvedValue({
      recibo: {
        recibo_id: 25,
        reserva_id: 15,
        estado_recibo: 'EMITIDO',
        total: 1180
      },
      detalles: [
        {
          recibo_detalle_id: 1,
          descripcion: 'Renta de reserva',
          importe: 1000
        }
      ]
    });

    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      },
      usuario: {
        usuario_id: 8,
        empresa_id: 6,
        roles: ['CLIENTE']
      }
    });

    const res = crearResponseMock();

    await obtenerReciboDetalle(req, res);

    expect(
      reciboModel.obtenerReciboCompletoAutorizado
    ).toHaveBeenCalledWith({
      usuario_id: 8,
      recibo_id: 25
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Detalle de boleta obtenido correctamente',
      recibo: {
        recibo_id: 25,
        reserva_id: 15,
        estado_recibo: 'EMITIDO',
        total: 1180
      },
      detalles: [
        {
          recibo_detalle_id: 1,
          descripcion: 'Renta de reserva',
          importe: 1000
        }
      ]
    });
  });

  test('CP-HU15-BE-12 retorna 404 si la boleta no existe o el usuario no tiene permiso', async () => {
    reciboModel.obtenerReciboCompletoAutorizado.mockResolvedValue(null);

    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      },
      usuario: {
        usuario_id: 8,
        empresa_id: 6,
        roles: ['CLIENTE']
      }
    });

    const res = crearResponseMock();

    await obtenerReciboDetalle(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró la boleta o no tienes permiso para verla'
    });
  });

  test('CP-HU15-BE-13 descarga correctamente el PDF de la boleta como archivo adjunto', async () => {
    const pdfBufferMock = Buffer.from('PDF simulado');

    reciboModel.obtenerReciboCompletoAutorizado.mockResolvedValue({
      recibo: {
        recibo_id: 25,
        serie_empresa: 'B001',
        correlativo_empresa: 25,
        estado_recibo: 'EMITIDO',
        total: 1180
      },
      detalles: [
        {
          recibo_detalle_id: 1,
          descripcion: 'Renta de reserva',
          importe: 1000
        }
      ]
    });

    generarReciboPdfBuffer.mockResolvedValue(pdfBufferMock);

    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      },
      query: {},
      usuario: {
        usuario_id: 8,
        empresa_id: 6,
        roles: ['CLIENTE']
      }
    });

    const res = crearResponseMock();

    await descargarReciboPdf(req, res);

    expect(
      reciboModel.obtenerReciboCompletoAutorizado
    ).toHaveBeenCalledWith({
      usuario_id: 8,
      recibo_id: 25
    });

    expect(generarReciboPdfBuffer).toHaveBeenCalledWith({
      recibo: {
        recibo_id: 25,
        serie_empresa: 'B001',
        correlativo_empresa: 25,
        estado_recibo: 'EMITIDO',
        total: 1180
      },
      detalles: [
        {
          recibo_detalle_id: 1,
          descripcion: 'Renta de reserva',
          importe: 1000
        }
      ]
    });

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf'
    );

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="boleta-digital-B001-000025.pdf"'
    );

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Length',
      pdfBufferMock.length
    );

    expect(res.end).toHaveBeenCalledWith(pdfBufferMock);
  });

  test('CP-HU15-BE-14 permite visualizar el PDF en modo inline', async () => {
    const pdfBufferMock = Buffer.from('PDF simulado');

    reciboModel.obtenerReciboCompletoAutorizado.mockResolvedValue({
      recibo: {
        recibo_id: 30,
        serie_empresa: 'B001',
        correlativo_empresa: 30,
        estado_recibo: 'EMITIDO',
        total: 900
      },
      detalles: []
    });

    generarReciboPdfBuffer.mockResolvedValue(pdfBufferMock);

    const req = crearRequestMock({
      params: {
        recibo_id: '30'
      },
      query: {
        modo: 'ver'
      },
      usuario: {
        usuario_id: 8,
        empresa_id: 6,
        roles: ['CLIENTE']
      }
    });

    const res = crearResponseMock();

    await descargarReciboPdf(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'inline; filename="boleta-digital-B001-000030.pdf"'
    );

    expect(res.end).toHaveBeenCalledWith(pdfBufferMock);
  });

  test('CP-HU15-BE-15 retorna 404 si no se encuentra la boleta al descargar PDF', async () => {
    reciboModel.obtenerReciboCompletoAutorizado.mockResolvedValue(null);

    const req = crearRequestMock({
      params: {
        recibo_id: '99'
      },
      usuario: {
        usuario_id: 8,
        empresa_id: 6,
        roles: ['CLIENTE']
      }
    });

    const res = crearResponseMock();

    await descargarReciboPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró la boleta o no tienes permiso para descargarla'
    });

    expect(generarReciboPdfBuffer).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  test('CP-HU15-BE-16 retorna 400 si no existe el concepto RENTA_RESERVA al generar boleta', async () => {
    reciboModel.generarReciboReservaGestion.mockResolvedValue({
        ok: false,
        codigo: 'CONCEPTO_RENTA_NO_CONFIGURADO',
        mensaje:
        'No existe el concepto del sistema RENTA_RESERVA. Verifica la configuración de conceptos.'
    });

    const req = crearRequestMock({
        params: {
        reserva_id: '15'
        }
    });

    const res = crearResponseMock();

    await generarReciboReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
        mensaje:
        'No existe el concepto del sistema RENTA_RESERVA. Verifica la configuración de conceptos.'
    });
  });

  test('CP-HU15-BE-17 retorna 400 si la reserva no tiene renta mensual válida', async () => {
    reciboModel.generarReciboReservaGestion.mockResolvedValue({
        ok: false,
        codigo: 'RENTA_INVALIDA',
        mensaje:
        'La reserva no tiene una renta mensual válida para generar el recibo.'
    });

    const req = crearRequestMock({
        params: {
        reserva_id: '15'
        }
    });

    const res = crearResponseMock();

    await generarReciboReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
        mensaje:
        'La reserva no tiene una renta mensual válida para generar el recibo.'
    });
  });

  test('CP-HU15-BE-18 retorna 409 si no existe concepto RENTA_RESERVA al previsualizar', async () => {
    reciboModel.obtenerVistaPreviaReciboReservaGestion.mockResolvedValue({
        ok: false,
        codigo: 'CONCEPTO_RENTA_NO_CONFIGURADO',
        mensaje:
        'No existe el concepto del sistema RENTA_RESERVA. Verifica la configuración de conceptos.'
    });

    const req = crearRequestMock({
        params: {
        reserva_id: '15'
        }
    });

    const res = crearResponseMock();

    await previsualizarReciboReserva(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
        mensaje:
        'No existe el concepto del sistema RENTA_RESERVA. Verifica la configuración de conceptos.',
        codigo: 'CONCEPTO_RENTA_NO_CONFIGURADO',
        estado_actual: undefined,
        recibo: undefined,
        detalles: undefined
    });
  });
});