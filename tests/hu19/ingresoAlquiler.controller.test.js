jest.mock('../../src/config/db', () => ({
  getConnection: jest.fn(),
  sql: {
    Int: 'Int'
  }
}));

jest.mock('../../src/models/ingresoAlquiler.model', () => ({
  listarCategoriasIngreso: jest.fn(),
  listarCuentasIngresoPorEmpresa: jest.fn(),
  listarRecibosPendientesIngreso: jest.fn(),
  obtenerCuentaPorEmpresa: jest.fn(),
  obtenerCategoriaIngresoPorId: jest.fn(),
  obtenerReciboPendientePorEmpresa: jest.fn(),
  registrarIngresoAlquiler: jest.fn(),
  listarIngresosAlquiler: jest.fn()
}));

const { getConnection } = require('../../src/config/db');
const ingresoModel = require('../../src/models/ingresoAlquiler.model');

const {
  obtenerDatosFormularioIngreso,
  listarRecibosPendientes,
  listarIngresos,
  registrarIngreso
} = require('../../src/controllers/ingresoAlquiler.controller');

const crearResponseMock = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
};

const crearRequestMock = ({
  body = {},
  usuario = {
    usuario_id: 1,
    empresa_id: 6,
    roles: ['ADMIN']
  }
} = {}) => ({
  body,
  usuario
});

const crearBodyIngresoValido = () => ({
  cuenta_bancaria_id: 3,
  categoria_movimiento_id: 8,
  recibo_id: 15,
  importe: 500,
  metodo_pago: 'TRANSFERENCIA',
  fecha_movimiento: '2026-07-15',
  concepto: 'Ingreso por alquiler julio',
  descripcion: 'Pago de alquiler correspondiente a julio',
  referencia_externa: 'OP-001',
  observaciones: 'Pago registrado manualmente'
});

const crearReciboPendienteMock = () => ({
  recibo_id: 15,
  empresa_id: 6,
  estado_recibo: 'EMITIDO',
  total: 500,
  saldo_pendiente: 500
});

const configurarEmpresaSecretarioMock = (empresaId = 6) => {
  const requestMock = {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockResolvedValue({
      recordset: [
        {
          empresa_id: empresaId
        }
      ]
    })
  };

  getConnection.mockResolvedValue({
    request: jest.fn(() => requestMock)
  });

  return requestMock;
};

describe('HU19 - ingresoAlquiler.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('CP-HU19-BE-01 obtiene datos del formulario como ADMIN correctamente', async () => {
    const categoriasMock = [
      {
        categoria_movimiento_id: 8,
        nombre: 'Alquiler',
        naturaleza: 'INGRESO',
        activo: true
      }
    ];

    const cuentasMock = [
      {
        cuenta_bancaria_id: 3,
        empresa_id: 6,
        nombre_cuenta: 'Caja Principal',
        saldo_actual: 1000
      }
    ];

    const recibosMock = [crearReciboPendienteMock()];

    ingresoModel.listarCategoriasIngreso.mockResolvedValue(categoriasMock);
    ingresoModel.listarCuentasIngresoPorEmpresa.mockResolvedValue(cuentasMock);
    ingresoModel.listarRecibosPendientesIngreso.mockResolvedValue(recibosMock);

    const req = crearRequestMock();
    const res = crearResponseMock();

    await obtenerDatosFormularioIngreso(req, res);

    expect(ingresoModel.listarCategoriasIngreso).toHaveBeenCalled();
    expect(ingresoModel.listarCuentasIngresoPorEmpresa).toHaveBeenCalledWith(6);
    expect(ingresoModel.listarRecibosPendientesIngreso).toHaveBeenCalledWith(6);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Datos para el formulario de ingreso obtenidos correctamente.',
      empresa_id: 6,
      categorias: categoriasMock,
      cuentas: cuentasMock,
      recibos_pendientes: recibosMock
    });
  });

  test('CP-HU19-BE-02 obtiene empresa gestionada cuando el usuario es SECRETARIO', async () => {
    configurarEmpresaSecretarioMock(9);

    ingresoModel.listarCategoriasIngreso.mockResolvedValue([]);
    ingresoModel.listarCuentasIngresoPorEmpresa.mockResolvedValue([]);
    ingresoModel.listarRecibosPendientesIngreso.mockResolvedValue([]);

    const req = crearRequestMock({
      usuario: {
        usuario_id: 20,
        empresa_id: null,
        roles: ['SECRETARIO']
      }
    });

    const res = crearResponseMock();

    await obtenerDatosFormularioIngreso(req, res);

    expect(ingresoModel.listarCuentasIngresoPorEmpresa).toHaveBeenCalledWith(9);
    expect(ingresoModel.listarRecibosPendientesIngreso).toHaveBeenCalledWith(9);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        empresa_id: 9
      })
    );
  });

  test('CP-HU19-BE-03 retorna 401 si no identifica empresa gestionada al cargar formulario', async () => {
    const req = crearRequestMock({
      usuario: null
    });

    const res = crearResponseMock();

    await obtenerDatosFormularioIngreso(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se pudo identificar la empresa gestionada por el usuario autenticado.'
    });
  });

  test('CP-HU19-BE-04 retorna 500 si falla la carga del formulario', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    ingresoModel.listarCategoriasIngreso.mockRejectedValue(
      new Error('Error simulado')
    );

    const req = crearRequestMock();
    const res = crearResponseMock();

    await obtenerDatosFormularioIngreso(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al obtener los datos del formulario.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU19-BE-05 lista recibos pendientes de ingreso correctamente', async () => {
    const recibosMock = [crearReciboPendienteMock()];

    ingresoModel.listarRecibosPendientesIngreso.mockResolvedValue(recibosMock);

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarRecibosPendientes(req, res);

    expect(ingresoModel.listarRecibosPendientesIngreso).toHaveBeenCalledWith(6);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Recibos pendientes de ingreso obtenidos correctamente.',
      empresa_id: 6,
      recibos: recibosMock
    });
  });

  test('CP-HU19-BE-06 retorna 500 si falla el listado de recibos pendientes', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    ingresoModel.listarRecibosPendientesIngreso.mockRejectedValue(
      new Error('Error simulado')
    );

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarRecibosPendientes(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al listar los recibos pendientes de ingreso.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU19-BE-07 lista ingresos de alquiler correctamente', async () => {
    const ingresosMock = [
      {
        movimiento_bancario_id: 30,
        concepto: 'Ingreso por alquiler julio',
        importe: 500,
        metodo_pago: 'TRANSFERENCIA'
      }
    ];

    ingresoModel.listarIngresosAlquiler.mockResolvedValue(ingresosMock);

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarIngresos(req, res);

    expect(ingresoModel.listarIngresosAlquiler).toHaveBeenCalledWith(6);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Ingresos de alquiler obtenidos correctamente.',
      empresa_id: 6,
      ingresos: ingresosMock
    });
  });

  test('CP-HU19-BE-08 retorna 500 si falla el listado de ingresos', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    ingresoModel.listarIngresosAlquiler.mockRejectedValue(
      new Error('Error simulado')
    );

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarIngresos(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al listar los ingresos de alquiler.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU19-BE-09 valida campos obligatorios al registrar ingreso', async () => {
    const req = crearRequestMock({
      body: {}
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    const respuesta = res.json.mock.calls[0][0];

    expect(respuesta.mensaje).toBe('Datos inválidos.');
    expect(respuesta.errores).toContain('La cuenta bancaria es obligatoria.');
    expect(respuesta.errores).toContain('La categoría del ingreso es obligatoria.');
    expect(respuesta.errores).toContain('El recibo es obligatorio.');
    expect(respuesta.errores).toContain('El importe debe ser mayor a cero.');
    expect(respuesta.errores).toContain('El método de pago es obligatorio.');

    expect(ingresoModel.obtenerCuentaPorEmpresa).not.toHaveBeenCalled();
    expect(ingresoModel.registrarIngresoAlquiler).not.toHaveBeenCalled();
  });

  test('CP-HU19-BE-10 valida método de pago inválido', async () => {
    const req = crearRequestMock({
      body: {
        ...crearBodyIngresoValido(),
        metodo_pago: 'YAPE_TEST'
      }
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    const respuesta = res.json.mock.calls[0][0];

    expect(respuesta.errores).toContain('El método de pago no es válido.');
  });

  test('CP-HU19-BE-11 valida fecha de movimiento inválida', async () => {
    const req = crearRequestMock({
      body: {
        ...crearBodyIngresoValido(),
        fecha_movimiento: 'fecha-no-valida'
      }
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    const respuesta = res.json.mock.calls[0][0];

    expect(respuesta.errores).toContain('La fecha del movimiento no es válida.');
  });

  test('CP-HU19-BE-12 retorna 404 si la cuenta bancaria no pertenece a la empresa', async () => {
    ingresoModel.obtenerCuentaPorEmpresa.mockResolvedValue(null);

    const req = crearRequestMock({
      body: crearBodyIngresoValido()
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(ingresoModel.obtenerCuentaPorEmpresa).toHaveBeenCalledWith(6, 3);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró la cuenta bancaria para esta empresa.'
    });

    expect(ingresoModel.registrarIngresoAlquiler).not.toHaveBeenCalled();
  });

  test('CP-HU19-BE-13 retorna 404 si la categoría de ingreso no existe', async () => {
    ingresoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    ingresoModel.obtenerCategoriaIngresoPorId.mockResolvedValue(null);

    const req = crearRequestMock({
      body: crearBodyIngresoValido()
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(ingresoModel.obtenerCategoriaIngresoPorId).toHaveBeenCalledWith(8);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró la categoría de ingreso.'
    });

    expect(ingresoModel.registrarIngresoAlquiler).not.toHaveBeenCalled();
  });

  test('CP-HU19-BE-14 retorna 404 si el recibo no pertenece a la empresa', async () => {
    ingresoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    ingresoModel.obtenerCategoriaIngresoPorId.mockResolvedValue({
      categoria_movimiento_id: 8,
      naturaleza: 'INGRESO'
    });

    ingresoModel.obtenerReciboPendientePorEmpresa.mockResolvedValue(null);

    const req = crearRequestMock({
      body: crearBodyIngresoValido()
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(ingresoModel.obtenerReciboPendientePorEmpresa).toHaveBeenCalledWith(
      6,
      15
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró el recibo para esta empresa.'
    });

    expect(ingresoModel.registrarIngresoAlquiler).not.toHaveBeenCalled();
  });

  test('CP-HU19-BE-15 bloquea ingreso sobre recibo anulado', async () => {
    ingresoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    ingresoModel.obtenerCategoriaIngresoPorId.mockResolvedValue({
      categoria_movimiento_id: 8,
      naturaleza: 'INGRESO'
    });

    ingresoModel.obtenerReciboPendientePorEmpresa.mockResolvedValue({
      ...crearReciboPendienteMock(),
      estado_recibo: 'ANULADO'
    });

    const req = crearRequestMock({
      body: crearBodyIngresoValido()
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se puede registrar ingreso sobre un recibo anulado.'
    });

    expect(ingresoModel.registrarIngresoAlquiler).not.toHaveBeenCalled();
  });

  test('CP-HU19-BE-16 bloquea ingreso sobre recibo ya pagado', async () => {
    ingresoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    ingresoModel.obtenerCategoriaIngresoPorId.mockResolvedValue({
      categoria_movimiento_id: 8,
      naturaleza: 'INGRESO'
    });

    ingresoModel.obtenerReciboPendientePorEmpresa.mockResolvedValue({
      ...crearReciboPendienteMock(),
      estado_recibo: 'PAGADO',
      saldo_pendiente: 0
    });

    const req = crearRequestMock({
      body: crearBodyIngresoValido()
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Este recibo ya se encuentra pagado.'
    });

    expect(ingresoModel.registrarIngresoAlquiler).not.toHaveBeenCalled();
  });

  test('CP-HU19-BE-17 bloquea ingreso si importe supera saldo pendiente', async () => {
    ingresoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    ingresoModel.obtenerCategoriaIngresoPorId.mockResolvedValue({
      categoria_movimiento_id: 8,
      naturaleza: 'INGRESO'
    });

    ingresoModel.obtenerReciboPendientePorEmpresa.mockResolvedValue({
      ...crearReciboPendienteMock(),
      saldo_pendiente: 300
    });

    const req = crearRequestMock({
      body: {
        ...crearBodyIngresoValido(),
        importe: 500
      }
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El importe no puede superar el saldo pendiente del recibo.'
    });

    expect(ingresoModel.registrarIngresoAlquiler).not.toHaveBeenCalled();
  });

  test('CP-HU19-BE-18 registra ingreso de alquiler correctamente', async () => {
    const ingresoMock = {
      movimiento_bancario_id: 30,
      cuenta_bancaria_id: 3,
      categoria_movimiento_id: 8,
      recibo_id: 15,
      tipo_movimiento: 'INGRESO',
      concepto: 'Ingreso por alquiler julio',
      importe: 500,
      metodo_pago: 'TRANSFERENCIA'
    };

    ingresoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    ingresoModel.obtenerCategoriaIngresoPorId.mockResolvedValue({
      categoria_movimiento_id: 8,
      naturaleza: 'INGRESO'
    });

    ingresoModel.obtenerReciboPendientePorEmpresa.mockResolvedValue(
      crearReciboPendienteMock()
    );

    ingresoModel.registrarIngresoAlquiler.mockResolvedValue(ingresoMock);

    const req = crearRequestMock({
      body: crearBodyIngresoValido()
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(ingresoModel.registrarIngresoAlquiler).toHaveBeenCalledWith(
      6,
      1,
      expect.objectContaining({
        cuenta_bancaria_id: 3,
        categoria_movimiento_id: 8,
        recibo_id: 15,
        importe: 500,
        metodo_pago: 'TRANSFERENCIA',
        concepto: 'Ingreso por alquiler julio',
        descripcion: 'Pago de alquiler correspondiente a julio',
        referencia_externa: 'OP-001',
        observaciones: 'Pago registrado manualmente',
        fecha_movimiento: expect.any(Date)
      })
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Ingreso de alquiler registrado correctamente.',
      empresa_id: 6,
      ingreso: ingresoMock
    });
  });

  test('CP-HU19-BE-19 registra ingreso con campos opcionales en null', async () => {
    const ingresoMock = {
      movimiento_bancario_id: 31,
      cuenta_bancaria_id: 3,
      categoria_movimiento_id: 8,
      recibo_id: 15,
      tipo_movimiento: 'INGRESO',
      importe: 400,
      metodo_pago: 'EFECTIVO'
    };

    ingresoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    ingresoModel.obtenerCategoriaIngresoPorId.mockResolvedValue({
      categoria_movimiento_id: 8,
      naturaleza: 'INGRESO'
    });

    ingresoModel.obtenerReciboPendientePorEmpresa.mockResolvedValue({
      ...crearReciboPendienteMock(),
      saldo_pendiente: 500
    });

    ingresoModel.registrarIngresoAlquiler.mockResolvedValue(ingresoMock);

    const req = crearRequestMock({
      body: {
        cuenta_bancaria_id: 3,
        categoria_movimiento_id: 8,
        recibo_id: 15,
        importe: 400,
        metodo_pago: 'EFECTIVO'
      }
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(ingresoModel.registrarIngresoAlquiler).toHaveBeenCalledWith(
      6,
      1,
      expect.objectContaining({
        concepto: null,
        descripcion: null,
        referencia_externa: null,
        observaciones: null,
        metodo_pago: 'EFECTIVO'
      })
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('CP-HU19-BE-20 retorna 400 si el modelo lanza error controlado', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    ingresoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    ingresoModel.obtenerCategoriaIngresoPorId.mockResolvedValue({
      categoria_movimiento_id: 8,
      naturaleza: 'INGRESO'
    });

    ingresoModel.obtenerReciboPendientePorEmpresa.mockResolvedValue(
      crearReciboPendienteMock()
    );

    ingresoModel.registrarIngresoAlquiler.mockRejectedValue(
      new Error('METODO_PAGO_NO_VALIDO')
    );

    const req = crearRequestMock({
      body: crearBodyIngresoValido()
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El método de pago no es válido.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU19-BE-21 retorna 500 si falla el registro del ingreso', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    ingresoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    ingresoModel.obtenerCategoriaIngresoPorId.mockResolvedValue({
      categoria_movimiento_id: 8,
      naturaleza: 'INGRESO'
    });

    ingresoModel.obtenerReciboPendientePorEmpresa.mockResolvedValue(
      crearReciboPendienteMock()
    );

    ingresoModel.registrarIngresoAlquiler.mockRejectedValue(
      new Error('Error inesperado')
    );

    const req = crearRequestMock({
      body: crearBodyIngresoValido()
    });

    const res = crearResponseMock();

    await registrarIngreso(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al registrar el ingreso de alquiler.'
    });

    consoleErrorMock.mockRestore();
  });
});