jest.mock('mssql', () => {
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
    Int: 'Int',
    Date: 'Date',
    Decimal: jest.fn((precision, scale) => `Decimal(${precision},${scale})`),
    NVarChar: jest.fn((length) => `NVarChar(${length})`),
    Transaction: TransactionMock,
    Request: RequestMock,
    __requestQueue: requestQueue
  };
});

jest.mock('../../src/config/db', () => ({
  getConnection: jest.fn()
}));

const sql = require('mssql');
const { getConnection } = require('../../src/config/db');

const {
  listarIPC,
  buscarIPCPorAnio,
  registrarIPC,
  listarInmueblesConRenta,
  obtenerInmueblePorId,
  verificarAplicacionIPC,
  aplicarIPCMasivo,
  listarHistorialTarifas
} = require('../../src/models/tarifa.model');

const crearRequestSqlMock = (respuestaQuery) => ({
  input: jest.fn().mockReturnThis(),
  query: jest.fn().mockResolvedValue(respuestaQuery)
});

const crearIPCMock = () => ({
  indice_ipc_id: 4,
  anio: 2026,
  porcentaje_anual: 3.5,
  fecha_publicacion: '2026-01-15',
  activo: true,
  created_at: '2026-01-15T00:00:00.000Z'
});

const crearInmuebleMock = (overrides = {}) => ({
  inmueble_id: 10,
  empresa_id: 6,
  codigo: 'DEP-101',
  tipo_inmueble: 'LOCAL',
  nombre: 'Departamento 101',
  direccion_linea1: 'Av. Principal 123',
  distrito: 'Miraflores',
  ciudad: 'Lima',
  renta_base_mensual: 1000,
  moneda: 'PEN',
  estado_operativo: 'DISPONIBLE',
  activo: true,
  publicacion_id: 5,
  titulo_publicacion: 'Departamento amoblado',
  precio_publicado_mensual: 1000,
  estado_publicacion: 'PUBLICADA',
  ...overrides
});

const crearTarifaMock = () => ({
  tarifa_inmueble_id: 20,
  inmueble_id: 10,
  indice_ipc_id: 4,
  vigencia_desde: '2026-07-01',
  vigencia_hasta: null,
  renta_base_mensual: 1035,
  porcentaje_ipc_aplicado: 3.5,
  monto_incremento: 35,
  motivo: 'IPC 2026 - Actualización anual de renta',
  aplicado_por_usuario_id: 1
});

describe('HU20 - tarifa.model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sql.__requestQueue.length = 0;
  });

  test('CP-HU20-MOD-01 lista IPC activos correctamente', async () => {
    const ipcMock = [crearIPCMock()];

    const requestMock = crearRequestSqlMock({
      recordset: ipcMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarIPC();

    expect(requestMock.query).toHaveBeenCalled();
    expect(resultado).toEqual(ipcMock);
  });

  test('CP-HU20-MOD-02 busca IPC por año correctamente', async () => {
    const ipcMock = crearIPCMock();

    const requestMock = crearRequestSqlMock({
      recordset: [ipcMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await buscarIPCPorAnio(2026);

    expect(requestMock.input).toHaveBeenCalledWith('anio', 'Int', 2026);
    expect(resultado).toEqual(ipcMock);
  });

  test('CP-HU20-MOD-03 retorna null si no encuentra IPC por año', async () => {
    const requestMock = crearRequestSqlMock({
      recordset: []
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await buscarIPCPorAnio(2025);

    expect(resultado).toBeNull();
  });

  test('CP-HU20-MOD-04 registra IPC correctamente', async () => {
    const ipcMock = crearIPCMock();

    const requestMock = crearRequestSqlMock({
      recordset: [ipcMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await registrarIPC({
      anio: 2026,
      porcentaje_anual: 3.5,
      fecha_publicacion: '2026-01-15'
    });

    expect(requestMock.input).toHaveBeenCalledWith('anio', 'Int', 2026);
    expect(requestMock.input).toHaveBeenCalledWith(
      'porcentaje_anual',
      'Decimal(6,3)',
      3.5
    );
    expect(requestMock.input).toHaveBeenCalledWith(
      'fecha_publicacion',
      'Date',
      '2026-01-15'
    );

    expect(resultado).toEqual(ipcMock);
  });

  test('CP-HU20-MOD-05 lista inmuebles con renta por empresa', async () => {
    const inmueblesMock = [crearInmuebleMock()];

    const requestMock = crearRequestSqlMock({
      recordset: inmueblesMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarInmueblesConRenta(6);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(resultado).toEqual(inmueblesMock);
  });

  test('CP-HU20-MOD-06 obtiene inmueble por ID sin transacción', async () => {
    const inmuebleMock = crearInmuebleMock();

    const requestMock = crearRequestSqlMock({
      recordset: [inmuebleMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerInmueblePorId(6, 10);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(requestMock.input).toHaveBeenCalledWith('inmueble_id', 'Int', 10);
    expect(resultado).toEqual(inmuebleMock);
  });

  test('CP-HU20-MOD-07 retorna null si no encuentra inmueble por ID', async () => {
    const requestMock = crearRequestSqlMock({
      recordset: []
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerInmueblePorId(6, 99);

    expect(resultado).toBeNull();
  });

  test('CP-HU20-MOD-08 verifica si ya se aplicó IPC a un inmueble', async () => {
    const tarifaMock = crearTarifaMock();

    const requestMock = crearRequestSqlMock({
      recordset: [tarifaMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await verificarAplicacionIPC(10, 4);

    expect(requestMock.input).toHaveBeenCalledWith('inmueble_id', 'Int', 10);
    expect(requestMock.input).toHaveBeenCalledWith('indice_ipc_id', 'Int', 4);
    expect(resultado).toEqual(tarifaMock);
  });

  test('CP-HU20-MOD-09 retorna null si IPC no fue aplicado al inmueble', async () => {
    const requestMock = crearRequestSqlMock({
      recordset: []
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await verificarAplicacionIPC(10, 4);

    expect(resultado).toBeNull();
  });

  test('CP-HU20-MOD-10 aplica IPC masivo y actualiza publicación', async () => {
    const inmuebleRequestMock = crearRequestSqlMock({
      recordset: [crearInmuebleMock()]
    });

    const cerrarTarifaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    const crearTarifaRequestMock = crearRequestSqlMock({
      recordset: [crearTarifaMock()]
    });

    const actualizarRentaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    const actualizarPublicacionRequestMock = crearRequestSqlMock({
      recordset: []
    });

    sql.__requestQueue.push(
      inmuebleRequestMock,
      cerrarTarifaRequestMock,
      crearTarifaRequestMock,
      actualizarRentaRequestMock,
      actualizarPublicacionRequestMock
    );

    getConnection.mockResolvedValue({});

    const resultado = await aplicarIPCMasivo({
      empresa_id: 6,
      usuario_id: 1,
      ipc: crearIPCMock(),
      inmueble_ids: [10],
      aplicar_a_publicacion: true,
      motivo: 'Actualización anual'
    });

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.begin).toHaveBeenCalled();
    expect(transaction.commit).toHaveBeenCalled();
    expect(transaction.rollback).not.toHaveBeenCalled();

    expect(inmuebleRequestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(inmuebleRequestMock.input).toHaveBeenCalledWith('inmueble_id', 'Int', 10);

    expect(cerrarTarifaRequestMock.input).toHaveBeenCalledWith(
      'inmueble_id',
      'Int',
      10
    );

    expect(crearTarifaRequestMock.input).toHaveBeenCalledWith(
      'renta_base_mensual',
      'Decimal(12,2)',
      1035
    );

    expect(crearTarifaRequestMock.input).toHaveBeenCalledWith(
      'porcentaje_ipc_aplicado',
      'Decimal(6,3)',
      3.5
    );

    expect(crearTarifaRequestMock.input).toHaveBeenCalledWith(
      'monto_incremento',
      'Decimal(12,2)',
      35
    );

    expect(crearTarifaRequestMock.input).toHaveBeenCalledWith(
      'motivo',
      'NVarChar(300)',
      'IPC 2026 - Actualización anual'
    );

    expect(actualizarRentaRequestMock.input).toHaveBeenCalledWith(
      'nueva_renta',
      'Decimal(12,2)',
      1035
    );

    expect(actualizarPublicacionRequestMock.input).toHaveBeenCalledWith(
      'nueva_renta',
      'Decimal(12,2)',
      1035
    );

    expect(resultado).toEqual([
      {
        inmueble_id: 10,
        nombre: 'Departamento 101',
        renta_anterior: 1000,
        porcentaje_ipc_aplicado: 3.5,
        monto_incremento: 35,
        nueva_renta: 1035,
        tarifa: crearTarifaMock()
      }
    ]);
  });

  test('CP-HU20-MOD-11 aplica IPC sin actualizar publicación', async () => {
    const inmuebleRequestMock = crearRequestSqlMock({
      recordset: [crearInmuebleMock()]
    });

    const cerrarTarifaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    const crearTarifaRequestMock = crearRequestSqlMock({
      recordset: [crearTarifaMock()]
    });

    const actualizarRentaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    sql.__requestQueue.push(
      inmuebleRequestMock,
      cerrarTarifaRequestMock,
      crearTarifaRequestMock,
      actualizarRentaRequestMock
    );

    getConnection.mockResolvedValue({});

    const resultado = await aplicarIPCMasivo({
      empresa_id: 6,
      usuario_id: 1,
      ipc: crearIPCMock(),
      inmueble_ids: [10],
      aplicar_a_publicacion: false,
      motivo: ''
    });

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.commit).toHaveBeenCalled();
    expect(resultado[0]).toEqual(
      expect.objectContaining({
        inmueble_id: 10,
        renta_anterior: 1000,
        monto_incremento: 35,
        nueva_renta: 1035
      })
    );

    expect(sql.Request).toHaveBeenCalledTimes(4);
  });

  test('CP-HU20-MOD-12 aplica IPC a varios inmuebles', async () => {
    const inmueble1RequestMock = crearRequestSqlMock({
      recordset: [crearInmuebleMock()]
    });

    const cerrarTarifa1RequestMock = crearRequestSqlMock({
      recordset: []
    });

    const crearTarifa1RequestMock = crearRequestSqlMock({
      recordset: [crearTarifaMock()]
    });

    const actualizarRenta1RequestMock = crearRequestSqlMock({
      recordset: []
    });

    const inmueble2RequestMock = crearRequestSqlMock({
      recordset: [
        crearInmuebleMock({
          inmueble_id: 11,
          nombre: 'Departamento 102',
          renta_base_mensual: 2000
        })
      ]
    });

    const cerrarTarifa2RequestMock = crearRequestSqlMock({
      recordset: []
    });

    const crearTarifa2RequestMock = crearRequestSqlMock({
      recordset: [
        {
          ...crearTarifaMock(),
          tarifa_inmueble_id: 21,
          inmueble_id: 11,
          renta_base_mensual: 2070,
          monto_incremento: 70
        }
      ]
    });

    const actualizarRenta2RequestMock = crearRequestSqlMock({
      recordset: []
    });

    sql.__requestQueue.push(
      inmueble1RequestMock,
      cerrarTarifa1RequestMock,
      crearTarifa1RequestMock,
      actualizarRenta1RequestMock,
      inmueble2RequestMock,
      cerrarTarifa2RequestMock,
      crearTarifa2RequestMock,
      actualizarRenta2RequestMock
    );

    getConnection.mockResolvedValue({});

    const resultado = await aplicarIPCMasivo({
      empresa_id: 6,
      usuario_id: 1,
      ipc: crearIPCMock(),
      inmueble_ids: [10, 11],
      aplicar_a_publicacion: false,
      motivo: 'Actualización anual'
    });

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.commit).toHaveBeenCalled();
    expect(resultado).toHaveLength(2);
    expect(resultado[0].nueva_renta).toBe(1035);
    expect(resultado[1].nueva_renta).toBe(2070);
  });

  test('CP-HU20-MOD-13 ejecuta rollback si inmueble no existe', async () => {
    const inmuebleRequestMock = crearRequestSqlMock({
      recordset: []
    });

    sql.__requestQueue.push(inmuebleRequestMock);

    getConnection.mockResolvedValue({});

    await expect(
      aplicarIPCMasivo({
        empresa_id: 6,
        usuario_id: 1,
        ipc: crearIPCMock(),
        inmueble_ids: [99],
        aplicar_a_publicacion: false,
        motivo: ''
      })
    ).rejects.toThrow('El inmueble 99 no existe o no pertenece a la empresa.');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU20-MOD-14 ejecuta rollback si inmueble no tiene renta válida', async () => {
    const inmuebleRequestMock = crearRequestSqlMock({
      recordset: [
        crearInmuebleMock({
          renta_base_mensual: 0
        })
      ]
    });

    sql.__requestQueue.push(inmuebleRequestMock);

    getConnection.mockResolvedValue({});

    await expect(
      aplicarIPCMasivo({
        empresa_id: 6,
        usuario_id: 1,
        ipc: crearIPCMock(),
        inmueble_ids: [10],
        aplicar_a_publicacion: false,
        motivo: ''
      })
    ).rejects.toThrow('El inmueble 10 no tiene una renta base mensual válida.');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU20-MOD-15 ejecuta rollback si falla la creación de tarifa', async () => {
    const inmuebleRequestMock = crearRequestSqlMock({
      recordset: [crearInmuebleMock()]
    });

    const cerrarTarifaRequestMock = crearRequestSqlMock({
      recordset: []
    });

    const crearTarifaRequestMock = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockRejectedValue(new Error('Error al crear tarifa'))
    };

    sql.__requestQueue.push(
      inmuebleRequestMock,
      cerrarTarifaRequestMock,
      crearTarifaRequestMock
    );

    getConnection.mockResolvedValue({});

    await expect(
      aplicarIPCMasivo({
        empresa_id: 6,
        usuario_id: 1,
        ipc: crearIPCMock(),
        inmueble_ids: [10],
        aplicar_a_publicacion: false,
        motivo: ''
      })
    ).rejects.toThrow('Error al crear tarifa');

    const transaction = sql.Transaction.mock.results[0].value;

    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  test('CP-HU20-MOD-16 lista historial de tarifas por inmueble', async () => {
    const historialMock = [
      {
        tarifa_inmueble_id: 20,
        inmueble_id: 10,
        indice_ipc_id: 4,
        anio: 2026,
        renta_base_mensual: 1035,
        porcentaje_ipc_aplicado: 3.5,
        monto_incremento: 35
      }
    ];

    const requestMock = crearRequestSqlMock({
      recordset: historialMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarHistorialTarifas(6, 10);

    expect(requestMock.input).toHaveBeenCalledWith('empresa_id', 'Int', 6);
    expect(requestMock.input).toHaveBeenCalledWith('inmueble_id', 'Int', 10);
    expect(resultado).toEqual(historialMock);
  });
});