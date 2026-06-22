const {
  listarUsuariosPorEmpresa,
  buscarUsuarioPorIdYEmpresa,
  inactivarUsuarioEmpresa,
  reactivarUsuarioEmpresa
} = require('../models/admin.model');
const obtenerUsuariosEmpresa = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa_id;

    const usuarios = await listarUsuariosPorEmpresa(empresaId);

    return res.json({
      mensaje: 'Usuarios obtenidos correctamente',
      total: usuarios.length,
      usuarios
    });

  } catch (error) {
    console.error('Error al obtener usuarios admin:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener usuarios',
      error: error.message
    });
  }
};

const inactivarUsuario = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa_id;
    const usuarioAdminId = req.usuario.usuario_id;
    const { usuario_id } = req.params;

    const usuarioIdNumero = Number(usuario_id);

    if (Number.isNaN(usuarioIdNumero) || usuarioIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del usuario no es válido'
      });
    }

    if (usuarioIdNumero === usuarioAdminId) {
      return res.status(400).json({
        mensaje: 'No puedes inactivar tu propia cuenta administradora'
      });
    }

    const usuario = await buscarUsuarioPorIdYEmpresa(usuarioIdNumero, empresaId);

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'El usuario no existe o no pertenece a tu empresa'
      });
    }

    if (!usuario.activo || usuario.estado === 'INACTIVO') {
      return res.status(400).json({
        mensaje: 'El usuario ya se encuentra inactivo'
      });
    }

    const usuarioActualizado = await inactivarUsuarioEmpresa(usuarioIdNumero, empresaId);

    return res.json({
      mensaje: 'Usuario inactivado correctamente',
      usuario: usuarioActualizado
    });

  } catch (error) {
    console.error('Error al inactivar usuario:', error);

    return res.status(500).json({
      mensaje: 'Error interno al inactivar usuario',
      error: error.message
    });
  }
};

const reactivarUsuario = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa_id;
    const { usuario_id } = req.params;

    const usuarioIdNumero = Number(usuario_id);

    if (Number.isNaN(usuarioIdNumero) || usuarioIdNumero <= 0) {
      return res.status(400).json({
        mensaje: 'El ID del usuario no es válido'
      });
    }

    const usuario = await buscarUsuarioPorIdYEmpresa(usuarioIdNumero, empresaId);

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'El usuario no existe o no pertenece a tu empresa'
      });
    }

    if (usuario.activo && usuario.estado === 'ACTIVO') {
      return res.status(400).json({
        mensaje: 'El usuario ya se encuentra activo'
      });
    }

    const usuarioActualizado = await reactivarUsuarioEmpresa(usuarioIdNumero, empresaId);

    return res.json({
      mensaje: 'Usuario reactivado correctamente',
      usuario: usuarioActualizado
    });

  } catch (error) {
    console.error('Error al reactivar usuario:', error);

    return res.status(500).json({
      mensaje: 'Error interno al reactivar usuario',
      error: error.message
    });
  }
};

module.exports = {
  obtenerUsuariosEmpresa,
  inactivarUsuario,
  reactivarUsuario
};