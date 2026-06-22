const {
  listarNotificacionesUsuario,
  contarNotificacionesNoLeidas,
  marcarNotificacionComoLeida,
  marcarTodasNotificacionesComoLeidas
} = require('../models/notificacion.model');

const obtenerMisNotificaciones = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const usuario_id = req.usuario.usuario_id;

    const limite = Number(req.query.limite) || 10;

    const notificaciones = await listarNotificacionesUsuario(
      empresa_id,
      usuario_id,
      limite
    );

    return res.status(200).json({
      mensaje: 'Notificaciones obtenidas correctamente',
      notificaciones
    });

  } catch (error) {
    console.error('Error al obtener notificaciones:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener notificaciones',
      error: error.message
    });
  }
};

const obtenerContadorNoLeidas = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const usuario_id = req.usuario.usuario_id;

    const total = await contarNotificacionesNoLeidas(empresa_id, usuario_id);

    return res.status(200).json({
      mensaje: 'Contador de notificaciones obtenido correctamente',
      total_no_leidas: total
    });

  } catch (error) {
    console.error('Error al obtener contador de notificaciones:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener contador de notificaciones',
      error: error.message
    });
  }
};

const marcarComoLeida = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const usuario_id = req.usuario.usuario_id;
    const notificacion_id = Number(req.params.notificacion_id);

    if (!notificacion_id || Number.isNaN(notificacion_id)) {
      return res.status(400).json({
        mensaje: 'El ID de la notificación no es válido'
      });
    }

    const notificacion = await marcarNotificacionComoLeida(
      empresa_id,
      usuario_id,
      notificacion_id
    );

    if (!notificacion) {
      return res.status(404).json({
        mensaje: 'No se encontró la notificación o no pertenece al usuario autenticado'
      });
    }

    return res.status(200).json({
      mensaje: 'Notificación marcada como leída',
      notificacion
    });

  } catch (error) {
    console.error('Error al marcar notificación como leída:', error);

    return res.status(500).json({
      mensaje: 'Error interno al marcar notificación como leída',
      error: error.message
    });
  }
};

const marcarTodasComoLeidas = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const usuario_id = req.usuario.usuario_id;

    const totalActualizadas = await marcarTodasNotificacionesComoLeidas(
      empresa_id,
      usuario_id
    );

    return res.status(200).json({
      mensaje: 'Todas las notificaciones fueron marcadas como leídas',
      total_actualizadas: totalActualizadas
    });

  } catch (error) {
    console.error('Error al marcar todas las notificaciones como leídas:', error);

    return res.status(500).json({
      mensaje: 'Error interno al marcar todas las notificaciones como leídas',
      error: error.message
    });
  }
};

module.exports = {
  obtenerMisNotificaciones,
  obtenerContadorNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas
};