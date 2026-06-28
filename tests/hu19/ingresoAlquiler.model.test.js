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
      Char: jest.fn(() => 'Char'),
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
  listarCategoriasIngreso,
  listarCuentasIngresoPorEmpresa,
  listarRecibosPendientesIngreso,
  obtenerCuentaPorEmpresa,
  obtenerCategoriaIngresoPorId,
  obtenerReciboPendientePorEmpresa,
  registrarIngresoAlquiler,
  listarIngresosAlquiler
} = require('../../src/models/ingresoAlquiler.model');

const crearRequestSqlMock = (respuestaQuery) => ({
  input: jest.fn().mockReturnThis(),
  query: jest.fn().mockResolvedValue(respuestaQuery)
});

const crearDataIngresoMock = () => ({
  cuenta_bancaria_id: 3,
  categoria_movimiento_id: 8,
  recibo_id: 15,
  importe: 500,
  metodo_pago: 'TRANSFERENCIA',
  fecha_movimiento: new Date('2026-07-15'),
  concepto: 'Ingreso por alquiler julio',
  descripcion: 'Pago de alquiler correspondiente a julio',
  referencia_externa: 'OP-001',
  observaciones: 'Pago registrado manualmente'
});

const crearCuentaMock = () => ({
  cuenta_bancaria_id: 3,
  empresa_id: 6,
  saldo_actual: 1000,
  moneda: 'PEN'
});

const crearCategoriaMock = () => ({
  categoria_movimiento_id: 8,
  nombre: 'Alquiler',
  naturaleza: 'INGRESO',
  activo: true
});

const crearReciboMock = (overrides = {}) => ({
  recibo_id: 15,
  reserva_id: 44,
  estado_recibo: 'EMITIDO',
  total: 500,
  saldo_pendiente: 500,
  inquilino_id: 13,
  moneda: 'PEN',
  inmueble_id: 10,
  empresa_id: 6,
  codigo_inmueble: 'DEP-101',
  nombre_inmueble: 'Departamento 101',
  ...overrides
});

describe('HU19 - ingresoAlquiler.model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.__requestQueue.length = 0;
  });

  test('CP-HU19-MOD-01 lista categorías de ingreso activas', async () => {
    const categoriasMock = [crearCategoriaMock()];

    const requestMock = crearRequestSqlMock({
      recordset: categoriasMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarCategoriasIngreso();

    expect(resultado).toEqual(categoriasMock);
    expect(requestMock.query).toHaveBeenCalled();
  });

  test('CP-HU19-MOD-02 lista cuentas de ingreso por empresa', async () => {
    const cuentasMock = [
      {
        cuenta_bancaria_id: 3,
        empresa_id: 6,
        nombre_cuenta: 'Caja Principal',
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

    const resultado = await listarCuentasIngresoPorEmpresa(6);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(resultado).toEqual(cuentasMock);
  });

  test('CP-HU19-MOD-03 lista recibos pendientes de ingreso por empresa', async () => {
    const recibosMock = [
      {
        recibo_id: 15,
        reserva_id: 44,
        saldo_pendiente: 500,
        nombre_inmueble: 'Departamento 101'
      }
    ];

    const requestMock = crearRequestSqlMock({
      recordset: recibosMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarRecibosPendientesIngreso(6);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(resultado).toEqual(recibosMock);
  });

  test('CP-HU19-MOD-04 obtiene cuenta bancaria por empresa correctamente', async () => {
    const cuentaMock = crearCuentaMock();

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

  test('CP-HU19-MOD-05 retorna undefined si no encuentra cuenta bancaria', async () => {
    const requestMock = crearRequestSqlMock({
      recordset: []
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerCuentaPorEmpresa(6, 99);

    expect(resultado).toBeUndefined();
  });

  test('CP-HU19-MOD-06 obtiene categoría de ingreso por ID correctamente', async () => {
    const categoriaMock = crearCategoriaMock();

    const requestMock = crearRequestSqlMock({
      recordset: [categoriaMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerCategoriaIngresoPorId(8);

    expect(requestMock.input).toHaveBeenCalledWith(
      'categoria_movimiento_id',
      'Int',
      8
    );

    expect(resultado).toEqual(categoriaMock);
  });

  test('CP-HU19-MOD-07 obtiene recibo pendiente por empresa correctamente', async () => {
    const reciboMock = crearReciboMock();

    const requestMock = crearRequestSqlMock({
      recordset: [reciboMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerReciboPendientePorEmpresa(6, 15);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(requestMock.input).toHaveBeenCalledWith('recibo_id', 'Int', 15);

    expect(resultado).toEqual(reciboMock);
  });

  test('CP-HU19-MOD-08 lista ingresos de alquiler por empresa', async () => {
    const ingresosMock = [
      {
        pago_id: 50,
        recibo_id: 15,
        importe: 500,
        metodo_pago: 'TRANSFERENCIA',
        concepto: 'Ingreso por alquiler julio',
        inmueble: 'Departamento 101'
      }
    ];

    const requestMock = crearRequestSqlMock({
      recordset: ingresosMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarIngresosAlquiler(6);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(resultado).toEqual(ingresosMock);
  });

  test('CP-HU19-MOD-09 registra ingreso completo y actualiza recibo como pagado', async () => {
    const pagoMock = {
      pago_id: 50,
      recibo_id: 15,
      reserva_id: 44,
      metodo_pago: 'TRANSFERENCIA',
      monto: 500,
      estado_pago: 'CONFIRMADO'
    };

    const movimientoMock = {
      movimiento_bancario_id: 70,
      pago_id: 50,
      tipo_movimiento: 'INGRESO',
      importe: 500,
      saldo_anterior: 1000,
      saldo_posterior: 1500
    };

    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [crearCuentaMock()]
    });

    const categoriaRequestMock = crearRequestSqlMock({
      recordset: [crearCategoriaMock()]
    });

    const reciboRequestMock = crearRequestSqlMock({
      recordset: [crearReciboMock()]
    });

    const pagoRequestMock = crearRequestSqlMock({
      recordset: [pagoMock]
    });

    const movimientoRequestMock = crearRequestSqlMock({
      recordset: [movimientoMock]
    });

    const actualizarCuentaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    const actualizarReciboRequestMock = crearRequestSqlMock({
      recordset: []
    });

    db.__requestQueue.push(
      cuentaRequestMock,
      categoriaRequestMock,
      reciboRequestMock,
      pagoRequestMock,
      movimientoRequestMock,
      actualizarCuentaRequestMock,
      actualizarReciboRequestMock
    );

    getConnection.mockResolvedValue({});

    const resultado = await registrarIngresoAlquiler(
      6,
      1,
      crearDataIngresoMock()
    );

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.begin).toHaveBeenCalled();
    expect(transaction.commit).toHaveBeenCalled();
    expect(transaction.rollback).not.toHaveBeenCalled();

    expect(pagoRequestMock.input).toHaveBeenCalledWith(
      'metodo_pago',
      sql.NVarChar(20),
      'TRANSFERENCIA'
    );

    expect(pagoRequestMock.input).toHaveBeenCalledWith(
      'monto',
      sql.Decimal(12, 2),
      500
    );

    expect(movimientoRequestMock.input).toHaveBeenCalledWith(
      'tipo_movimiento',
      sql.NVarChar(20),
      'INGRESO'
    );

    expect(movimientoRequestMock.input).toHaveBeenCalledWith(
      'importe',
      sql.Decimal(14, 2),
      500
    );

    expect(movimientoRequestMock.input).toHaveBeenCalledWith(
      'saldo_anterior',
      sql.Decimal(14, 2),
      1000
    );

    expect(movimientoRequestMock.input).toHaveBeenCalledWith(
      'saldo_posterior',
      sql.Decimal(14, 2),
      1500
    );

    expect(actualizarCuentaRequestMock.input).toHaveBeenCalledWith(
      'saldo_actual',
      sql.Decimal(14, 2),
      1500
    );

    expect(actualizarReciboRequestMock.input).toHaveBeenCalledWith(
      'estado_recibo',
      sql.NVarChar(20),
      'PAGADO'
    );

    expect(actualizarReciboRequestMock.input).toHaveBeenCalledWith(
      'saldo_pendiente',
      sql.Decimal(12, 2),
      0
    );

    expect(resultado).toEqual({
      pago: pagoMock,
      movimiento: movimientoMock,
      recibo_actualizado: {
        recibo_id: 15,
        estado_recibo: 'PAGADO',
        saldo_pendiente: 0
      },
      saldo_cuenta: {
        cuenta_bancaria_id: 3,
        saldo_anterior: 1000,
        saldo_posterior: 1500
      }
    });
  });

  test('CP-HU19-MOD-10 registra ingreso parcial y actualiza recibo como parcial', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [crearCuentaMock()]
    });

    const categoriaRequestMock = crearRequestSqlMock({
      recordset: [crearCategoriaMock()]
    });

    const reciboRequestMock = crearRequestSqlMock({
      recordset: [
        crearReciboMock({
          saldo_pendiente: 500
        })
      ]
    });

    const pagoRequestMock = crearRequestSqlMock({
      recordset: [
        {
          pago_id: 51,
          recibo_id: 15,
          monto: 300
        }
      ]
    });

    const movimientoRequestMock = crearRequestSqlMock({
      recordset: [
        {
          movimiento_bancario_id: 71,
          tipo_movimiento: 'INGRESO',
          importe: 300
        }
      ]
    });

    const actualizarCuentaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    const actualizarReciboRequestMock = crearRequestSqlMock({
      recordset: []
    });

    db.__requestQueue.push(
      cuentaRequestMock,
      categoriaRequestMock,
      reciboRequestMock,
      pagoRequestMock,
      movimientoRequestMock,
      actualizarCuentaRequestMock,
      actualizarReciboRequestMock
    );

    getConnection.mockResolvedValue({});

    const resultado = await registrarIngresoAlquiler(6, 1, {
      ...crearDataIngresoMock(),
      importe: 300
    });

    expect(actualizarReciboRequestMock.input).toHaveBeenCalledWith(
      'estado_recibo',
      sql.NVarChar(20),
      'PARCIAL'
    );

    expect(actualizarReciboRequestMock.input).toHaveBeenCalledWith(
      'saldo_pendiente',
      sql.Decimal(12, 2),
      200
    );

    expect(resultado.recibo_actualizado).toEqual({
      recibo_id: 15,
      estado_recibo: 'PARCIAL',
      saldo_pendiente: 200
    });
  });

  test('CP-HU19-MOD-11 registra ingreso usando concepto y descripción por defecto', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [crearCuentaMock()]
    });

    const categoriaRequestMock = crearRequestSqlMock({
      recordset: [crearCategoriaMock()]
    });

    const reciboRequestMock = crearRequestSqlMock({
      recordset: [crearReciboMock()]
    });

    const pagoRequestMock = crearRequestSqlMock({
      recordset: [
        {
          pago_id: 52,
          recibo_id: 15,
          monto: 500
        }
      ]
    });

    const movimientoRequestMock = crearRequestSqlMock({
      recordset: [
        {
          movimiento_bancario_id: 72,
          tipo_movimiento: 'INGRESO',
          importe: 500
        }
      ]
    });

    const actualizarCuentaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    const actualizarReciboRequestMock = crearRequestSqlMock({
      recordset: []
    });

    db.__requestQueue.push(
      cuentaRequestMock,
      categoriaRequestMock,
      reciboRequestMock,
      pagoRequestMock,
      movimientoRequestMock,
      actualizarCuentaRequestMock,
      actualizarReciboRequestMock
    );

    getConnection.mockResolvedValue({});

    await registrarIngresoAlquiler(6, 1, {
      cuenta_bancaria_id: 3,
      categoria_movimiento_id: 8,
      recibo_id: 15,
      importe: 500,
      metodo_pago: 'EFECTIVO',
      fecha_movimiento: new Date('2026-07-15')
    });

    expect(movimientoRequestMock.input).toHaveBeenCalledWith(
      'concepto',
      sql.NVarChar(200),
      'Ingreso por alquiler - Recibo #15'
    );

    expect(movimientoRequestMock.input).toHaveBeenCalledWith(
      'descripcion',
      sql.NVarChar(500),
      'Cobro de alquiler del inmueble Departamento 101.'
    );

    expect(pagoRequestMock.input).toHaveBeenCalledWith(
      'observaciones',
      sql.NVarChar(500),
      'Ingreso de alquiler registrado manualmente por usuario 1.'
    );
  });

  test('CP-HU19-MOD-12 lanza METODO_PAGO_NO_VALIDO y ejecuta rollback', async () => {
    getConnection.mockResolvedValue({});

    await expect(
      registrarIngresoAlquiler(6, 1, {
        ...crearDataIngresoMock(),
        metodo_pago: 'YAPE_TEST'
      })
    ).rejects.toThrow('METODO_PAGO_NO_VALIDO');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.begin).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU19-MOD-13 lanza CUENTA_NO_VALIDA y ejecuta rollback', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    db.__requestQueue.push(cuentaRequestMock);

    getConnection.mockResolvedValue({});

    await expect(
      registrarIngresoAlquiler(6, 1, crearDataIngresoMock())
    ).rejects.toThrow('CUENTA_NO_VALIDA');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU19-MOD-14 lanza CATEGORIA_NO_VALIDA y ejecuta rollback', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [crearCuentaMock()]
    });

    const categoriaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    db.__requestQueue.push(cuentaRequestMock, categoriaRequestMock);

    getConnection.mockResolvedValue({});

    await expect(
      registrarIngresoAlquiler(6, 1, crearDataIngresoMock())
    ).rejects.toThrow('CATEGORIA_NO_VALIDA');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU19-MOD-15 lanza RECIBO_NO_VALIDO y ejecuta rollback', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [crearCuentaMock()]
    });

    const categoriaRequestMock = crearRequestSqlMock({
      recordset: [crearCategoriaMock()]
    });

    const reciboRequestMock = crearRequestSqlMock({
      recordset: []
    });

    db.__requestQueue.push(
      cuentaRequestMock,
      categoriaRequestMock,
      reciboRequestMock
    );

    getConnection.mockResolvedValue({});

    await expect(
      registrarIngresoAlquiler(6, 1, crearDataIngresoMock())
    ).rejects.toThrow('RECIBO_NO_VALIDO');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU19-MOD-16 lanza RECIBO_ANULADO y ejecuta rollback', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [crearCuentaMock()]
    });

    const categoriaRequestMock = crearRequestSqlMock({
      recordset: [crearCategoriaMock()]
    });

    const reciboRequestMock = crearRequestSqlMock({
      recordset: [
        crearReciboMock({
          estado_recibo: 'ANULADO'
        })
      ]
    });

    db.__requestQueue.push(
      cuentaRequestMock,
      categoriaRequestMock,
      reciboRequestMock
    );

    getConnection.mockResolvedValue({});

    await expect(
      registrarIngresoAlquiler(6, 1, crearDataIngresoMock())
    ).rejects.toThrow('RECIBO_ANULADO');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU19-MOD-17 lanza RECIBO_YA_PAGADO si el recibo no tiene saldo', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [crearCuentaMock()]
    });

    const categoriaRequestMock = crearRequestSqlMock({
      recordset: [crearCategoriaMock()]
    });

    const reciboRequestMock = crearRequestSqlMock({
      recordset: [
        crearReciboMock({
          estado_recibo: 'PAGADO',
          saldo_pendiente: 0
        })
      ]
    });

    db.__requestQueue.push(
      cuentaRequestMock,
      categoriaRequestMock,
      reciboRequestMock
    );

    getConnection.mockResolvedValue({});

    await expect(
      registrarIngresoAlquiler(6, 1, crearDataIngresoMock())
    ).rejects.toThrow('RECIBO_YA_PAGADO');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU19-MOD-18 lanza IMPORTE_SUPERA_SALDO si el importe es mayor al saldo pendiente', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [crearCuentaMock()]
    });

    const categoriaRequestMock = crearRequestSqlMock({
      recordset: [crearCategoriaMock()]
    });

    const reciboRequestMock = crearRequestSqlMock({
      recordset: [
        crearReciboMock({
          saldo_pendiente: 300
        })
      ]
    });

    db.__requestQueue.push(
      cuentaRequestMock,
      categoriaRequestMock,
      reciboRequestMock
    );

    getConnection.mockResolvedValue({});

    await expect(
      registrarIngresoAlquiler(6, 1, {
        ...crearDataIngresoMock(),
        importe: 500
      })
    ).rejects.toThrow('IMPORTE_SUPERA_SALDO');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU19-MOD-19 ejecuta rollback si falla la inserción del pago', async () => {
    const cuentaRequestMock = crearRequestSqlMock({
      recordset: [crearCuentaMock()]
    });

    const categoriaRequestMock = crearRequestSqlMock({
      recordset: [crearCategoriaMock()]
    });

    const reciboRequestMock = crearRequestSqlMock({
      recordset: [crearReciboMock()]
    });

    const pagoRequestMock = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockRejectedValue(new Error('Error al insertar pago'))
    };

    db.__requestQueue.push(
      cuentaRequestMock,
      categoriaRequestMock,
      reciboRequestMock,
      pagoRequestMock
    );

    getConnection.mockResolvedValue({});

    await expect(
      registrarIngresoAlquiler(6, 1, crearDataIngresoMock())
    ).rejects.toThrow('Error al insertar pago');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });
});