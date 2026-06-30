const {
  obtenerResumenFinancieroMensual,
  obtenerDetalleMovimientosMensuales
} = require('../models/reporte.model');

const obtenerUsuarioRequest = (req) => {
  return req.usuario || req.user || null;
};

const obtenerRolesUsuario = (usuario) => {
  if (!usuario) return [];

  const posiblesRoles = usuario.roles || usuario.rol || usuario.nombre_rol || [];

  if (Array.isArray(posiblesRoles)) {
    return posiblesRoles
      .map((rol) => {
        if (typeof rol === 'string') return rol;
        return rol.nombre || rol.nombre_rol || rol.rol || '';
      })
      .filter(Boolean)
      .map((rol) => rol.toUpperCase());
  }

  if (typeof posiblesRoles === 'string') {
    return [posiblesRoles.toUpperCase()];
  }

  return [];
};

const usuarioTieneRolPermitido = (usuario) => {
  const roles = obtenerRolesUsuario(usuario);

  return roles.some((rol) =>
    ['SECRETARIO', 'ADMIN', 'ADMIN_EMPRESA'].includes(rol)
  );
};

const validarFiltrosReporte = (anio, mes) => {
  const anioNumber = Number(anio);
  const mesNumber = Number(mes);

  if (!anio || Number.isNaN(anioNumber)) {
    return {
      valido: false,
      mensaje: 'El año es obligatorio y debe ser numérico.'
    };
  }

  if (!mes || Number.isNaN(mesNumber)) {
    return {
      valido: false,
      mensaje: 'El mes es obligatorio y debe ser numérico.'
    };
  }

  if (!Number.isInteger(anioNumber) || anioNumber < 2000 || anioNumber > 2100) {
    return {
      valido: false,
      mensaje: 'El año debe ser válido.'
    };
  }

  if (!Number.isInteger(mesNumber) || mesNumber < 1 || mesNumber > 12) {
    return {
      valido: false,
      mensaje: 'El mes debe estar entre 1 y 12.'
    };
  }

  return {
    valido: true,
    anio: anioNumber,
    mes: mesNumber
  };
};

const obtenerReporteFinancieroMensual = async (req, res) => {
  try {
    const usuario = obtenerUsuarioRequest(req);

    if (!usuario) {
      return res.status(401).json({
        message: 'Usuario no autenticado.'
      });
    }

    if (!usuarioTieneRolPermitido(usuario)) {
      return res.status(403).json({
        message: 'No tiene permisos para consultar reportes financieros.'
      });
    }

    const empresaId = usuario.empresa_id;

    if (!empresaId) {
      return res.status(400).json({
        message: 'El usuario no tiene una empresa asociada.'
      });
    }

    const validacion = validarFiltrosReporte(req.query.anio, req.query.mes);

    if (!validacion.valido) {
      return res.status(400).json({
        message: validacion.mensaje
      });
    }

    const resumen = await obtenerResumenFinancieroMensual(
      empresaId,
      validacion.anio,
      validacion.mes
    );

    const totalIngresos = Number(resumen?.total_ingresos || 0);
    const totalGastos = Number(resumen?.total_gastos || 0);
    const balanceNeto = Number(resumen?.balance_neto || 0);

    return res.json({
      message: 'Reporte financiero mensual obtenido correctamente.',
      data: {
        anio: validacion.anio,
        mes: validacion.mes,
        total_ingresos: totalIngresos,
        total_gastos: totalGastos,
        balance_neto: balanceNeto,
        estado_balance:
          balanceNeto > 0 ? 'POSITIVO' : balanceNeto < 0 ? 'NEGATIVO' : 'NEUTRO'
      }
    });
  } catch (error) {
    console.error('Error al obtener reporte financiero mensual:', error);

    return res.status(500).json({
      message: 'Error interno al obtener el reporte financiero mensual.'
    });
  }
};

const obtenerDetalleMovimientosMensualesController = async (req, res) => {
  try {
    const usuario = obtenerUsuarioRequest(req);

    if (!usuario) {
      return res.status(401).json({
        message: 'Usuario no autenticado.'
      });
    }

    if (!usuarioTieneRolPermitido(usuario)) {
      return res.status(403).json({
        message: 'No tiene permisos para consultar el detalle financiero.'
      });
    }

    const empresaId = usuario.empresa_id;

    if (!empresaId) {
      return res.status(400).json({
        message: 'El usuario no tiene una empresa asociada.'
      });
    }

    const validacion = validarFiltrosReporte(req.query.anio, req.query.mes);

    if (!validacion.valido) {
      return res.status(400).json({
        message: validacion.mensaje
      });
    }

    const movimientos = await obtenerDetalleMovimientosMensuales(
      empresaId,
      validacion.anio,
      validacion.mes
    );

    return res.json({
      message: 'Detalle de movimientos mensuales obtenido correctamente.',
      data: {
        anio: validacion.anio,
        mes: validacion.mes,
        total_movimientos: movimientos.length,
        movimientos
      }
    });
  } catch (error) {
    console.error('Error al obtener detalle de movimientos mensuales:', error);

    return res.status(500).json({
      message: 'Error interno al obtener el detalle de movimientos mensuales.'
    });
  }
};

module.exports = {
  obtenerReporteFinancieroMensual,
  obtenerDetalleMovimientosMensuales: obtenerDetalleMovimientosMensualesController
};