jest.mock('../../src/config/db', () => {
  const requestMock = jest.fn();

  const TransactionMock = jest.fn().mockImplementation(() => ({
    begin: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined)
  }));

  const RequestMock = jest.fn().mockImplementation(() => {
    return requestMock();
  });

  return {
    getConnection: jest.fn(),
    sql: {
      Int: 'Int',
      TinyInt: 'TinyInt',
      Decimal: jest.fn(() => 'Decimal'),
      Date: 'Date',
      NVarChar: jest.fn(() => 'NVarChar'),
      VarChar: jest.fn(() => 'VarChar'),
      ISOLATION_LEVEL: {
        SERIALIZABLE: 'SERIALIZABLE'
      },
      Transaction: TransactionMock,
      Request: RequestMock
    },
    __requestMock: requestMock,
    __TransactionMock: TransactionMock,
    __RequestMock: RequestMock
  };
});

const dbMock = require('../../src/config/db');

const {
  obtenerVistaPreviaReciboReservaGestion,
  generarReciboReservaGestion,
  listarRecibosReservaAutorizados,
  obtenerReciboCompletoAutorizado
} = require('../../src/models/recibo.model');

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

describe('HU15 - recibo.model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('CP-HU15-MOD-01 genera vista previa correctamente con renta e IGV', async () => {
    const reservaMock = {
      reserva_id: 15,
      inmueble_id: 6,
      inquilino_id: 8,
      estado_reserva: 'APROBADA',
      fecha_inicio: '2026-07-10',
      fecha_fin: '2026-07-15',
      renta_pactada_mensual: 3000,
      moneda: 'PEN',
      empresa_id: 6,
      codigo_inmueble: 'DEP-101',
      nombre_inmueble: 'Departamento 101'
    };

    const conceptosMock = [
      {
        concepto_cobro_id: 1,
        codigo: 'RENTA_RESERVA',
        nombre: 'Renta de reserva',
        descripcion: 'Renta',
        aplica_igv: true,
        monto_default: 0,
        metodo_calculo: 'RENTA_RESERVA',
        prorrateable: true
      }
    ];

    const poolRequest = crearRequestSqlMock([
      {
        recordset: [reservaMock]
      },
      {
        recordset: []
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: conceptosMock
      })
    );

    const resultado = await obtenerVistaPreviaReciboReservaGestion({
      usuario_gestor_id: 3,
      reserva_id: 15
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.reserva).toEqual(reservaMock);
    expect(resultado.dias_reserva).toBe(5);

    expect(resultado.conceptos).toHaveLength(1);
    expect(resultado.conceptos[0]).toMatchObject({
      concepto_cobro_id: 1,
      codigo: 'RENTA_RESERVA',
      descripcion: 'Renta de reserva (5 día(s))',
      cantidad: 5,
      precio_unitario: 100,
      importe: 500,
      aplica_igv: true,
      igv: 90,
      total_linea: 590,
      obligatorio: true,
      editable: false
    });

    expect(resultado.subtotal).toBe(500);
    expect(resultado.igv_total).toBe(90);
    expect(resultado.total).toBe(590);
  });

  test('CP-HU15-MOD-02 retorna RESERVA_NO_ENCONTRADA si no existe reserva gestionable', async () => {
    const poolRequest = crearRequestSqlMock([
      {
        recordset: []
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    const resultado = await obtenerVistaPreviaReciboReservaGestion({
      usuario_gestor_id: 3,
      reserva_id: 99
    });

    expect(resultado).toEqual({
      ok: false,
      codigo: 'RESERVA_NO_ENCONTRADA',
      mensaje: 'La reserva no existe o no pertenece a la empresa gestionada.'
    });
  });

  test('CP-HU15-MOD-03 retorna ESTADO_NO_PERMITIDO si la reserva está SOLICITADA', async () => {
    const poolRequest = crearRequestSqlMock([
      {
        recordset: [
          {
            reserva_id: 15,
            estado_reserva: 'SOLICITADA'
          }
        ]
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    const resultado = await obtenerVistaPreviaReciboReservaGestion({
      usuario_gestor_id: 3,
      reserva_id: 15
    });

    expect(resultado).toEqual({
      ok: false,
      codigo: 'ESTADO_NO_PERMITIDO',
      mensaje:
        'Solo se puede revisar boleta para reservas aprobadas, activas o finalizadas.',
      estado_actual: 'SOLICITADA'
    });
  });

  test('CP-HU15-MOD-04 retorna RECIBO_EXISTENTE si la reserva ya tiene boleta generada', async () => {
    const reservaMock = {
      reserva_id: 15,
      estado_reserva: 'APROBADA'
    };

    const reciboMock = {
      recibo_id: 30,
      reserva_id: 15,
      estado_recibo: 'EMITIDO',
      total: 590
    };

    const detallesMock = [
      {
        recibo_detalle_id: 1,
        recibo_id: 30,
        descripcion: 'Renta de reserva',
        importe: 500
      }
    ];

    const poolRequest = crearRequestSqlMock([
      {
        recordset: [reservaMock]
      },
      {
        recordset: [
          {
            recibo_id: 30
          }
        ]
      },
      {
        recordset: [reciboMock]
      },
      {
        recordset: detallesMock
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    const resultado = await obtenerVistaPreviaReciboReservaGestion({
      usuario_gestor_id: 3,
      reserva_id: 15
    });

    expect(resultado).toEqual({
      ok: false,
      codigo: 'RECIBO_EXISTENTE',
      mensaje: 'Esta reserva ya tiene una boleta digital generada.',
      recibo: reciboMock,
      detalles: detallesMock
    });
  });

  test('CP-HU15-MOD-05 retorna CONCEPTO_RENTA_NO_CONFIGURADO si no existe RENTA_RESERVA', async () => {
    const reservaMock = {
      reserva_id: 15,
      inmueble_id: 6,
      estado_reserva: 'APROBADA',
      fecha_inicio: '2026-07-10',
      fecha_fin: '2026-07-15',
      renta_pactada_mensual: 3000
    };

    const poolRequest = crearRequestSqlMock([
      {
        recordset: [reservaMock]
      },
      {
        recordset: []
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: []
      })
    );

    const resultado = await obtenerVistaPreviaReciboReservaGestion({
      usuario_gestor_id: 3,
      reserva_id: 15
    });

    expect(resultado).toEqual({
      ok: false,
      codigo: 'CONCEPTO_RENTA_NO_CONFIGURADO',
      mensaje:
        'No existe el concepto del sistema RENTA_RESERVA. Verifica la configuración de conceptos.'
    });
  });

  test('CP-HU15-MOD-06 retorna RENTA_INVALIDA si la reserva no tiene renta mensual válida', async () => {
    const reservaMock = {
      reserva_id: 15,
      inmueble_id: 6,
      estado_reserva: 'APROBADA',
      fecha_inicio: '2026-07-10',
      fecha_fin: '2026-07-15',
      renta_pactada_mensual: 0
    };

    const conceptosMock = [
      {
        concepto_cobro_id: 1,
        codigo: 'RENTA_RESERVA',
        nombre: 'Renta de reserva',
        aplica_igv: true,
        monto_default: 0
      }
    ];

    const poolRequest = crearRequestSqlMock([
      {
        recordset: [reservaMock]
      },
      {
        recordset: []
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: conceptosMock
      })
    );

    const resultado = await obtenerVistaPreviaReciboReservaGestion({
      usuario_gestor_id: 3,
      reserva_id: 15
    });

    expect(resultado).toEqual({
      ok: false,
      codigo: 'RENTA_INVALIDA',
      mensaje:
        'La reserva no tiene una renta mensual válida para generar el recibo.'
    });
  });

  test('CP-HU15-MOD-07 genera boleta correctamente con detalle de recibo', async () => {
    const transactionMock = {
      begin: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    };

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);

    const reservaMock = {
      reserva_id: 15,
      inmueble_id: 6,
      inquilino_id: 8,
      estado_reserva: 'APROBADA',
      fecha_inicio: '2026-07-10',
      fecha_fin: '2026-07-15',
      renta_pactada_mensual: 3000,
      moneda: 'PEN',
      empresa_id: 6,
      codigo_inmueble: 'DEP-101',
      nombre_inmueble: 'Departamento 101'
    };

    const reciboInsertadoMock = {
      recibo_id: 40,
      cuenta_cobro_inmueble_id: 10,
      reserva_id: 15,
      periodo_anio: 2026,
      periodo_mes: 7,
      estado_recibo: 'EMITIDO',
      subtotal: 500,
      igv_total: 90,
      total: 590,
      saldo_pendiente: 590
    };

    const reciboCompletoMock = {
      ...reciboInsertadoMock,
      serie_empresa: 'B006',
      correlativo_empresa: 1
    };

    const detallesMock = [
      {
        recibo_detalle_id: 1,
        recibo_id: 40,
        descripcion: 'Renta de reserva (5 día(s))',
        importe: 500
      }
    ];

    const poolRequest = crearRequestSqlMock([
      {
        recordset: [reservaMock]
      },
      {
        recordset: [reciboCompletoMock]
      },
      {
        recordset: detallesMock
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    dbMock.__requestMock
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: []
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [
            {
              cuenta_cobro_inmueble_id: 10,
              inmueble_id: 6,
              numero_recibo_base: 'REC-6-DEP-101',
              dia_vencimiento: 5,
              activo: true
            }
          ]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [
            {
              concepto_cobro_id: 1,
              codigo: 'RENTA_RESERVA',
              nombre: 'Renta de reserva',
              aplica_igv: true,
              monto_default: 0
            }
          ]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: [reciboInsertadoMock]
        })
      )
      .mockReturnValueOnce(
        crearRequestIndividualMock({
          recordset: []
        })
      );

    const resultado = await generarReciboReservaGestion({
      usuario_gestor_id: 3,
      reserva_id: 15,
      observaciones: 'Boleta generada en prueba',
      conceptos_editados: []
    });

    expect(transactionMock.begin).toHaveBeenCalledWith('SERIALIZABLE');
    expect(transactionMock.commit).toHaveBeenCalled();
    expect(transactionMock.rollback).not.toHaveBeenCalled();

    expect(resultado).toEqual({
      ok: true,
      recibo: reciboCompletoMock,
      detalles: detallesMock,
      reserva: reservaMock
    });
  });

  test('CP-HU15-MOD-08 al generar boleta retorna RECIBO_EXISTENTE y ejecuta rollback', async () => {
    const transactionMock = {
      begin: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    };

    dbMock.sql.Transaction.mockImplementationOnce(() => transactionMock);

    const reservaMock = {
      reserva_id: 15,
      estado_reserva: 'APROBADA'
    };

    const reciboMock = {
      recibo_id: 40,
      reserva_id: 15,
      estado_recibo: 'EMITIDO'
    };

    const poolRequest = crearRequestSqlMock([
      {
        recordset: [reservaMock]
      },
      {
        recordset: [reciboMock]
      },
      {
        recordset: []
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    dbMock.__requestMock.mockReturnValueOnce(
      crearRequestIndividualMock({
        recordset: [
          {
            recibo_id: 40
          }
        ]
      })
    );

    const resultado = await generarReciboReservaGestion({
      usuario_gestor_id: 3,
      reserva_id: 15
    });

    expect(transactionMock.rollback).toHaveBeenCalled();
    expect(transactionMock.commit).not.toHaveBeenCalled();

    expect(resultado).toEqual({
      ok: false,
      codigo: 'RECIBO_EXISTENTE',
      mensaje: 'Esta reserva ya tiene una boleta digital generada.',
      recibo: reciboMock,
      detalles: []
    });
  });

  test('CP-HU15-MOD-09 lista recibos autorizados de una reserva', async () => {
    const recibosMock = [
      {
        recibo_id: 25,
        reserva_id: 15,
        estado_recibo: 'EMITIDO',
        total: 590
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

    const resultado = await listarRecibosReservaAutorizados({
      usuario_id: 8,
      reserva_id: 15
    });

    expect(resultado).toEqual(recibosMock);
    expect(poolRequest.input).toHaveBeenCalledWith('usuario_id', 'Int', 8);
    expect(poolRequest.input).toHaveBeenCalledWith('reserva_id', 'Int', 15);
  });

  test('CP-HU15-MOD-10 obtiene recibo completo autorizado', async () => {
    const reciboMock = {
      recibo_id: 25,
      reserva_id: 15,
      estado_recibo: 'EMITIDO',
      total: 590
    };

    const detallesMock = [
      {
        recibo_detalle_id: 1,
        recibo_id: 25,
        descripcion: 'Renta de reserva',
        importe: 500
      }
    ];

    const poolRequest = crearRequestSqlMock([
      {
        recordset: [
          {
            recibo_id: 25
          }
        ]
      },
      {
        recordset: [reciboMock]
      },
      {
        recordset: detallesMock
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    const resultado = await obtenerReciboCompletoAutorizado({
      usuario_id: 8,
      recibo_id: 25
    });

    expect(resultado).toEqual({
      recibo: reciboMock,
      detalles: detallesMock
    });
  });

  test('CP-HU15-MOD-11 retorna null si el usuario no tiene acceso al recibo', async () => {
    const poolRequest = crearRequestSqlMock([
      {
        recordset: []
      }
    ]);

    dbMock.getConnection.mockResolvedValue({
      request: jest.fn(() => poolRequest)
    });

    const resultado = await obtenerReciboCompletoAutorizado({
      usuario_id: 99,
      recibo_id: 25
    });

    expect(resultado).toBeNull();
  });
});