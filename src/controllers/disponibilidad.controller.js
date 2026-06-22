const {
  buscarInmueblePorEmpresa,
  listarBloqueosPorInmueble,
  buscarBloqueosSolapados,
  registrarBloqueoDisponibilidad,
  buscarBloqueoPorId,
  cancelarBloqueoDisponibilidad,
  listarBloqueosPorRango,
  listarReservasPorRango,
  buscarBloqueosSolapadosExcepto,
  actualizarBloqueoDisponibilidad,
  listarInmueblesParaDisponibilidad
} = require('../models/disponibilidad.model');

const obtenerBloqueosPorInmueble = async (req, res) => {
  try {
    const { inmueble_id } = req.params;

    const inmuebleIdNumero = Number(inmueble_id);

    if (Number.isNaN(inmuebleIdNumero) || inmuebleIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del inmueble no es válido'
      });
    }

    const empresaId = req.usuario.empresa_id;

    const inmueble = await buscarInmueblePorEmpresa(
      empresaId,
      inmuebleIdNumero
    );

    if (!inmueble) {
      return res.status(404).json({
        mensaje: 'El inmueble no existe, no está activo o no pertenece a tu empresa'
      });
    }

    const bloqueos = await listarBloqueosPorInmueble(
      empresaId,
      inmuebleIdNumero
    );

    return res.json({
      mensaje: 'Bloqueos de disponibilidad obtenidos correctamente',
      inmueble: {
        inmueble_id: inmueble.inmueble_id,
        codigo: inmueble.codigo,
        nombre: inmueble.nombre,
        tipo_inmueble: inmueble.tipo_inmueble,
        estado_operativo: inmueble.estado_operativo
      },
      total: bloqueos.length,
      bloqueos
    });

  } catch (error) {
    console.error('Error al obtener bloqueos de disponibilidad:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener bloqueos de disponibilidad',
      error: error.message
    });
  }
};

const crearBloqueoDisponibilidad = async (req, res) => {
  try {
    const {
      inmueble_id,
      fecha_inicio,
      fecha_fin,
      motivo,
      origen
    } = req.body;

    if (!inmueble_id || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        mensaje: 'Inmueble, fecha de inicio y fecha de fin son obligatorios'
      });
    }

    const inmuebleIdNumero = Number(inmueble_id);

    if (Number.isNaN(inmuebleIdNumero) || inmuebleIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del inmueble no es válido'
      });
    }

    const fechaInicio = new Date(fecha_inicio);
    const fechaFin = new Date(fecha_fin);

    if (Number.isNaN(fechaInicio.getTime()) || Number.isNaN(fechaFin.getTime())) {
      return res.status(400).json({
        mensaje: 'Las fechas enviadas no son válidas'
      });
    }

    if (fechaFin < fechaInicio) {
      return res.status(400).json({
        mensaje: 'La fecha de fin no puede ser menor que la fecha de inicio'
      });
    }

    const origenNormalizado = origen ? String(origen).trim().toUpperCase() : 'MANUAL';

    const origenesPermitidos = ['MANUAL', 'MANTENIMIENTO', 'OTRO'];

    if (!origenesPermitidos.includes(origenNormalizado)) {
      return res.status(400).json({
        mensaje: 'El origen del bloqueo no es válido',
        origenes_permitidos: origenesPermitidos
      });
    }

    const motivoLimpio = motivo ? String(motivo).trim() : null;

    if (motivoLimpio && motivoLimpio.length > 300) {
      return res.status(400).json({
        mensaje: 'El motivo no debe superar los 300 caracteres'
      });
    }

    const empresaId = req.usuario.empresa_id;

    const inmueble = await buscarInmueblePorEmpresa(
      empresaId,
      inmuebleIdNumero
    );

    if (!inmueble) {
      return res.status(404).json({
        mensaje: 'El inmueble no existe, no está activo o no pertenece a tu empresa'
      });
    }

const bloqueosSolapados = await buscarBloqueosSolapados(
  empresaId,
  inmuebleIdNumero,
  fecha_inicio,
  fecha_fin
);

if (bloqueosSolapados.length > 0) {
  return res.status(409).json({
    mensaje: 'Ya existe un bloqueo activo que se cruza con el rango de fechas enviado',
    bloqueos_solapados: bloqueosSolapados
  });
}

/*
  Regla HU06:
  No se debe permitir bloquear manualmente un rango de fechas
  si ya existe una reserva solicitada, aprobada o activa en ese mismo rango.
*/
const reservasSolapadas = await listarReservasPorRango(
  empresaId,
  inmuebleIdNumero,
  fecha_inicio,
  fecha_fin
);

if (reservasSolapadas.length > 0) {
  return res.status(409).json({
    mensaje: 'No se puede bloquear este rango porque existen reservas que se cruzan con las fechas enviadas',
    reservas_solapadas: reservasSolapadas
  });
}

const bloqueoCreado = await registrarBloqueoDisponibilidad({
  empresa_id: empresaId,
  inmueble,
  fecha_inicio,
  fecha_fin,
  motivo: motivoLimpio,
  origen: origenNormalizado
});

    return res.status(201).json({
  mensaje: inmueble.tipo_inmueble === 'EDIFICIO'
    ? 'Bloqueo registrado correctamente para el edificio y sus unidades'
    : 'Bloqueo de disponibilidad registrado correctamente',
  inmueble: {
    inmueble_id: inmueble.inmueble_id,
    codigo: inmueble.codigo,
    nombre: inmueble.nombre,
    tipo_inmueble: inmueble.tipo_inmueble
  },
  bloqueo: bloqueoCreado
});

  } catch (error) {
    console.error('Error al crear bloqueo de disponibilidad:', error);

    return res.status(500).json({
      mensaje: 'Error interno al crear bloqueo de disponibilidad',
      error: error.message
    });
  }
};

const eliminarBloqueoDisponibilidad = async (req, res) => {
  try {
    const { bloqueo_id } = req.params;

    const bloqueoIdNumero = Number(bloqueo_id);

    if (Number.isNaN(bloqueoIdNumero) || bloqueoIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del bloqueo no es válido'
      });
    }

    const empresaId = req.usuario.empresa_id;

    const bloqueoExistente = await buscarBloqueoPorId(
      empresaId,
      bloqueoIdNumero
    );

    if (!bloqueoExistente) {
      return res.status(404).json({
        mensaje: 'El bloqueo no existe, ya fue cancelado o no pertenece a tu empresa'
      });
    }

    const bloqueosCancelados = await cancelarBloqueoDisponibilidad(
      empresaId,
      bloqueoIdNumero
    );

    return res.json({
      mensaje: bloqueoExistente.tipo_inmueble === 'EDIFICIO'
        ? 'Bloqueo del edificio y sus unidades cancelado correctamente'
        : 'Bloqueo de disponibilidad cancelado correctamente',
      total_cancelados: bloqueosCancelados.length,
      bloqueos: bloqueosCancelados
    });

  } catch (error) {
    console.error('Error al cancelar bloqueo de disponibilidad:', error);

    return res.status(500).json({
      mensaje: 'Error interno al cancelar bloqueo de disponibilidad',
      error: error.message
    });
  }
};

const editarBloqueoDisponibilidad = async (req, res) => {
  try {
    const { bloqueo_id } = req.params;

    const {
      fecha_inicio,
      fecha_fin,
      motivo,
      origen
    } = req.body;

    const bloqueoIdNumero = Number(bloqueo_id);

    if (Number.isNaN(bloqueoIdNumero) || bloqueoIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del bloqueo no es válido'
      });
    }

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        mensaje: 'La fecha de inicio y la fecha de fin son obligatorias'
      });
    }

    const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;

    if (!formatoFecha.test(fecha_inicio) || !formatoFecha.test(fecha_fin)) {
      return res.status(400).json({
        mensaje: 'Las fechas deben tener formato YYYY-MM-DD'
      });
    }

    const fechaInicioDate = new Date(`${fecha_inicio}T00:00:00`);
    const fechaFinDate = new Date(`${fecha_fin}T00:00:00`);

    if (
      Number.isNaN(fechaInicioDate.getTime()) ||
      Number.isNaN(fechaFinDate.getTime())
    ) {
      return res.status(400).json({
        mensaje: 'Las fechas enviadas no son válidas'
      });
    }

    if (fechaFinDate < fechaInicioDate) {
      return res.status(400).json({
        mensaje: 'La fecha de fin no puede ser menor que la fecha de inicio'
      });
    }

    const origenNormalizado = origen ? String(origen).trim().toUpperCase() : 'MANUAL';

    const origenesPermitidos = ['MANUAL', 'MANTENIMIENTO', 'OTRO'];

    if (!origenesPermitidos.includes(origenNormalizado)) {
      return res.status(400).json({
        mensaje: 'El origen del bloqueo no es válido',
        origenes_permitidos: origenesPermitidos
      });
    }

    const motivoLimpio = motivo ? String(motivo).trim() : null;

    if (motivoLimpio && motivoLimpio.length > 300) {
      return res.status(400).json({
        mensaje: 'El motivo no debe superar los 300 caracteres'
      });
    }

    const empresaId = req.usuario.empresa_id;

    const bloqueoActual = await buscarBloqueoPorId(
      empresaId,
      bloqueoIdNumero
    );

    if (!bloqueoActual) {
      return res.status(404).json({
        mensaje: 'El bloqueo no existe, ya fue cancelado o no pertenece a tu empresa'
      });
    }

    const bloqueosSolapados = await buscarBloqueosSolapadosExcepto(
      empresaId,
      bloqueoActual.inmueble_id,
      bloqueoIdNumero,
      fecha_inicio,
      fecha_fin
    );

    if (bloqueosSolapados.length > 0) {
      return res.status(409).json({
        mensaje: 'Ya existe otro bloqueo activo que se cruza con el nuevo rango de fechas',
        bloqueos_solapados: bloqueosSolapados
      });
    }

    const reservasSolapadas = await listarReservasPorRango(
      empresaId,
      bloqueoActual.inmueble_id,
      fecha_inicio,
      fecha_fin
    );

    if (reservasSolapadas.length > 0) {
      return res.status(409).json({
        mensaje: 'No se puede editar el bloqueo porque existen reservas que se cruzan con las fechas enviadas',
        reservas_solapadas: reservasSolapadas
      });
    }

    const bloqueoActualizado = await actualizarBloqueoDisponibilidad({
      empresa_id: empresaId,
      bloqueo_id: bloqueoIdNumero,
      fecha_inicio,
      fecha_fin,
      motivo: motivoLimpio,
      origen: origenNormalizado
    });

    return res.json({
      mensaje: 'Bloqueo de disponibilidad actualizado correctamente',
      bloqueo: bloqueoActualizado
    });

  } catch (error) {
    console.error('Error al editar bloqueo de disponibilidad:', error);

    return res.status(500).json({
      mensaje: 'Error interno al editar bloqueo de disponibilidad',
      error: error.message
    });
  }
};

const obtenerCalendarioDisponibilidad = async (req, res) => {
  try {
    const { inmueble_id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    const inmuebleIdNumero = Number(inmueble_id);

    if (Number.isNaN(inmuebleIdNumero) || inmuebleIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del inmueble no es válido'
      });
    }

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        mensaje: 'Debe enviar fecha_inicio y fecha_fin como parámetros de consulta'
      });
    }

    const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;

    if (!formatoFecha.test(fecha_inicio) || !formatoFecha.test(fecha_fin)) {
      return res.status(400).json({
        mensaje: 'Las fechas deben tener formato YYYY-MM-DD'
      });
    }

    const fechaInicioDate = new Date(`${fecha_inicio}T00:00:00`);
    const fechaFinDate = new Date(`${fecha_fin}T00:00:00`);

    if (
      Number.isNaN(fechaInicioDate.getTime()) ||
      Number.isNaN(fechaFinDate.getTime())
    ) {
      return res.status(400).json({
        mensaje: 'Las fechas enviadas no son válidas'
      });
    }

    if (fechaFinDate < fechaInicioDate) {
      return res.status(400).json({
        mensaje: 'La fecha de fin no puede ser menor que la fecha de inicio'
      });
    }

    const diferenciaDias =
      (fechaFinDate - fechaInicioDate) / (1000 * 60 * 60 * 24);

    if (diferenciaDias > 370) {
      return res.status(400).json({
        mensaje: 'El rango de fechas no debe superar 370 días'
      });
    }

    const empresaId = req.usuario.empresa_id;

    const inmueble = await buscarInmueblePorEmpresa(
      empresaId,
      inmuebleIdNumero
    );

    if (!inmueble) {
      return res.status(404).json({
        mensaje: 'El inmueble no existe, no está activo o no pertenece a tu empresa'
      });
    }

    const bloqueos = await listarBloqueosPorRango(
      empresaId,
      inmuebleIdNumero,
      fecha_inicio,
      fecha_fin
    );

    const reservas = await listarReservasPorRango(
      empresaId,
      inmuebleIdNumero,
      fecha_inicio,
      fecha_fin
    );

    const reservasConfirmadas = reservas.filter((reserva) =>
      ['APROBADA', 'ACTIVA'].includes(reserva.estado_reserva)
    );

    const disponibleEnRango =
      bloqueos.length === 0 && reservasConfirmadas.length === 0;

    return res.json({
      mensaje: 'Calendario de disponibilidad obtenido correctamente',
      inmueble: {
        inmueble_id: inmueble.inmueble_id,
        codigo: inmueble.codigo,
        nombre: inmueble.nombre,
        tipo_inmueble: inmueble.tipo_inmueble,
        estado_operativo: inmueble.estado_operativo
      },
      rango: {
        fecha_inicio,
        fecha_fin
      },
      disponible_en_rango: disponibleEnRango,
      resumen: {
        total_bloqueos: bloqueos.length,
        total_reservas: reservas.length,
        total_reservas_confirmadas: reservasConfirmadas.length
      },
      bloqueos,
      reservas
    });

  } catch (error) {
    console.error('Error al obtener calendario de disponibilidad:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener calendario de disponibilidad',
      error: error.message
    });
  }
};

const obtenerInmueblesParaDisponibilidad = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa_id;

    const inmuebles = await listarInmueblesParaDisponibilidad(empresaId);

    return res.json({
      mensaje: 'Inmuebles obtenidos correctamente para gestión de disponibilidad',
      total: inmuebles.length,
      inmuebles
    });

  } catch (error) {
    console.error('Error al obtener inmuebles para disponibilidad:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener inmuebles para disponibilidad',
      error: error.message
    });
  }
};

module.exports = {
  obtenerBloqueosPorInmueble,
  crearBloqueoDisponibilidad,
  eliminarBloqueoDisponibilidad,
  obtenerCalendarioDisponibilidad,
  editarBloqueoDisponibilidad,
  obtenerInmueblesParaDisponibilidad
};