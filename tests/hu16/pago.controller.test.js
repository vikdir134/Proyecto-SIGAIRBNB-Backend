jest.mock('../../src/models/pago.model', () => ({
  listarRecibosPendientesInquilino: jest.fn(),
  obtenerReciboPendienteParaPago: jest.fn(),
  registrarPagoOnline: jest.fn(),
  listarMisPagos: jest.fn()
}));

const pagoModel = require('../../src/models/pago.model');

const {
  obtenerMisRecibosPendientes,
  obtenerDetalleReciboParaPago,
  pagarReciboOnline,
  obtenerMisPagos
} = require('../../src/controllers/pago.controller');

const crearResponseMock = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
};

const crearRequestMock = ({
  params = {},
  body = {},
  usuario = {
    usuario_id: 8,
    empresa_id: 6,
    correo: 'inquilino@test.com',
    roles: ['CLIENTE']
  }
} = {}) => ({
  params,
  body,
  usuario
});

describe('HU16 - pago.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('CP-HU16-BE-01 retorna 401 si no identifica usuario al listar recibos pendientes', async () => {
    const req = crearRequestMock({
      usuario: null
    });

    const res = crearResponseMock();

    await obtenerMisRecibosPendientes(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se pudo identificar al usuario autenticado.'
    });

    expect(
      pagoModel.listarRecibosPendientesInquilino
    ).not.toHaveBeenCalled();
  });

  test('CP-HU16-BE-02 lista correctamente los recibos pendientes del inquilino', async () => {
    pagoModel.listarRecibosPendientesInquilino.mockResolvedValue([
      {
        recibo_id: 25,
        reserva_id: 15,
        estado_recibo: 'EMITIDO',
        total: 590,
        saldo_pendiente: 590,
        nombre_inmueble: 'Departamento 101'
      }
    ]);

    const req = crearRequestMock();
    const res = crearResponseMock();

    await obtenerMisRecibosPendientes(req, res);

    expect(
      pagoModel.listarRecibosPendientesInquilino
    ).toHaveBeenCalledWith(6, 8);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Recibos pendientes obtenidos correctamente.',
      recibos: [
        {
          recibo_id: 25,
          reserva_id: 15,
          estado_recibo: 'EMITIDO',
          total: 590,
          saldo_pendiente: 590,
          nombre_inmueble: 'Departamento 101'
        }
      ]
    });
  });

  test('CP-HU16-BE-03 retorna 500 si falla el listado de recibos pendientes', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    pagoModel.listarRecibosPendientesInquilino.mockRejectedValue(
      new Error('Error simulado de base de datos')
    );

    const req = crearRequestMock();
    const res = crearResponseMock();

    await obtenerMisRecibosPendientes(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al obtener los recibos pendientes.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU16-BE-04 retorna 401 si no identifica usuario al obtener detalle de recibo', async () => {
    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      },
      usuario: null
    });

    const res = crearResponseMock();

    await obtenerDetalleReciboParaPago(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se pudo identificar al usuario autenticado.'
    });

    expect(
      pagoModel.obtenerReciboPendienteParaPago
    ).not.toHaveBeenCalled();
  });

  test('CP-HU16-BE-05 retorna 400 si el recibo_id no es válido al obtener detalle', async () => {
    const req = crearRequestMock({
      params: {
        recibo_id: 'abc'
      }
    });

    const res = crearResponseMock();

    await obtenerDetalleReciboParaPago(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El recibo_id no es válido.'
    });

    expect(
      pagoModel.obtenerReciboPendienteParaPago
    ).not.toHaveBeenCalled();
  });

  test('CP-HU16-BE-06 retorna 404 si el recibo no existe o no pertenece al inquilino', async () => {
    pagoModel.obtenerReciboPendienteParaPago.mockResolvedValue(null);

    const req = crearRequestMock({
      params: {
        recibo_id: '99'
      }
    });

    const res = crearResponseMock();

    await obtenerDetalleReciboParaPago(req, res);

    expect(
      pagoModel.obtenerReciboPendienteParaPago
    ).toHaveBeenCalledWith(6, 8, 99);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Recibo no encontrado o no pertenece al inquilino.'
    });
  });

  test('CP-HU16-BE-07 obtiene correctamente el detalle de un recibo pendiente', async () => {
    pagoModel.obtenerReciboPendienteParaPago.mockResolvedValue({
      recibo_id: 25,
      reserva_id: 15,
      estado_recibo: 'EMITIDO',
      total: 590,
      saldo_pendiente: 590,
      moneda: 'PEN',
      nombre_inmueble: 'Departamento 101'
    });

    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      }
    });

    const res = crearResponseMock();

    await obtenerDetalleReciboParaPago(req, res);

    expect(
      pagoModel.obtenerReciboPendienteParaPago
    ).toHaveBeenCalledWith(6, 8, 25);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Detalle del recibo obtenido correctamente.',
      recibo: {
        recibo_id: 25,
        reserva_id: 15,
        estado_recibo: 'EMITIDO',
        total: 590,
        saldo_pendiente: 590,
        moneda: 'PEN',
        nombre_inmueble: 'Departamento 101'
      }
    });
  });

  test('CP-HU16-BE-08 retorna 401 si no identifica usuario al pagar recibo', async () => {
    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      },
      usuario: null
    });

    const res = crearResponseMock();

    await pagarReciboOnline(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se pudo identificar al usuario autenticado.'
    });

    expect(
      pagoModel.registrarPagoOnline
    ).not.toHaveBeenCalled();
  });

  test('CP-HU16-BE-09 retorna 400 si el recibo_id no es válido al pagar', async () => {
    const req = crearRequestMock({
      params: {
        recibo_id: 'abc'
      }
    });

    const res = crearResponseMock();

    await pagarReciboOnline(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El recibo_id no es válido.'
    });

    expect(
      pagoModel.registrarPagoOnline
    ).not.toHaveBeenCalled();
  });

  test('CP-HU16-BE-10 retorna 400 si el método de pago no es válido', async () => {
    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      },
      body: {
        metodo_pago: 'EFECTIVO'
      }
    });

    const res = crearResponseMock();

    await pagarReciboOnline(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Método de pago no válido.'
    });

    expect(
      pagoModel.registrarPagoOnline
    ).not.toHaveBeenCalled();
  });

  test('CP-HU16-BE-11 procesa correctamente un pago online', async () => {
    pagoModel.registrarPagoOnline.mockResolvedValue({
      ok: true,
      pago: {
        pago_id: 40,
        recibo_id: 25,
        reserva_id: 15,
        metodo_pago: 'ONLINE',
        proveedor_pasarela: 'SIMULADO',
        monto: 590,
        moneda: 'PEN',
        estado_pago: 'CONFIRMADO'
      },
      monto_pagado: 590
    });

    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      },
      body: {
        metodo_pago: 'online',
        proveedor_pasarela: 'SIMULADO',
        referencia: 'REF-001'
      }
    });

    const res = crearResponseMock();

    await pagarReciboOnline(req, res);

    expect(
      pagoModel.registrarPagoOnline
    ).toHaveBeenCalledWith({
      empresa_id: 6,
      usuario_id: 8,
      recibo_id: 25,
      metodo_pago: 'ONLINE',
      proveedor_pasarela: 'SIMULADO',
      referencia: 'REF-001'
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Pago procesado correctamente.',
      pago: {
        pago_id: 40,
        recibo_id: 25,
        reserva_id: 15,
        metodo_pago: 'ONLINE',
        proveedor_pasarela: 'SIMULADO',
        monto: 590,
        moneda: 'PEN',
        estado_pago: 'CONFIRMADO'
      },
      monto_pagado: 590
    });
  });

  test('CP-HU16-BE-12 procesa transferencia dejando proveedor_pasarela en null', async () => {
    pagoModel.registrarPagoOnline.mockResolvedValue({
      ok: true,
      pago: {
        pago_id: 41,
        recibo_id: 26,
        metodo_pago: 'TRANSFERENCIA',
        monto: 700,
        estado_pago: 'CONFIRMADO'
      },
      monto_pagado: 700
    });

    const req = crearRequestMock({
      params: {
        recibo_id: '26'
      },
      body: {
        metodo_pago: 'transferencia',
        proveedor_pasarela: 'NO_DEBE_ENVIARSE',
        referencia: 'TRANSFER-001'
      }
    });

    const res = crearResponseMock();

    await pagarReciboOnline(req, res);

    expect(
      pagoModel.registrarPagoOnline
    ).toHaveBeenCalledWith({
      empresa_id: 6,
      usuario_id: 8,
      recibo_id: 26,
      metodo_pago: 'TRANSFERENCIA',
      proveedor_pasarela: null,
      referencia: 'TRANSFER-001'
    });

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('CP-HU16-BE-13 retorna status del modelo cuando el pago no se puede procesar', async () => {
    pagoModel.registrarPagoOnline.mockResolvedValue({
      ok: false,
      status: 409,
      mensaje: 'Este recibo ya fue pagado anteriormente.'
    });

    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      },
      body: {
        metodo_pago: 'ONLINE'
      }
    });

    const res = crearResponseMock();

    await pagarReciboOnline(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Este recibo ya fue pagado anteriormente.'
    });
  });

  test('CP-HU16-BE-14 retorna 404 si el modelo lanza RECIBO_NO_VALIDO', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    pagoModel.registrarPagoOnline.mockRejectedValue(
      new Error('RECIBO_NO_VALIDO')
    );

    const req = crearRequestMock({
      params: {
        recibo_id: '99'
      }
    });

    const res = crearResponseMock();

    await pagarReciboOnline(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje:
        'El recibo no existe, no pertenece al inquilino autenticado o no está disponible para pago.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU16-BE-15 retorna 409 si el recibo ya fue pagado', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    pagoModel.registrarPagoOnline.mockRejectedValue(
      new Error('RECIBO_YA_PAGADO')
    );

    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      }
    });

    const res = crearResponseMock();

    await pagarReciboOnline(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Este recibo ya fue pagado anteriormente.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU16-BE-16 retorna 409 si el recibo está anulado', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    pagoModel.registrarPagoOnline.mockRejectedValue(
      new Error('RECIBO_ANULADO')
    );

    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      }
    });

    const res = crearResponseMock();

    await pagarReciboOnline(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se puede pagar un recibo anulado.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU16-BE-17 lista correctamente el historial de pagos del inquilino', async () => {
    pagoModel.listarMisPagos.mockResolvedValue([
      {
        pago_id: 40,
        recibo_id: 25,
        reserva_id: 15,
        metodo_pago: 'ONLINE',
        monto: 590,
        moneda: 'PEN',
        estado_pago: 'CONFIRMADO',
        nombre_inmueble: 'Departamento 101'
      }
    ]);

    const req = crearRequestMock();
    const res = crearResponseMock();

    await obtenerMisPagos(req, res);

    expect(
      pagoModel.listarMisPagos
    ).toHaveBeenCalledWith(6, 8);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Pagos obtenidos correctamente.',
      pagos: [
        {
          pago_id: 40,
          recibo_id: 25,
          reserva_id: 15,
          metodo_pago: 'ONLINE',
          monto: 590,
          moneda: 'PEN',
          estado_pago: 'CONFIRMADO',
          nombre_inmueble: 'Departamento 101'
        }
      ]
    });
  });

  test('CP-HU16-BE-18 retorna 401 si no identifica usuario al listar pagos', async () => {
    const req = crearRequestMock({
      usuario: null
    });

    const res = crearResponseMock();

    await obtenerMisPagos(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se pudo identificar al usuario autenticado.'
    });

    expect(
      pagoModel.listarMisPagos
    ).not.toHaveBeenCalled();
  });

  test('CP-HU16-BE-19 retorna 500 si ocurre error inesperado al pagar', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    pagoModel.registrarPagoOnline.mockRejectedValue(
      new Error('Error simulado de pasarela')
    );

    const req = crearRequestMock({
      params: {
        recibo_id: '25'
      }
    });

    const res = crearResponseMock();

    await pagarReciboOnline(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error simulado de pasarela'
    });

    consoleErrorMock.mockRestore();
  });
});