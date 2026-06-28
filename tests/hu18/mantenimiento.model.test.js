jest.mock('../../src/config/db', () => {
  const requestQueue = [];

  const crearRequestDefault = () => ({
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockResolvedValue({
      recordset: []
    })
  });

  const TransactionMock = jest.fn().mockImplementation(() => ({
    begin: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined)
  }));

  const RequestMock = jest.fn().mockImplementation(() => {
    if (requestQueue.length > 0) {
      return requestQueue.shift();
    }

    return crearRequestDefault();
  });

  return {
    getConnection: jest.fn(),
    sql: {
      Int: 'Int',
      DateTime2: 'DateTime2',
      NVarChar: jest.fn(() => 'NVarChar'),
      Decimal: jest.fn(() => 'Decimal'),
      Transaction: TransactionMock,
      Request: RequestMock
    },
    __requestQueue: requestQueue
  };
});

const db = require('../../src/config/db');
const { getConnection, sql } = db;

const {
  listarCategoriasGasto,
  listarCuentasMantenimientoPorEmpresa,
  listarInmueblesParaGasto,
  obtenerCuentaPorEmpresa,
  obtenerCategoriaGastoPorId,
  obtenerInmueblePorEmpresa,
  registrarGastoMantenimiento,
  listarGastosMantenimiento
} = require('../../src/models/mantenimiento.model');

const crearRequestSqlMock = (respuestaQuery) => ({
  input: jest.fn().mockReturnThis(),
  query: jest.fn().mockResolvedValue(respuestaQuery)
});

const crearGastoDataMock = () => ({
  cuenta_bancaria_id: 3,
  categoria_movimiento_id: 5,
  inmueble_id: 10,
  reserva_id: null,
  fecha_movimiento: new Date('2026-07-15'),
  concepto: 'Reparación de tubería',
  descripcion: 'Servicio técnico por reparación de fuga',
  importe: 250,
  referencia_externa: 'FAC-001',
  observaciones: 'Trabajo realizado correctamente'
});

describe('HU18 - mantenimiento.model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.__requestQueue.length = 0;
  });

  test('CP-HU18-MOD-01 lista categorías de gasto activas', async () => {
    const categoriasMock = [
      {
        categoria_movimiento_id: 5,
        nombre: 'Mantenimiento',
        naturaleza: 'GASTO',
        activo: true
      }
    ];

    const requestMock = crearRequestSqlMock({
      recordset: categoriasMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarCategoriasGasto();

    expect(resultado).toEqual(categoriasMock);
    expect(requestMock.query).toHaveBeenCalled();
  });

  test('CP-HU18-MOD-02 lista cuentas de mantenimiento por empresa', async () => {
    const cuentasMock = [
      {
        cuenta_bancaria_id: 3,
        empresa_id: 6,
        nombre_cuenta: 'Caja Principal de Mantenimiento',
        numero_cuenta: 'CAJA-EMP-6',
        moneda: 'PEN',
        saldo_actual: 1000
      }
    ];

    const requestMock = crearRequestSqlMock({
      recordset: cuentasMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarCuentasMantenimientoPorEmpresa(6);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(resultado).toEqual(cuentasMock);
  });

  test('CP-HU18-MOD-03 lista inmuebles para gasto por empresa', async () => {
    const inmueblesMock = [
      {
        inmueble_id: 10,
        codigo: 'DEP-101',
        nombre: 'Departamento 101',
        tipo_inmueble: 'LOCAL'
      }
    ];

    const requestMock = crearRequestSqlMock({
      recordset: inmueblesMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarInmueblesParaGasto(6);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(resultado).toEqual(inmueblesMock);
  });

  test('CP-HU18-MOD-04 obtiene cuenta bancaria por empresa correctamente', async () => {
    const cuentaMock = {
      cuenta_bancaria_id: 3,
      empresa_id: 6,
      saldo_actual: 1000,
      moneda: 'PEN',
      activa: true
    };

    const requestMock = crearRequestSqlMock({
      recordset: [cuentaMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerCuentaPorEmpresa(6, 3);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(requestMock.input).toHaveBeenCalledWith(
      'cuenta_bancaria_id',
      'Int',
      3
    );

    expect(resultado).toEqual(cuentaMock);
  });

  test('CP-HU18-MOD-05 retorna undefined si no encuentra cuenta bancaria', async () => {
    const requestMock = crearRequestSqlMock({
      recordset: []
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerCuentaPorEmpresa(6, 99);

    expect(resultado).toBeUndefined();
  });

  test('CP-HU18-MOD-06 obtiene categoría de gasto por ID correctamente', async () => {
    const categoriaMock = {
      categoria_movimiento_id: 5,
      nombre: 'Mantenimiento',
      naturaleza: 'GASTO',
      activo: true
    };

    const requestMock = crearRequestSqlMock({
      recordset: [categoriaMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerCategoriaGastoPorId(5);

    expect(requestMock.input).toHaveBeenCalledWith(
      'categoria_movimiento_id',
      'Int',
      5
    );

    expect(resultado).toEqual(categoriaMock);
  });

  test('CP-HU18-MOD-07 obtiene inmueble por empresa correctamente', async () => {
    const inmuebleMock = {
      inmueble_id: 10,
      empresa_id: 6,
      codigo: 'DEP-101',
      nombre: 'Departamento 101',
      tipo_inmueble: 'LOCAL',
      activo: true
    };

    const requestMock = crearRequestSqlMock({
      recordset: [inmuebleMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerInmueblePorEmpresa(6, 10);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(requestMock.input).toHaveBeenCalledWith('inmueble_id', 'Int', 10);

    expect(resultado).toEqual(inmuebleMock);
  });

  test('CP-HU18-MOD-08 lista gastos de mantenimiento por empresa', async () => {
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

    const requestMock = crearRequestSqlMock({
      recordset: gastosMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarGastosMantenimiento(6);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(resultado).toEqual(gastosMock);
  });

  test('CP-HU18-MOD-09 registra gasto de mantenimiento y actualiza saldo', async () => {
    const gastoInsertadoMock = {
      movimiento_bancario_id: 20,
      cuenta_bancaria_id: 3,
      categoria_movimiento_id: 5,
      tipo_movimiento: 'GASTO',
      inmueble_id: 10,
      concepto: 'Reparación de tubería',
      importe: 250,
      saldo_anterior: 1000,
      saldo_posterior: 750
    };

    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [
        {
          cuenta_bancaria_id: 3,
          empresa_id: 6,
          saldo_actual: 1000,
          moneda: 'PEN'
        }
      ]
    });

    const insertRequestMock = crearRequestSqlMock({
      recordset: [gastoInsertadoMock]
    });

    const updateRequestMock = crearRequestSqlMock({
      recordset: []
    });

    db.__requestQueue.push(
      cuentaRequestMock,
      insertRequestMock,
      updateRequestMock
    );

    getConnection.mockResolvedValue({});

    const resultado = await registrarGastoMantenimiento(
      6,
      crearGastoDataMock()
    );

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.begin).toHaveBeenCalled();
    expect(transaction.commit).toHaveBeenCalled();
    expect(transaction.rollback).not.toHaveBeenCalled();

    expect(insertRequestMock.input).toHaveBeenCalledWith(
      'tipo_movimiento',
      sql.NVarChar(20),
      'GASTO'
    );

    expect(insertRequestMock.input).toHaveBeenCalledWith(
      'importe',
      sql.Decimal(14, 2),
      250
    );

    expect(insertRequestMock.input).toHaveBeenCalledWith(
      'saldo_anterior',
      sql.Decimal(14, 2),
      1000
    );

    expect(insertRequestMock.input).toHaveBeenCalledWith(
      'saldo_posterior',
      sql.Decimal(14, 2),
      750
    );

    expect(updateRequestMock.input).toHaveBeenCalledWith(
      'saldo_actual',
      sql.Decimal(14, 2),
      750
    );

    expect(resultado).toEqual(gastoInsertadoMock);
  });

  test('CP-HU18-MOD-10 registra gasto con campos opcionales en null', async () => {
    const gastoInsertadoMock = {
      movimiento_bancario_id: 21,
      cuenta_bancaria_id: 3,
      categoria_movimiento_id: 5,
      tipo_movimiento: 'GASTO',
      inmueble_id: null,
      reserva_id: null,
      concepto: 'Compra de materiales',
      importe: 180
    };

    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [
        {
          cuenta_bancaria_id: 3,
          empresa_id: 6,
          saldo_actual: 500,
          moneda: 'PEN'
        }
      ]
    });

    const insertRequestMock = crearRequestSqlMock({
      recordset: [gastoInsertadoMock]
    });

    const updateRequestMock = crearRequestSqlMock({
      recordset: []
    });

    db.__requestQueue.push(
      cuentaRequestMock,
      insertRequestMock,
      updateRequestMock
    );

    getConnection.mockResolvedValue({});

    const resultado = await registrarGastoMantenimiento(6, {
      cuenta_bancaria_id: 3,
      categoria_movimiento_id: 5,
      inmueble_id: null,
      reserva_id: null,
      fecha_movimiento: new Date('2026-07-15'),
      concepto: 'Compra de materiales',
      importe: 180
    });

    expect(insertRequestMock.input).toHaveBeenCalledWith(
      'inmueble_id',
      'Int',
      null
    );

    expect(insertRequestMock.input).toHaveBeenCalledWith(
      'reserva_id',
      'Int',
      null
    );

    expect(insertRequestMock.input).toHaveBeenCalledWith(
      'descripcion',
      sql.NVarChar(500),
      null
    );

    expect(insertRequestMock.input).toHaveBeenCalledWith(
      'referencia_externa',
      sql.NVarChar(150),
      null
    );

    expect(insertRequestMock.input).toHaveBeenCalledWith(
      'observaciones',
      sql.NVarChar(500),
      null
    );

    expect(resultado).toEqual(gastoInsertadoMock);
  });

  test('CP-HU18-MOD-11 lanza CUENTA_NO_VALIDA y ejecuta rollback', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    db.__requestQueue.push(cuentaRequestMock);

    getConnection.mockResolvedValue({});

    await expect(
      registrarGastoMantenimiento(6, crearGastoDataMock())
    ).rejects.toThrow('CUENTA_NO_VALIDA');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.begin).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU18-MOD-12 ejecuta rollback si falla la inserción del gasto', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [
        {
          cuenta_bancaria_id: 3,
          empresa_id: 6,
          saldo_actual: 1000,
          moneda: 'PEN'
        }
      ]
    });

    const insertRequestMock = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockRejectedValue(new Error('Error al insertar gasto'))
    };

    db.__requestQueue.push(cuentaRequestMock, insertRequestMock);

    getConnection.mockResolvedValue({});

    await expect(
      registrarGastoMantenimiento(6, crearGastoDataMock())
    ).rejects.toThrow('Error al insertar gasto');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.begin).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });
});