jest.mock('../../src/models/mantenimiento.model', () => ({
  listarCategoriasGasto: jest.fn(),
  listarCuentasMantenimientoPorEmpresa: jest.fn(),
  listarInmueblesParaGasto: jest.fn(),
  obtenerCuentaPorEmpresa: jest.fn(),
  obtenerCategoriaGastoPorId: jest.fn(),
  obtenerInmueblePorEmpresa: jest.fn(),
  registrarGastoMantenimiento: jest.fn(),
  listarGastosMantenimiento: jest.fn()
}));

const mantenimientoModel = require('../../src/models/mantenimiento.model');

const {
  obtenerDatosFormularioGasto,
  listarGastos,
  registrarGasto
} = require('../../src/controllers/mantenimiento.controller');

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

const crearBodyGastoValido = () => ({
  cuenta_bancaria_id: 3,
  categoria_movimiento_id: 5,
  inmueble_id: 10,
  fecha_movimiento: '2026-07-15',
  concepto: 'Reparación de tubería',
  descripcion: 'Servicio técnico por reparación de fuga',
  importe: 250,
  referencia_externa: 'FAC-001',
  observaciones: 'Trabajo realizado correctamente'
});

describe('HU18 - mantenimiento.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('CP-HU18-BE-01 obtiene datos del formulario de gasto correctamente', async () => {
    const categoriasMock = [
      {
        categoria_movimiento_id: 5,
        nombre: 'Mantenimiento',
        naturaleza: 'GASTO',
        activo: true
      }
    ];

    const cuentasMock = [
      {
        cuenta_bancaria_id: 3,
        empresa_id: 6,
        nombre_cuenta: 'Caja Principal de Mantenimiento',
        moneda: 'PEN',
        saldo_actual: 1000
      }
    ];

    const inmueblesMock = [
      {
        inmueble_id: 10,
        codigo: 'DEP-101',
        nombre: 'Departamento 101',
        tipo_inmueble: 'LOCAL'
      }
    ];

    mantenimientoModel.listarCategoriasGasto.mockResolvedValue(categoriasMock);
    mantenimientoModel.listarCuentasMantenimientoPorEmpresa.mockResolvedValue(cuentasMock);
    mantenimientoModel.listarInmueblesParaGasto.mockResolvedValue(inmueblesMock);

    const req = crearRequestMock();
    const res = crearResponseMock();

    await obtenerDatosFormularioGasto(req, res);

    expect(mantenimientoModel.listarCategoriasGasto).toHaveBeenCalled();
    expect(
      mantenimientoModel.listarCuentasMantenimientoPorEmpresa
    ).toHaveBeenCalledWith(6);
    expect(mantenimientoModel.listarInmueblesParaGasto).toHaveBeenCalledWith(6);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Datos para el formulario de gasto obtenidos correctamente.',
      categorias: categoriasMock,
      cuentas: cuentasMock,
      inmuebles: inmueblesMock
    });
  });

  test('CP-HU18-BE-02 retorna 500 si falla la obtención del formulario', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mantenimientoModel.listarCategoriasGasto.mockRejectedValue(
      new Error('Error simulado')
    );

    const req = crearRequestMock();
    const res = crearResponseMock();

    await obtenerDatosFormularioGasto(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al obtener los datos del formulario.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU18-BE-03 lista gastos de mantenimiento correctamente', async () => {
    const gastosMock = [
      {
        movimiento_bancario_id: 20,
        concepto: 'Reparación de tubería',
        importe: 250,
        categoria: 'Mantenimiento',
        nombre_cuenta: 'Caja Principal de Mantenimiento',
        inmueble: 'Departamento 101'
      }
    ];

    mantenimientoModel.listarGastosMantenimiento.mockResolvedValue(gastosMock);

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarGastos(req, res);

    expect(mantenimientoModel.listarGastosMantenimiento).toHaveBeenCalledWith(6);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Gastos de mantenimiento obtenidos correctamente.',
      gastos: gastosMock
    });
  });

  test('CP-HU18-BE-04 retorna 500 si falla el listado de gastos', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mantenimientoModel.listarGastosMantenimiento.mockRejectedValue(
      new Error('Error simulado')
    );

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarGastos(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al listar los gastos de mantenimiento.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU18-BE-05 valida campos obligatorios al registrar gasto', async () => {
    const req = crearRequestMock({
      body: {}
    });

    const res = crearResponseMock();

    await registrarGasto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    const respuesta = res.json.mock.calls[0][0];

    expect(respuesta.mensaje).toBe('Datos inválidos.');
    expect(respuesta.errores).toContain('La cuenta bancaria es obligatoria.');
    expect(respuesta.errores).toContain('La categoría del gasto es obligatoria.');
    expect(respuesta.errores).toContain('El concepto del gasto es obligatorio.');
    expect(respuesta.errores).toContain('El importe debe ser mayor a cero.');

    expect(mantenimientoModel.obtenerCuentaPorEmpresa).not.toHaveBeenCalled();
    expect(mantenimientoModel.registrarGastoMantenimiento).not.toHaveBeenCalled();
  });

  test('CP-HU18-BE-06 valida fecha de movimiento inválida', async () => {
    const req = crearRequestMock({
      body: {
        ...crearBodyGastoValido(),
        fecha_movimiento: 'fecha-no-valida'
      }
    });

    const res = crearResponseMock();

    await registrarGasto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    const respuesta = res.json.mock.calls[0][0];

    expect(respuesta.errores).toContain('La fecha del movimiento no es válida.');
  });

  test('CP-HU18-BE-07 valida inmueble inválido', async () => {
    const req = crearRequestMock({
      body: {
        ...crearBodyGastoValido(),
        inmueble_id: -1
      }
    });

    const res = crearResponseMock();

    await registrarGasto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    const respuesta = res.json.mock.calls[0][0];

    expect(respuesta.errores).toContain('El inmueble seleccionado no es válido.');
  });

  test('CP-HU18-BE-08 retorna 404 si la cuenta bancaria no pertenece a la empresa', async () => {
    mantenimientoModel.obtenerCuentaPorEmpresa.mockResolvedValue(null);

    const req = crearRequestMock({
      body: crearBodyGastoValido()
    });

    const res = crearResponseMock();

    await registrarGasto(req, res);

    expect(mantenimientoModel.obtenerCuentaPorEmpresa).toHaveBeenCalledWith(
      6,
      3
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró la cuenta bancaria para esta empresa.'
    });

    expect(mantenimientoModel.registrarGastoMantenimiento).not.toHaveBeenCalled();
  });

  test('CP-HU18-BE-09 retorna 404 si la categoría de gasto no existe', async () => {
    mantenimientoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    mantenimientoModel.obtenerCategoriaGastoPorId.mockResolvedValue(null);

    const req = crearRequestMock({
      body: crearBodyGastoValido()
    });

    const res = crearResponseMock();

    await registrarGasto(req, res);

    expect(mantenimientoModel.obtenerCategoriaGastoPorId).toHaveBeenCalledWith(5);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró la categoría de gasto.'
    });

    expect(mantenimientoModel.registrarGastoMantenimiento).not.toHaveBeenCalled();
  });

  test('CP-HU18-BE-10 retorna 404 si el inmueble no pertenece a la empresa', async () => {
    mantenimientoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    mantenimientoModel.obtenerCategoriaGastoPorId.mockResolvedValue({
      categoria_movimiento_id: 5,
      naturaleza: 'GASTO'
    });

    mantenimientoModel.obtenerInmueblePorEmpresa.mockResolvedValue(null);

    const req = crearRequestMock({
      body: crearBodyGastoValido()
    });

    const res = crearResponseMock();

    await registrarGasto(req, res);

    expect(mantenimientoModel.obtenerInmueblePorEmpresa).toHaveBeenCalledWith(
      6,
      10
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró el inmueble seleccionado.'
    });

    expect(mantenimientoModel.registrarGastoMantenimiento).not.toHaveBeenCalled();
  });

  test('CP-HU18-BE-11 registra gasto de mantenimiento correctamente con inmueble', async () => {
    const gastoMock = {
      movimiento_bancario_id: 20,
      cuenta_bancaria_id: 3,
      categoria_movimiento_id: 5,
      inmueble_id: 10,
      tipo_movimiento: 'GASTO',
      concepto: 'Reparación de tubería',
      importe: 250
    };

    mantenimientoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    mantenimientoModel.obtenerCategoriaGastoPorId.mockResolvedValue({
      categoria_movimiento_id: 5,
      naturaleza: 'GASTO'
    });

    mantenimientoModel.obtenerInmueblePorEmpresa.mockResolvedValue({
      inmueble_id: 10,
      empresa_id: 6
    });

    mantenimientoModel.registrarGastoMantenimiento.mockResolvedValue(gastoMock);

    const req = crearRequestMock({
      body: crearBodyGastoValido()
    });

    const res = crearResponseMock();

    await registrarGasto(req, res);

    expect(mantenimientoModel.registrarGastoMantenimiento).toHaveBeenCalledWith(
      6,
      expect.objectContaining({
        cuenta_bancaria_id: 3,
        categoria_movimiento_id: 5,
        inmueble_id: 10,
        reserva_id: null,
        concepto: 'Reparación de tubería',
        descripcion: 'Servicio técnico por reparación de fuga',
        importe: 250,
        referencia_externa: 'FAC-001',
        observaciones: 'Trabajo realizado correctamente',
        fecha_movimiento: expect.any(Date)
      })
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Gasto de mantenimiento registrado correctamente.',
      gasto: gastoMock
    });
  });

  test('CP-HU18-BE-12 registra gasto correctamente sin inmueble asociado', async () => {
    const gastoMock = {
      movimiento_bancario_id: 21,
      cuenta_bancaria_id: 3,
      categoria_movimiento_id: 5,
      inmueble_id: null,
      tipo_movimiento: 'GASTO',
      concepto: 'Compra de materiales',
      importe: 180
    };

    mantenimientoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    mantenimientoModel.obtenerCategoriaGastoPorId.mockResolvedValue({
      categoria_movimiento_id: 5,
      naturaleza: 'GASTO'
    });

    mantenimientoModel.registrarGastoMantenimiento.mockResolvedValue(gastoMock);

    const req = crearRequestMock({
      body: {
        ...crearBodyGastoValido(),
        inmueble_id: '',
        concepto: 'Compra de materiales',
        importe: 180
      }
    });

    const res = crearResponseMock();

    await registrarGasto(req, res);

    expect(mantenimientoModel.obtenerInmueblePorEmpresa).not.toHaveBeenCalled();

    expect(mantenimientoModel.registrarGastoMantenimiento).toHaveBeenCalledWith(
      6,
      expect.objectContaining({
        inmueble_id: null,
        concepto: 'Compra de materiales',
        importe: 180
      })
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('CP-HU18-BE-13 retorna 400 si el modelo detecta cuenta no válida', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mantenimientoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    mantenimientoModel.obtenerCategoriaGastoPorId.mockResolvedValue({
      categoria_movimiento_id: 5,
      naturaleza: 'GASTO'
    });

    mantenimientoModel.obtenerInmueblePorEmpresa.mockResolvedValue({
      inmueble_id: 10,
      empresa_id: 6
    });

    mantenimientoModel.registrarGastoMantenimiento.mockRejectedValue(
      new Error('CUENTA_NO_VALIDA')
    );

    const req = crearRequestMock({
      body: crearBodyGastoValido()
    });

    const res = crearResponseMock();

    await registrarGasto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'La cuenta bancaria no es válida para esta empresa.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU18-BE-14 retorna 500 si falla el registro del gasto', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mantenimientoModel.obtenerCuentaPorEmpresa.mockResolvedValue({
      cuenta_bancaria_id: 3,
      empresa_id: 6
    });

    mantenimientoModel.obtenerCategoriaGastoPorId.mockResolvedValue({
      categoria_movimiento_id: 5,
      naturaleza: 'GASTO'
    });

    mantenimientoModel.obtenerInmueblePorEmpresa.mockResolvedValue({
      inmueble_id: 10,
      empresa_id: 6
    });

    mantenimientoModel.registrarGastoMantenimiento.mockRejectedValue(
      new Error('Error inesperado')
    );

    const req = crearRequestMock({
      body: crearBodyGastoValido()
    });

    const res = crearResponseMock();

    await registrarGasto(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al registrar el gasto de mantenimiento.'
    });

    consoleErrorMock.mockRestore();
  });
});