const {
  obtenerPublicacionReservablePorId,
  buscarConflictosReserva,
  crearSolicitudReserva,
  listarSolicitudesPorInquilino,
  listarSolicitudesGestionEmpresa,
  obtenerSolicitudGestionPorId,
  buscarConflictosAprobacionReserva,
  aprobarSolicitudReservaPorId,
  rechazarSolicitudReservaPorId,
  listarEventosReservaGestion,
  obtenerSolicitudInquilinoPorId,
  listarEventosReservaInquilino,
  obtenerVettingInquilinoReservaGestion,
  obtenerUltimaEvaluacionInquilinoPorReserva,
  listarEvaluacionesInquilinoReservaGestion,
  registrarEvaluacionConEventoReservaGestion,
  confirmarCheckinReservaGestion,
  confirmarCheckoutReservaGestion,
  obtenerReservaExtensibleInquilinoPorId,
  obtenerSolicitudExtensionPendientePorReserva,
  buscarConflictosExtensionReserva,
  crearSolicitudExtensionReserva,
  obtenerExtensionPendienteReservaGestion,
  aprobarSolicitudExtensionReservaGestion,
  rechazarSolicitudExtensionReservaGestion,
  obtenerReservaParaCancelacionInquilino,
  cancelarReservaPorInquilino
} = require('../models/reserva.model');

const {
  crearNotificacion
} = require('../models/notificacion.model');

const limpiarTexto = (valor) => {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
};

const validarFechaYYYYMMDD = (fecha) => {
  if (!fecha) return false;

  const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;

  if (!formatoFecha.test(fecha)) {
    return false;
  }

  const fechaDate = new Date(`${fecha}T00:00:00`);

  return !Number.isNaN(fechaDate.getTime());
};

// HU13 -HELPER- Convierte fechas de SQL Server al formato YYYY-MM-DD
const convertirFechaAYYYYMMDD = (valor) => {
  if (!valor) return null;

  if (valor instanceof Date) {
    const anio = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }

  const texto = String(valor);
  const coincidencia = texto.match(/^\d{4}-\d{2}-\d{2}/);

  return coincidencia ? coincidencia[0] : null;
};

const construirEstadoVettingSolicitud = (solicitud) => {
  const tieneEvaluacion = Boolean(solicitud.evaluacion_inquilino_id);
  const resultadoEvaluacion = solicitud.resultado_evaluacion || null;

  const requiereEvaluacion =
    solicitud.estado_reserva === 'SOLICITADA' &&
    !tieneEvaluacion;

  return {
    tiene_evaluacion: tieneEvaluacion,
    resultado: resultadoEvaluacion,
    score_riesgo: solicitud.score_riesgo,
    fecha_evaluacion: solicitud.fecha_evaluacion,
    observaciones: solicitud.observaciones_evaluacion,
    puede_aprobar:
      solicitud.estado_reserva === 'SOLICITADA' &&
      resultadoEvaluacion === 'APROBADO',
    requiere_evaluacion: requiereEvaluacion,
    mensaje:
      solicitud.estado_reserva !== 'SOLICITADA'
        ? 'La reserva no requiere evaluación de vetting'
        : requiereEvaluacion
          ? 'Pendiente de evaluación de vetting'
          : resultadoEvaluacion === 'APROBADO'
            ? 'Evaluación aprobada, puede continuar con la aprobación'
            : 'La evaluación no está aprobada'
  };
};

const construirResumenVetting = (vetting) => {
  const solicitud = vetting.solicitud;
  const resumenHistorial = vetting.resumen_historial || {};
  const evaluacion = vetting.evaluacion_inquilino;

  const alertas = [];
  const puntosFuertes = [];

  if (!solicitud.perfil_usuario_id) {
    alertas.push({
      tipo: 'PERFIL_INCOMPLETO',
      nivel: 'ALTO',
      mensaje: 'El inquilino no tiene perfil registrado.'
    });
  }

  if (!solicitud.tipo_documento || !solicitud.numero_documento) {
    alertas.push({
      tipo: 'DOCUMENTO_FALTANTE',
      nivel: 'MEDIO',
      mensaje: 'El inquilino no tiene documento registrado.'
    });
  } else {
    puntosFuertes.push({
      tipo: 'DOCUMENTO_REGISTRADO',
      mensaje: 'El inquilino tiene documento registrado.'
    });
  }

  if (!solicitud.telefono) {
    alertas.push({
      tipo: 'TELEFONO_FALTANTE',
      nivel: 'MEDIO',
      mensaje: 'El inquilino no tiene teléfono registrado.'
    });
  } else {
    puntosFuertes.push({
      tipo: 'TELEFONO_REGISTRADO',
      mensaje: 'El inquilino tiene teléfono registrado.'
    });
  }

  if (!solicitud.email_verificado) {
    alertas.push({
      tipo: 'EMAIL_NO_VERIFICADO',
      nivel: 'ALTO',
      mensaje: 'El correo del inquilino no está verificado.'
    });
  } else {
    puntosFuertes.push({
      tipo: 'EMAIL_VERIFICADO',
      mensaje: 'El correo del inquilino está verificado.'
    });
  }

  if (!solicitud.ingreso_mensual_referencial) {
    alertas.push({
      tipo: 'INGRESO_NO_DECLARADO',
      nivel: 'BAJO',
      mensaje: 'El inquilino no declaró ingreso mensual referencial.'
    });
  }

  if (
    !solicitud.tiene_aval_bancario &&
    !solicitud.tiene_contrato_trabajo &&
    !solicitud.tiene_garante
  ) {
    alertas.push({
      tipo: 'SIN_RESPALDO_DECLARADO',
      nivel: 'MEDIO',
      mensaje: 'El inquilino no declaró aval, contrato de trabajo ni garante.'
    });
  } else {
    puntosFuertes.push({
      tipo: 'RESPALDO_DECLARADO',
      mensaje: 'El inquilino declaró al menos un respaldo básico.'
    });
  }

  const totalSolicitudes = Number(resumenHistorial.total_solicitudes || 0);
  const totalRechazadas = Number(resumenHistorial.total_rechazadas || 0);
  const totalAprobadas = Number(resumenHistorial.total_aprobadas || 0);
  const totalFinalizadas = Number(resumenHistorial.total_finalizadas || 0);

  if (totalSolicitudes >= 3 && totalAprobadas === 0 && totalFinalizadas === 0) {
    alertas.push({
      tipo: 'VARIAS_SOLICITUDES_SIN_APROBACION',
      nivel: 'MEDIO',
      mensaje: 'El inquilino tiene varias solicitudes recientes sin reservas aprobadas o finalizadas.'
    });
  }

  if (totalRechazadas >= 2) {
    alertas.push({
      tipo: 'RECHAZOS_PREVIOS',
      nivel: 'ALTO',
      mensaje: 'El inquilino tiene varias solicitudes rechazadas en su historial.'
    });
  }

  if (evaluacion) {
    if (evaluacion.resultado === 'APROBADO') {
      puntosFuertes.push({
        tipo: 'EVALUACION_APROBADA',
        mensaje: 'El inquilino ya tiene una evaluación aprobada para esta solicitud.'
      });
    }

    if (evaluacion.resultado === 'OBSERVADO') {
      alertas.push({
        tipo: 'EVALUACION_OBSERVADA',
        nivel: 'MEDIO',
        mensaje: 'La evaluación del inquilino fue marcada como observada.'
      });
    }

    if (evaluacion.resultado === 'RECHAZADO') {
      alertas.push({
        tipo: 'EVALUACION_RECHAZADA',
        nivel: 'ALTO',
        mensaje: 'La evaluación del inquilino fue marcada como rechazada.'
      });
    }
  }

  const cantidadAlertasAltas = alertas.filter((a) => a.nivel === 'ALTO').length;
  const cantidadAlertasMedias = alertas.filter((a) => a.nivel === 'MEDIO').length;

  let nivelRiesgo = 'BAJO';
  let recomendacion = 'El inquilino no presenta alertas fuertes. Puede continuar con la revisión.';

  if (cantidadAlertasAltas >= 1) {
    nivelRiesgo = 'ALTO';
    recomendacion = 'Se recomienda revisar cuidadosamente la información antes de aprobar la reserva.';
  } else if (cantidadAlertasMedias >= 2) {
    nivelRiesgo = 'MEDIO';
    recomendacion = 'Se recomienda solicitar o revisar información adicional antes de confirmar la reserva.';
  }

  return {
    nivel_riesgo_sugerido: nivelRiesgo,
    recomendacion,
    total_alertas: alertas.length,
    total_puntos_fuertes: puntosFuertes.length,
    alertas,
    puntos_fuertes: puntosFuertes
  };
};

const construirEvaluacionSugerida = (resumenAutomatico) => {
  let scoreRiesgoSugerido = 20;
  let resultadoSugerido = 'APROBADO';
  let mensaje = 'El inquilino no presenta alertas graves. Puede ser aprobado si el anfitrión está conforme.';

  const alertas = resumenAutomatico.alertas || [];

  const alertasAltas = alertas.filter((alerta) => alerta.nivel === 'ALTO').length;
  const alertasMedias = alertas.filter((alerta) => alerta.nivel === 'MEDIO').length;
  const alertasBajas = alertas.filter((alerta) => alerta.nivel === 'BAJO').length;

  scoreRiesgoSugerido += alertasAltas * 30;
  scoreRiesgoSugerido += alertasMedias * 15;
  scoreRiesgoSugerido += alertasBajas * 5;

  if (scoreRiesgoSugerido > 100) {
    scoreRiesgoSugerido = 100;
  }

  if (scoreRiesgoSugerido >= 70) {
    resultadoSugerido = 'RECHAZADO';
    mensaje = 'El inquilino presenta alertas importantes. Se recomienda no aprobar sin información adicional.';
  } else if (scoreRiesgoSugerido >= 40) {
    resultadoSugerido = 'OBSERVADO';
    mensaje = 'El inquilino tiene datos incompletos o alertas medias. Se recomienda observar antes de aprobar.';
  }

  return {
    score_riesgo_sugerido: scoreRiesgoSugerido,
    resultado_sugerido: resultadoSugerido,
    mensaje
  };
};

const construirAdvertenciasEvaluacion = ({
  score_riesgo,
  resultado,
  resumen_automatico
}) => {
  const advertencias = [];

  if (resultado === 'APROBADO' && score_riesgo >= 70) {
    advertencias.push({
      tipo: 'APROBADO_CON_RIESGO_ALTO',
      nivel: 'ALTO',
      mensaje: 'El resultado es APROBADO, pero el score de riesgo es alto.'
    });
  }

  if (resultado === 'APROBADO' && resumen_automatico?.nivel_riesgo_sugerido === 'ALTO') {
    advertencias.push({
      tipo: 'APROBADO_CON_ALERTAS_ALTAS',
      nivel: 'ALTO',
      mensaje: 'El inquilino tiene alertas altas, pero fue marcado como aprobado.'
    });
  }

  if (resultado === 'RECHAZADO' && score_riesgo <= 30) {
    advertencias.push({
      tipo: 'RECHAZADO_CON_RIESGO_BAJO',
      nivel: 'MEDIO',
      mensaje: 'El resultado es RECHAZADO, pero el score de riesgo es bajo.'
    });
  }

  if (resultado === 'OBSERVADO' && score_riesgo <= 20) {
    advertencias.push({
      tipo: 'OBSERVADO_CON_RIESGO_MUY_BAJO',
      nivel: 'BAJO',
      mensaje: 'El resultado es OBSERVADO, pero el score de riesgo es muy bajo.'
    });
  }

  return advertencias;
};

const solicitarReserva = async (req, res) => {
  try {
    const inquilinoId = req.usuario.usuario_id;

    const {
      publicacion_id,
      fecha_inicio,
      fecha_fin,
      observacion_inquilino
    } = req.body;

    const publicacionIdNumero = Number(publicacion_id);

    if (Number.isNaN(publicacionIdNumero) || publicacionIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'Debe seleccionar una publicación válida'
      });
    }

    if (!validarFechaYYYYMMDD(fecha_inicio) || !validarFechaYYYYMMDD(fecha_fin)) {
      return res.status(400).json({
        mensaje: 'Las fechas deben tener formato YYYY-MM-DD'
      });
    }

    if (fecha_fin <= fecha_inicio) {
      return res.status(400).json({
        mensaje: 'La fecha de fin debe ser mayor que la fecha de inicio'
      });
    }

    const observacionLimpia = limpiarTexto(observacion_inquilino);

    if (observacionLimpia.length > 500) {
      return res.status(400).json({
        mensaje: 'La observación no puede superar los 500 caracteres'
      });
    }

    const publicacion = await obtenerPublicacionReservablePorId(publicacionIdNumero);

    if (!publicacion) {
      return res.status(404).json({
        mensaje: 'La publicación no existe, no está disponible o no acepta reservas'
      });
    }

    if (
      publicacion.disponible_desde &&
      fecha_inicio < publicacion.disponible_desde.toISOString().slice(0, 10)
    ) {
      return res.status(400).json({
        mensaje: 'El inmueble aún no está disponible desde la fecha seleccionada',
        disponible_desde: publicacion.disponible_desde
      });
    }

    const conflictos = await buscarConflictosReserva({
      empresa_id: publicacion.empresa_id,
      inmueble_id: publicacion.inmueble_id,
      fecha_inicio,
      fecha_fin
    });

    if (conflictos.bloqueos.length > 0 || conflictos.reservas.length > 0) {
      return res.status(409).json({
        mensaje: 'No se puede solicitar la reserva porque el inmueble no está disponible en ese rango de fechas',
        bloqueos_solapados: conflictos.bloqueos,
        reservas_solapadas: conflictos.reservas
      });
    }

    const reservaCreada = await crearSolicitudReserva({
      inmueble_id: publicacion.inmueble_id,
      inquilino_id: inquilinoId,
      fecha_inicio,
      fecha_fin,
      renta_pactada_mensual: publicacion.precio_publicado_mensual,
      moneda: publicacion.moneda,
      observacion_inquilino: observacionLimpia || null
    });

    return res.status(201).json({
      mensaje: 'Solicitud de reserva enviada correctamente',
      publicacion: {
        publicacion_id: publicacion.publicacion_id,
        inmueble_id: publicacion.inmueble_id,
        titulo: publicacion.titulo,
        codigo_inmueble: publicacion.codigo_inmueble,
        nombre_inmueble: publicacion.nombre_inmueble,
        tipo_inmueble: publicacion.tipo_inmueble
      },
      reserva: reservaCreada
    });

  } catch (error) {
    console.error('Error al solicitar reserva:', error);

    return res.status(500).json({
      mensaje: 'Error interno al solicitar reserva',
      error: error.message
    });
  }
};

const obtenerMisSolicitudesReserva = async (req, res) => {
  try {
    const inquilinoId = req.usuario.usuario_id;

    const solicitudes = await listarSolicitudesPorInquilino(inquilinoId);

    return res.json({
      mensaje: 'Solicitudes de reserva obtenidas correctamente',
      total: solicitudes.length,
      solicitudes
    });

  } catch (error) {
    console.error('Error al obtener mis solicitudes de reserva:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener mis solicitudes de reserva',
      error: error.message
    });
  }
};

const obtenerSolicitudesGestion = async (req, res) => {
  try {
    const usuarioPublicadorId = req.usuario.usuario_id;

    const { estado_reserva, estado_vetting } = req.query;

    const rolesUsuario = Array.isArray(req.usuario.roles)
      ? req.usuario.roles
      : [];

    const esAdmin = rolesUsuario.includes('ADMIN');
    const esSecretario = rolesUsuario.includes('SECRETARIO');

    let estadoNormalizado = limpiarTexto(estado_reserva).toUpperCase();
    let estadoVettingNormalizado = limpiarTexto(estado_vetting).toUpperCase();

    /*
      El secretario solamente controla el ciclo de ocupación.
      No puede consultar solicitudes pendientes, rechazadas,
      canceladas o expiradas.
    */
    if (esSecretario && !esAdmin) {
      const estadosPermitidosSecretario = [
        'APROBADA',
        'ACTIVA',
        'FINALIZADA'
      ];

      if (
        estadoNormalizado &&
        !estadosPermitidosSecretario.includes(estadoNormalizado)
      ) {
        return res.status(403).json({
          mensaje: 'El secretario solo puede consultar reservas aprobadas, activas o finalizadas',
          estados_permitidos: estadosPermitidosSecretario
        });
      }

      if (estadoVettingNormalizado) {
        return res.status(403).json({
          mensaje: 'El secretario no tiene permisos para consultar información de vetting'
        });
      }

      /*
        Si no envía filtro, comenzará viendo las aprobadas.
      */
      if (!estadoNormalizado) {
        estadoNormalizado = 'APROBADA';
      }

      estadoVettingNormalizado = '';
    }

    const estadosPermitidos = [
      'SOLICITADA',
      'APROBADA',
      'RECHAZADA',
      'CANCELADA',
      'ACTIVA',
      'FINALIZADA',
      'EXPIRADA'
    ];

    if (estadoNormalizado && !estadosPermitidos.includes(estadoNormalizado)) {
      return res.status(400).json({
        mensaje: 'El estado de reserva no es válido',
        estados_permitidos: estadosPermitidos
      });
    }

    const estadosVettingPermitidos = [
      'PENDIENTE',
      'APROBADO',
      'OBSERVADO',
      'RECHAZADO'
    ];

    if (
      estadoVettingNormalizado &&
      !estadosVettingPermitidos.includes(estadoVettingNormalizado)
    ) {
      return res.status(400).json({
        mensaje: 'El estado de vetting no es válido',
        estados_permitidos: estadosVettingPermitidos
      });
    }

    const solicitudes = await listarSolicitudesGestionEmpresa(usuarioPublicadorId, {
      estado_reserva: estadoNormalizado || null
    });

    const solicitudesConVetting = solicitudes.map((solicitud) => {
      return {
        ...solicitud,
        estado_vetting: construirEstadoVettingSolicitud(solicitud)
      };
    });

    let solicitudesFiltradas = solicitudesConVetting;

    if (estadoVettingNormalizado === 'PENDIENTE') {
      solicitudesFiltradas = solicitudesConVetting.filter(
        (solicitud) => solicitud.estado_vetting.requiere_evaluacion
      );
    }

    if (estadoVettingNormalizado === 'APROBADO') {
      solicitudesFiltradas = solicitudesConVetting.filter(
        (solicitud) => solicitud.estado_vetting.resultado === 'APROBADO'
      );
    }

    if (estadoVettingNormalizado === 'OBSERVADO') {
      solicitudesFiltradas = solicitudesConVetting.filter(
        (solicitud) => solicitud.estado_vetting.resultado === 'OBSERVADO'
      );
    }

    if (estadoVettingNormalizado === 'RECHAZADO') {
      solicitudesFiltradas = solicitudesConVetting.filter(
        (solicitud) => solicitud.estado_vetting.resultado === 'RECHAZADO'
      );
    }

    return res.json({
      mensaje: 'Solicitudes de reserva para gestión obtenidas correctamente',
      filtros: {
        estado_reserva: estadoNormalizado || null,
        estado_vetting: estadoVettingNormalizado || null
      },
      total: solicitudesFiltradas.length,
      solicitudes: solicitudesFiltradas
    });

  } catch (error) {
    console.error('Error al obtener solicitudes de reserva para gestión:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener solicitudes de reserva para gestión',
      error: error.message
    });
  }
};

const aprobarSolicitudReserva = async (req, res) => {
  try {
    const usuarioPublicadorId = req.usuario.usuario_id;
    const gestorId = req.usuario.usuario_id;

    const { reserva_id } = req.params;
    const { observacion_gestor } = req.body;

    const reservaIdNumero = Number(reserva_id);

    if (Number.isNaN(reservaIdNumero) || reservaIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    const observacionLimpia = limpiarTexto(observacion_gestor);

    if (observacionLimpia.length > 500) {
      return res.status(400).json({
        mensaje: 'La observación del gestor no puede superar los 500 caracteres'
      });
    }

    const solicitud = await obtenerSolicitudGestionPorId(
      usuarioPublicadorId,
      reservaIdNumero
    );

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'La solicitud de reserva no existe o no pertenece a tus publicaciones'
      });
    }

    if (solicitud.inquilino_id === gestorId) {
        return res.status(403).json({
        mensaje: 'No puedes aprobar tu propia solicitud de reserva'
        });
    }

    if (solicitud.estado_reserva !== 'SOLICITADA') {
      return res.status(400).json({
        mensaje: 'Solo se pueden aprobar solicitudes en estado SOLICITADA',
        estado_actual: solicitud.estado_reserva
      });
    }

    const ultimaEvaluacion = await obtenerUltimaEvaluacionInquilinoPorReserva(
      reservaIdNumero
    );

    if (!ultimaEvaluacion) {
      return res.status(409).json({
        mensaje: 'Antes de aprobar la solicitud debes revisar y registrar una evaluación del inquilino',
        accion_requerida: 'Registrar evaluación de vetting',
        ruta_sugerida: `/api/reservas/gestion/solicitudes/${reservaIdNumero}/evaluacion`
      });
    }

    if (ultimaEvaluacion.resultado !== 'APROBADO') {
      return res.status(409).json({
        mensaje: 'No se puede aprobar la solicitud porque la evaluación del inquilino no está aprobada',
        resultado_evaluacion: ultimaEvaluacion.resultado,
        evaluacion: ultimaEvaluacion
      });
    }

    const conflictos = await buscarConflictosAprobacionReserva({
      empresa_id: solicitud.empresa_id,
      inmueble_id: solicitud.inmueble_id,
      reserva_id: solicitud.reserva_id,
      fecha_inicio: solicitud.fecha_inicio,
      fecha_fin: solicitud.fecha_fin
    });

    if (conflictos.length > 0) {
      return res.status(409).json({
        mensaje: 'No se puede aprobar la solicitud porque existe otra reserva aprobada o activa en el mismo rango',
        reservas_conflictivas: conflictos
      });
    }

    const reservaAprobada = await aprobarSolicitudReservaPorId({
      usuario_publicador_id: usuarioPublicadorId,
      reserva_id: reservaIdNumero,
      gestor_id: gestorId,
      observacion_gestor: observacionLimpia || null
    });

    if (!reservaAprobada) {
      return res.status(400).json({
        mensaje: 'No se pudo aprobar la solicitud. Verifica que siga en estado SOLICITADA'
      });
    }

    return res.json({
      mensaje: 'Solicitud de reserva aprobada correctamente',
      reserva: reservaAprobada
    });

  } catch (error) {
    console.error('Error al aprobar solicitud de reserva:', error);

    return res.status(500).json({
      mensaje: 'Error interno al aprobar solicitud de reserva',
      error: error.message
    });
  }
};

const rechazarSolicitudReserva = async (req, res) => {
  try {
    const usuarioPublicadorId = req.usuario.usuario_id;
    const gestorId = req.usuario.usuario_id;

    const { reserva_id } = req.params;
    const { motivo_rechazo, observacion_gestor } = req.body;

    const reservaIdNumero = Number(reserva_id);

    if (Number.isNaN(reservaIdNumero) || reservaIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    const motivoLimpio = limpiarTexto(motivo_rechazo);
    const observacionLimpia = limpiarTexto(observacion_gestor);

    if (!motivoLimpio) {
      return res.status(400).json({
        mensaje: 'Debe ingresar el motivo del rechazo'
      });
    }

    if (motivoLimpio.length > 300) {
      return res.status(400).json({
        mensaje: 'El motivo de rechazo no puede superar los 300 caracteres'
      });
    }

    if (observacionLimpia.length > 500) {
      return res.status(400).json({
        mensaje: 'La observación del gestor no puede superar los 500 caracteres'
      });
    }

    const solicitud = await obtenerSolicitudGestionPorId(
      usuarioPublicadorId,
      reservaIdNumero
    );

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'La solicitud de reserva no existe o no pertenece a tus publicaciones'
      });
    }

    if (solicitud.inquilino_id === gestorId) {
      return res.status(403).json({
        mensaje: 'No puedes rechazar tu propia solicitud de reserva'
      });
    }

    if (solicitud.estado_reserva !== 'SOLICITADA') {
      return res.status(400).json({
        mensaje: 'Solo se pueden rechazar solicitudes en estado SOLICITADA',
        estado_actual: solicitud.estado_reserva
      });
    }

    const reservaRechazada = await rechazarSolicitudReservaPorId({
      usuario_publicador_id: usuarioPublicadorId,
      reserva_id: reservaIdNumero,
      gestor_id: gestorId,
      motivo_rechazo: motivoLimpio,
      observacion_gestor: observacionLimpia || null
    });

    if (!reservaRechazada) {
      return res.status(400).json({
        mensaje: 'No se pudo rechazar la solicitud. Verifica que siga en estado SOLICITADA'
      });
    }

    return res.json({
      mensaje: 'Solicitud de reserva rechazada correctamente',
      reserva: reservaRechazada
    });

  } catch (error) {
    console.error('Error al rechazar solicitud de reserva:', error);

    return res.status(500).json({
      mensaje: 'Error interno al rechazar solicitud de reserva',
      error: error.message
    });
  }
};

const obtenerEventosReservaGestion = async (req, res) => {
  try {
    const usuarioPublicadorId = req.usuario.usuario_id;
    const { reserva_id } = req.params;

    const reservaIdNumero = Number(reserva_id);

    if (Number.isNaN(reservaIdNumero) || reservaIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    const solicitud = await obtenerSolicitudGestionPorId(
      usuarioPublicadorId,
      reservaIdNumero
    );

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'La solicitud de reserva no existe o no pertenece a tus publicaciones'
      });
    }

    const rolesUsuario = Array.isArray(req.usuario.roles)
      ? req.usuario.roles
      : [];

    const esAdmin = rolesUsuario.includes('ADMIN');
    const esSecretario = rolesUsuario.includes('SECRETARIO');

    if (esSecretario && !esAdmin) {
      const estadosPermitidosSecretario = [
        'APROBADA',
        'ACTIVA',
        'FINALIZADA'
      ];

      if (!estadosPermitidosSecretario.includes(solicitud.estado_reserva)) {
        return res.status(403).json({
          mensaje: 'El secretario no puede consultar el historial de esta solicitud',
          estado_actual: solicitud.estado_reserva
        });
      }
    }

    const eventos = await listarEventosReservaGestion(
      usuarioPublicadorId,
      reservaIdNumero
    );

    const solicitudExtensionPendiente =await obtenerExtensionPendienteReservaGestion(
      usuarioPublicadorId,
      reservaIdNumero
    );

    return res.json({
      mensaje: 'Historial de eventos de la reserva obtenido correctamente',
      reserva: {
        reserva_id: solicitud.reserva_id,
        inmueble_id: solicitud.inmueble_id,
        inquilino_id: solicitud.inquilino_id,
        estado_reserva: solicitud.estado_reserva,
        fecha_inicio: solicitud.fecha_inicio,
        fecha_fin: solicitud.fecha_fin,
        codigo_inmueble: solicitud.codigo_inmueble,
        nombre_inmueble: solicitud.nombre_inmueble,
        tipo_inmueble: solicitud.tipo_inmueble
      },

      // HU13
      solicitud_extension_pendiente: solicitudExtensionPendiente,
      total: eventos.length,
      eventos
    });

  } catch (error) {
    console.error('Error al obtener eventos de reserva:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener eventos de reserva',
      error: error.message
    });
  }
};

const obtenerDetalleMiSolicitudReserva = async (req, res) => {
  try {
    const inquilinoId = req.usuario.usuario_id;
    const { reserva_id } = req.params;

    const reservaIdNumero = Number(reserva_id);

    if (Number.isNaN(reservaIdNumero) || reservaIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    const solicitud = await obtenerSolicitudInquilinoPorId(
      inquilinoId,
      reservaIdNumero
    );

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'La solicitud de reserva no existe o no pertenece a tu usuario'
      });
    }

    const eventos = await listarEventosReservaInquilino(
      inquilinoId,
      reservaIdNumero
    );

    const solicitudExtensionPendiente = await obtenerSolicitudExtensionPendientePorReserva(
    reservaIdNumero
    );

    return res.json({
      mensaje: 'Detalle de solicitud de reserva obtenido correctamente',
      solicitud,
      solicitudExtensionPendiente: solicitudExtensionPendiente,
      total_eventos: eventos.length,
      eventos
    });

  } catch (error) {
    console.error('Error al obtener detalle de mi solicitud:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener detalle de mi solicitud',
      error: error.message
    });
  }
};

const obtenerVettingInquilinoGestion = async (req, res) => {
  try {
    const usuarioPublicadorId = req.usuario.usuario_id;
    const { reserva_id } = req.params;

    const reservaIdNumero = Number(reserva_id);

    if (Number.isNaN(reservaIdNumero) || reservaIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    const vetting = await obtenerVettingInquilinoReservaGestion(
      usuarioPublicadorId,
      reservaIdNumero
    );

    if (!vetting) {
      return res.status(404).json({
        mensaje: 'La solicitud de reserva no existe o no pertenece a tus publicaciones'
      });
    }

    if (vetting.solicitud.inquilino_id === usuarioPublicadorId) {
      return res.status(403).json({
        mensaje: 'No puedes revisar el vetting de tu propia solicitud de reserva'
      });
    }

    const resumenAutomatico = construirResumenVetting(vetting);
    const evaluacionSugerida = construirEvaluacionSugerida(resumenAutomatico);

    return res.json({
      mensaje: 'Vetting del inquilino obtenido correctamente',
      solicitud: {
        reserva_id: vetting.solicitud.reserva_id,
        estado_reserva: vetting.solicitud.estado_reserva,
        fecha_solicitud: vetting.solicitud.fecha_solicitud,
        fecha_inicio: vetting.solicitud.fecha_inicio,
        fecha_fin: vetting.solicitud.fecha_fin,
        renta_pactada_mensual: vetting.solicitud.renta_pactada_mensual,
        monto_total_estimado: vetting.solicitud.monto_total_estimado,
        deposito_garantia: vetting.solicitud.deposito_garantia,
        moneda: vetting.solicitud.moneda,
        observacion_inquilino: vetting.solicitud.observacion_inquilino
      },
      inmueble: {
        inmueble_id: vetting.solicitud.inmueble_id,
        codigo: vetting.solicitud.codigo_inmueble,
        nombre: vetting.solicitud.nombre_inmueble,
        tipo_inmueble: vetting.solicitud.tipo_inmueble,
        subtipo_unidad: vetting.solicitud.subtipo_unidad,
        direccion_linea1: vetting.solicitud.direccion_linea1,
        numero: vetting.solicitud.numero,
        distrito: vetting.solicitud.distrito,
        ciudad: vetting.solicitud.ciudad,
        provincia: vetting.solicitud.provincia,
        departamento: vetting.solicitud.departamento
      },
      publicacion: {
        publicacion_id: vetting.solicitud.publicacion_id,
        titulo: vetting.solicitud.titulo_publicacion,
        precio_publicado_mensual: vetting.solicitud.precio_publicado_mensual
      },
      inquilino: {
        usuario_id: vetting.solicitud.usuario_inquilino_id,
        correo: vetting.solicitud.correo_inquilino,
        estado_usuario: vetting.solicitud.estado_usuario_inquilino,
        email_verificado: vetting.solicitud.email_verificado,
        perfil: {
          perfil_usuario_id: vetting.solicitud.perfil_usuario_id,
          nombres: vetting.solicitud.nombres_inquilino,
          apellidos: vetting.solicitud.apellidos_inquilino,
          tipo_documento: vetting.solicitud.tipo_documento,
          numero_documento: vetting.solicitud.numero_documento,
          telefono: vetting.solicitud.telefono,
          fecha_nacimiento: vetting.solicitud.fecha_nacimiento,
          sexo: vetting.solicitud.sexo,
          foto_url: vetting.solicitud.foto_url,
          biografia: vetting.solicitud.biografia,
          direccion: vetting.solicitud.direccion_inquilino,
          distrito: vetting.solicitud.distrito_inquilino,
          ciudad: vetting.solicitud.ciudad_inquilino,
          pais: vetting.solicitud.pais_inquilino
        },
        vetting_basico: {
          ingreso_mensual_referencial: vetting.solicitud.ingreso_mensual_referencial,
          tiene_aval_bancario: vetting.solicitud.tiene_aval_bancario,
          tiene_contrato_trabajo: vetting.solicitud.tiene_contrato_trabajo,
          tiene_garante: vetting.solicitud.tiene_garante,
          nombre_garante: vetting.solicitud.nombre_garante,
          contacto_garante: vetting.solicitud.contacto_garante
        }
      },
      resumen_historial: vetting.resumen_historial,
      historial_reservas: vetting.historial_reservas,
      evaluacion_inquilino: vetting.evaluacion_inquilino,
      resumen_automatico: resumenAutomatico,
      evaluacion_sugerida: evaluacionSugerida
    });

  } catch (error) {
    console.error('Error al obtener vetting del inquilino:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener vetting del inquilino',
      error: error.message
    });
  }
};

const registrarEvaluacionInquilinoGestion = async (req, res) => {
  try {
    const usuarioPublicadorId = req.usuario.usuario_id;
    const gestorId = req.usuario.usuario_id;

    const { reserva_id } = req.params;
    const {
      score_riesgo,
      resultado,
      observaciones
    } = req.body;

    const reservaIdNumero = Number(reserva_id);

    if (Number.isNaN(reservaIdNumero) || reservaIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    const scoreNumero = Number(score_riesgo);

    if (
      Number.isNaN(scoreNumero) ||
      scoreNumero < 0 ||
      scoreNumero > 100
    ) {
      return res.status(400).json({
        mensaje: 'El score de riesgo debe ser un número entre 0 y 100'
      });
    }

    const resultadoNormalizado = limpiarTexto(resultado).toUpperCase();

    const resultadosPermitidos = [
      'PENDIENTE',
      'APROBADO',
      'OBSERVADO',
      'RECHAZADO'
    ];

    if (!resultadosPermitidos.includes(resultadoNormalizado)) {
      return res.status(400).json({
        mensaje: 'El resultado de evaluación no es válido',
        resultados_permitidos: resultadosPermitidos
      });
    }

    const observacionesLimpias = limpiarTexto(observaciones);

    if (observacionesLimpias.length > 500) {
      return res.status(400).json({
        mensaje: 'Las observaciones no pueden superar los 500 caracteres'
      });
    }

    const solicitud = await obtenerSolicitudGestionPorId(
      usuarioPublicadorId,
      reservaIdNumero
    );

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'La solicitud de reserva no existe o no pertenece a tus publicaciones'
      });
    }

    if (solicitud.inquilino_id === gestorId) {
      return res.status(403).json({
        mensaje: 'No puedes evaluar tu propia solicitud de reserva'
      });
    }

    if (solicitud.estado_reserva !== 'SOLICITADA') {
      return res.status(400).json({
        mensaje: 'Solo se puede registrar evaluación mientras la solicitud está en estado SOLICITADA',
        estado_actual: solicitud.estado_reserva
      });
    }

    const vetting = await obtenerVettingInquilinoReservaGestion(
      usuarioPublicadorId,
      reservaIdNumero
    );

    const resumenAutomatico = construirResumenVetting(vetting);

    const advertenciasEvaluacion = construirAdvertenciasEvaluacion({
      score_riesgo: scoreNumero,
      resultado: resultadoNormalizado,
      resumen_automatico: resumenAutomatico
    });

    const historialReservas = Number(
      vetting?.resumen_historial?.total_solicitudes || 0
    );

    const ultimaEvaluacion = await obtenerUltimaEvaluacionInquilinoPorReserva(
      reservaIdNumero
    );

    const observacionUltima = limpiarTexto(ultimaEvaluacion?.observaciones);

    if (
      ultimaEvaluacion &&
      ultimaEvaluacion.resultado === resultadoNormalizado &&
      Number(ultimaEvaluacion.score_riesgo) === scoreNumero &&
      observacionUltima === observacionesLimpias
    ) {
      return res.status(409).json({
        mensaje: 'Ya existe una evaluación reciente con el mismo resultado, score y observaciones',
        evaluacion_actual: ultimaEvaluacion
      });
    }

    let descripcionEvento = `Evaluación de vetting registrada. Resultado: ${resultadoNormalizado}. Score de riesgo: ${scoreNumero}. Historial del inquilino: ${historialReservas} solicitud(es).`;

    if (observacionesLimpias) {
      descripcionEvento += ` Observación: ${observacionesLimpias}`;
    }

    if (descripcionEvento.length > 500) {
      descripcionEvento = descripcionEvento.slice(0, 497) + '...';
    }

    const { evaluacion, evento } = await registrarEvaluacionConEventoReservaGestion({
      reserva_id: reservaIdNumero,
      evaluado_por_usuario_id: gestorId,
      score_riesgo: scoreNumero,
      historial_reservas: historialReservas,
      observaciones: observacionesLimpias || null,
      resultado: resultadoNormalizado,
      descripcion_evento: descripcionEvento
    });

    return res.status(201).json({
      mensaje: 'Evaluación simplificada del inquilino registrada correctamente',
      evaluacion,
      evento,
      advertencias: advertenciasEvaluacion,
      total_advertencias: advertenciasEvaluacion.length
    });

  } catch (error) {
    console.error('Error al registrar evaluación del inquilino:', error);

    return res.status(500).json({
      mensaje: 'Error interno al registrar evaluación del inquilino',
      error: error.message
    });
  }
};

const obtenerEvaluacionesInquilinoGestion = async (req, res) => {
  try {
    const usuarioPublicadorId = req.usuario.usuario_id;
    const { reserva_id } = req.params;

    const reservaIdNumero = Number(reserva_id);

    if (Number.isNaN(reservaIdNumero) || reservaIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    const solicitud = await obtenerSolicitudGestionPorId(
      usuarioPublicadorId,
      reservaIdNumero
    );

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'La solicitud de reserva no existe o no pertenece a tus publicaciones'
      });
    }

    const evaluaciones = await listarEvaluacionesInquilinoReservaGestion(
      usuarioPublicadorId,
      reservaIdNumero
    );

    return res.json({
      mensaje: 'Evaluaciones del inquilino obtenidas correctamente',
      reserva: {
        reserva_id: solicitud.reserva_id,
        estado_reserva: solicitud.estado_reserva,
        inquilino_id: solicitud.inquilino_id,
        inmueble_id: solicitud.inmueble_id,
        codigo_inmueble: solicitud.codigo_inmueble,
        nombre_inmueble: solicitud.nombre_inmueble,
        tipo_inmueble: solicitud.tipo_inmueble
      },
      total: evaluaciones.length,
      evaluaciones
    });

  } catch (error) {
    console.error('Error al obtener evaluaciones del inquilino:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener evaluaciones del inquilino',
      error: error.message
    });
  }
};

const obtenerResumenVettingGestion = async (req, res) => {
  try {
    const usuarioPublicadorId = req.usuario.usuario_id;

    const solicitudes = await listarSolicitudesGestionEmpresa(usuarioPublicadorId, {
      estado_reserva: null
    });

    const solicitudesConVetting = solicitudes.map((solicitud) => {
      return {
        ...solicitud,
        estado_vetting: construirEstadoVettingSolicitud(solicitud)
      };
    });

    const resumen = {
      total_solicitudes: solicitudesConVetting.length,
      pendientes_vetting: 0,
      vetting_aprobado: 0,
      vetting_observado: 0,
      vetting_rechazado: 0,
      puede_aprobar: 0,
      no_puede_aprobar: 0,
      solicitudes_solicitadas: 0,
      solicitudes_aprobadas: 0,
      solicitudes_rechazadas: 0
    };

    solicitudesConVetting.forEach((solicitud) => {
      if (solicitud.estado_reserva === 'SOLICITADA') {
        resumen.solicitudes_solicitadas += 1;
      }

      if (solicitud.estado_reserva === 'APROBADA') {
        resumen.solicitudes_aprobadas += 1;
      }

      if (solicitud.estado_reserva === 'RECHAZADA') {
        resumen.solicitudes_rechazadas += 1;
      }

      if (
        solicitud.estado_reserva === 'SOLICITADA' &&
        solicitud.estado_vetting.requiere_evaluacion
      ) {
        resumen.pendientes_vetting += 1;
      }

      if (solicitud.estado_vetting.resultado === 'APROBADO') {
        resumen.vetting_aprobado += 1;
      }

      if (solicitud.estado_vetting.resultado === 'OBSERVADO') {
        resumen.vetting_observado += 1;
      }

      if (solicitud.estado_vetting.resultado === 'RECHAZADO') {
        resumen.vetting_rechazado += 1;
      }

      if (
        solicitud.estado_reserva === 'SOLICITADA' &&
        solicitud.estado_vetting.puede_aprobar
      ) {
        resumen.puede_aprobar += 1;
      }

      if (
        solicitud.estado_reserva === 'SOLICITADA' &&
        !solicitud.estado_vetting.puede_aprobar
      ) {
        resumen.no_puede_aprobar += 1;
      }
    });

    return res.json({
      mensaje: 'Resumen de vetting obtenido correctamente',
      resumen
    });

  } catch (error) {
    console.error('Error al obtener resumen de vetting:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener resumen de vetting',
      error: error.message
    });
  }
};

const confirmarCheckinReserva = async (req, res) => {
  try {
    const usuarioPublicadorId = req.usuario.usuario_id;
    const gestorId = req.usuario.usuario_id;

    const { reserva_id } = req.params;

    const reservaIdNumero = Number(reserva_id);

    if (Number.isNaN(reservaIdNumero) || reservaIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    const solicitud = await obtenerSolicitudGestionPorId(
      usuarioPublicadorId,
      reservaIdNumero
    );

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'La reserva no existe o no pertenece a tus publicaciones'
      });
    }

    if (solicitud.inquilino_id === gestorId) {
      return res.status(403).json({
        mensaje: 'No puedes confirmar el check-in de tu propia reserva'
      });
    }

    if (solicitud.estado_reserva !== 'APROBADA') {
      return res.status(400).json({
        mensaje: 'Solo se puede confirmar check-in de una reserva APROBADA',
        estado_actual: solicitud.estado_reserva
      });
    }

    const resultado = await confirmarCheckinReservaGestion({
      usuario_publicador_id: usuarioPublicadorId,
      reserva_id: reservaIdNumero,
      gestor_id: gestorId
    });

    if (!resultado) {
      return res.status(400).json({
        mensaje: 'No se pudo confirmar el check-in. Verifica que la reserva siga en estado APROBADA'
      });
    }

    return res.json({
      mensaje: 'Check-in confirmado correctamente',
      reserva: resultado.reserva,
      evento: resultado.evento
    });

  } catch (error) {
    console.error('Error al confirmar check-in:', error);

    return res.status(500).json({
      mensaje: 'Error interno al confirmar check-in',
      error: error.message
    });
  }
};

const confirmarCheckoutReserva = async (req, res) => {
  try {
    const usuarioPublicadorId = req.usuario.usuario_id;
    const gestorId = req.usuario.usuario_id;

    const { reserva_id } = req.params;

    const reservaIdNumero = Number(reserva_id);

    if (Number.isNaN(reservaIdNumero) || reservaIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    const solicitud = await obtenerSolicitudGestionPorId(
      usuarioPublicadorId,
      reservaIdNumero
    );

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'La reserva no existe o no pertenece a tus publicaciones'
      });
    }

    if (solicitud.inquilino_id === gestorId) {
      return res.status(403).json({
        mensaje: 'No puedes confirmar el check-out de tu propia reserva'
      });
    }

    if (solicitud.estado_reserva !== 'ACTIVA') {
      return res.status(400).json({
        mensaje: 'Solo se puede confirmar check-out de una reserva ACTIVA',
        estado_actual: solicitud.estado_reserva
      });
    }

    const resultado = await confirmarCheckoutReservaGestion({
      usuario_publicador_id: usuarioPublicadorId,
      reserva_id: reservaIdNumero,
      gestor_id: gestorId
    });

    if (!resultado) {
      return res.status(400).json({
        mensaje: 'No se pudo confirmar el check-out. Verifica que la reserva siga en estado ACTIVA'
      });
    }

    return res.json({
      mensaje: 'Check-out confirmado correctamente',
      reserva: resultado.reserva,
      evento: resultado.evento
    });

  } catch (error) {
    console.error('Error al confirmar check-out:', error);

    return res.status(500).json({
      mensaje: 'Error interno al confirmar check-out',
      error: error.message
    });
  }
};

const solicitarExtensionReserva = async (req, res) => {
  try {
    const inquilinoId = req.usuario.usuario_id;

    const { reserva_id } = req.params;
    const {
      nueva_fecha_fin,
      motivo
    } = req.body;

    const reservaIdNumero = Number(reserva_id);

    if (
      Number.isNaN(reservaIdNumero) ||
      reservaIdNumero <= 0
    ) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    if (!validarFechaYYYYMMDD(nueva_fecha_fin)) {
      return res.status(400).json({
        mensaje: 'La nueva fecha de finalización debe tener formato YYYY-MM-DD'
      });
    }

    const motivoLimpio = limpiarTexto(motivo);

    if (motivoLimpio.length > 500) {
      return res.status(400).json({
        mensaje: 'El motivo de la extensión no puede superar los 500 caracteres'
      });
    }

    /*
      Busca la reserva validando al mismo tiempo que:

      - Pertenezca al usuario autenticado.
      - Se encuentre APROBADA o ACTIVA.
      - No tenga check-out confirmado.
    */
    const reserva = await obtenerReservaExtensibleInquilinoPorId(
      inquilinoId,
      reservaIdNumero
    );

    if (!reserva) {
      return res.status(404).json({
        mensaje:
          'La reserva no existe, no pertenece a tu usuario o no se encuentra disponible para solicitar una extensión'
      });
    }

    const fechaFinActual = convertirFechaAYYYYMMDD(
      reserva.fecha_fin
    );

    if (!fechaFinActual) {
      return res.status(500).json({
        mensaje: 'No se pudo interpretar la fecha final actual de la reserva'
      });
    }

    if (nueva_fecha_fin <= fechaFinActual) {
      return res.status(400).json({
        mensaje:
          'La nueva fecha de finalización debe ser posterior a la fecha final actual',
        fecha_fin_actual: fechaFinActual,
        nueva_fecha_fin
      });
    }

    /*
      No permitimos que el inquilino tenga dos solicitudes
      pendientes para la misma reserva.
    */
    const solicitudPendiente =
      await obtenerSolicitudExtensionPendientePorReserva(
        reservaIdNumero
      );

    if (solicitudPendiente) {
      return res.status(409).json({
        mensaje:
          'Ya existe una solicitud de extensión pendiente para esta reserva',
        solicitud_extension_pendiente: solicitudPendiente
      });
    }

    /*
      Se revisa solamente el periodo adicional:

      fecha_fin_actual + 1 día
      hasta nueva_fecha_fin
    */
    const conflictos = await buscarConflictosExtensionReserva({
      empresa_id: reserva.empresa_id,
      inmueble_id: reserva.inmueble_id,
      reserva_id: reserva.reserva_id,
      fecha_fin_actual: fechaFinActual,
      nueva_fecha_fin
    });

    if (
      conflictos.bloqueos.length > 0 ||
      conflictos.reservas.length > 0
    ) {
      return res.status(409).json({
        mensaje:
          'No se puede solicitar la extensión porque el inmueble no está disponible durante todo el periodo adicional',
        fecha_fin_actual: fechaFinActual,
        nueva_fecha_fin,
        bloqueos_solapados: conflictos.bloqueos,
        reservas_solapadas: conflictos.reservas
      });
    }

    const resultado = await crearSolicitudExtensionReserva({
      reserva_id: reservaIdNumero,
      solicitante_usuario_id: inquilinoId,
      nueva_fecha_fin,
      motivo: motivoLimpio || null
    });

    /*
      Puede devolver null si la reserva cambió de estado o si otra
      solicitud pendiente fue registrada simultáneamente.
    */
    if (!resultado) {
      return res.status(409).json({
        mensaje:
          'No se pudo registrar la solicitud de extensión. Verifica que la reserva siga activa o aprobada y que no exista otra solicitud pendiente'
      });
    }

    return res.status(201).json({
      mensaje: 'Solicitud de extensión enviada correctamente',
      reserva: {
        reserva_id: reserva.reserva_id,
        inmueble_id: reserva.inmueble_id,
        estado_reserva: reserva.estado_reserva,
        fecha_inicio: reserva.fecha_inicio,
        fecha_fin_actual: fechaFinActual,
        codigo_inmueble: reserva.codigo_inmueble,
        nombre_inmueble: reserva.nombre_inmueble,
        titulo_publicacion: reserva.titulo_publicacion
      },
      solicitud_extension: resultado.solicitud_extension,
      evento: resultado.evento
    });

  } catch (error) {
    console.error(
      'Error al solicitar extensión de reserva:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al solicitar la extensión de la reserva',
      error: error.message
    });
  }
};

const aprobarSolicitudExtension = async (req, res) => {
  try {
    const gestorId = req.usuario.usuario_id;
    const { solicitud_extension_id } = req.params;
    const { comentario_decision } = req.body;

    const solicitudExtensionIdNumero = Number(
      solicitud_extension_id
    );

    if (
      Number.isNaN(solicitudExtensionIdNumero) ||
      solicitudExtensionIdNumero <= 0
    ) {
      return res.status(400).json({
        mensaje:
          'El ID de la solicitud de extensión no es válido'
      });
    }

    const comentarioLimpio = limpiarTexto(
      comentario_decision
    );

    if (comentarioLimpio.length > 500) {
      return res.status(400).json({
        mensaje:
          'El comentario de decisión no puede superar los 500 caracteres'
      });
    }

    const resultado =
      await aprobarSolicitudExtensionReservaGestion({
        usuario_gestor_id: gestorId,
        solicitud_extension_id:
          solicitudExtensionIdNumero,
        comentario_decision:
          comentarioLimpio || null
      });

    if (!resultado) {
      return res.status(500).json({
        mensaje:
          'No se obtuvo una respuesta al aprobar la extensión'
      });
    }

    if (resultado.codigo === 'NO_DISPONIBLE') {
      return res.status(404).json({
        mensaje:
          'La solicitud de extensión no existe, no pertenece a tus inmuebles o ya no está pendiente'
      });
    }

    if (resultado.codigo === 'FECHA_INVALIDA') {
      return res.status(400).json({
        mensaje:
          'La nueva fecha de finalización no es válida',
        fecha_fin_actual:
          resultado.fecha_fin_actual,
        nueva_fecha_fin:
          resultado.nueva_fecha_fin
      });
    }

    if (
      resultado.codigo ===
      'CONFLICTO_DISPONIBILIDAD'
    ) {
      return res.status(409).json({
        mensaje:
          'No se puede aprobar la extensión porque el inmueble ya no está disponible durante todo el periodo adicional',
        bloqueos_solapados:
          resultado.bloqueos || [],
        reservas_solapadas:
          resultado.reservas || []
      });
    }

    if (
      resultado.codigo ===
      'RESERVA_NO_ACTUALIZADA'
    ) {
      return res.status(409).json({
        mensaje:
          'La solicitud fue encontrada, pero la reserva ya no puede ser extendida'
      });
    }

    if (resultado.codigo !== 'OK') {
      return res.status(400).json({
        mensaje:
          'No se pudo aprobar la solicitud de extensión'
      });
    }

    return res.json({
      mensaje:
        'Solicitud de extensión aprobada correctamente',
      solicitud_extension:
        resultado.solicitud_extension,
      reserva: resultado.reserva,
      evento: resultado.evento
    });

  } catch (error) {
    console.error(
      'Error al aprobar solicitud de extensión:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al aprobar la solicitud de extensión',
      error: error.message
    });
  }
};

const rechazarSolicitudExtension = async (
  req,
  res
) => {
  try {
    const gestorId = req.usuario.usuario_id;
    const { solicitud_extension_id } = req.params;
    const { comentario_decision } = req.body;

    const solicitudExtensionIdNumero = Number(
      solicitud_extension_id
    );

    if (
      Number.isNaN(solicitudExtensionIdNumero) ||
      solicitudExtensionIdNumero <= 0
    ) {
      return res.status(400).json({
        mensaje:
          'El ID de la solicitud de extensión no es válido'
      });
    }

    const comentarioLimpio = limpiarTexto(
      comentario_decision
    );

    if (!comentarioLimpio) {
      return res.status(400).json({
        mensaje:
          'Debes ingresar el motivo del rechazo'
      });
    }

    if (comentarioLimpio.length > 500) {
      return res.status(400).json({
        mensaje:
          'El motivo del rechazo no puede superar los 500 caracteres'
      });
    }

    const resultado =
      await rechazarSolicitudExtensionReservaGestion({
        usuario_gestor_id: gestorId,
        solicitud_extension_id:
          solicitudExtensionIdNumero,
        comentario_decision:
          comentarioLimpio
      });

    if (!resultado) {
      return res.status(404).json({
        mensaje:
          'La solicitud de extensión no existe, no pertenece a tus inmuebles o ya no está pendiente'
      });
    }

    return res.json({
      mensaje:
        'Solicitud de extensión rechazada correctamente',
      solicitud_extension:
        resultado.solicitud_extension,
      evento: resultado.evento
    });

  } catch (error) {
    console.error(
      'Error al rechazar solicitud de extensión:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al rechazar la solicitud de extensión',
      error: error.message
    });
  }
};

const cancelarReservaInquilino = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const usuario_id = req.usuario.usuario_id;
    const reserva_id = Number(req.params.reserva_id);

    const { motivo } = req.body;

    if (!reserva_id || Number.isNaN(reserva_id)) {
      return res.status(400).json({
        mensaje: 'El ID de la reserva no es válido'
      });
    }

    const reserva = await obtenerReservaParaCancelacionInquilino(
  reserva_id,
  usuario_id
);

    if (!reserva) {
      return res.status(404).json({
        mensaje: 'No se encontró la reserva o no pertenece al inquilino autenticado'
      });
    }

    const estadosCancelables = ['SOLICITADA', 'APROBADA'];

    if (!estadosCancelables.includes(reserva.estado_reserva)) {
      return res.status(400).json({
        mensaje: `La reserva no puede cancelarse porque se encuentra en estado ${reserva.estado_reserva}`
      });
    }

    const reservaCancelada = await cancelarReservaPorInquilino({
  reserva_id,
  usuario_id,
  motivo: motivo?.trim() || null
});

    let notificacionCreada = null;

        if (reserva.anfitrion_usuario_id) {
      notificacionCreada = await crearNotificacion({
        empresa_id: reserva.empresa_id,
        usuario_origen_id: usuario_id,
        usuario_destino_id: reserva.anfitrion_usuario_id,
        tipo_notificacion: 'RESERVA_CANCELADA_INQUILINO',
        titulo: 'Reserva cancelada',
        mensaje: `El inquilino canceló la reserva del inmueble ${reserva.nombre_inmueble || reserva.codigo_inmueble || ''}.`,
        referencia_tipo: 'RESERVA',
        referencia_id: reserva_id
      });
    }

    return res.status(200).json({
      mensaje: 'Reserva cancelada correctamente',
      reserva: reservaCancelada,
      notificacion: notificacionCreada
    });

  } catch (error) {
    console.error('Error al cancelar reserva:', error);

    return res.status(500).json({
      mensaje: 'Error interno al cancelar la reserva',
      error: error.message
    });
  }
};


module.exports = {
  solicitarReserva,
  obtenerMisSolicitudesReserva,
  obtenerSolicitudesGestion,
  aprobarSolicitudReserva,
  rechazarSolicitudReserva,
  obtenerEventosReservaGestion,
  obtenerDetalleMiSolicitudReserva,
  obtenerVettingInquilinoGestion,
  registrarEvaluacionInquilinoGestion,
  obtenerEvaluacionesInquilinoGestion,
  obtenerResumenVettingGestion,
  confirmarCheckinReserva,
  confirmarCheckoutReserva,
  solicitarExtensionReserva,
  aprobarSolicitudExtension,
  rechazarSolicitudExtension,
  cancelarReservaInquilino
};