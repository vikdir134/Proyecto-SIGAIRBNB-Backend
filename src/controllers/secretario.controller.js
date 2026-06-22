const {
  asignarSecretarioEmpresaPorCorreo,
  listarSecretariosEmpresa,
  revocarSecretarioEmpresa,
   eliminarAsignacionSecretarioRevocada,
  reactivarSecretarioEmpresa
} = require('../models/secretario.model');

const normalizarCorreo = (valor) => {
  return String(valor || '')
    .trim()
    .toLowerCase();
};

const correoEsValido = (correo) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
};

const asignarSecretario = async (req, res) => {
  try {
    const administrador_id = Number(req.usuario?.usuario_id);
    const empresa_id = Number(req.usuario?.empresa_id);

    const correo_secretario = normalizarCorreo(
      req.body?.correo
    );

    if (
      !Number.isInteger(administrador_id) ||
      administrador_id <= 0
    ) {
      return res.status(401).json({
        mensaje: 'No se pudo identificar al usuario autenticado'
      });
    }

    if (
      !Number.isInteger(empresa_id) ||
      empresa_id <= 0
    ) {
      return res.status(400).json({
        mensaje:
          'El administrador no tiene una empresa válida asociada'
      });
    }

    if (!correo_secretario) {
      return res.status(400).json({
        mensaje:
          'El correo del secretario es obligatorio'
      });
    }

    if (!correoEsValido(correo_secretario)) {
      return res.status(400).json({
        mensaje:
          'El correo del secretario no tiene un formato válido'
      });
    }

    const resultado =
      await asignarSecretarioEmpresaPorCorreo({
        empresa_id,
        administrador_id,
        correo_secretario
      });

    if (!resultado.ok) {
     const estadosPorCodigo = {
  ADMIN_NO_VALIDO: 403,
  USUARIO_NO_ENCONTRADO: 404,
  AUTO_ASIGNACION: 400,
  USUARIO_NO_HABILITADO: 409,
  USUARIO_YA_ES_ADMIN: 409,
  USUARIO_YA_ES_SECRETARIO: 409,
  USUARIO_YA_ASIGNADO_COMO_SECRETARIO: 409,
  ROL_NO_DISPONIBLE: 500
};

      const estadoHttp =
        estadosPorCodigo[resultado.codigo] || 400;

      return res.status(estadoHttp).json({
        mensaje: resultado.mensaje,
        codigo: resultado.codigo
      });
    }

    return res.status(200).json({
      mensaje: 'Secretario asignado correctamente',
      asignacion: resultado.asignacion
    });
  } catch (error) {
    console.error(
      'Error al asignar secretario:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Ocurrió un error al asignar el secretario'
    });
  }
};

const obtenerSecretariosEmpresa = async (req, res) => {
  try {
    const empresa_id = Number(req.usuario?.empresa_id);

    if (
      !Number.isInteger(empresa_id) ||
      empresa_id <= 0
    ) {
      return res.status(400).json({
        mensaje:
          'El administrador no tiene una empresa válida asociada'
      });
    }

    const secretarios = await listarSecretariosEmpresa({
      empresa_id
    });

    return res.status(200).json({
      mensaje: 'Secretarios obtenidos correctamente',
      cantidad: secretarios.length,
      secretarios
    });
  } catch (error) {
    console.error(
      'Error al obtener secretarios:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Ocurrió un error al obtener los secretarios de la empresa'
    });
  }
};

const revocarSecretario = async (req, res) => {
  try {
    const empresa_id = Number(req.usuario?.empresa_id);

    const empresa_secretario_id = Number(
      req.params.empresa_secretario_id
    );

    if (
      !Number.isInteger(empresa_id) ||
      empresa_id <= 0
    ) {
      return res.status(400).json({
        mensaje:
          'El administrador no tiene una empresa válida asociada'
      });
    }

    if (
      !Number.isInteger(empresa_secretario_id) ||
      empresa_secretario_id <= 0
    ) {
      return res.status(400).json({
        mensaje:
          'El identificador de la asignación no es válido'
      });
    }

    const resultado = await revocarSecretarioEmpresa({
      empresa_id,
      empresa_secretario_id
    });

    if (!resultado.ok) {
      const estadosPorCodigo = {
        ASIGNACION_NO_ENCONTRADA: 404,
        ASIGNACION_YA_REVOCADA: 409
      };

      return res
        .status(estadosPorCodigo[resultado.codigo] || 400)
        .json({
          mensaje: resultado.mensaje,
          codigo: resultado.codigo
        });
    }

    return res.status(200).json({
      mensaje:
        'Acceso del secretario revocado correctamente',
      asignacion: resultado.asignacion,
      rol_secretario_removido:
        resultado.rol_secretario_removido
    });
  } catch (error) {
    console.error(
      'Error al revocar secretario:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Ocurrió un error al revocar el acceso del secretario'
    });
  }
};

const eliminarSecretarioRevocado = async (req, res) => {
  try {
    const empresa_id = Number(req.usuario?.empresa_id);

    const empresa_secretario_id = Number(
      req.params.empresa_secretario_id
    );

    if (
      !Number.isInteger(empresa_id) ||
      empresa_id <= 0
    ) {
      return res.status(400).json({
        mensaje:
          'El administrador no tiene una empresa válida asociada'
      });
    }

    if (
      !Number.isInteger(empresa_secretario_id) ||
      empresa_secretario_id <= 0
    ) {
      return res.status(400).json({
        mensaje:
          'El identificador de la asignación no es válido'
      });
    }

    const resultado =
      await eliminarAsignacionSecretarioRevocada({
        empresa_id,
        empresa_secretario_id
      });

    if (!resultado.ok) {
      const estadosPorCodigo = {
        ASIGNACION_NO_ENCONTRADA: 404,
        ASIGNACION_ACTIVA_NO_ELIMINABLE: 409
      };

      return res
        .status(estadosPorCodigo[resultado.codigo] || 400)
        .json({
          mensaje: resultado.mensaje,
          codigo: resultado.codigo
        });
    }

    return res.status(200).json({
      mensaje:
        'Secretario revocado quitado de la lista correctamente',
      asignacion: resultado.asignacion
    });
  } catch (error) {
    console.error(
      'Error al quitar secretario revocado:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Ocurrió un error al quitar el secretario revocado'
    });
  }
};

const reactivarSecretario = async (req, res) => {
  try {
    const empresa_id = Number(req.usuario?.empresa_id);
    const administrador_id = Number(req.usuario?.usuario_id);

    const empresa_secretario_id = Number(
      req.params.empresa_secretario_id
    );

    if (
      !Number.isInteger(empresa_id) ||
      empresa_id <= 0
    ) {
      return res.status(400).json({
        mensaje:
          'El administrador no tiene una empresa válida asociada'
      });
    }

    if (
      !Number.isInteger(administrador_id) ||
      administrador_id <= 0
    ) {
      return res.status(401).json({
        mensaje:
          'No se pudo identificar al administrador'
      });
    }

    if (
      !Number.isInteger(empresa_secretario_id) ||
      empresa_secretario_id <= 0
    ) {
      return res.status(400).json({
        mensaje:
          'El identificador de la asignación no es válido'
      });
    }

    const resultado = await reactivarSecretarioEmpresa({
      empresa_id,
      empresa_secretario_id,
      administrador_id
    });

    if (!resultado.ok) {
      const estadosPorCodigo = {
        ASIGNACION_NO_ENCONTRADA: 404,
        ASIGNACION_YA_ACTIVA: 409,
        ROL_NO_DISPONIBLE: 500
      };

      return res
        .status(estadosPorCodigo[resultado.codigo] || 400)
        .json({
          mensaje: resultado.mensaje,
          codigo: resultado.codigo
        });
    }

    return res.status(200).json({
      mensaje:
        'Acceso del secretario reactivado correctamente',
      asignacion: resultado.asignacion
    });
  } catch (error) {
    console.error(
      'Error al reactivar secretario:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Ocurrió un error al reactivar el acceso del secretario'
    });
  }
};

module.exports = {
  asignarSecretario,
  obtenerSecretariosEmpresa,
  revocarSecretario,
  eliminarSecretarioRevocado,
  reactivarSecretario
};