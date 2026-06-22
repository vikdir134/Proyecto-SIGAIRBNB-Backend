
const {
  listarIPC,
  buscarIPCPorAnio,
  registrarIPC: registrarIPCModel,
  listarInmueblesConRenta,
  obtenerInmueblePorId,
  verificarAplicacionIPC,
  aplicarIPCMasivo,
  listarHistorialTarifas
} = require('../models/tarifa.model');

const rolesPermitidos = ['SECRETARIO', 'ADMIN_EMPRESA', 'ADMIN'];


const obtenerRolesUsuario = (usuario) => {
  if (!usuario) return [];

  if (Array.isArray(usuario.roles)) {
    return usuario.roles.map((rol) => {
      if (typeof rol === 'string') {
        return rol.toUpperCase();
      }

      return (
        rol?.nombre ||
        rol?.nombre_rol ||
        rol?.codigo ||
        rol?.codigo_rol ||
        ''
      ).toString().toUpperCase();
    }).filter(Boolean);
  }

  const rolUnico = (
    usuario?.rol_nombre ||
    usuario?.nombre_rol ||
    usuario?.rol ||
    usuario?.codigo_rol ||
    usuario?.role ||
    usuario?.tipo_usuario ||
    ''
  ).toString().toUpperCase();

  return rolUnico ? [rolUnico] : [];
};

const validarAccesoGestion = (req, res) => {
  if (!req.usuario) {
    res.status(401).json({
      mensaje: 'Usuario no autenticado.'
    });
    return false;
  }

  const rolesUsuario = obtenerRolesUsuario(req.usuario);

  const tienePermiso = rolesUsuario.some((rol) =>
    rolesPermitidos.includes(rol)
  );

  if (!tienePermiso) {
    res.status(403).json({
      mensaje: 'No tienes permisos para gestionar tarifas.',
      roles_detectados: rolesUsuario
    });
    return false;
  }

  return true;
};

const obtenerInmuebleIds = (body) => {
  return (
    body.inmueble_ids ||
    body.inmuebles_ids ||
    body.inmueblesSeleccionados ||
    body.inmuebles_seleccionados ||
    []
  );
};

const redondear2 = (numero) => {
  return Math.round((Number(numero) + Number.EPSILON) * 100) / 100;
};

const listarIPCController = async (req, res) => {
  try {
    if (!validarAccesoGestion(req, res)) return;

    const ipc = await listarIPC();

    return res.status(200).json({
      mensaje: 'IPC registrados obtenidos correctamente.',
      ipc
    });

  } catch (error) {
    console.error('Error al listar IPC:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar IPC.'
    });
  }
};

const registrarIPC = async (req, res) => {
  try {
    if (!validarAccesoGestion(req, res)) return;

    const {
      anio,
      porcentaje_anual,
      fecha_publicacion
    } = req.body;

    const anioNumero = Number(anio);
    const porcentajeNumero = Number(porcentaje_anual);

    if (!anio || !Number.isInteger(anioNumero)) {
      return res.status(400).json({
        mensaje: 'El año es obligatorio y debe ser un número entero.'
      });
    }

    if (anioNumero < 2000 || anioNumero > 2100) {
      return res.status(400).json({
        mensaje: 'El año ingresado no es válido.'
      });
    }

    if (
      porcentaje_anual === undefined ||
      porcentaje_anual === null ||
      porcentaje_anual === '' ||
      Number.isNaN(porcentajeNumero)
    ) {
      return res.status(400).json({
        mensaje: 'El porcentaje anual es obligatorio.'
      });
    }

    if (porcentajeNumero < 0) {
      return res.status(400).json({
        mensaje: 'El porcentaje anual no puede ser negativo.'
      });
    }

    const existente = await buscarIPCPorAnio(anioNumero);

    if (existente) {
      return res.status(409).json({
        mensaje: `Ya existe un IPC registrado para el año ${anioNumero}.`,
        ipc: existente
      });
    }

    const ipcCreado = await registrarIPCModel({
      anio: anioNumero,
      porcentaje_anual: porcentajeNumero,
      fecha_publicacion: fecha_publicacion || null
    });

    return res.status(201).json({
      mensaje: 'IPC registrado correctamente.',
      ipc: ipcCreado
    });

  } catch (error) {
    console.error('Error al registrar IPC:', error);

    return res.status(500).json({
      mensaje: 'Error interno al registrar IPC.'
    });
  }
};

const listarInmuebles = async (req, res) => {
  try {
    if (!validarAccesoGestion(req, res)) return;

    const empresa_id = req.usuario.empresa_id;

    if (!empresa_id) {
      return res.status(400).json({
        mensaje: 'No se encontró la empresa del usuario autenticado.'
      });
    }

    const inmuebles = await listarInmueblesConRenta(empresa_id);

    return res.status(200).json({
      mensaje: 'Inmuebles con renta obtenidos correctamente.',
      inmuebles
    });

  } catch (error) {
    console.error('Error al listar inmuebles con renta:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar inmuebles con renta.'
    });
  }
};

const previsualizarAplicacionIPC = async (req, res) => {
  try {
    if (!validarAccesoGestion(req, res)) return;

    const empresa_id = req.usuario.empresa_id;

    const {
      anio
    } = req.body;

    const inmueble_ids = obtenerInmuebleIds(req.body);
    const anioNumero = Number(anio);

    if (!empresa_id) {
      return res.status(400).json({
        mensaje: 'No se encontró la empresa del usuario autenticado.'
      });
    }

    if (!anio || !Number.isInteger(anioNumero)) {
      return res.status(400).json({
        mensaje: 'Debe seleccionar un año IPC válido.'
      });
    }

    if (!Array.isArray(inmueble_ids) || inmueble_ids.length === 0) {
      return res.status(400).json({
        mensaje: 'Debe seleccionar al menos un inmueble para previsualizar.'
      });
    }

    const ipc = await buscarIPCPorAnio(anioNumero);

    if (!ipc) {
      return res.status(404).json({
        mensaje: `No existe IPC registrado para el año ${anioNumero}.`
      });
    }

    const porcentajeIPC = Number(ipc.porcentaje_anual);
    const previsualizacion = [];

    for (const item of inmueble_ids) {
      const inmueble_id = Number(item);

      if (!Number.isInteger(inmueble_id)) {
        return res.status(400).json({
          mensaje: 'Uno de los inmuebles seleccionados no tiene un ID válido.'
        });
      }

      const inmueble = await obtenerInmueblePorId(empresa_id, inmueble_id);

      if (!inmueble) {
        return res.status(404).json({
          mensaje: `El inmueble ${inmueble_id} no existe o no pertenece a la empresa.`
        });
      }

      const rentaActual = Number(inmueble.renta_base_mensual || 0);

      if (rentaActual <= 0) {
        return res.status(400).json({
          mensaje: `El inmueble ${inmueble_id} no tiene una renta base mensual válida.`
        });
      }

      const montoIncremento = redondear2(rentaActual * (porcentajeIPC / 100));
      const nuevaRenta = redondear2(rentaActual + montoIncremento);

      const aplicacionExistente = await verificarAplicacionIPC(
        inmueble_id,
        ipc.indice_ipc_id
      );

      previsualizacion.push({
        inmueble_id,
        codigo: inmueble.codigo,
        nombre: inmueble.nombre,
        tipo_inmueble: inmueble.tipo_inmueble,
        direccion_linea1: inmueble.direccion_linea1,
        distrito: inmueble.distrito,
        ciudad: inmueble.ciudad,
        moneda: inmueble.moneda,
        anio_ipc: ipc.anio,
        indice_ipc_id: ipc.indice_ipc_id,
        porcentaje_ipc: porcentajeIPC,
        renta_actual: rentaActual,
        monto_incremento: montoIncremento,
        nueva_renta: nuevaRenta,
        ya_aplicado: !!aplicacionExistente
      });
    }

    return res.status(200).json({
      mensaje: 'Previsualización generada correctamente.',
      advertencia: 'Esta acción actualizará rentas futuras, no recibos anteriores.',
      ipc,
      previsualizacion
    });

  } catch (error) {
    console.error('Error al previsualizar aplicación IPC:', error);

    return res.status(500).json({
      mensaje: 'Error interno al previsualizar la aplicación de IPC.'
    });
  }
};

const aplicarIPC = async (req, res) => {
  try {
    if (!validarAccesoGestion(req, res)) return;

    const empresa_id = req.usuario.empresa_id;
    const usuario_id = req.usuario.usuario_id;

    const {
      anio,
      aplicar_a_publicacion,
      motivo
    } = req.body;

    const inmueble_ids = obtenerInmuebleIds(req.body);
    const anioNumero = Number(anio);

    if (!empresa_id) {
      return res.status(400).json({
        mensaje: 'No se encontró la empresa del usuario autenticado.'
      });
    }

    if (!usuario_id) {
      return res.status(400).json({
        mensaje: 'No se encontró el usuario autenticado.'
      });
    }

    if (!anio || !Number.isInteger(anioNumero)) {
      return res.status(400).json({
        mensaje: 'Debe seleccionar un año IPC válido.'
      });
    }

    if (!Array.isArray(inmueble_ids) || inmueble_ids.length === 0) {
      return res.status(400).json({
        mensaje: 'Debe seleccionar al menos un inmueble para aplicar IPC.'
      });
    }

    const idsLimpios = inmueble_ids.map((id) => Number(id));

    if (idsLimpios.some((id) => !Number.isInteger(id))) {
      return res.status(400).json({
        mensaje: 'Uno de los inmuebles seleccionados no tiene un ID válido.'
      });
    }

    const ipc = await buscarIPCPorAnio(anioNumero);

    if (!ipc) {
      return res.status(404).json({
        mensaje: `No existe IPC registrado para el año ${anioNumero}.`
      });
    }

    const duplicados = [];

    for (const inmueble_id of idsLimpios) {
      const inmueble = await obtenerInmueblePorId(empresa_id, inmueble_id);

      if (!inmueble) {
        return res.status(404).json({
          mensaje: `El inmueble ${inmueble_id} no existe o no pertenece a la empresa.`
        });
      }

      const aplicacionExistente = await verificarAplicacionIPC(
        inmueble_id,
        ipc.indice_ipc_id
      );

      if (aplicacionExistente) {
        duplicados.push({
          inmueble_id,
          tarifa_inmueble_id: aplicacionExistente.tarifa_inmueble_id
        });
      }
    }

    if (duplicados.length > 0) {
      return res.status(409).json({
        mensaje: 'No se puede aplicar el mismo IPC más de una vez a uno o más inmuebles.',
        duplicados
      });
    }

    const aplicarPublicacionFinal =
      aplicar_a_publicacion === true ||
      aplicar_a_publicacion === 'true' ||
      aplicar_a_publicacion === 1 ||
      aplicar_a_publicacion === '1';

    const resultado = await aplicarIPCMasivo({
      empresa_id,
      usuario_id,
      ipc,
      inmueble_ids: idsLimpios,
      aplicar_a_publicacion: aplicarPublicacionFinal,
      motivo: motivo || null
    });

    return res.status(200).json({
      mensaje: 'IPC aplicado correctamente. Las rentas futuras fueron actualizadas.',
      advertencia: 'Esta acción actualizó rentas futuras, no recibos anteriores.',
      resumen: {
        total_actualizados: resultado.length,
        actualizados: resultado
      }
    });

  } catch (error) {
    console.error('Error al aplicar IPC:', error);

    return res.status(500).json({
      mensaje: error.message || 'Error interno al aplicar IPC.'
    });
  }
};

const listarHistorialTarifasController = async (req, res) => {
  try {
    if (!validarAccesoGestion(req, res)) return;

    const empresa_id = req.usuario.empresa_id;
    const inmueble_id = Number(req.params.id);

    if (!empresa_id) {
      return res.status(400).json({
        mensaje: 'No se encontró la empresa del usuario autenticado.'
      });
    }

    if (!Number.isInteger(inmueble_id)) {
      return res.status(400).json({
        mensaje: 'El ID del inmueble no es válido.'
      });
    }

    const inmueble = await obtenerInmueblePorId(empresa_id, inmueble_id);

    if (!inmueble) {
      return res.status(404).json({
        mensaje: 'El inmueble no existe o no pertenece a la empresa.'
      });
    }

    const historial = await listarHistorialTarifas(empresa_id, inmueble_id);

    return res.status(200).json({
      mensaje: 'Historial de tarifas obtenido correctamente.',
      inmueble,
      historial
    });

  } catch (error) {
    console.error('Error al listar historial de tarifas:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar historial de tarifas.'
    });
  }
};

module.exports = {
  listarIPC: listarIPCController,
  registrarIPC,
  listarInmuebles,
  previsualizarAplicacionIPC,
  aplicarIPC,
  listarHistorialTarifas: listarHistorialTarifasController
};