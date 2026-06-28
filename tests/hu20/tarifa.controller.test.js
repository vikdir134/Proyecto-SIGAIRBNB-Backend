jest.mock('../../src/models/tarifa.model', () => ({
  listarIPC: jest.fn(),
  buscarIPCPorAnio: jest.fn(),
  registrarIPC: jest.fn(),
  listarInmueblesConRenta: jest.fn(),
  obtenerInmueblePorId: jest.fn(),
  verificarAplicacionIPC: jest.fn(),
  aplicarIPCMasivo: jest.fn(),
  listarHistorialTarifas: jest.fn()
}));

const tarifaModel = require('../../src/models/tarifa.model');

const {
  listarIPC,
  registrarIPC,
  listarInmuebles,
  previsualizarAplicacionIPC,
  aplicarIPC,
  listarHistorialTarifas
} = require('../../src/controllers/tarifa.controller');

const crearResponseMock = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
};

const crearRequestMock = ({
  body = {},
  params = {},
  usuario = {
    usuario_id: 1,
    empresa_id: 6,
    roles: ['ADMIN']
  }
} = {}) => ({
  body,
  params,
  usuario
});

const crearIPCMock = () => ({
  indice_ipc_id: 4,
  anio: 2026,
  porcentaje_anual: 3.5,
  fecha_publicacion: '2026-01-15',
  activo: true
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
  ...overrides
});

describe('HU20 - tarifa.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('CP-HU20-BE-01 lista IPC registrados correctamente', async () => {
    const ipcMock = [crearIPCMock()];

    tarifaModel.listarIPC.mockResolvedValue(ipcMock);

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarIPC(req, res);

    expect(tarifaModel.listarIPC).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'IPC registrados obtenidos correctamente.',
      ipc: ipcMock
    });
  });

  test('CP-HU20-BE-02 retorna 401 si el usuario no está autenticado', async () => {
    const req = crearRequestMock({
      usuario: null
    });

    const res = crearResponseMock();

    await listarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Usuario no autenticado.'
    });

    expect(tarifaModel.listarIPC).not.toHaveBeenCalled();
  });

  test('CP-HU20-BE-03 retorna 403 si el usuario no tiene rol permitido', async () => {
    const req = crearRequestMock({
      usuario: {
        usuario_id: 1,
        empresa_id: 6,
        roles: ['CLIENTE']
      }
    });

    const res = crearResponseMock();

    await listarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No tienes permisos para gestionar tarifas.',
      roles_detectados: ['CLIENTE']
    });

    expect(tarifaModel.listarIPC).not.toHaveBeenCalled();
  });

  test('CP-HU20-BE-04 retorna 500 si falla el listado de IPC', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    tarifaModel.listarIPC.mockRejectedValue(new Error('Error simulado'));

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al listar IPC.'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU20-BE-05 registra IPC correctamente', async () => {
    const ipcCreadoMock = crearIPCMock();

    tarifaModel.buscarIPCPorAnio.mockResolvedValue(null);
    tarifaModel.registrarIPC.mockResolvedValue(ipcCreadoMock);

    const req = crearRequestMock({
      body: {
        anio: 2026,
        porcentaje_anual: 3.5,
        fecha_publicacion: '2026-01-15'
      }
    });

    const res = crearResponseMock();

    await registrarIPC(req, res);

    expect(tarifaModel.buscarIPCPorAnio).toHaveBeenCalledWith(2026);
    expect(tarifaModel.registrarIPC).toHaveBeenCalledWith({
      anio: 2026,
      porcentaje_anual: 3.5,
      fecha_publicacion: '2026-01-15'
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'IPC registrado correctamente.',
      ipc: ipcCreadoMock
    });
  });

  test('CP-HU20-BE-06 valida año obligatorio o no entero al registrar IPC', async () => {
    const req = crearRequestMock({
      body: {
        anio: '2026.5',
        porcentaje_anual: 3.5
      }
    });

    const res = crearResponseMock();

    await registrarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El año es obligatorio y debe ser un número entero.'
    });

    expect(tarifaModel.registrarIPC).not.toHaveBeenCalled();
  });

  test('CP-HU20-BE-07 valida rango de año al registrar IPC', async () => {
    const req = crearRequestMock({
      body: {
        anio: 1999,
        porcentaje_anual: 3.5
      }
    });

    const res = crearResponseMock();

    await registrarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El año ingresado no es válido.'
    });
  });

  test('CP-HU20-BE-08 valida porcentaje anual obligatorio', async () => {
    const req = crearRequestMock({
      body: {
        anio: 2026,
        porcentaje_anual: ''
      }
    });

    const res = crearResponseMock();

    await registrarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El porcentaje anual es obligatorio.'
    });
  });

  test('CP-HU20-BE-09 valida porcentaje anual negativo', async () => {
    const req = crearRequestMock({
      body: {
        anio: 2026,
        porcentaje_anual: -2
      }
    });

    const res = crearResponseMock();

    await registrarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El porcentaje anual no puede ser negativo.'
    });
  });

  test('CP-HU20-BE-10 evita registrar IPC duplicado por año', async () => {
    const ipcExistenteMock = crearIPCMock();

    tarifaModel.buscarIPCPorAnio.mockResolvedValue(ipcExistenteMock);

    const req = crearRequestMock({
      body: {
        anio: 2026,
        porcentaje_anual: 3.5
      }
    });

    const res = crearResponseMock();

    await registrarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Ya existe un IPC registrado para el año 2026.',
      ipc: ipcExistenteMock
    });

    expect(tarifaModel.registrarIPC).not.toHaveBeenCalled();
  });

  test('CP-HU20-BE-11 lista inmuebles con renta correctamente', async () => {
    const inmueblesMock = [crearInmuebleMock()];

    tarifaModel.listarInmueblesConRenta.mockResolvedValue(inmueblesMock);

    const req = crearRequestMock();
    const res = crearResponseMock();

    await listarInmuebles(req, res);

    expect(tarifaModel.listarInmueblesConRenta).toHaveBeenCalledWith(6);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Inmuebles con renta obtenidos correctamente.',
      inmuebles: inmueblesMock
    });
  });

  test('CP-HU20-BE-12 valida empresa obligatoria al listar inmuebles', async () => {
    const req = crearRequestMock({
      usuario: {
        usuario_id: 1,
        empresa_id: null,
        roles: ['ADMIN']
      }
    });

    const res = crearResponseMock();

    await listarInmuebles(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró la empresa del usuario autenticado.'
    });
  });

  test('CP-HU20-BE-13 previsualiza aplicación de IPC correctamente', async () => {
    const ipcMock = crearIPCMock();

    tarifaModel.buscarIPCPorAnio.mockResolvedValue(ipcMock);

    tarifaModel.obtenerInmueblePorId
      .mockResolvedValueOnce(crearInmuebleMock())
      .mockResolvedValueOnce(
        crearInmuebleMock({
          inmueble_id: 11,
          codigo: 'DEP-102',
          nombre: 'Departamento 102',
          renta_base_mensual: 2000
        })
      );

    tarifaModel.verificarAplicacionIPC
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        tarifa_inmueble_id: 99
      });

    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: [10, 11]
      }
    });

    const res = crearResponseMock();

    await previsualizarAplicacionIPC(req, res);

    expect(tarifaModel.buscarIPCPorAnio).toHaveBeenCalledWith(2026);
    expect(tarifaModel.obtenerInmueblePorId).toHaveBeenCalledWith(6, 10);
    expect(tarifaModel.obtenerInmueblePorId).toHaveBeenCalledWith(6, 11);
    expect(tarifaModel.verificarAplicacionIPC).toHaveBeenCalledWith(10, 4);
    expect(tarifaModel.verificarAplicacionIPC).toHaveBeenCalledWith(11, 4);

    expect(res.status).toHaveBeenCalledWith(200);

    const respuesta = res.json.mock.calls[0][0];

    expect(respuesta.mensaje).toBe('Previsualización generada correctamente.');
    expect(respuesta.advertencia).toBe(
      'Esta acción actualizará rentas futuras, no recibos anteriores.'
    );
    expect(respuesta.previsualizacion).toHaveLength(2);
    expect(respuesta.previsualizacion[0]).toEqual(
      expect.objectContaining({
        inmueble_id: 10,
        renta_actual: 1000,
        porcentaje_ipc: 3.5,
        monto_incremento: 35,
        nueva_renta: 1035,
        ya_aplicado: false
      })
    );
    expect(respuesta.previsualizacion[1]).toEqual(
      expect.objectContaining({
        inmueble_id: 11,
        renta_actual: 2000,
        monto_incremento: 70,
        nueva_renta: 2070,
        ya_aplicado: true
      })
    );
  });

  test('CP-HU20-BE-14 valida año IPC al previsualizar', async () => {
    const req = crearRequestMock({
      body: {
        anio: 'abc',
        inmueble_ids: [10]
      }
    });

    const res = crearResponseMock();

    await previsualizarAplicacionIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Debe seleccionar un año IPC válido.'
    });
  });

  test('CP-HU20-BE-15 valida inmuebles seleccionados al previsualizar', async () => {
    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: []
      }
    });

    const res = crearResponseMock();

    await previsualizarAplicacionIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Debe seleccionar al menos un inmueble para previsualizar.'
    });
  });

  test('CP-HU20-BE-16 retorna 404 si no existe IPC para previsualizar', async () => {
    tarifaModel.buscarIPCPorAnio.mockResolvedValue(null);

    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: [10]
      }
    });

    const res = crearResponseMock();

    await previsualizarAplicacionIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No existe IPC registrado para el año 2026.'
    });
  });

  test('CP-HU20-BE-17 valida ID de inmueble inválido al previsualizar', async () => {
    tarifaModel.buscarIPCPorAnio.mockResolvedValue(crearIPCMock());

    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: ['abc']
      }
    });

    const res = crearResponseMock();

    await previsualizarAplicacionIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Uno de los inmuebles seleccionados no tiene un ID válido.'
    });
  });

  test('CP-HU20-BE-18 retorna 404 si inmueble no pertenece a la empresa al previsualizar', async () => {
    tarifaModel.buscarIPCPorAnio.mockResolvedValue(crearIPCMock());
    tarifaModel.obtenerInmueblePorId.mockResolvedValue(null);

    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: [99]
      }
    });

    const res = crearResponseMock();

    await previsualizarAplicacionIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El inmueble 99 no existe o no pertenece a la empresa.'
    });
  });

  test('CP-HU20-BE-19 valida renta base inválida al previsualizar', async () => {
    tarifaModel.buscarIPCPorAnio.mockResolvedValue(crearIPCMock());
    tarifaModel.obtenerInmueblePorId.mockResolvedValue(
      crearInmuebleMock({
        renta_base_mensual: 0
      })
    );

    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: [10]
      }
    });

    const res = crearResponseMock();

    await previsualizarAplicacionIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El inmueble 10 no tiene una renta base mensual válida.'
    });
  });

  test('CP-HU20-BE-20 aplica IPC correctamente', async () => {
    const ipcMock = crearIPCMock();

    const resultadoMock = [
      {
        inmueble_id: 10,
        nombre: 'Departamento 101',
        renta_anterior: 1000,
        porcentaje_ipc_aplicado: 3.5,
        monto_incremento: 35,
        nueva_renta: 1035
      }
    ];

    tarifaModel.buscarIPCPorAnio.mockResolvedValue(ipcMock);
    tarifaModel.obtenerInmueblePorId.mockResolvedValue(crearInmuebleMock());
    tarifaModel.verificarAplicacionIPC.mockResolvedValue(null);
    tarifaModel.aplicarIPCMasivo.mockResolvedValue(resultadoMock);

    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: ['10'],
        aplicar_a_publicacion: 'true',
        motivo: 'Actualización anual'
      }
    });

    const res = crearResponseMock();

    await aplicarIPC(req, res);

    expect(tarifaModel.aplicarIPCMasivo).toHaveBeenCalledWith({
      empresa_id: 6,
      usuario_id: 1,
      ipc: ipcMock,
      inmueble_ids: [10],
      aplicar_a_publicacion: true,
      motivo: 'Actualización anual'
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'IPC aplicado correctamente. Las rentas futuras fueron actualizadas.',
      advertencia: 'Esta acción actualizó rentas futuras, no recibos anteriores.',
      resumen: {
        total_actualizados: 1,
        actualizados: resultadoMock
      }
    });
  });

  test('CP-HU20-BE-21 valida usuario autenticado al aplicar IPC', async () => {
    const req = crearRequestMock({
      usuario: {
        usuario_id: null,
        empresa_id: 6,
        roles: ['ADMIN']
      },
      body: {
        anio: 2026,
        inmueble_ids: [10]
      }
    });

    const res = crearResponseMock();

    await aplicarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se encontró el usuario autenticado.'
    });
  });

  test('CP-HU20-BE-22 bloquea aplicación duplicada de IPC', async () => {
    tarifaModel.buscarIPCPorAnio.mockResolvedValue(crearIPCMock());
    tarifaModel.obtenerInmueblePorId.mockResolvedValue(crearInmuebleMock());
    tarifaModel.verificarAplicacionIPC.mockResolvedValue({
      tarifa_inmueble_id: 99
    });

    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: [10]
      }
    });

    const res = crearResponseMock();

    await aplicarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No se puede aplicar el mismo IPC más de una vez a uno o más inmuebles.',
      duplicados: [
        {
          inmueble_id: 10,
          tarifa_inmueble_id: 99
        }
      ]
    });

    expect(tarifaModel.aplicarIPCMasivo).not.toHaveBeenCalled();
  });

  test('CP-HU20-BE-23 valida ID de inmueble inválido al aplicar IPC', async () => {
    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: ['abc']
      }
    });

    const res = crearResponseMock();

    await aplicarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Uno de los inmuebles seleccionados no tiene un ID válido.'
    });
  });

  test('CP-HU20-BE-24 retorna 404 si no existe IPC al aplicar', async () => {
    tarifaModel.buscarIPCPorAnio.mockResolvedValue(null);

    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: [10]
      }
    });

    const res = crearResponseMock();

    await aplicarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'No existe IPC registrado para el año 2026.'
    });
  });

  test('CP-HU20-BE-25 retorna 500 si falla la aplicación de IPC', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    tarifaModel.buscarIPCPorAnio.mockResolvedValue(crearIPCMock());
    tarifaModel.obtenerInmueblePorId.mockResolvedValue(crearInmuebleMock());
    tarifaModel.verificarAplicacionIPC.mockResolvedValue(null);
    tarifaModel.aplicarIPCMasivo.mockRejectedValue(
      new Error('Error al actualizar tarifa')
    );

    const req = crearRequestMock({
      body: {
        anio: 2026,
        inmueble_ids: [10]
      }
    });

    const res = crearResponseMock();

    await aplicarIPC(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error al actualizar tarifa'
    });

    consoleErrorMock.mockRestore();
  });

  test('CP-HU20-BE-26 lista historial de tarifas correctamente', async () => {
    const inmuebleMock = crearInmuebleMock();

    const historialMock = [
      {
        tarifa_inmueble_id: 1,
        inmueble_id: 10,
        anio: 2026,
        renta_base_mensual: 1035,
        porcentaje_ipc_aplicado: 3.5
      }
    ];

    tarifaModel.obtenerInmueblePorId.mockResolvedValue(inmuebleMock);
    tarifaModel.listarHistorialTarifas.mockResolvedValue(historialMock);

    const req = crearRequestMock({
      params: {
        id: '10'
      }
    });

    const res = crearResponseMock();

    await listarHistorialTarifas(req, res);

    expect(tarifaModel.obtenerInmueblePorId).toHaveBeenCalledWith(6, 10);
    expect(tarifaModel.listarHistorialTarifas).toHaveBeenCalledWith(6, 10);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Historial de tarifas obtenido correctamente.',
      inmueble: inmuebleMock,
      historial: historialMock
    });
  });

  test('CP-HU20-BE-27 valida ID de inmueble inválido al listar historial', async () => {
    const req = crearRequestMock({
      params: {
        id: 'abc'
      }
    });

    const res = crearResponseMock();

    await listarHistorialTarifas(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El ID del inmueble no es válido.'
    });
  });

  test('CP-HU20-BE-28 retorna 404 si inmueble no existe al listar historial', async () => {
    tarifaModel.obtenerInmueblePorId.mockResolvedValue(null);

    const req = crearRequestMock({
      params: {
        id: '99'
      }
    });

    const res = crearResponseMock();

    await listarHistorialTarifas(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'El inmueble no existe o no pertenece a la empresa.'
    });

    expect(tarifaModel.listarHistorialTarifas).not.toHaveBeenCalled();
  });

  test('CP-HU20-BE-29 retorna 500 si falla el historial de tarifas', async () => {
    const consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    tarifaModel.obtenerInmueblePorId.mockResolvedValue(crearInmuebleMock());
    tarifaModel.listarHistorialTarifas.mockRejectedValue(
      new Error('Error simulado')
    );

    const req = crearRequestMock({
      params: {
        id: '10'
      }
    });

    const res = crearResponseMock();

    await listarHistorialTarifas(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Error interno al listar historial de tarifas.'
    });

    consoleErrorMock.mockRestore();
  });
});