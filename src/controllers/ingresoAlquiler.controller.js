const { getConnection, sql } = require('../config/db');

const {
  listarCategoriasIngreso,
  listarCuentasIngresoPorEmpresa,
  listarRecibosPendientesIngreso,
  obtenerCuentaPorEmpresa,
  obtenerCategoriaIngresoPorId,
  obtenerReciboPendientePorEmpresa,
  registrarIngresoAlquiler,
  listarIngresosAlquiler
} = require('../models/ingresoAlquiler.model');

const obtenerUsuarioId = (req) => {
  return req.usuario?.usuario_id || req.usuario?.id;
};

const obtenerRolesUsuario = (req) => {
  const roles = req.usuario?.roles || [];

  if (Array.isArray(roles)) {
    return roles.map((rol) => String(rol).toUpperCase());
  }

  return [];
};

const obtenerEmpresaGestionada = async (req) => {
  const usuario_id = obtenerUsuarioId(req);
  const empresaToken = req.usuario?.empresa_id;
  const roles = obtenerRolesUsuario(req);

  if (!usuario_id) {
    return null;
  }

  /*
    Si es ADMIN, trabaja con su propia empresa.
  */
  if (roles.includes('ADMIN')) {
    return empresaToken || null;
  }

  /*
    Si es SECRETARIO, debe trabajar con la empresa asignada
    en core.EmpresaSecretario, no con su empresa propia.
  */
  if (roles.includes('SECRETARIO')) {
    const pool = await getConnection();

    const result = await pool.request()
      .input('secretario_usuario_id', sql.Int, usuario_id)
      .query(`
        SELECT TOP 1
          es.empresa_id
        FROM core.EmpresaSecretario es
        INNER JOIN core.Empresa e
          ON e.empresa_id = es.empresa_id
        WHERE es.secretario_usuario_id = @secretario_usuario_id
          AND es.activo = 1
          AND e.activo = 1
          AND e.deleted_at IS NULL
        ORDER BY es.fecha_asignacion DESC;
      `);

    return result.recordset[0]?.empresa_id || null;
  }

  return empresaToken || null;
};

const obtenerDatosFormularioIngreso = async (req, res) => {
  try {
    const empresa_id = await obtenerEmpresaGestionada(req);

    if (!empresa_id) {
      return res.status(401).json({
        mensaje: 'No se pudo identificar la empresa gestionada por el usuario autenticado.'
      });
    }

    const [categorias, cuentas, recibos_pendientes] = await Promise.all([
      listarCategoriasIngreso(),
      listarCuentasIngresoPorEmpresa(empresa_id),
      listarRecibosPendientesIngreso(empresa_id)
    ]);

    return res.status(200).json({
      mensaje: 'Datos para el formulario de ingreso obtenidos correctamente.',
      empresa_id,
      categorias,
      cuentas,
      recibos_pendientes
    });
  } catch (error) {
    console.error('Error al obtener datos del formulario de ingreso:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener los datos del formulario.'
    });
  }
};

const listarRecibosPendientes = async (req, res) => {
  try {
    const empresa_id = await obtenerEmpresaGestionada(req);

    if (!empresa_id) {
      return res.status(401).json({
        mensaje: 'No se pudo identificar la empresa gestionada por el usuario autenticado.'
      });
    }

    const recibos = await listarRecibosPendientesIngreso(empresa_id);

    return res.status(200).json({
      mensaje: 'Recibos pendientes de ingreso obtenidos correctamente.',
      empresa_id,
      recibos
    });
  } catch (error) {
    console.error('Error al listar recibos pendientes de ingreso:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar los recibos pendientes de ingreso.'
    });
  }
};

const listarIngresos = async (req, res) => {
  try {
    const empresa_id = await obtenerEmpresaGestionada(req);

    if (!empresa_id) {
      return res.status(401).json({
        mensaje: 'No se pudo identificar la empresa gestionada por el usuario autenticado.'
      });
    }

    const ingresos = await listarIngresosAlquiler(empresa_id);

    return res.status(200).json({
      mensaje: 'Ingresos de alquiler obtenidos correctamente.',
      empresa_id,
      ingresos
    });
  } catch (error) {
    console.error('Error al listar ingresos de alquiler:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar los ingresos de alquiler.'
    });
  }
};

const registrarIngreso = async (req, res) => {
  try {
    const empresa_id = await obtenerEmpresaGestionada(req);
    const usuario_registrador_id = obtenerUsuarioId(req);

    if (!empresa_id) {
      return res.status(401).json({
        mensaje: 'No se pudo identificar la empresa gestionada por el usuario autenticado.'
      });
    }

    if (!usuario_registrador_id) {
      return res.status(401).json({
        mensaje: 'No se pudo identificar al usuario autenticado.'
      });
    }

    const cuenta_bancaria_id = Number(req.body.cuenta_bancaria_id);
    const categoria_movimiento_id = Number(req.body.categoria_movimiento_id);
    const recibo_id = Number(req.body.recibo_id);
    const importe = Number(req.body.importe);

    const metodo_pago = String(req.body.metodo_pago || '').trim().toUpperCase();

    const concepto = req.body.concepto
      ? String(req.body.concepto).trim()
      : null;

    const descripcion = req.body.descripcion
      ? String(req.body.descripcion).trim()
      : null;

    const referencia_externa = req.body.referencia_externa
      ? String(req.body.referencia_externa).trim()
      : null;

    const observaciones = req.body.observaciones
      ? String(req.body.observaciones).trim()
      : null;

    const fecha_movimiento = req.body.fecha_movimiento
      ? new Date(req.body.fecha_movimiento)
      : new Date();

    const errores = [];

    if (!cuenta_bancaria_id) {
      errores.push('La cuenta bancaria es obligatoria.');
    }

    if (!categoria_movimiento_id) {
      errores.push('La categoría del ingreso es obligatoria.');
    }

    if (!recibo_id) {
      errores.push('El recibo es obligatorio.');
    }

    if (!importe || importe <= 0) {
      errores.push('El importe debe ser mayor a cero.');
    }

    if (!metodo_pago) {
      errores.push('El método de pago es obligatorio.');
    }

    const metodosPermitidos = [
      'ONLINE',
      'TARJETA',
      'TRANSFERENCIA',
      'EFECTIVO'
    ];

    if (metodo_pago && !metodosPermitidos.includes(metodo_pago)) {
      errores.push('El método de pago no es válido.');
    }

    if (Number.isNaN(fecha_movimiento.getTime())) {
      errores.push('La fecha del movimiento no es válida.');
    }

    if (errores.length > 0) {
      return res.status(400).json({
        mensaje: 'Datos inválidos.',
        errores
      });
    }

    const cuenta = await obtenerCuentaPorEmpresa(
      empresa_id,
      cuenta_bancaria_id
    );

    if (!cuenta) {
      return res.status(404).json({
        mensaje: 'No se encontró la cuenta bancaria para esta empresa.'
      });
    }

    const categoria = await obtenerCategoriaIngresoPorId(
      categoria_movimiento_id
    );

    if (!categoria) {
      return res.status(404).json({
        mensaje: 'No se encontró la categoría de ingreso.'
      });
    }

    const recibo = await obtenerReciboPendientePorEmpresa(
      empresa_id,
      recibo_id
    );

    if (!recibo) {
      return res.status(404).json({
        mensaje: 'No se encontró el recibo para esta empresa.'
      });
    }

    if (recibo.estado_recibo === 'ANULADO') {
      return res.status(400).json({
        mensaje: 'No se puede registrar ingreso sobre un recibo anulado.'
      });
    }

    if (
      recibo.estado_recibo === 'PAGADO' ||
      Number(recibo.saldo_pendiente) <= 0
    ) {
      return res.status(400).json({
        mensaje: 'Este recibo ya se encuentra pagado.'
      });
    }

    if (importe > Number(recibo.saldo_pendiente)) {
      return res.status(400).json({
        mensaje: 'El importe no puede superar el saldo pendiente del recibo.'
      });
    }

    const resultado = await registrarIngresoAlquiler(
      empresa_id,
      usuario_registrador_id,
      {
        cuenta_bancaria_id,
        categoria_movimiento_id,
        recibo_id,
        importe,
        metodo_pago,
        fecha_movimiento,
        concepto,
        descripcion,
        referencia_externa,
        observaciones
      }
    );

    return res.status(201).json({
      mensaje: 'Ingreso de alquiler registrado correctamente.',
      empresa_id,
      ingreso: resultado
    });
  } catch (error) {
    console.error('Error al registrar ingreso de alquiler:', error);

    const mensajesPorError = {
      CUENTA_NO_VALIDA: 'La cuenta bancaria no es válida para esta empresa.',
      CATEGORIA_NO_VALIDA: 'La categoría seleccionada no es válida.',
      RECIBO_NO_VALIDO: 'El recibo no es válido para esta empresa.',
      RECIBO_ANULADO: 'No se puede registrar ingreso sobre un recibo anulado.',
      RECIBO_YA_PAGADO: 'Este recibo ya se encuentra pagado.',
      IMPORTE_INVALIDO: 'El importe debe ser mayor a cero.',
      IMPORTE_SUPERA_SALDO: 'El importe no puede superar el saldo pendiente del recibo.',
      FECHA_INVALIDA: 'La fecha del movimiento no es válida.',
      METODO_PAGO_NO_VALIDO: 'El método de pago no es válido.'
    };

    if (mensajesPorError[error.message]) {
      return res.status(400).json({
        mensaje: mensajesPorError[error.message]
      });
    }

    return res.status(500).json({
      mensaje: 'Error interno al registrar el ingreso de alquiler.'
    });
  }
};

module.exports = {
  obtenerDatosFormularioIngreso,
  listarRecibosPendientes,
  listarIngresos,
  registrarIngreso
};