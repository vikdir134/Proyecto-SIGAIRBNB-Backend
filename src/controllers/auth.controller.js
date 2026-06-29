/*auth.controller.js*/
const bcrypt = require('bcryptjs');

const jwt = require('jsonwebtoken');

const {
  buscarUsuarioPorCorreo,
  registrarUsuario,
  obtenerRolesUsuario,
  actualizarUltimoAcceso,
  obtenerUsuarioConPerfil,
  crearTokenVerificacionEmail,
  verificarTokenEmail,
  crearTokenRecuperacionPassword,
restablecerPasswordConToken
} = require('../models/auth.model');

const {
  enviarCorreoVerificacion,
  enviarCorreoRecuperacionPassword
} = require('../services/email.service');

const {
  cleanText,
  isStrongPassword,
  isValidEmail,
  isValidPersonName
} = require('../utils/validationHelpers');

const registrar = async (req, res) => {
  try {
    const {
      nombres,
      apellidos,
      correo,
      password,
      acepta_terminos
    } = req.body;

    const nombresLimpios = cleanText(nombres);
    const apellidosLimpios = cleanText(apellidos);
    const correoNormalizado = cleanText(correo).toLowerCase();

    if (!nombresLimpios || !apellidosLimpios || !correoNormalizado || !password) {
      return res.status(400).json({
        mensaje: 'Nombres, apellidos, correo y contraseña son obligatorios'
      });
    }

    if (!isValidPersonName(nombresLimpios) || !isValidPersonName(apellidosLimpios)) {
      return res.status(400).json({
        mensaje: 'Nombres y apellidos deben contener solo letras y tener entre 2 y 80 caracteres'
      });
    }

    if (!isValidEmail(correoNormalizado)) {
      return res.status(400).json({
        mensaje: 'El correo electrónico no tiene un formato válido'
      });
    }

    if (!acepta_terminos) {
      return res.status(400).json({
        mensaje: 'Debe aceptar los términos y condiciones'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        mensaje: 'La contraseña debe tener como mínimo 6 caracteres'
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número'
      });
    }

    const usuarioExistente = await buscarUsuarioPorCorreo(correoNormalizado);

    if (usuarioExistente) {
      return res.status(409).json({
        mensaje: 'El correo ya está registrado'
      });
    }

        const passwordHash = await bcrypt.hash(password, 10);

    const usuarioCreado = await registrarUsuario({
      correo: correoNormalizado,
      password_hash: passwordHash,
      nombres: nombresLimpios,
      apellidos: apellidosLimpios,
      acepta_terminos
    });
    const tokenVerificacion = await crearTokenVerificacionEmail(usuarioCreado.usuario_id);

        await enviarCorreoVerificacion({
        correo: correoNormalizado,
        nombres: nombresLimpios,
        token: tokenVerificacion
        });

    return res.status(201).json({
    mensaje: 'Usuario registrado correctamente. Revisa tu correo para verificar tu cuenta.',
    usuario: {
        usuario_id: usuarioCreado.usuario_id,
        empresa_id: usuarioCreado.empresa_id,
        correo: usuarioCreado.correo,
        estado: usuarioCreado.estado,
        email_verificado: usuarioCreado.email_verificado
    }
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);

    return res.status(500).json({
      mensaje: 'Error interno al registrar usuario',
      error: error.message
    });
  }
};
// Funcion de login
const login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({
        mensaje: 'Correo y contraseña son obligatorios'
      });
    }

    const correoNormalizado = cleanText(correo).toLowerCase();

    if (!isValidEmail(correoNormalizado)) {
      return res.status(400).json({
        mensaje: 'El correo electrónico no tiene un formato válido'
      });
    }

    const usuario = await buscarUsuarioPorCorreo(correoNormalizado);

    if (!usuario) {
      return res.status(401).json({
        mensaje: 'Credenciales incorrectas'
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        mensaje: 'El usuario se encuentra inactivo'
      });
    }

    if (usuario.estado === 'BLOQUEADO') {
      return res.status(403).json({
        mensaje: 'El usuario se encuentra bloqueado'
      });
    }
    if (!usuario.email_verificado) {
    return res.status(403).json({
        mensaje: 'Debes verificar tu correo electrónico antes de iniciar sesión'
    });
    }

    if (usuario.estado !== 'ACTIVO') {
    return res.status(403).json({
        mensaje: 'Tu cuenta aún no está activa. Verifica tu correo electrónico'
    });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValido) {
      return res.status(401).json({
        mensaje: 'Credenciales incorrectas'
      });
    }

    const roles = await obtenerRolesUsuario(usuario.usuario_id);

    const token = jwt.sign(
      {
        usuario_id: usuario.usuario_id,
        empresa_id: usuario.empresa_id,
        correo: usuario.correo,
        roles
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '2h'
      }
    );

    await actualizarUltimoAcceso(usuario.usuario_id);

    return res.json({
      mensaje: 'Login correcto',
      token,
      usuario: {
        usuario_id: usuario.usuario_id,
        empresa_id: usuario.empresa_id,
        correo: usuario.correo,
        estado: usuario.estado,
        email_verificado: usuario.email_verificado,
        roles
      }
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);

    return res.status(500).json({
      mensaje: 'Error interno al iniciar sesión',
      error: error.message
    });
  }
};

const obtenerMiPerfil = async (req, res) => {
  try {
    const usuarioPerfil = await obtenerUsuarioConPerfil(req.usuario.usuario_id);

    if (!usuarioPerfil) {
      return res.status(404).json({
        mensaje: 'Usuario no encontrado'
      });
    }

    const roles = await obtenerRolesUsuario(req.usuario.usuario_id);

    return res.json({
      mensaje: 'Perfil obtenido correctamente',
      usuario: {
        usuario_id: usuarioPerfil.usuario_id,
        correo: usuarioPerfil.correo,
        estado: usuarioPerfil.estado,
        email_verificado: usuarioPerfil.email_verificado,
        acepta_terminos: usuarioPerfil.acepta_terminos,
        ultimo_acceso: usuarioPerfil.ultimo_acceso,
        roles,
        perfil: {
          perfil_usuario_id: usuarioPerfil.perfil_usuario_id,
          nombres: usuarioPerfil.nombres,
          apellidos: usuarioPerfil.apellidos,
          telefono: usuarioPerfil.telefono,
          tipo_documento: usuarioPerfil.tipo_documento,
          numero_documento: usuarioPerfil.numero_documento,
          fecha_nacimiento: usuarioPerfil.fecha_nacimiento,
          sexo: usuarioPerfil.sexo,
          foto_url: usuarioPerfil.foto_url,
          biografia: usuarioPerfil.biografia,
          direccion: usuarioPerfil.direccion,
          distrito: usuarioPerfil.distrito,
          ciudad: usuarioPerfil.ciudad,
          pais: usuarioPerfil.pais,
          recibe_notif_email: usuarioPerfil.recibe_notif_email,
          recibe_notif_push: usuarioPerfil.recibe_notif_push,
          recibe_notif_sms: usuarioPerfil.recibe_notif_sms
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener mi perfil:', error);

    return res.status(500).json({
      mensaje: 'Error al obtener el perfil del usuario',
      error: error.message
    });
  }
};
const verificarEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        mensaje: 'El token de verificación es obligatorio'
      });
    }

    const resultado = await verificarTokenEmail(token);

    if (!resultado.ok) {
      return res.status(400).json({
        mensaje: resultado.mensaje
      });
    }

    return res.json({
      mensaje: resultado.mensaje
    });

  } catch (error) {
    console.error('Error al verificar email:', error);

    return res.status(500).json({
      mensaje: 'Error interno al verificar email',
      error: error.message
    });
  }
};

const solicitarRecuperacionPassword = async (req, res) => {
  try {
    const { correo } = req.body;

    if (!correo) {
      return res.status(400).json({
        mensaje: 'El correo electrónico es obligatorio'
      });
    }

    const correoNormalizado = cleanText(correo).toLowerCase();

    if (!isValidEmail(correoNormalizado)) {
      return res.status(400).json({
        mensaje: 'El correo electrónico no tiene un formato válido'
      });
    }

    const usuario = await buscarUsuarioPorCorreo(correoNormalizado);

    /*
      Por seguridad, aunque el correo no exista,
      respondemos con un mensaje general.
    */
    if (!usuario) {
      return res.json({
        mensaje: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña'
      });
    }

    const token = await crearTokenRecuperacionPassword(usuario.usuario_id);

    await enviarCorreoRecuperacionPassword({
      correo: usuario.correo,
      token
    });

    return res.json({
      mensaje: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña'
    });

  } catch (error) {
    console.error('Error al solicitar recuperación de contraseña:', error);

    return res.status(500).json({
      mensaje: 'Error interno al solicitar recuperación de contraseña',
      error: error.message
    });
  }
};

const restablecerPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        mensaje: 'Token y nueva contraseña son obligatorios'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        mensaje: 'La contraseña debe tener como mínimo 6 caracteres'
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const resultado = await restablecerPasswordConToken({
      token,
      password_hash: passwordHash
    });

    if (!resultado.ok) {
      return res.status(400).json({
        mensaje: resultado.mensaje
      });
    }

    return res.json({
      mensaje: resultado.mensaje
    });

  } catch (error) {
    console.error('Error al restablecer contraseña:', error);

    return res.status(500).json({
      mensaje: 'Error interno al restablecer contraseña',
      error: error.message
    });
  }
};

module.exports = {
  registrar,
  login,
  obtenerMiPerfil,
  verificarEmail,
  solicitarRecuperacionPassword,
  restablecerPassword
};
