const {
  buscarEdificioPorCodigo,
  registrarEdificio,
  listarEdificios,
  buscarEdificioPadrePorId,
  registrarPisoLocal,
  listarPisosLocalesPorEdificio,
  buscarUnidadPorUbicacion,
  buscarUnidadPorId,

  // HU05 - Mantenimiento de Datos
  listarInmueblesMantenimiento,
  buscarInmuebleMantenimientoPorId,
  contarUnidadesActivasPorEdificio,
  darBajaLogicaInmueble,
  actualizarInmuebleMantenimiento,
  listarCatalogoCaracteristicas,
  listarCaracteristicasPorInmueble,
  actualizarCaracteristicasInmueble
} = require('../models/edificio.model');

const limpiarTexto = (valor) => {
  if (valor === undefined || valor === null) {
    return '';
  }

  return String(valor).trim();
};

const convertirNumeroOpcional = (valor) => {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  return Number(valor);
};

const crearEdificio = async (req, res) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      direccion_linea1,
      direccion_linea2,
      numero,
      distrito,
      ciudad,
      provincia,
      departamento,
      codigo_postal,
      pais,
      area_m2,
      latitud,
      longitud
    } = req.body;

    const codigoNormalizado = limpiarTexto(codigo).toUpperCase();
    const nombreLimpio = limpiarTexto(nombre);
    const direccionLimpia = limpiarTexto(direccion_linea1);
    const numeroLimpio = limpiarTexto(numero);
    const codigoPostalLimpio = limpiarTexto(codigo_postal);

    if (!codigoNormalizado || !nombreLimpio || !direccionLimpia || !numeroLimpio || !codigoPostalLimpio) {
      return res.status(400).json({
        mensaje: 'Código, nombre, dirección principal, número y código postal son obligatorios'
      });
    }

    if (codigoNormalizado.length > 30) {
      return res.status(400).json({
        mensaje: 'El código no debe superar los 30 caracteres'
      });
    }

    if (nombreLimpio.length > 150) {
      return res.status(400).json({
        mensaje: 'El nombre del edificio no debe superar los 150 caracteres'
      });
    }

    if (direccionLimpia.length > 255) {
      return res.status(400).json({
        mensaje: 'La dirección principal no debe superar los 255 caracteres'
      });
    }

    if (numeroLimpio.length > 30) {
      return res.status(400).json({
        mensaje: 'El número no debe superar los 30 caracteres'
      });
    }

    if (codigoPostalLimpio.length > 20) {
      return res.status(400).json({
        mensaje: 'El código postal no debe superar los 20 caracteres'
      });
    }

    const areaConvertida = convertirNumeroOpcional(area_m2);
    const latitudConvertida = convertirNumeroOpcional(latitud);
    const longitudConvertida = convertirNumeroOpcional(longitud);

    const erroresNumericos = [];

    if (areaConvertida !== null && (Number.isNaN(areaConvertida) || areaConvertida <= 0)) {
      erroresNumericos.push('El área en m² debe ser un número mayor a 0');
    }

    if (latitudConvertida !== null && (Number.isNaN(latitudConvertida) || latitudConvertida < -90 || latitudConvertida > 90)) {
      erroresNumericos.push('La latitud debe ser un número entre -90 y 90');
    }

    if (longitudConvertida !== null && (Number.isNaN(longitudConvertida) || longitudConvertida < -180 || longitudConvertida > 180)) {
      erroresNumericos.push('La longitud debe ser un número entre -180 y 180');
    }

    if (erroresNumericos.length > 0) {
      return res.status(400).json({
        mensaje: 'Existen datos numéricos inválidos',
        errores: erroresNumericos
      });
    }

    const empresaId = req.usuario.empresa_id;

    const edificioExistente = await buscarEdificioPorCodigo(empresaId, codigoNormalizado);

    if (edificioExistente) {
      return res.status(409).json({
        mensaje: 'Ya existe un inmueble con ese código en tu empresa'
      });
    }

    const edificioCreado = await registrarEdificio({
      empresa_id: empresaId,
      codigo: codigoNormalizado,
      nombre: nombreLimpio,
      descripcion: limpiarTexto(descripcion) || null,
      direccion_linea1: direccionLimpia,
      direccion_linea2: limpiarTexto(direccion_linea2) || null,
      numero: numeroLimpio,
      distrito: limpiarTexto(distrito) || null,
      ciudad: limpiarTexto(ciudad) || null,
      provincia: limpiarTexto(provincia) || null,
      departamento: limpiarTexto(departamento) || null,
      codigo_postal: codigoPostalLimpio,
      pais: limpiarTexto(pais) || 'Perú',
      area_m2: areaConvertida,
      latitud: latitudConvertida,
      longitud: longitudConvertida
    });

    return res.status(201).json({
      mensaje: 'Edificio registrado correctamente',
      edificio: edificioCreado
    });

  } catch (error) {
    console.error('Error al registrar edificio:', error);

    return res.status(500).json({
      mensaje: 'Error interno al registrar edificio',
      error: error.message
    });
  }
};

const obtenerEdificios = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa_id;
    const edificios = await listarEdificios(empresaId);

    return res.json({
      mensaje: 'Edificios obtenidos correctamente',
      total: edificios.length,
      edificios
    });

  } catch (error) {
    console.error('Error al listar edificios:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar edificios',
      error: error.message
    });
  }
};

const validarNumero = (valor, nombreCampo, opciones = {}) => {
  const { obligatorio = false, minimo = 0, maximo, entero = false } = opciones;

  if (valor === undefined || valor === null || valor === '') {
    if (obligatorio) {
      return `${nombreCampo} es obligatorio`;
    }

    return null;
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return `${nombreCampo} debe ser un número válido`;
  }

  if (numero < minimo) {
    return `${nombreCampo} no puede ser menor que ${minimo}`;
  }

  if (maximo !== undefined && numero > maximo) {
    return `${nombreCampo} no puede ser mayor que ${maximo}`;
  }

  if (entero && !Number.isInteger(numero)) {
    return `${nombreCampo} debe ser un número entero`;
  }

  return null;
};

const crearPisoLocal = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa_id;
    const usuarioId = req.usuario.usuario_id;
    const {
      edificio_id,
      codigo,
      tipo_inmueble,
      nombre,
      subtipo_unidad,
      descripcion,
      planta,
      letra,
      area_m2,
      num_habitaciones,
      num_banos,
      capacidad_personas,
      renta_base_mensual,
      moneda
    } = req.body;

    if (!edificio_id || !codigo || !tipo_inmueble || !nombre || !planta || !letra) {
      return res.status(400).json({
        mensaje: 'Edificio, código, tipo, nombre, planta y letra son obligatorios'
      });
    }

    const edificioIdNumero = Number(edificio_id);

    if (Number.isNaN(edificioIdNumero) || edificioIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El edificio seleccionado no es válido'
      });
    }

    const tipoNormalizado = tipo_inmueble.trim().toUpperCase();

    if (tipoNormalizado !== 'PISO' && tipoNormalizado !== 'LOCAL') {
      return res.status(400).json({
        mensaje: 'El tipo de inmueble solo puede ser PISO o LOCAL'
      });
    }

    if (codigo.length > 30) {
      return res.status(400).json({
        mensaje: 'El código no debe superar los 30 caracteres'
      });
    }

    const erroresNumericos = [
      validarNumero(area_m2, 'El área en m²', { minimo: 0.01 }),
      validarNumero(num_habitaciones, 'El número de habitaciones', { minimo: 0, maximo: 100, entero: true }),
      validarNumero(num_banos, 'El número de baños', { minimo: 0, maximo: 100, entero: true }),
      validarNumero(capacidad_personas, 'La capacidad de personas', { minimo: 0, maximo: 1000, entero: true }),
      validarNumero(renta_base_mensual, 'La renta base mensual', { minimo: 0 })
    ].filter(Boolean);

    if (erroresNumericos.length > 0) {
      return res.status(400).json({
        mensaje: 'Existen datos numéricos inválidos',
        errores: erroresNumericos
      });
    }

    const codigoNormalizado = codigo.trim().toUpperCase();

    const unidadExistente = await buscarEdificioPorCodigo(empresaId, codigoNormalizado);

    if (unidadExistente) {
      return res.status(409).json({
        mensaje: 'Ya existe un inmueble con ese código en tu empresa'
      });
    }

    //empresa_id se obteniene desde el token JWT.
    
    const edificioPadre = await buscarEdificioPadrePorId(empresaId, edificioIdNumero);

    if (!edificioPadre) {
      return res.status(404).json({
        mensaje: 'El edificio seleccionado no existe o no está activo'
      });
    }

    const plantaNormalizada = planta.trim();
    const letraNormalizada = letra.trim().toUpperCase();

    const unidadMismaUbicacion = await buscarUnidadPorUbicacion(
      empresaId,
      edificioIdNumero,
      plantaNormalizada,
      letraNormalizada
    );

    if (unidadMismaUbicacion) {
      return res.status(409).json({
        mensaje: 'Ya existe un piso/local registrado en esa planta y letra para este edificio',
        unidad_existente: {
          inmueble_id: unidadMismaUbicacion.inmueble_id,
          codigo: unidadMismaUbicacion.codigo,
          tipo_inmueble: unidadMismaUbicacion.tipo_inmueble,
          nombre: unidadMismaUbicacion.nombre,
          planta: unidadMismaUbicacion.planta,
          letra: unidadMismaUbicacion.letra
        }
      });
    }

    const unidadCreada = await registrarPisoLocal({
      empresa_id: empresaId,
      edificio_id: edificioIdNumero,
      codigo: codigoNormalizado,
      tipo_inmueble: tipoNormalizado,
      nombre: nombre.trim(),
      subtipo_unidad: subtipo_unidad ? subtipo_unidad.trim().toUpperCase() : null,
      descripcion,
      planta: plantaNormalizada,
      letra: letraNormalizada,
      area_m2: area_m2 !== undefined && area_m2 !== null && area_m2 !== '' ? Number(area_m2) : null,
      num_habitaciones: num_habitaciones !== undefined && num_habitaciones !== null && num_habitaciones !== '' ? Number(num_habitaciones) : null,
      num_banos: num_banos !== undefined && num_banos !== null && num_banos !== '' ? Number(num_banos) : null,
      capacidad_personas: capacidad_personas !== undefined && capacidad_personas !== null && capacidad_personas !== '' ? Number(capacidad_personas) : null,
      renta_base_mensual: renta_base_mensual !== undefined && renta_base_mensual !== null && renta_base_mensual !== '' ? Number(renta_base_mensual) : null,
      moneda: moneda ? moneda.trim().toUpperCase() : 'PEN'
    });

    return res.status(201).json({
      mensaje: `${tipoNormalizado} registrado correctamente`,
      edificio_padre: {
        inmueble_id: edificioPadre.inmueble_id,
        codigo: edificioPadre.codigo,
        nombre: edificioPadre.nombre
      },
      unidad: unidadCreada
    });

  } catch (error) {
    console.error('Error al registrar piso/local:', error);

    return res.status(500).json({
      mensaje: 'Error interno al registrar piso/local',
      error: error.message
    });
  }
};

const obtenerUnidadesPorEdificio = async (req, res) => {
  try {
    const { edificio_id } = req.params;

    const edificioIdNumero = Number(edificio_id);

    if (Number.isNaN(edificioIdNumero) || edificioIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del edificio no es válido'
      });
    }

    const empresaId = req.usuario.empresa_id;

    const edificioPadre = await buscarEdificioPadrePorId(empresaId, edificioIdNumero);

    if (!edificioPadre) {
      return res.status(404).json({
        mensaje: 'El edificio no existe o no está activo'
      });
    }

    const unidades = await listarPisosLocalesPorEdificio(empresaId, edificioIdNumero);

    return res.json({
      mensaje: 'Pisos/locales obtenidos correctamente',
      edificio: {
        inmueble_id: edificioPadre.inmueble_id,
        codigo: edificioPadre.codigo,
        nombre: edificioPadre.nombre
      },
      total: unidades.length,
      unidades
    });

  } catch (error) {
    console.error('Error al listar pisos/locales:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar pisos/locales',
      error: error.message
    });
  }
};

const obtenerUnidadPorId = async (req, res) => {
  try {
    const { unidad_id } = req.params;

    const unidadIdNumero = Number(unidad_id);

    if (Number.isNaN(unidadIdNumero) || unidadIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del piso/local no es válido'
      });
    }

    const empresaId = req.usuario.empresa_id;

    const unidad = await buscarUnidadPorId(empresaId, unidadIdNumero);

    if (!unidad) {
      return res.status(404).json({
        mensaje: 'El piso/local no existe o no pertenece a la empresa'
      });
    }

    return res.json({
      mensaje: 'Piso/local obtenido correctamente',
      unidad
    });

  } catch (error) {
    console.error('Error al obtener piso/local:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener piso/local',
      error: error.message
    });
  }
};

const obtenerInmueblesMantenimiento = async (req, res) => {
  try {
    /*
      Por ahora usamos empresa_id = 1.
      Luego se podrá obtener desde el token JWT.
    */
    const empresaId = req.usuario.empresa_id;

    const inmuebles = await listarInmueblesMantenimiento(empresaId);

    return res.json({
      mensaje: 'Inmuebles obtenidos correctamente para mantenimiento',
      total: inmuebles.length,
      inmuebles
    });

  } catch (error) {
    console.error('Error al listar inmuebles para mantenimiento:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar inmuebles para mantenimiento',
      error: error.message
    });
  }
};

const obtenerInmuebleMantenimientoPorId = async (req, res) => {
  try {
    const { inmueble_id } = req.params;

    const inmuebleIdNumero = Number(inmueble_id);

    if (Number.isNaN(inmuebleIdNumero) || inmuebleIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del inmueble no es válido'
      });
    }

    /*
      Por ahora usamos empresa_id = 1.
      Luego se podrá obtener desde el token JWT.
    */
    const empresaId = req.usuario.empresa_id;

    const inmueble = await buscarInmuebleMantenimientoPorId(empresaId, inmuebleIdNumero);

    if (!inmueble) {
      return res.status(404).json({
        mensaje: 'El inmueble no existe o no pertenece a la empresa'
      });
    }

    return res.json({
      mensaje: 'Inmueble obtenido correctamente',
      inmueble
    });

  } catch (error) {
    console.error('Error al obtener inmueble para mantenimiento:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener inmueble para mantenimiento',
      error: error.message
    });
  }
};

const darBajaInmueble = async (req, res) => {
  try {
    const { inmueble_id } = req.params;

    const inmuebleIdNumero = Number(inmueble_id);

    if (Number.isNaN(inmuebleIdNumero) || inmuebleIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del inmueble no es válido'
      });
    }

    /*
      Por ahora usamos empresa_id = 1.
      Luego se podrá obtener desde el token JWT.
    */
    const empresaId = req.usuario.empresa_id;

    const inmueble = await buscarInmuebleMantenimientoPorId(empresaId, inmuebleIdNumero);

    if (!inmueble) {
      return res.status(404).json({
        mensaje: 'El inmueble no existe o ya fue dado de baja'
      });
    }

    if (inmueble.activo === false || inmueble.activo === 0) {
      return res.status(400).json({
        mensaje: 'El inmueble ya se encuentra inactivo'
      });
    }

    /*
      Regla de seguridad:
      Si se intenta dar de baja un EDIFICIO que todavía tiene pisos/locales activos,
      no se permite la baja directa para evitar dejar unidades huérfanas activas.
    */
    if (inmueble.tipo_inmueble === 'EDIFICIO') {
      const totalUnidadesActivas = await contarUnidadesActivasPorEdificio(
        empresaId,
        inmuebleIdNumero
      );

      if (totalUnidadesActivas > 0) {
        return res.status(409).json({
          mensaje: 'No se puede dar de baja el edificio porque tiene pisos/locales activos asociados',
          total_unidades_activas: totalUnidadesActivas
        });
      }
    }

    const inmuebleDadoBaja = await darBajaLogicaInmueble(empresaId, inmuebleIdNumero);

    return res.json({
      mensaje: 'Inmueble dado de baja correctamente',
      inmueble: inmuebleDadoBaja
    });

  } catch (error) {
    console.error('Error al dar de baja inmueble:', error);

    return res.status(500).json({
      mensaje: 'Error interno al dar de baja inmueble',
      error: error.message
    });
  }
};

const actualizarInmueble = async (req, res) => {
  try {
    const { inmueble_id } = req.params;

    const inmuebleIdNumero = Number(inmueble_id);

    if (Number.isNaN(inmuebleIdNumero) || inmuebleIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del inmueble no es válido'
      });
    }

    const empresaId = req.usuario.empresa_id;

    const inmuebleActual = await buscarInmuebleMantenimientoPorId(empresaId, inmuebleIdNumero);

    if (!inmuebleActual) {
      return res.status(404).json({
        mensaje: 'El inmueble no existe o no pertenece a la empresa'
      });
    }

    if (inmuebleActual.activo === false || inmuebleActual.activo === 0) {
      return res.status(400).json({
        mensaje: 'No se puede modificar un inmueble dado de baja'
      });
    }

    const {
      nombre,
      descripcion,
      direccion_linea1,
      direccion_linea2,
      numero,
      distrito,
      ciudad,
      provincia,
      departamento,
      codigo_postal,
      pais,
      subtipo_unidad,
      planta,
      letra,
      area_m2,
      num_habitaciones,
      num_banos,
      capacidad_personas,
      renta_base_mensual,
      moneda,
      latitud,
      longitud,
      estado_operativo,
      es_publicable
    } = req.body;

    const nombreLimpio = limpiarTexto(nombre);

    if (!nombreLimpio) {
      return res.status(400).json({
        mensaje: 'El nombre del inmueble es obligatorio'
      });
    }

    if (nombreLimpio.length > 150) {
      return res.status(400).json({
        mensaje: 'El nombre del inmueble no debe superar los 150 caracteres'
      });
    }

    const estadosPermitidos = [
      'DISPONIBLE',
      'RESERVADO',
      'OCUPADO',
      'MANTENIMIENTO',
      'INACTIVO'
    ];

    const estadoNormalizado = limpiarTexto(estado_operativo || inmuebleActual.estado_operativo).toUpperCase();

    if (!estadosPermitidos.includes(estadoNormalizado)) {
      return res.status(400).json({
        mensaje: 'El estado operativo no es válido'
      });
    }

    const areaConvertida = convertirNumeroOpcional(area_m2);
    const latitudConvertida = convertirNumeroOpcional(latitud);
    const longitudConvertida = convertirNumeroOpcional(longitud);
    const rentaConvertida = convertirNumeroOpcional(renta_base_mensual);
    const habitacionesConvertidas = convertirNumeroOpcional(num_habitaciones);
    const banosConvertidos = convertirNumeroOpcional(num_banos);
    const capacidadConvertida = convertirNumeroOpcional(capacidad_personas);

    const errores = [];

    if (areaConvertida !== null && (Number.isNaN(areaConvertida) || areaConvertida <= 0)) {
      errores.push('El área en m² debe ser mayor a 0');
    }

    if (latitudConvertida !== null && (Number.isNaN(latitudConvertida) || latitudConvertida < -90 || latitudConvertida > 90)) {
      errores.push('La latitud debe estar entre -90 y 90');
    }

    if (longitudConvertida !== null && (Number.isNaN(longitudConvertida) || longitudConvertida < -180 || longitudConvertida > 180)) {
      errores.push('La longitud debe estar entre -180 y 180');
    }

    if (rentaConvertida !== null && (Number.isNaN(rentaConvertida) || rentaConvertida < 0)) {
      errores.push('La renta base mensual no puede ser negativa');
    }

    if (
      habitacionesConvertidas !== null &&
      (
        !Number.isFinite(habitacionesConvertidas) ||
        habitacionesConvertidas < 0 ||
        habitacionesConvertidas > 100 ||
        !Number.isInteger(habitacionesConvertidas)
      )
    ) {
      errores.push('El número de habitaciones debe ser un entero entre 0 y 100');
    }

    if (
      banosConvertidos !== null &&
      (
        !Number.isFinite(banosConvertidos) ||
        banosConvertidos < 0 ||
        banosConvertidos > 100 ||
        !Number.isInteger(banosConvertidos)
      )
    ) {
      errores.push('El número de baños debe ser un entero entre 0 y 100');
    }

    if (
      capacidadConvertida !== null &&
      (
        !Number.isFinite(capacidadConvertida) ||
        capacidadConvertida < 0 ||
        capacidadConvertida > 1000 ||
        !Number.isInteger(capacidadConvertida)
      )
    ) {
      errores.push('La capacidad de personas debe ser un entero entre 0 y 1000');
    }

    if (errores.length > 0) {
      return res.status(400).json({
        mensaje: 'Existen datos inválidos',
        errores
      });
    }

    if (inmuebleActual.tipo_inmueble === 'EDIFICIO') {
      if (!limpiarTexto(direccion_linea1) || !limpiarTexto(numero) || !limpiarTexto(codigo_postal)) {
        return res.status(400).json({
          mensaje: 'Para editar un edificio, dirección principal, número y código postal son obligatorios'
        });
      }
    }

    if (inmuebleActual.tipo_inmueble === 'PISO' || inmuebleActual.tipo_inmueble === 'LOCAL') {
      if (!limpiarTexto(planta) || !limpiarTexto(letra)) {
        return res.status(400).json({
          mensaje: 'Para editar un piso/local, planta y letra son obligatorios'
        });
      }
    }

    const inmuebleActualizado = await actualizarInmuebleMantenimiento({
      empresa_id: empresaId,
      inmueble_id: inmuebleIdNumero,

      nombre: nombreLimpio,
      descripcion: limpiarTexto(descripcion) || null,

      direccion_linea1: limpiarTexto(direccion_linea1),
      direccion_linea2: limpiarTexto(direccion_linea2) || null,
      numero: limpiarTexto(numero),
      distrito: limpiarTexto(distrito) || null,
      ciudad: limpiarTexto(ciudad) || null,
      provincia: limpiarTexto(provincia) || null,
      departamento: limpiarTexto(departamento) || null,
      codigo_postal: limpiarTexto(codigo_postal),
      pais: limpiarTexto(pais) || 'Perú',

      subtipo_unidad: limpiarTexto(subtipo_unidad) || null,
      planta: limpiarTexto(planta) || null,
      letra: limpiarTexto(letra).toUpperCase() || null,

      area_m2: areaConvertida,
      num_habitaciones: habitacionesConvertidas,
      num_banos: banosConvertidos,
      capacidad_personas: capacidadConvertida,
      renta_base_mensual: rentaConvertida,
      moneda: limpiarTexto(moneda).toUpperCase() || 'PEN',

      latitud: latitudConvertida,
      longitud: longitudConvertida,
      estado_operativo: estadoNormalizado,
      es_publicable: es_publicable === undefined ? inmuebleActual.es_publicable : Boolean(es_publicable)
    });

    return res.json({
      mensaje: 'Inmueble actualizado correctamente',
      inmueble: inmuebleActualizado
    });

  } catch (error) {
    console.error('Error al actualizar inmueble:', error);

    return res.status(500).json({
      mensaje: 'Error interno al actualizar inmueble',
      error: error.message
    });
  }
};

const obtenerCatalogoCaracteristicas = async (req, res) => {
  try {
    const caracteristicas = await listarCatalogoCaracteristicas();

    return res.json({
      mensaje: 'Catálogo de características obtenido correctamente',
      total: caracteristicas.length,
      caracteristicas
    });

  } catch (error) {
    console.error('Error al obtener catálogo de características:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener catálogo de características',
      error: error.message
    });
  }
};

const obtenerCaracteristicasDeInmueble = async (req, res) => {
  try {
    const { inmueble_id } = req.params;

    const inmuebleIdNumero = Number(inmueble_id);

    if (Number.isNaN(inmuebleIdNumero) || inmuebleIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del inmueble no es válido'
      });
    }

    const empresaId = req.usuario.empresa_id;

    const inmueble = await buscarInmuebleMantenimientoPorId(empresaId, inmuebleIdNumero);

    if (!inmueble) {
      return res.status(404).json({
        mensaje: 'El inmueble no existe o no pertenece a la empresa'
      });
    }

    const caracteristicas = await listarCaracteristicasPorInmueble(
      empresaId,
      inmuebleIdNumero
    );

    return res.json({
      mensaje: 'Características del inmueble obtenidas correctamente',
      inmueble: {
        inmueble_id: inmueble.inmueble_id,
        codigo: inmueble.codigo,
        nombre: inmueble.nombre,
        tipo_inmueble: inmueble.tipo_inmueble
      },
      total: caracteristicas.length,
      caracteristicas
    });

  } catch (error) {
    console.error('Error al obtener características del inmueble:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener características del inmueble',
      error: error.message
    });
  }
};

const actualizarCaracteristicasDeInmueble = async (req, res) => {
  try {
    const { inmueble_id } = req.params;
    const { caracteristicas } = req.body;

    const inmuebleIdNumero = Number(inmueble_id);

    if (Number.isNaN(inmuebleIdNumero) || inmuebleIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del inmueble no es válido'
      });
    }

    if (!Array.isArray(caracteristicas)) {
      return res.status(400).json({
        mensaje: 'Debe enviar un arreglo de características'
      });
    }

    const empresaId = req.usuario.empresa_id;

    const inmueble = await buscarInmuebleMantenimientoPorId(empresaId, inmuebleIdNumero);

    if (!inmueble) {
      return res.status(404).json({
        mensaje: 'El inmueble no existe o no pertenece a la empresa'
      });
    }

    if (inmueble.activo === false || inmueble.activo === 0) {
      return res.status(400).json({
        mensaje: 'No se pueden editar características de un inmueble dado de baja'
      });
    }

    const catalogo = await listarCatalogoCaracteristicas();
    const mapaCatalogo = new Map();

    catalogo.forEach((item) => {
      mapaCatalogo.set(item.caracteristica_id, item);
    });

    const idsRepetidos = new Set();
    const idsUsados = new Set();
    const caracteristicasNormalizadas = [];
    const errores = [];

    for (const item of caracteristicas) {
      const caracteristicaId = Number(item.caracteristica_id);

      if (Number.isNaN(caracteristicaId) || caracteristicaId <= 0) {
        errores.push('Existe una característica con ID inválido');
        continue;
      }

      if (idsUsados.has(caracteristicaId)) {
        idsRepetidos.add(caracteristicaId);
        continue;
      }

      idsUsados.add(caracteristicaId);

      const caracteristicaCatalogo = mapaCatalogo.get(caracteristicaId);

      if (!caracteristicaCatalogo) {
        errores.push(`La característica con ID ${caracteristicaId} no existe o no está activa`);
        continue;
      }

      let valorTexto = null;
      let valorNumero = null;
      let valorBoolean = null;

      if (caracteristicaCatalogo.tipo_dato === 'BOOLEAN') {
        valorBoolean = Boolean(item.valor_boolean);
      }

      if (caracteristicaCatalogo.tipo_dato === 'TEXTO') {
        valorTexto = limpiarTexto(item.valor_texto);

        if (!valorTexto) {
          errores.push(`La característica ${caracteristicaCatalogo.nombre} requiere un valor de texto`);
        }

        if (valorTexto.length > 200) {
          errores.push(`La característica ${caracteristicaCatalogo.nombre} no debe superar los 200 caracteres`);
        }
      }

      if (caracteristicaCatalogo.tipo_dato === 'NUMERO') {
        valorNumero = convertirNumeroOpcional(item.valor_numero);

        if (valorNumero === null || Number.isNaN(valorNumero)) {
          errores.push(`La característica ${caracteristicaCatalogo.nombre} requiere un valor numérico`);
        } else if (valorNumero < 0) {
          errores.push(`La característica ${caracteristicaCatalogo.nombre} no puede ser negativa`);
        }
      }

      caracteristicasNormalizadas.push({
        caracteristica_id: caracteristicaId,
        valor_texto: valorTexto,
        valor_numero: valorNumero,
        valor_boolean: valorBoolean
      });
    }

    if (idsRepetidos.size > 0) {
      errores.push('No se puede enviar la misma característica más de una vez');
    }

    if (errores.length > 0) {
      return res.status(400).json({
        mensaje: 'Existen errores en las características enviadas',
        errores
      });
    }

    const caracteristicasActualizadas = await actualizarCaracteristicasInmueble(
      empresaId,
      inmuebleIdNumero,
      caracteristicasNormalizadas
    );

    return res.json({
      mensaje: 'Características del inmueble actualizadas correctamente',
      inmueble: {
        inmueble_id: inmueble.inmueble_id,
        codigo: inmueble.codigo,
        nombre: inmueble.nombre,
        tipo_inmueble: inmueble.tipo_inmueble
      },
      total: caracteristicasActualizadas.length,
      caracteristicas: caracteristicasActualizadas
    });

  } catch (error) {
    console.error('Error al actualizar características del inmueble:', error);

    return res.status(500).json({
      mensaje: 'Error interno al actualizar características del inmueble',
      error: error.message
    });
  }
};

module.exports = {
  crearEdificio,
  obtenerEdificios,
  crearPisoLocal,
  obtenerUnidadesPorEdificio,
  obtenerUnidadPorId,

  // HU05 - Mantenimiento de Datos
  obtenerInmueblesMantenimiento,
  obtenerInmuebleMantenimientoPorId,
  darBajaInmueble,
  actualizarInmueble,
  obtenerCatalogoCaracteristicas,
  obtenerCaracteristicasDeInmueble,
  actualizarCaracteristicasDeInmueble
};
