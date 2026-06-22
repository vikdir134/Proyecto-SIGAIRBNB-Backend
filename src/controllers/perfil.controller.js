const {
  obtenerPerfilPorUsuarioId,
  actualizarPerfilBasico,
  actualizarNotificaciones
} = require('../models/perfil.model');

const obtenerMiPerfil = async (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;

    const perfil = await obtenerPerfilPorUsuarioId(usuarioId);

    if (!perfil) {
      return res.status(404).json({
        mensaje: 'Perfil no encontrado'
      });
    }

    return res.json({
      mensaje: 'Perfil obtenido correctamente',
      perfil
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener el perfil',
      error: error.message
    });
  }
};

const actualizarMiPerfil = async (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;

    const {
      nombres,
      apellidos,
      telefono,
      foto_url,
      biografia,
      direccion,
      distrito,
      ciudad,
      pais
    } = req.body;

    if (!nombres || !apellidos) {
      return res.status(400).json({
        mensaje: 'Nombres y apellidos son obligatorios'
      });
    }

    if (nombres.trim().length < 2) {
      return res.status(400).json({
        mensaje: 'El nombre debe tener como mínimo 2 caracteres'
      });
    }

    if (apellidos.trim().length < 2) {
      return res.status(400).json({
        mensaje: 'El apellido debe tener como mínimo 2 caracteres'
      });
    }

    const perfilActualizado = await actualizarPerfilBasico({
      usuario_id: usuarioId,
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      telefono: telefono ? telefono.trim() : null,
      foto_url: foto_url ? foto_url.trim() : null,
      biografia: biografia ? biografia.trim() : null,
      direccion: direccion ? direccion.trim() : null,
      distrito: distrito ? distrito.trim() : null,
      ciudad: ciudad ? ciudad.trim() : null,
      pais: pais ? pais.trim() : 'Perú'
    });

    if (!perfilActualizado) {
      return res.status(404).json({
        mensaje: 'No se pudo actualizar el perfil. Verifica que el usuario esté activo y verificado'
      });
    }

    return res.json({
      mensaje: 'Perfil actualizado correctamente',
      perfil: perfilActualizado
    });

  } catch (error) {
    console.error('Error al actualizar perfil:', error);

    return res.status(500).json({
      mensaje: 'Error interno al actualizar el perfil',
      error: error.message
    });
  }
};

const actualizarMisNotificaciones = async (req, res) => {
  try {
    const usuarioId = req.usuario.usuario_id;

    const {
      recibe_notif_email,
      recibe_notif_push,
      recibe_notif_sms
    } = req.body;

    if (
      typeof recibe_notif_email !== 'boolean' ||
      typeof recibe_notif_push !== 'boolean' ||
      typeof recibe_notif_sms !== 'boolean'
    ) {
      return res.status(400).json({
        mensaje: 'Las preferencias de notificación deben ser valores booleanos'
      });
    }

    const perfilActualizado = await actualizarNotificaciones({
      usuario_id: usuarioId,
      recibe_notif_email,
      recibe_notif_push,
      recibe_notif_sms
    });

    if (!perfilActualizado) {
      return res.status(404).json({
        mensaje: 'No se pudieron actualizar las notificaciones. Verifica que el usuario esté activo y verificado'
      });
    }

    return res.json({
      mensaje: 'Notificaciones actualizadas correctamente',
      perfil: perfilActualizado
    });

  } catch (error) {
    console.error('Error al actualizar notificaciones:', error);

    return res.status(500).json({
      mensaje: 'Error interno al actualizar las notificaciones',
      error: error.message
    });
  }
};

module.exports = {
  obtenerMiPerfil,
  actualizarMiPerfil,
  actualizarMisNotificaciones
};