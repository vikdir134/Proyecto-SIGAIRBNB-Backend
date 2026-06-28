jest.mock('../../src/config/db', () => {
  const requestMock = jest.fn();

  const crearTransactionDefault = () => ({
    begin: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined)
  });

  const TransactionMock = jest.fn().mockImplementation(
    crearTransactionDefault
  );

  const RequestMock = jest.fn().mockImplementation(() => {
    return requestMock();
  });

  return {
    getConnection: jest.fn(),
    sql: {
      Int: 'Int',
      TinyInt: 'TinyInt',
      Date: 'Date',
      DateTime2: 'DateTime2',
      Char: jest.fn(() => 'Char'),
      NVarChar: jest.fn(() => 'NVarChar'),
      Decimal: jest.fn(() => 'Decimal'),
      Transaction: TransactionMock,
      Request: RequestMock
    },
    __requestMock: requestMock,
    __crearTransactionDefault: crearTransactionDefault
  };
});

const dbMock = require('../../src/config/db');

const {
  listarRecibosPendientesInquilino,
  obtenerReciboPendienteParaPago,
  registrarPagoOnline,
  listarMisPagos,
  generarReciboPendientePrueba
} = require('../../src/models/pago.model');

const crearRequestSqlMock = (respuestasQuery = []) => {
  const request = {
    input: jest.fn().mockReturnThis(),
    query: jest.fn()
  };

  respuestasQuery.forEach((respuesta) => {
    request.query.mockResolvedValueOnce(respuesta);
  });

  return request;
};

const crearRequestIndividualMock = (respuesta) => ({
  input: jest.fn().mockReturnThis(),
  query: jest.fn().mockResolvedValue(respuesta)
});

const crearTransactionMock = () => ({
  begin: jest.fn().mockResolvedValue(undefined),
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined)
});

describe('HU16 - pago.model', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    dbMock.getConnection.mockReset();
    dbMock.__requestMock.mockReset();

    dbMock.sql.Transaction.mockReset();
    dbMock.sql.Transaction.mockImplementation(() =>
      dbMock.__crearTransactionDefault()
    );

    dbMock.sql.Request.mockReset();
    dbMock.sql.Request.mockImplementation(() => {
      return dbMock.__requestMock();
    });
  });

  test('CP-HU16-MOD-01 lista recibos pendientes del inquilino', async () => {
    const recibosMock = [
      {
        recibo_id: 25,
        reserva_id: 15,
        estado_recibo: 'EMITIDO',
        total: 590,
        saldo_pendiente: 590,
        nombre_inmueble: 'Departamento 101'
      }
    ];

    const poolRequest = crearRequestSqlMock([
      {
        recordset: recibosMock
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    const resultado = await listarRecibosPendientesInquilino(6, 8);

    expect(resultado).toEqual(recibosMock);
    expect(poolRequest.input).toHaveBeenCalledWith('usuario_id', 'Int', 8);
  });

  test('CP-HU16-MOD-02 obtiene recibo pendiente para pago', async () => {
    const reciboMock = {
      recibo_id: 25,
      reserva_id: 15,
      estado_recibo: 'EMITIDO',
      total: 590,
      saldo_pendiente: 590,
      moneda: 'PEN',
      nombre_inmueble: 'Departamento 101',
      inquilino_id: 8
    };

    const poolRequest = crearRequestSqlMock([
      {
        recordset: [reciboMock]
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    const resultado = await obtenerReciboPendienteParaPago(6, 8, 25);

    expect(resultado).toEqual(reciboMock);
    expect(poolRequest.input).toHaveBeenCalledWith('usuario_id', 'Int', 8);
    expect(poolRequest.input).toHaveBeenCalledWith('recibo_id', 'Int', 25);
  });

  test('CP-HU16-MOD-03 retorna undefined si no encuentra recibo pendiente', async () => {
    const poolRequest = crearRequestSqlMock([
      {
        recordset: []
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    const resultado = await obtenerReciboPendienteParaPago(6, 8, 99);

    expect(resultado).toBeUndefined();
  });

  test('CP-HU16-MOD-04 registra pago online correctamente y actualiza recibo', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);

    const reciboMock = {
      recibo_id: 25,
      reserva_id: 15,
      estado_recibo: 'EMITIDO',
      total: 590,
      saldo_pendiente: 590,
      inquilino_id: 8,
      moneda: 'PEN',
      inmueble_id: 6,
      empresa_id: 6,
      codigo_inmueble: 'DEP-101',
      nombre_inmueble: 'Departamento 101'
    };

    const pagoMock = {
      pago_id: 40,
      recibo_id: 25,
      reserva_id: 15,
      usuario_pagador_id: 8,
      metodo_pago: 'ONLINE',
      proveedor_pasarela: 'SIMULADO',
      monto: 590,
      moneda: 'PEN',
      estado_pago: 'CONFIRMADO'
    };

    const categoriaMock = {
      categoria_movimiento_id: 2,
      nombre: 'Ingreso por alquiler'
    };

    const cuentaMock = {
      cuenta_bancaria_id: 10,
      empresa_id: 6,
      nombre_cuenta: 'Caja Principal',
      saldo_actual: 1000,
      moneda: 'PEN'
    };

    const movimientoMock = {
      movimiento_bancario_id: 70,
      cuenta_bancaria_id: 10,
      recibo_id: 25,
      pago_id: 40,
      importe: 590,
      saldo_anterior: 1000,
      saldo_posterior: 1590
    };

    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [reciboMock]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [pagoMock]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [categoriaMock]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [cuentaMock]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [movimientoMock]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          rowsAffected: [1]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          rowsAffected: [1]
        })
      );

    const resultado = await registrarPagoOnline({
      empresa_id: 6,
      usuario_id: 8,
      recibo_id: 25,
      metodo_pago: 'ONLINE',
      proveedor_pasarela: 'SIMULADO',
      referencia: 'REF-001'
    });

    expect(transactionMock.begin).toHaveBeenCalled();
    expect(transactionMock.commit).toHaveBeenCalled();
    expect(transactionMock.rollback).not.toHaveBeenCalled();

    expect(resultado).toEqual({
      ok: true,
      pago: pagoMock,
      movimiento: movimientoMock,
      monto_pagado: 590,
      recibo_actualizado: {
        recibo_id: 25,
        estado_recibo: 'PAGADO',
        saldo_pendiente: 0
      }
    });
  });

  test('CP-HU16-MOD-05 lanza RECIBO_NO_VALIDO si el recibo no existe o no pertenece al usuario', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: []
      })
    );

    await expect(
      registrarPagoOnline({
        empresa_id: 6,
        usuario_id: 8,
        recibo_id: 99
      })
    ).rejects.toThrow('RECIBO_NO_VALIDO');

    expect(transactionMock.rollback).toHaveBeenCalled();
    expect(transactionMock.commit).not.toHaveBeenCalled();
  });

  test('CP-HU16-MOD-06 lanza RECIBO_ANULADO si el recibo está anulado', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: [
          {
            recibo_id: 25,
            estado_recibo: 'ANULADO',
            saldo_pendiente: 590
          }
        ]
      })
    );

    await expect(
      registrarPagoOnline({
        empresa_id: 6,
        usuario_id: 8,
        recibo_id: 25
      })
    ).rejects.toThrow('RECIBO_ANULADO');

    expect(transactionMock.rollback).toHaveBeenCalled();
  });

  test('CP-HU16-MOD-07 lanza RECIBO_YA_PAGADO si el recibo está pagado', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: [
          {
            recibo_id: 25,
            estado_recibo: 'PAGADO',
            saldo_pendiente: 0
          }
        ]
      })
    );

    await expect(
      registrarPagoOnline({
        empresa_id: 6,
        usuario_id: 8,
        recibo_id: 25
      })
    ).rejects.toThrow('RECIBO_YA_PAGADO');

    expect(transactionMock.rollback).toHaveBeenCalled();
  });

  test('CP-HU16-MOD-08 lanza RECIBO_NO_DISPONIBLE_PARA_PAGO si el estado no es permitido', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: [
          {
            recibo_id: 25,
            estado_recibo: 'BORRADOR',
            saldo_pendiente: 590
          }
        ]
      })
    );

    await expect(
      registrarPagoOnline({
        empresa_id: 6,
        usuario_id: 8,
        recibo_id: 25
      })
    ).rejects.toThrow('RECIBO_NO_DISPONIBLE_PARA_PAGO');

    expect(transactionMock.rollback).toHaveBeenCalled();
  });

  test('CP-HU16-MOD-09 lanza METODO_PAGO_NO_VALIDO si el método no está permitido', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: [
          {
            recibo_id: 25,
            reserva_id: 15,
            estado_recibo: 'EMITIDO',
            saldo_pendiente: 590,
            moneda: 'PEN',
            empresa_id: 6
          }
        ]
      })
    );

    await expect(
      registrarPagoOnline({
        empresa_id: 6,
        usuario_id: 8,
        recibo_id: 25,
        metodo_pago: 'EFECTIVO'
      })
    ).rejects.toThrow('METODO_PAGO_NO_VALIDO');

    expect(transactionMock.rollback).toHaveBeenCalled();
  });

  test('CP-HU16-MOD-10 lanza EMPRESA_NO_DETERMINADA si no se puede obtener empresa', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: [
          {
            recibo_id: 25,
            reserva_id: 15,
            estado_recibo: 'EMITIDO',
            saldo_pendiente: 590,
            moneda: 'PEN',
            empresa_id: null
          }
        ]
      })
    );

    await expect(
      registrarPagoOnline({
        empresa_id: null,
        usuario_id: 8,
        recibo_id: 25,
        metodo_pago: 'ONLINE'
      })
    ).rejects.toThrow('EMPRESA_NO_DETERMINADA');

    expect(transactionMock.rollback).toHaveBeenCalled();
  });

  test('CP-HU16-MOD-11 lanza CATEGORIA_INGRESO_NO_CONFIGURADA si no existe categoría de ingreso', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [
            {
              recibo_id: 25,
              reserva_id: 15,
              estado_recibo: 'EMITIDO',
              saldo_pendiente: 590,
              moneda: 'PEN',
              empresa_id: 6
            }
          ]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [
            {
              pago_id: 40,
              recibo_id: 25,
              monto: 590
            }
          ]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: []
        })
      );

    await expect(
      registrarPagoOnline({
        empresa_id: 6,
        usuario_id: 8,
        recibo_id: 25,
        metodo_pago: 'ONLINE'
      })
    ).rejects.toThrow('CATEGORIA_INGRESO_NO_CONFIGURADA');

    expect(transactionMock.rollback).toHaveBeenCalled();
  });

  test('CP-HU16-MOD-12 lanza CUENTA_TESORERIA_NO_CONFIGURADA si no existe cuenta bancaria', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [
            {
              recibo_id: 25,
              reserva_id: 15,
              estado_recibo: 'EMITIDO',
              saldo_pendiente: 590,
              moneda: 'PEN',
              empresa_id: 6
            }
          ]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [
            {
              pago_id: 40,
              recibo_id: 25,
              monto: 590
            }
          ]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [
            {
              categoria_movimiento_id: 2,
              nombre: 'Ingreso por alquiler'
            }
          ]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: []
        })
      );

    await expect(
      registrarPagoOnline({
        empresa_id: 6,
        usuario_id: 8,
        recibo_id: 25,
        metodo_pago: 'ONLINE'
      })
    ).rejects.toThrow('CUENTA_TESORERIA_NO_CONFIGURADA');

    expect(transactionMock.rollback).toHaveBeenCalled();
  });

  test('CP-HU16-MOD-13 lista historial de pagos del inquilino', async () => {
    const pagosMock = [
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
    ];

    const poolRequest = crearRequestSqlMock([
      {
        recordset: pagosMock
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    const resultado = await listarMisPagos(6, 8);

    expect(resultado).toEqual(pagosMock);
    expect(poolRequest.input).toHaveBeenCalledWith('usuario_id', 'Int', 8);
  });

  test('CP-HU16-MOD-14 genera recibo pendiente de prueba correctamente', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    const reservaMock = {
      reserva_id: 15,
      inmueble_id: 6,
      inquilino_id: 8,
      estado_reserva: 'APROBADA',
      renta_pactada_mensual: 1000,
      moneda_reserva: 'PEN',
      nombre_inmueble: 'Departamento 101'
    };

    const reciboMock = {
      recibo_id: 80,
      reserva_id: 15,
      estado_recibo: 'EMITIDO',
      total: 1000,
      saldo_pendiente: 1000
    };

    dbMock.__requestMock
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [reservaMock]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [
            {
              cuenta_cobro_inmueble_id: 10
            }
          ]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: []
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [reciboMock]
        })
      );

    const resultado = await generarReciboPendientePrueba({
      empresa_id: 6,
      usuario_id: 8,
      reserva_id: 15,
      monto: 1000,
      periodo_anio: 2026,
      periodo_mes: 7
    });

    expect(transactionMock.begin).toHaveBeenCalled();
    expect(transactionMock.commit).toHaveBeenCalled();

    expect(resultado).toEqual({
      ok: true,
      recibo: reciboMock
    });
  });

  test('CP-HU16-MOD-15 retorna 404 si no existe reserva aprobada o activa para generar recibo de prueba', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: []
      })
    );

    const resultado = await generarReciboPendientePrueba({
      empresa_id: 6,
      usuario_id: 8,
      reserva_id: 99
    });

    expect(transactionMock.rollback).toHaveBeenCalled();

    expect(resultado).toEqual({
      ok: false,
      status: 404,
      mensaje: 'No existe una reserva APROBADA o ACTIVA para este inquilino.'
    });
  });

  test('CP-HU16-MOD-16 retorna 400 si periodo_mes no es válido al generar recibo de prueba', async () => {
    const transactionMock = crearTransactionMock();

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);
    dbMock.getConnection.mockResolvedValue({});

    dbMock.__requestMock
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [
            {
              reserva_id: 15,
              inmueble_id: 6,
              inquilino_id: 8,
              estado_reserva: 'APROBADA',
              renta_pactada_mensual: 1000
            }
          ]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [
            {
              cuenta_cobro_inmueble_id: 10
            }
          ]
        })
      );

    const resultado = await generarReciboPendientePrueba({
      empresa_id: 6,
      usuario_id: 8,
      reserva_id: 15,
      periodo_mes: 13
    });

    expect(transactionMock.rollback).toHaveBeenCalled();

    expect(resultado).toEqual({
      ok: false,
      status: 400,
      mensaje: 'El periodo_mes debe estar entre 1 y 12.'
    });
  });
});