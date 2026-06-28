jest.mock('../../src/config/db', () => ({
  getConnection: jest.fn(),
  sql: {
    Int: 'Int',
    Bit: 'Bit',
    NVarChar: jest.fn(() => 'NVarChar'),
    Decimal: jest.fn(() => 'Decimal')
  }
}));

const { getConnection, sql } = require('../../src/config/db');

const {
  listarConceptosCobro,
  obtenerConceptoCobroPorId,
  obtenerConceptoCobroPorCodigo,
  crearConceptoCobro,
  actualizarConceptoCobro,
  cambiarEstadoConceptoCobro
} = require('../../src/models/conceptoCobro.model');

const crearRequestSqlMock = (respuestaQuery) => ({
  input: jest.fn().mockReturnThis(),
  query: jest.fn().mockResolvedValue(respuestaQuery)
});

const crearConceptoMock = () => ({
  concepto_cobro_id: 2,
  codigo: 'LIMPIEZA_FINAL',
  nombre: 'Limpieza final',
  descripcion: 'Cobro por limpieza final',
  tipo_concepto: 'SERVICIO',
  es_obligatorio: false,
  aplica_igv: true,
  monto_default: 120,
  orden_impresion: 2,
  activo: true,
  categoria: 'LIMPIEZA',
  metodo_calculo: 'MONTO_FIJO',
  aplica_en: 'RESERVA',
  aplica_desde_dias: 1,
  prorrateable: false,
  permite_pago_online: true,
  es_sistema: false,
  editable: true
});

const crearDataConcepto = () => ({
  codigo: 'LIMPIEZA_FINAL',
  nombre: 'Limpieza final',
  descripcion: 'Cobro por limpieza final',
  tipo_concepto: 'SERVICIO',
  es_obligatorio: false,
  aplica_igv: true,
  monto_default: 120,
  orden_impresion: 2,
  categoria: 'LIMPIEZA',
  metodo_calculo: 'MONTO_FIJO',
  aplica_en: 'RESERVA',
  aplica_desde_dias: 1,
  prorrateable: false,
  permite_pago_online: true
});

describe('HU17 - conceptoCobro.model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('CP-HU17-MOD-01 lista conceptos de cobro desde la base de datos', async () => {
    const conceptosMock = [
      {
        concepto_cobro_id: 1,
        codigo: 'RENTA_RESERVA',
        nombre: 'Renta de reserva',
        editable: false
      },
      crearConceptoMock()
    ];

    const requestMock = crearRequestSqlMock({
      recordset: conceptosMock
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await listarConceptosCobro();

    expect(resultado).toEqual(conceptosMock);
    expect(requestMock.query).toHaveBeenCalled();
  });

  test('CP-HU17-MOD-02 obtiene concepto por ID correctamente', async () => {
    const conceptoMock = crearConceptoMock();

    const requestMock = crearRequestSqlMock({
      recordset: [conceptoMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerConceptoCobroPorId(2);

    expect(requestMock.input).toHaveBeenCalledWith(
      'concepto_cobro_id',
      'Int',
      2
    );

    expect(resultado).toEqual(conceptoMock);
  });

  test('CP-HU17-MOD-03 retorna undefined si no encuentra concepto por ID', async () => {
    const requestMock = crearRequestSqlMock({
      recordset: []
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerConceptoCobroPorId(99);

    expect(resultado).toBeUndefined();
  });

  test('CP-HU17-MOD-04 obtiene concepto por código correctamente', async () => {
    const conceptoMock = {
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL'
    };

    const requestMock = crearRequestSqlMock({
      recordset: [conceptoMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await obtenerConceptoCobroPorCodigo('LIMPIEZA_FINAL');

    expect(requestMock.input).toHaveBeenCalledWith(
      'codigo',
      sql.NVarChar(30),
      'LIMPIEZA_FINAL'
    );

    expect(resultado).toEqual(conceptoMock);
  });

  test('CP-HU17-MOD-05 crea concepto de cobro correctamente', async () => {
    const conceptoCreadoMock = crearConceptoMock();

    const requestMock = crearRequestSqlMock({
      recordset: [conceptoCreadoMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const data = crearDataConcepto();

    const resultado = await crearConceptoCobro(data);

    expect(requestMock.input).toHaveBeenCalledWith(
      'codigo',
      sql.NVarChar(30),
      'LIMPIEZA_FINAL'
    );

    expect(requestMock.input).toHaveBeenCalledWith(
      'nombre',
      sql.NVarChar(100),
      'Limpieza final'
    );

    expect(requestMock.input).toHaveBeenCalledWith(
      'monto_default',
      sql.Decimal(12, 2),
      120
    );

    expect(resultado).toEqual(conceptoCreadoMock);
  });

  test('CP-HU17-MOD-06 crea concepto usando valores por defecto si faltan campos opcionales', async () => {
    const conceptoCreadoMock = {
      ...crearConceptoMock(),
      descripcion: null,
      monto_default: 0,
      orden_impresion: 1,
      aplica_desde_dias: 1,
      prorrateable: false,
      permite_pago_online: false
    };

    const requestMock = crearRequestSqlMock({
      recordset: [conceptoCreadoMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await crearConceptoCobro({
      codigo: 'AJUSTE_MANUAL',
      nombre: 'Ajuste manual',
      tipo_concepto: 'VARIABLE',
      categoria: 'AJUSTE',
      metodo_calculo: 'MANUAL',
      aplica_en: 'AMBOS'
    });

    expect(requestMock.input).toHaveBeenCalledWith(
      'descripcion',
      sql.NVarChar(300),
      null
    );

    expect(requestMock.input).toHaveBeenCalledWith(
      'monto_default',
      sql.Decimal(12, 2),
      0
    );

    expect(requestMock.input).toHaveBeenCalledWith(
      'orden_impresion',
      'Int',
      1
    );

    expect(resultado).toEqual(conceptoCreadoMock);
  });

  test('CP-HU17-MOD-07 actualiza concepto de cobro correctamente', async () => {
    const conceptoActualizadoMock = {
      ...crearConceptoMock(),
      nombre: 'Limpieza profunda',
      monto_default: 150
    };

    const requestMock = crearRequestSqlMock({
      recordset: [conceptoActualizadoMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await actualizarConceptoCobro(2, {
      ...crearDataConcepto(),
      nombre: 'Limpieza profunda',
      monto_default: 150
    });

    expect(requestMock.input).toHaveBeenCalledWith(
      'concepto_cobro_id',
      'Int',
      2
    );

    expect(requestMock.input).toHaveBeenCalledWith(
      'nombre',
      sql.NVarChar(100),
      'Limpieza profunda'
    );

    expect(requestMock.input).toHaveBeenCalledWith(
      'monto_default',
      sql.Decimal(12, 2),
      150
    );

    expect(resultado).toEqual(conceptoActualizadoMock);
  });

  test('CP-HU17-MOD-08 retorna undefined si no actualiza concepto no editable', async () => {
    const requestMock = crearRequestSqlMock({
      recordset: []
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await actualizarConceptoCobro(
      1,
      crearDataConcepto()
    );

    expect(resultado).toBeUndefined();
  });

  test('CP-HU17-MOD-09 desactiva concepto de cobro correctamente', async () => {
    const conceptoDesactivadoMock = {
      ...crearConceptoMock(),
      activo: false
    };

    const requestMock = crearRequestSqlMock({
      recordset: [conceptoDesactivadoMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await cambiarEstadoConceptoCobro(2, false);

    expect(requestMock.input).toHaveBeenCalledWith(
      'concepto_cobro_id',
      'Int',
      2
    );

    expect(requestMock.input).toHaveBeenCalledWith(
      'activo',
      'Bit',
      false
    );

    expect(resultado).toEqual(conceptoDesactivadoMock);
  });

  test('CP-HU17-MOD-10 reactiva concepto de cobro correctamente', async () => {
    const conceptoReactivadoMock = {
      ...crearConceptoMock(),
      activo: true
    };

    const requestMock = crearRequestSqlMock({
      recordset: [conceptoReactivadoMock]
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await cambiarEstadoConceptoCobro(2, true);

    expect(requestMock.input).toHaveBeenCalledWith(
      'activo',
      'Bit',
      true
    );

    expect(resultado).toEqual(conceptoReactivadoMock);
  });

  test('CP-HU17-MOD-11 retorna undefined si no cambia estado de concepto no editable', async () => {
    const requestMock = crearRequestSqlMock({
      recordset: []
    });

    getConnection.mockResolvedValue({
      request: jest.fn(() => requestMock)
    });

    const resultado = await cambiarEstadoConceptoCobro(1, false);

    expect(resultado).toBeUndefined();
  });
});