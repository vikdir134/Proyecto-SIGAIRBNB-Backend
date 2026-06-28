jest.mock('../../src/models/conceptoCobro.model', () => ({
  listarConceptosCobro: jest.fn(),
  obtenerConceptoCobroPorId: jest.fn(),
  obtenerConceptoCobroPorCodigo: jest.fn(),
  crearConceptoCobro: jest.fn(),
  actualizarConceptoCobro: jest.fn(),
  cambiarEstadoConceptoCobro: jest.fn()
}));

const conceptoModel = require('../../src/models/conceptoCobro.model');

const {
  listarConceptos,
  crearConcepto,
  actualizarConcepto,
  cambiarEstadoConcepto
} = require('../../src/controllers/conceptoCobro.controller');

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
    usuario_id: 1,
    empresa_id: 6,
    roles: ['ADMIN']
  }
} = {}) => ({
  params,
  body,
  usuario
});

const crearConceptoBodyValido = () => ({
  codigo: 'LIMPIEZA_FINAL',
  nombre: 'Limpieza final',
  descripcion: 'Cobro por limpieza final del inmueble',
  tipo_concepto: 'SERVICIO',
  categoria: 'LIMPIEZA',
  metodo_calculo: 'MONTO_FIJO',
  aplica_en: 'RESERVA',
  monto_default: 120,
  orden_impresion: 2,
  aplica_desde_dias: 1,
  es_obligatorio: false,
  aplica_igv: true,
  prorrateable: false,
  permite_pago_online: true
});

describe('HU17 - conceptoCobro.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('CP-HU17-BE-01 lista conceptos de cobro correctamente', async () => {
    const conceptosMock = [
      {
        concepto_cobro_id: 1,
        codigo: 'RENTA_RESERVA',
        nombre: 'Renta de reserva',
        tipo_concepto: 'FIJO',
        categoria: 'RENTA',
        metodo_calculo: 'RENTA_RESERVA',
        aplica_en: 'RESERVA',
        activo: true,
        editable: false
      },
      {
        concepto_cobro_id: 2,
        codigo: 'LIMPIEZA_FINAL',
        nombre: 'Limpieza final',
        tipo_concepto: 'SERVICIO',
        categoria: 'LIMPIEZA',
        metodo_calculo: 'MONTO_FIJO',
        aplica_en: 'RESERVA',
        activo: true,
        editable: true
      }
    ];

    conceptoModel.listarConceptosCobro.mockResolvedValue(conceptosMock);

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarConceptos(req, res);

    expect(conceptoModel.listarConceptosCobro).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Conceptos de cobro obtenidos correctamente.',
      conceptos: conceptosMock
    });
  });

  test('CP-HU17-BE-02 retorna 500 si falla el listado de conceptos', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    conceptoModel.listarConceptosCobro.mockRejectedValue(
      new Error('Error simulado de base de datos')
    );

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarConceptos(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al listar conceptos de cobro.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU17-BE-03 valida datos obligatorios al crear concepto', async () => {
    const req = crearRequestMock({
      body: {}
    });

    const res = crearResponseMock();

    await crearConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    const respuesta = res.json.mock.calls[0][0];

    expect(respuesta.mensaje).toBe('Datos inválidos.');
    expect(respuesta.errores).toContain('El código es obligatorio.');
    expect(respuesta.errores).toContain('El nombre es obligatorio.');

    expect(conceptoModel.obtenerConceptoCobroPorCodigo).not.toHaveBeenCalled();
    expect(conceptoModel.crearConceptoCobro).not.toHaveBeenCalled();
  });

  test('CP-HU17-BE-04 valida tipo, categoría, método y aplica_en inválidos al crear', async () => {
    const req = crearRequestMock({
      body: {
        codigo: 'TEST',
        nombre: 'Concepto test',
        tipo_concepto: 'INVALIDO',
        categoria: 'NO_EXISTE',
        metodo_calculo: 'OTRO_METODO',
        aplica_en: 'NINGUNO',
        monto_default: -10,
        orden_impresion: -1,
        aplica_desde_dias: -1
      }
    });

    const res = crearResponseMock();

    await crearConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    const respuesta = res.json.mock.calls[0][0];

    expect(respuesta.errores).toContain('El tipo de concepto no es válido.');
    expect(respuesta.errores).toContain('La categoría no es válida.');
    expect(respuesta.errores).toContain('El método de cálculo no es válido.');
    expect(respuesta.errores).toContain('El campo aplica_en no es válido.');
    expect(respuesta.errores).toContain('El monto por defecto no puede ser negativo.');
    expect(respuesta.errores).toContain('El orden de impresión debe ser mayor a cero.');
    expect(respuesta.errores).toContain(
      'La cantidad de días desde la que aplica debe ser mayor a cero.'
    );
  });

  test('CP-HU17-BE-05 bloquea creación si el código ya existe', async () => {
    conceptoModel.obtenerConceptoCobroPorCodigo.mockResolvedValue({
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL'
    });

    const req = crearRequestMock({
      body: crearConceptoBodyValido()
    });

    const res = crearResponseMock();

    await crearConcepto(req, res);

    expect(
      conceptoModel.obtenerConceptoCobroPorCodigo
    ).toHaveBeenCalledWith('LIMPIEZA_FINAL');

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Ya existe un concepto con ese código.'
    });

    expect(conceptoModel.crearConceptoCobro).not.toHaveBeenCalled();
  });

  test('CP-HU17-BE-06 crea concepto de cobro correctamente', async () => {
    const conceptoCreadoMock = {
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL',
      nombre: 'Limpieza final',
      tipo_concepto: 'SERVICIO',
      categoria: 'LIMPIEZA',
      metodo_calculo: 'MONTO_FIJO',
      aplica_en: 'RESERVA',
      monto_default: 120,
      activo: true,
      editable: true
    };

    conceptoModel.obtenerConceptoCobroPorCodigo.mockResolvedValue(null);
    conceptoModel.crearConceptoCobro.mockResolvedValue(conceptoCreadoMock);

    const req = crearRequestMock({
      body: crearConceptoBodyValido()
    });

    const res = crearResponseMock();

    await crearConcepto(req, res);

    expect(conceptoModel.crearConceptoCobro).toHaveBeenCalledWith({
      codigo: 'LIMPIEZA_FINAL',
      nombre: 'Limpieza final',
      descripcion: 'Cobro por limpieza final del inmueble',
      tipo_concepto: 'SERVICIO',
      categoria: 'LIMPIEZA',
      metodo_calculo: 'MONTO_FIJO',
      aplica_en: 'RESERVA',
      monto_default: 120,
      orden_impresion: 2,
      aplica_desde_dias: 1,
      es_obligatorio: false,
      aplica_igv: true,
      prorrateable: false,
      permite_pago_online: true
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Concepto de cobro creado correctamente.',
      concepto: conceptoCreadoMock
    });
  });

  test('CP-HU17-BE-07 normaliza código usando el nombre si no se envía código', async () => {
    conceptoModel.obtenerConceptoCobroPorCodigo.mockResolvedValue(null);
    conceptoModel.crearConceptoCobro.mockResolvedValue({
      concepto_cobro_id: 3,
      codigo: 'PENALIDAD_POR_MORA',
      nombre: 'Penalidad por mora'
    });

    const req = crearRequestMock({
      body: {
        nombre: 'Penalidad por mora',
        tipo_concepto: 'VARIABLE',
        categoria: 'PENALIDAD',
        metodo_calculo: 'MANUAL',
        aplica_en: 'AMBOS',
        monto_default: 0,
        orden_impresion: 3,
        aplica_desde_dias: 1
      }
    });

    const res = crearResponseMock();

    await crearConcepto(req, res);

    expect(
      conceptoModel.obtenerConceptoCobroPorCodigo
    ).toHaveBeenCalledWith('PENALIDAD_POR_MORA');

    expect(conceptoModel.crearConceptoCobro).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: 'PENALIDAD_POR_MORA',
        nombre: 'Penalidad por mora'
      })
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('CP-HU17-BE-08 retorna 500 si falla la creación de concepto', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    conceptoModel.obtenerConceptoCobroPorCodigo.mockResolvedValue(null);
    conceptoModel.crearConceptoCobro.mockRejectedValue(
      new Error('Error simulado')
    );

    const req = crearRequestMock({
      body: crearConceptoBodyValido()
    });

    const res = crearResponseMock();

    await crearConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al crear concepto de cobro.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU17-BE-09 valida ID inválido al actualizar concepto', async () => {
    const req = crearRequestMock({
      params: {
        concepto_cobro_id: 'abc'
      },
      body: crearConceptoBodyValido()
    });

    const res = crearResponseMock();

    await actualizarConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El ID del concepto es obligatorio.'
    });

    expect(conceptoModel.obtenerConceptoCobroPorId).not.toHaveBeenCalled();
  });

  test('CP-HU17-BE-10 retorna 404 si el concepto a actualizar no existe', async () => {
    conceptoModel.obtenerConceptoCobroPorId.mockResolvedValue(null);

    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '99'
      },
      body: crearConceptoBodyValido()
    });

    const res = crearResponseMock();

    await actualizarConcepto(req, res);

    expect(conceptoModel.obtenerConceptoCobroPorId).toHaveBeenCalledWith(99);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró el concepto de cobro.'
    });
  });

  test('CP-HU17-BE-11 bloquea actualización de concepto del sistema', async () => {
    conceptoModel.obtenerConceptoCobroPorId.mockResolvedValue({
      concepto_cobro_id: 1,
      codigo: 'RENTA_RESERVA',
      nombre: 'Renta de reserva',
      editable: false,
      es_sistema: true
    });

    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '1'
      },
      body: crearConceptoBodyValido()
    });

    const res = crearResponseMock();

    await actualizarConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Este concepto es del sistema y no puede editarse.'
    });

    expect(conceptoModel.actualizarConceptoCobro).not.toHaveBeenCalled();
  });

  test('CP-HU17-BE-12 valida datos inválidos al actualizar concepto', async () => {
    conceptoModel.obtenerConceptoCobroPorId.mockResolvedValue({
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL',
      nombre: 'Limpieza final',
      editable: true
    });

    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '2'
      },
      body: {
        nombre: '',
        tipo_concepto: 'INVALIDO',
        categoria: 'NO_EXISTE',
        metodo_calculo: 'OTRO',
        aplica_en: 'NINGUNO',
        monto_default: -1
      }
    });

    const res = crearResponseMock();

    await actualizarConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    const respuesta = res.json.mock.calls[0][0];

    expect(respuesta.mensaje).toBe('Datos inválidos.');
    expect(respuesta.errores).toContain('El nombre es obligatorio.');
    expect(respuesta.errores).toContain('El tipo de concepto no es válido.');
  });

  test('CP-HU17-BE-13 actualiza concepto de cobro correctamente', async () => {
    const conceptoActualizadoMock = {
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL',
      nombre: 'Limpieza profunda',
      tipo_concepto: 'SERVICIO',
      categoria: 'LIMPIEZA',
      metodo_calculo: 'MONTO_FIJO',
      aplica_en: 'RESERVA',
      monto_default: 150,
      activo: true,
      editable: true
    };

    conceptoModel.obtenerConceptoCobroPorId.mockResolvedValue({
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL',
      nombre: 'Limpieza final',
      editable: true
    });

    conceptoModel.actualizarConceptoCobro.mockResolvedValue(
      conceptoActualizadoMock
    );

    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '2'
      },
      body: {
        ...crearConceptoBodyValido(),
        codigo: 'NO_DEBE_CAMBIAR',
        nombre: 'Limpieza profunda',
        monto_default: 150
      }
    });

    const res = crearResponseMock();

    await actualizarConcepto(req, res);

    expect(conceptoModel.actualizarConceptoCobro).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        codigo: 'LIMPIEZA_FINAL',
        nombre: 'Limpieza profunda',
        monto_default: 150
      })
    );

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Concepto de cobro actualizado correctamente.',
      concepto: conceptoActualizadoMock
    });
  });

  test('CP-HU17-BE-14 retorna 500 si falla la actualización de concepto', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    conceptoModel.obtenerConceptoCobroPorId.mockResolvedValue({
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL',
      editable: true
    });

    conceptoModel.actualizarConceptoCobro.mockRejectedValue(
      new Error('Error simulado')
    );

    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '2'
      },
      body: crearConceptoBodyValido()
    });

    const res = crearResponseMock();

    await actualizarConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al actualizar concepto de cobro.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU17-BE-15 valida ID inválido al cambiar estado', async () => {
    const req = crearRequestMock({
      params: {
        concepto_cobro_id: 'abc'
      },
      body: {
        activo: false
      }
    });

    const res = crearResponseMock();

    await cambiarEstadoConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El ID del concepto es obligatorio.'
    });

    expect(conceptoModel.obtenerConceptoCobroPorId).not.toHaveBeenCalled();
  });

  test('CP-HU17-BE-16 valida que activo sea booleano', async () => {
    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '2'
      },
      body: {
        activo: 'false'
      }
    });

    const res = crearResponseMock();

    await cambiarEstadoConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El estado activo debe ser true o false.'
    });

    expect(conceptoModel.obtenerConceptoCobroPorId).not.toHaveBeenCalled();
  });

  test('CP-HU17-BE-17 retorna 404 si el concepto a cambiar estado no existe', async () => {
    conceptoModel.obtenerConceptoCobroPorId.mockResolvedValue(null);

    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '99'
      },
      body: {
        activo: false
      }
    });

    const res = crearResponseMock();

    await cambiarEstadoConcepto(req, res);

    expect(conceptoModel.obtenerConceptoCobroPorId).toHaveBeenCalledWith(99);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró el concepto de cobro.'
    });
  });

  test('CP-HU17-BE-18 bloquea desactivación de concepto del sistema', async () => {
    conceptoModel.obtenerConceptoCobroPorId.mockResolvedValue({
      concepto_cobro_id: 1,
      codigo: 'RENTA_RESERVA',
      editable: false,
      es_sistema: true
    });

    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '1'
      },
      body: {
        activo: false
      }
    });

    const res = crearResponseMock();

    await cambiarEstadoConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Este concepto es del sistema y no puede desactivarse.'
    });

    expect(conceptoModel.cambiarEstadoConceptoCobro).not.toHaveBeenCalled();
  });

  test('CP-HU17-BE-19 desactiva concepto de cobro correctamente', async () => {
    const conceptoDesactivadoMock = {
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL',
      nombre: 'Limpieza final',
      activo: false,
      editable: true
    };

    conceptoModel.obtenerConceptoCobroPorId.mockResolvedValue({
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL',
      editable: true
    });

    conceptoModel.cambiarEstadoConceptoCobro.mockResolvedValue(
      conceptoDesactivadoMock
    );

    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '2'
      },
      body: {
        activo: false
      }
    });

    const res = crearResponseMock();

    await cambiarEstadoConcepto(req, res);

    expect(conceptoModel.cambiarEstadoConceptoCobro).toHaveBeenCalledWith(
      2,
      false
    );

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Concepto de cobro desactivado correctamente.',
      concepto: conceptoDesactivadoMock
    });
  });

  test('CP-HU17-BE-20 reactiva concepto de cobro correctamente', async () => {
    const conceptoReactivadoMock = {
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL',
      nombre: 'Limpieza final',
      activo: true,
      editable: true
    };

    conceptoModel.obtenerConceptoCobroPorId.mockResolvedValue({
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL',
      editable: true
    });

    conceptoModel.cambiarEstadoConceptoCobro.mockResolvedValue(
      conceptoReactivadoMock
    );

    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '2'
      },
      body: {
        activo: true
      }
    });

    const res = crearResponseMock();

    await cambiarEstadoConcepto(req, res);

    expect(conceptoModel.cambiarEstadoConceptoCobro).toHaveBeenCalledWith(
      2,
      true
    );

    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Concepto de cobro reactivado correctamente.',
      concepto: conceptoReactivadoMock
    });
  });

  test('CP-HU17-BE-21 retorna 500 si falla el cambio de estado', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    conceptoModel.obtenerConceptoCobroPorId.mockResolvedValue({
      concepto_cobro_id: 2,
      codigo: 'LIMPIEZA_FINAL',
      editable: true
    });

    conceptoModel.cambiarEstadoConceptoCobro.mockRejectedValue(
      new Error('Error simulado')
    );

    const req = crearRequestMock({
      params: {
        concepto_cobro_id: '2'
      },
      body: {
        activo: false
      }
    });

    const res = crearResponseMock();

    await cambiarEstadoConcepto(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al cambiar el estado del concepto de cobro.'
    });

    consoleErrorMock.mockRestore();
  });
});