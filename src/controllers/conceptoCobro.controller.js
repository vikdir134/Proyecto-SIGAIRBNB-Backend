const {
  listarConceptosCobro,
  obtenerConceptoCobroPorId,
  obtenerConceptoCobroPorCodigo,
  crearConceptoCobro,
  actualizarConceptoCobro,
  cambiarEstadoConceptoCobro
} = require('../models/conceptoCobro.model');

const tiposValidos = ['FIJO', 'VARIABLE', 'IMPUESTO', 'SERVICIO'];

const categoriasValidas = [
  'RENTA',
  'LIMPIEZA',
  'MANTENIMIENTO',
  'SERVICIO',
  'PENALIDAD',
  'GARANTIA',
  'IMPUESTO',
  'AJUSTE',
  'DESCUENTO',
  'OTRO'
];

const metodosValidos = [
  'RENTA_RESERVA',
  'MONTO_FIJO',
  'MANUAL',
  'POR_DIA',
  'POR_MES',
  'POR_AREA_M2',
  'POR_PORCENTAJE_RENTA'
];

const aplicaEnValidos = ['RESERVA', 'MENSUAL', 'AMBOS'];

const normalizarCodigo = (texto) => {
  return String(texto || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
};

const validarConcepto = (body) => {
  const errores = [];

  const codigo = normalizarCodigo(body.codigo || body.nombre);
  const nombre = String(body.nombre || '').trim();
  const tipo_concepto = String(body.tipo_concepto || '').trim().toUpperCase();
  const categoria = String(body.categoria || '').trim().toUpperCase();
  const metodo_calculo = String(body.metodo_calculo || '').trim().toUpperCase();
  const aplica_en = String(body.aplica_en || '').trim().toUpperCase();

  const monto_default = Number(body.monto_default || 0);
  const orden_impresion = Number(body.orden_impresion || 1);
  const aplica_desde_dias = Number(body.aplica_desde_dias || 1);

  if (!codigo) errores.push('El código es obligatorio.');
  if (!nombre) errores.push('El nombre es obligatorio.');

  if (!tiposValidos.includes(tipo_concepto)) {
    errores.push('El tipo de concepto no es válido.');
  }

  if (!categoriasValidas.includes(categoria)) {
    errores.push('La categoría no es válida.');
  }

  if (!metodosValidos.includes(metodo_calculo)) {
    errores.push('El método de cálculo no es válido.');
  }

  if (!aplicaEnValidos.includes(aplica_en)) {
    errores.push('El campo aplica_en no es válido.');
  }

  if (monto_default < 0) {
    errores.push('El monto por defecto no puede ser negativo.');
  }

  if (orden_impresion <= 0) {
    errores.push('El orden de impresión debe ser mayor a cero.');
  }

  if (aplica_desde_dias <= 0) {
    errores.push('La cantidad de días desde la que aplica debe ser mayor a cero.');
  }

  return {
    errores,
    data: {
      codigo,
      nombre,
      descripcion: body.descripcion || null,
      tipo_concepto,
      categoria,
      metodo_calculo,
      aplica_en,
      monto_default,
      orden_impresion,
      aplica_desde_dias,
      es_obligatorio: Boolean(body.es_obligatorio),
      aplica_igv: Boolean(body.aplica_igv),
      prorrateable: Boolean(body.prorrateable),
      permite_pago_online: Boolean(body.permite_pago_online)
    }
  };
};

const listarConceptos = async (req, res) => {
  try {
    const conceptos = await listarConceptosCobro();

    return res.json({
      mensaje: 'Conceptos de cobro obtenidos correctamente.',
      conceptos
    });
  } catch (error) {
    console.error('Error al listar conceptos de cobro:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar conceptos de cobro.'
    });
  }
};

const crearConcepto = async (req, res) => {
  try {
    const { errores, data } = validarConcepto(req.body);

    if (errores.length > 0) {
      return res.status(400).json({
        mensaje: 'Datos inválidos.',
        errores
      });
    }

    const conceptoExistente = await obtenerConceptoCobroPorCodigo(data.codigo);

    if (conceptoExistente) {
      return res.status(409).json({
        mensaje: 'Ya existe un concepto con ese código.'
      });
    }

    const concepto = await crearConceptoCobro(data);

    return res.status(201).json({
      mensaje: 'Concepto de cobro creado correctamente.',
      concepto
    });
  } catch (error) {
    console.error('Error al crear concepto de cobro:', error);

    return res.status(500).json({
      mensaje: 'Error interno al crear concepto de cobro.'
    });
  }
};

const actualizarConcepto = async (req, res) => {
  try {
    const concepto_cobro_id = Number(req.params.concepto_cobro_id);

    if (!concepto_cobro_id) {
      return res.status(400).json({
        mensaje: 'El ID del concepto es obligatorio.'
      });
    }

    const conceptoActual = await obtenerConceptoCobroPorId(concepto_cobro_id);

    if (!conceptoActual) {
      return res.status(404).json({
        mensaje: 'No se encontró el concepto de cobro.'
      });
    }

    if (!conceptoActual.editable) {
      return res.status(403).json({
        mensaje: 'Este concepto es del sistema y no puede editarse.'
      });
    }

    const { errores, data } = validarConcepto({
      ...req.body,
      codigo: conceptoActual.codigo
    });

    if (errores.length > 0) {
      return res.status(400).json({
        mensaje: 'Datos inválidos.',
        errores
      });
    }

    const concepto = await actualizarConceptoCobro(concepto_cobro_id, data);

    return res.json({
      mensaje: 'Concepto de cobro actualizado correctamente.',
      concepto
    });
  } catch (error) {
    console.error('Error al actualizar concepto de cobro:', error);

    return res.status(500).json({
      mensaje: 'Error interno al actualizar concepto de cobro.'
    });
  }
};

const cambiarEstadoConcepto = async (req, res) => {
  try {
    const concepto_cobro_id = Number(req.params.concepto_cobro_id);
    const { activo } = req.body;

    if (!concepto_cobro_id) {
      return res.status(400).json({
        mensaje: 'El ID del concepto es obligatorio.'
      });
    }

    if (typeof activo !== 'boolean') {
      return res.status(400).json({
        mensaje: 'El estado activo debe ser true o false.'
      });
    }

    const conceptoActual = await obtenerConceptoCobroPorId(concepto_cobro_id);

    if (!conceptoActual) {
      return res.status(404).json({
        mensaje: 'No se encontró el concepto de cobro.'
      });
    }

    if (!conceptoActual.editable) {
      return res.status(403).json({
        mensaje: 'Este concepto es del sistema y no puede desactivarse.'
      });
    }

    const concepto = await cambiarEstadoConceptoCobro(concepto_cobro_id, activo);

    return res.json({
      mensaje: activo
        ? 'Concepto de cobro reactivado correctamente.'
        : 'Concepto de cobro desactivado correctamente.',
      concepto
    });
  } catch (error) {
    console.error('Error al cambiar estado del concepto de cobro:', error);

    return res.status(500).json({
      mensaje: 'Error interno al cambiar el estado del concepto de cobro.'
    });
  }
};

module.exports = {
  listarConceptos,
  crearConcepto,
  actualizarConcepto,
  cambiarEstadoConcepto
};