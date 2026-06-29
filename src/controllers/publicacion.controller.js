const {
  listarPublicaciones,
  obtenerPublicacionPorId,
  obtenerFotosPublicacion,
  listarInmueblesPublicablesGestion,
  buscarInmueblePublicablePorEmpresa,
  buscarPublicacionPorInmueble,
  crearPublicacionBorrador,
  obtenerPublicacionGestionPorId,
  registrarFotoPublicacion,
  contarFotosPublicacion,
  publicarPublicacionPorId,
  eliminarBorradorPublicacionPorId,
  eliminarPublicacionPorId
} = require('../models/publicacion.model');

const {
  subirImagenACloudinary,
  eliminarImagenCloudinary
} = require('../services/cloudinary.service');

const {
  isPastDateOnly,
  isDateNotAbsurd
} = require('../utils/dateHelpers');

const limpiarTexto = (valor) => {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
};

const validarFecha = (fecha) => {
  if (!fecha) return true;

  const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;

  if (!formatoFecha.test(fecha)) {
    return false;
  }

  const fechaDate = new Date(`${fecha}T00:00:00`);

  return !Number.isNaN(fechaDate.getTime());
};

const convertirBooleano = (valor, valorPorDefecto = false) => {
  if (valor === undefined || valor === null) {
    return valorPorDefecto;
  }

  if (valor === true || valor === 'true' || valor === '1' || valor === 1) {
    return true;
  }

  if (valor === false || valor === 'false' || valor === '0' || valor === 0) {
    return false;
  }

  return valorPorDefecto;
};

const obtenerPublicIdFoto = (foto) => {
  if (!foto) return null;

  return (
    foto.public_id_cloudinary ||
    foto.public_id ||
    foto.nombre_archivo ||
    null
  );
};

const eliminarArchivoFotoCloudinary = async (foto) => {
  try {
    const publicId = obtenerPublicIdFoto(foto);

    if (!publicId) return;

    await eliminarImagenCloudinary(publicId);

  } catch (error) {
    console.error('No se pudo eliminar la imagen de Cloudinary:', error.message);
  }
};

const listarPublicacionesPublicas = async (req, res) => {
  try {
    const {
      ubicacion,
      tipo_inmueble,
      fecha_inicio,
      fecha_fin,
      precio_min,
      precio_max,
      capacidad_personas
    } = req.query;

    const tipoNormalizado = limpiarTexto(tipo_inmueble).toUpperCase();

    if (
      tipoNormalizado &&
      !['EDIFICIO', 'PISO', 'LOCAL'].includes(tipoNormalizado)
    ) {
      return res.status(400).json({
        mensaje: 'El tipo de inmueble no es válido'
      });
    }

    if (!validarFecha(fecha_inicio) || !validarFecha(fecha_fin)) {
      return res.status(400).json({
        mensaje: 'Las fechas deben tener formato YYYY-MM-DD'
      });
    }

    if ((fecha_inicio && !fecha_fin) || (!fecha_inicio && fecha_fin)) {
      return res.status(400).json({
        mensaje: 'Para filtrar por disponibilidad debe enviar fecha_inicio y fecha_fin'
      });
    }

    if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) {
      return res.status(400).json({
        mensaje: 'La fecha de fin no puede ser menor que la fecha de inicio'
      });
    }

    if (
      precio_min !== undefined &&
      precio_min !== '' &&
      (Number.isNaN(Number(precio_min)) || Number(precio_min) < 0)
    ) {
      return res.status(400).json({
        mensaje: 'El precio mínimo no es válido'
      });
    }

    if (
      precio_max !== undefined &&
      precio_max !== '' &&
      (Number.isNaN(Number(precio_max)) || Number(precio_max) < 0)
    ) {
      return res.status(400).json({
        mensaje: 'El precio máximo no es válido'
      });
    }

    if (
      precio_min !== undefined &&
      precio_min !== '' &&
      precio_max !== undefined &&
      precio_max !== '' &&
      Number(precio_max) < Number(precio_min)
    ) {
      return res.status(400).json({
        mensaje: 'El precio máximo no puede ser menor que el precio mínimo'
      });
    }

    if (
      capacidad_personas !== undefined &&
      capacidad_personas !== '' &&
      (
        Number.isNaN(Number(capacidad_personas)) ||
        Number(capacidad_personas) < 0
      )
    ) {
      return res.status(400).json({
        mensaje: 'La capacidad de personas no es válida'
      });
    }

    const publicaciones = await listarPublicaciones({
      ubicacion: limpiarTexto(ubicacion) || null,
      tipo_inmueble: tipoNormalizado || null,
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      precio_min,
      precio_max,
      capacidad_personas
    });

    return res.json({
      mensaje: 'Publicaciones obtenidas correctamente',
      total: publicaciones.length,
      publicaciones
    });

  } catch (error) {
    console.error('Error al listar publicaciones:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar publicaciones',
      error: error.message
    });
  }
};

const obtenerDetallePublicacion = async (req, res) => {
  try {
    const { publicacion_id } = req.params;

    const publicacionIdNumero = Number(publicacion_id);

    if (Number.isNaN(publicacionIdNumero) || publicacionIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la publicación no es válido'
      });
    }

    const publicacion = await obtenerPublicacionPorId(publicacionIdNumero);

    if (!publicacion) {
      return res.status(404).json({
        mensaje: 'La publicación no existe o no se encuentra disponible'
      });
    }

    const fotos = await obtenerFotosPublicacion(publicacionIdNumero);

    return res.json({
      mensaje: 'Detalle de publicación obtenido correctamente',
      publicacion,
      fotos
    });

  } catch (error) {
    console.error('Error al obtener detalle de publicación:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener detalle de publicación',
      error: error.message
    });
  }
};

const subirFotoPublicacion = async (req, res) => {
  let imagenCloudinary = null;

  try {
    const empresaId = req.usuario.empresa_id;
    const { publicacion_id } = req.params;

    const publicacionIdNumero = Number(publicacion_id);

    if (Number.isNaN(publicacionIdNumero) || publicacionIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la publicación no es válido'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        mensaje: 'Debe enviar una imagen en el campo foto'
      });
    }

    const publicacion = await obtenerPublicacionGestionPorId(
      empresaId,
      publicacionIdNumero
    );

    if (!publicacion) {
      return res.status(404).json({
        mensaje: 'La publicación no existe o no pertenece a tu empresa'
      });
    }

    const ordenVisual = req.body.orden_visual
      ? Number(req.body.orden_visual)
      : 1;

    if (Number.isNaN(ordenVisual) || ordenVisual <= 0) {
      return res.status(400).json({
        mensaje: 'El orden visual debe ser mayor a 0'
      });
    }

    const esPrincipal =
      req.body.es_principal === true ||
      req.body.es_principal === 'true' ||
      req.body.es_principal === '1';

    imagenCloudinary = await subirImagenACloudinary(
      req.file,
      `sigairbnb/empresa_${empresaId}/publicaciones`
    );

    const fotoRegistrada = await registrarFotoPublicacion({
      publicacion_id: publicacionIdNumero,

      // Ahora se guarda la URL pública de Cloudinary.
      url_foto: imagenCloudinary.url,

      // Se guarda también en nombre_archivo para compatibilidad con el model actual.
      // Ya no será un nombre de archivo local, sino el public_id de Cloudinary.
      nombre_archivo: imagenCloudinary.public_id,

      // Si actualizas el model, esta columna nueva también se puede registrar.
      public_id_cloudinary: imagenCloudinary.public_id,

      orden_visual: ordenVisual,
      es_principal: esPrincipal
    });

    return res.status(201).json({
      mensaje: 'Foto de publicación registrada correctamente',
      publicacion: {
        publicacion_id: publicacion.publicacion_id,
        inmueble_id: publicacion.inmueble_id,
        titulo: publicacion.titulo,
        codigo_inmueble: publicacion.codigo_inmueble,
        nombre_inmueble: publicacion.nombre_inmueble,
        tipo_inmueble: publicacion.tipo_inmueble
      },
      foto: fotoRegistrada
    });

  } catch (error) {
    console.error('Error al subir foto de publicación:', error);

    if (imagenCloudinary?.public_id) {
      try {
        await eliminarImagenCloudinary(imagenCloudinary.public_id);
      } catch (deleteError) {
        console.error(
          'No se pudo eliminar la imagen de Cloudinary luego del error:',
          deleteError.message
        );
      }
    }

    return res.status(500).json({
      mensaje: 'Error interno al subir foto de publicación',
      error: error.message
    });
  }
};

const obtenerInmueblesPublicablesGestion = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa_id;

    const inmuebles = await listarInmueblesPublicablesGestion(empresaId);

    return res.json({
      mensaje: 'Inmuebles publicables obtenidos correctamente',
      total: inmuebles.length,
      inmuebles
    });

  } catch (error) {
    console.error('Error al obtener inmuebles publicables:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener inmuebles publicables',
      error: error.message
    });
  }
};

const crearPublicacionGestion = async (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;
    const empresaId = req.usuario.empresa_id;
    const {
      inmueble_id,
      titulo,
      descripcion_corta,
      descripcion_larga,
      precio_publicado_mensual,
      moneda,
      condiciones_arrendamiento,
      disponible_desde,
      acepta_reservas,
      es_destacado
    } = req.body;

    const inmuebleIdNumero = Number(inmueble_id);

    if (Number.isNaN(inmuebleIdNumero) || inmuebleIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'Debe seleccionar un inmueble válido'
      });
    }

    const tituloLimpio = limpiarTexto(titulo);

    if (!tituloLimpio) {
      return res.status(400).json({
        mensaje: 'El título de la publicación es obligatorio'
      });
    }

    if (tituloLimpio.length > 200) {
      return res.status(400).json({
        mensaje: 'El título no puede superar los 200 caracteres'
      });
    }

    const descripcionCortaLimpia = limpiarTexto(descripcion_corta);

    if (descripcionCortaLimpia.length > 500) {
      return res.status(400).json({
        mensaje: 'La descripción corta no puede superar los 500 caracteres'
      });
    }

    const precioNumero = Number(precio_publicado_mensual);

    if (Number.isNaN(precioNumero) || precioNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El precio publicado mensual debe ser mayor a 0'
      });
    }

    const monedaNormalizada = limpiarTexto(moneda || 'PEN').toUpperCase();

    if (!['PEN', 'USD'].includes(monedaNormalizada)) {
      return res.status(400).json({
        mensaje: 'La moneda debe ser PEN o USD'
      });
    }

    if (disponible_desde && !validarFecha(disponible_desde)) {
      return res.status(400).json({
        mensaje: 'La fecha disponible_desde debe tener formato YYYY-MM-DD'
      });
    }

    if (disponible_desde && !isDateNotAbsurd(disponible_desde, { minYear: 2000, maxFutureYears: 3 })) {
      return res.status(400).json({
        mensaje: 'La fecha de disponibilidad está fuera del rango permitido para el sistema'
      });
    }

    if (disponible_desde && isPastDateOnly(disponible_desde)) {
      return res.status(400).json({
        mensaje: 'La fecha de disponibilidad no puede ser una fecha pasada'
      });
    }

    const inmueble = await buscarInmueblePublicablePorEmpresa(
      empresaId,
      inmuebleIdNumero
    );

    if (!inmueble) {
      return res.status(404).json({
        mensaje: 'El inmueble no existe, no pertenece a tu empresa o no es publicable'
      });
    }

    const publicacionExistente = await buscarPublicacionPorInmueble(
      inmuebleIdNumero
    );

    if (publicacionExistente) {
      return res.status(409).json({
        mensaje: 'Este inmueble ya tiene una publicación registrada',
        publicacion: publicacionExistente
      });
    }

    const publicacionCreada = await crearPublicacionBorrador({
      inmueble_id: inmuebleIdNumero,
      publicado_por_usuario_id: usuarioId,
      titulo: tituloLimpio,
      descripcion_corta: descripcionCortaLimpia || null,
      descripcion_larga: limpiarTexto(descripcion_larga) || null,
      precio_publicado_mensual: precioNumero,
      moneda: monedaNormalizada,
      condiciones_arrendamiento: limpiarTexto(condiciones_arrendamiento) || null,
      disponible_desde: disponible_desde || null,
      acepta_reservas: convertirBooleano(acepta_reservas, true),
      es_destacado: convertirBooleano(es_destacado, false)
    });

    return res.status(201).json({
      mensaje: 'Publicación creada correctamente en estado BORRADOR',
      inmueble: {
        inmueble_id: inmueble.inmueble_id,
        codigo: inmueble.codigo,
        nombre: inmueble.nombre,
        tipo_inmueble: inmueble.tipo_inmueble
      },
      publicacion: publicacionCreada
    });

  } catch (error) {
    console.error('Error al crear publicación:', error);

    return res.status(500).json({
      mensaje: 'Error interno al crear publicación',
      error: error.message
    });
  }
};

const publicarPublicacionGestion = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa_id;
    const { publicacion_id } = req.params;

    const publicacionIdNumero = Number(publicacion_id);

    if (Number.isNaN(publicacionIdNumero) || publicacionIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la publicación no es válido'
      });
    }

    const publicacion = await obtenerPublicacionGestionPorId(
      empresaId,
      publicacionIdNumero
    );

    if (!publicacion) {
      return res.status(404).json({
        mensaje: 'La publicación no existe o no pertenece a tu empresa'
      });
    }

    if (publicacion.estado_publicacion === 'PUBLICADO') {
      return res.json({
        mensaje: 'La publicación ya se encuentra publicada',
        publicacion
      });
    }

    if (publicacion.estado_publicacion === 'RETIRADO') {
      return res.status(400).json({
        mensaje: 'No se puede publicar una publicación retirada'
      });
    }

    const totalFotos = await contarFotosPublicacion(publicacionIdNumero);

    if (totalFotos <= 0) {
      return res.status(400).json({
        mensaje: 'Debe registrar al menos una foto antes de publicar el inmueble'
      });
    }

    const publicacionPublicada = await publicarPublicacionPorId(
      empresaId,
      publicacionIdNumero
    );

    return res.json({
      mensaje: 'Publicación publicada correctamente',
      publicacion: publicacionPublicada
    });

  } catch (error) {
    console.error('Error al publicar publicación:', error);

    return res.status(500).json({
      mensaje: 'Error interno al publicar publicación',
      error: error.message
    });
  }
};

const eliminarBorradorPublicacionGestion = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa_id;
    const { publicacion_id } = req.params;

    const publicacionIdNumero = Number(publicacion_id);

    if (Number.isNaN(publicacionIdNumero) || publicacionIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la publicación no es válido'
      });
    }

    const publicacion = await obtenerPublicacionGestionPorId(
      empresaId,
      publicacionIdNumero
    );

    if (!publicacion) {
      return res.status(404).json({
        mensaje: 'La publicación no existe o no pertenece a tu empresa'
      });
    }

    if (publicacion.estado_publicacion !== 'BORRADOR') {
      return res.status(400).json({
        mensaje: 'Solo se pueden eliminar publicaciones en estado BORRADOR'
      });
    }

    const resultado = await eliminarBorradorPublicacionPorId(
      empresaId,
      publicacionIdNumero
    );

    if (!resultado.publicacion_eliminada) {
      return res.status(404).json({
        mensaje: 'No se encontró un borrador válido para eliminar'
      });
    }

    await Promise.all(
      resultado.fotos_eliminadas.map((foto) =>
        eliminarArchivoFotoCloudinary(foto)
      )
    );

    return res.json({
      mensaje: 'Borrador de publicación eliminado correctamente',
      publicacion: resultado.publicacion_eliminada,
      total_fotos_eliminadas: resultado.fotos_eliminadas.length
    });

  } catch (error) {
    console.error('Error al eliminar borrador:', error);

    return res.status(500).json({
      mensaje: 'Error interno al eliminar borrador',
      error: error.message
    });
  }
};

const eliminarPublicacionGestion = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa_id;
    const { publicacion_id } = req.params;

    const publicacionIdNumero = Number(publicacion_id);

    if (Number.isNaN(publicacionIdNumero) || publicacionIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la publicación no es válido'
      });
    }

    const publicacion = await obtenerPublicacionGestionPorId(
      empresaId,
      publicacionIdNumero
    );

    if (!publicacion) {
      return res.status(404).json({
        mensaje: 'La publicación no existe o no pertenece a tu empresa'
      });
    }

    const resultado = await eliminarPublicacionPorId(
      empresaId,
      publicacionIdNumero
    );

    if (!resultado.publicacion_eliminada) {
      return res.status(404).json({
        mensaje: 'No se encontró una publicación válida para eliminar'
      });
    }

    await Promise.all(
      resultado.fotos_eliminadas.map((foto) =>
        eliminarArchivoFotoCloudinary(foto)
      )
    );

    return res.json({
      mensaje: 'Publicación eliminada correctamente',
      publicacion: resultado.publicacion_eliminada,
      total_fotos_eliminadas: resultado.fotos_eliminadas.length
    });

  } catch (error) {
    console.error('Error al eliminar publicación:', error);

    return res.status(500).json({
      mensaje: 'Error interno al eliminar publicación',
      error: error.message
    });
  }
};

module.exports = {
  listarPublicacionesPublicas,
  obtenerDetallePublicacion,
  obtenerInmueblesPublicablesGestion,
  crearPublicacionGestion,
  subirFotoPublicacion,
  publicarPublicacionGestion,
  eliminarBorradorPublicacionGestion,
  eliminarPublicacionGestion
};
