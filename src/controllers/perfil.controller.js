const {
  obtenerPerfilPorUsuarioId,
  actualizarPerfilBasico,
  actualizarNotificaciones
} = require('../models/perfil.model');

const {
  cleanOptionalText,
  cleanText,
  isValidPersonName,
  isValidPhone,
  isValidUrl,
  onlyDigits,
  validateTextLength
} = require('../utils/validationHelpers');

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

    const nombresLimpios = cleanText(nombres);
    const apellidosLimpios = cleanText(apellidos);
    const telefonoLimpio = telefono ? onlyDigits(telefono) : null;
    const fotoUrlLimpia = cleanOptionalText(foto_url);
    const errores = [];

    if (!nombresLimpios || !apellidosLimpios) {
      return res.status(400).json({
        mensaje: 'Nombres y apellidos son obligatorios'
      });
    }

    if (nombresLimpios.length < 2) {
      return res.status(400).json({
        mensaje: 'El nombre debe tener como mínimo 2 caracteres'
      });
    }

    if (apellidosLimpios.length < 2) {
      return res.status(400).json({
        mensaje: 'El apellido debe tener como mínimo 2 caracteres'
      });
    }

    if (!isValidPersonName(nombresLimpios) || !isValidPersonName(apellidosLimpios)) {
      errores.push('Nombres y apellidos deben contener solo letras y tener entre 2 y 80 caracteres.');
    }

    if (!isValidPhone(telefonoLimpio)) {
      errores.push('El teléfono debe contener entre 7 y 15 dígitos y no puede ser un número repetido.');
    }

    if (!isValidUrl(fotoUrlLimpia)) {
      errores.push('La URL de foto debe iniciar con http:// o https://.');
    }

    validateTextLength(biografia, 500, 'La biografía', errores);
    validateTextLength(direccion, 255, 'La dirección', errores);
    validateTextLength(distrito, 100, 'El distrito', errores);
    validateTextLength(ciudad, 100, 'La ciudad', errores);
    validateTextLength(pais, 80, 'El país', errores);

    if (errores.length > 0) {
      return res.status(400).json({
        mensaje: 'Datos inválidos.',
        errores
      });
    }

    const perfilActualizado = await actualizarPerfilBasico({
      usuario_id: usuarioId,
      nombres: nombresLimpios,
      apellidos: apellidosLimpios,
      telefono: telefonoLimpio,
      foto_url: fotoUrlLimpia,
      biografia: cleanOptionalText(biografia),
      direccion: cleanOptionalText(direccion),
      distrito: cleanOptionalText(distrito),
      ciudad: cleanOptionalText(ciudad),
      pais: cleanText(pais) || 'Perú'
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
