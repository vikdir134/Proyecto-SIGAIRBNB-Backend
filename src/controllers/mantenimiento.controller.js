const {
  listarCategoriasGasto,
  listarCuentasMantenimientoPorEmpresa,
  listarInmueblesParaGasto,
  obtenerCuentaPorEmpresa,
  obtenerCategoriaGastoPorId,
  obtenerInmueblePorEmpresa,
  registrarGastoMantenimiento,
  listarGastosMantenimiento
} = require('../models/mantenimiento.model');

const {
  isDateNotAbsurd
} = require('../utils/dateHelpers');

const obtenerDatosFormularioGasto = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;

    const [categorias, cuentas, inmuebles] = await Promise.all([
      listarCategoriasGasto(),
      listarCuentasMantenimientoPorEmpresa(empresa_id),
      listarInmueblesParaGasto(empresa_id)
    ]);

    return res.status(200).json({
      mensaje: 'Datos para el formulario de gasto obtenidos correctamente.',
      categorias,
      cuentas,
      inmuebles
    });
  } catch (error) {
    console.error('Error al obtener datos del formulario de gasto:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener los datos del formulario.'
    });
  }
};

const listarGastos = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;

    const gastos = await listarGastosMantenimiento(empresa_id);

    return res.status(200).json({
      mensaje: 'Gastos de mantenimiento obtenidos correctamente.',
      gastos
    });
  } catch (error) {
    console.error('Error al listar gastos de mantenimiento:', error);

    return res.status(500).json({
      mensaje: 'Error interno al listar los gastos de mantenimiento.'
    });
  }
};

const registrarGasto = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;

    const cuenta_bancaria_id = Number(req.body.cuenta_bancaria_id);
    const categoria_movimiento_id = Number(req.body.categoria_movimiento_id);
    const inmueble_id = req.body.inmueble_id ? Number(req.body.inmueble_id) : null;

    const concepto = String(req.body.concepto || '').trim();
    const descripcion = req.body.descripcion
      ? String(req.body.descripcion).trim()
      : null;

    const referencia_externa = req.body.referencia_externa
      ? String(req.body.referencia_externa).trim()
      : null;

    const observaciones = req.body.observaciones
      ? String(req.body.observaciones).trim()
      : null;

    const importe = Number(req.body.importe);
    const fecha_movimiento = req.body.fecha_movimiento
      ? new Date(req.body.fecha_movimiento)
      : new Date();

    const errores = [];

    if (!cuenta_bancaria_id) {
      errores.push('La cuenta bancaria es obligatoria.');
    }

    if (!categoria_movimiento_id) {
      errores.push('La categoría del gasto es obligatoria.');
    }

    if (!concepto) {
      errores.push('El concepto del gasto es obligatorio.');
    }

    if (!Number.isFinite(importe) || importe <= 0) {
      errores.push('El importe debe ser mayor a cero.');
    }

    if (Number.isNaN(fecha_movimiento.getTime())) {
      errores.push('La fecha del movimiento no es válida.');
    }

    const fechaMovimientoTexto = !Number.isNaN(fecha_movimiento.getTime())
      ? fecha_movimiento.toISOString().slice(0, 10)
      : null;

    if (fechaMovimientoTexto && !isDateNotAbsurd(fechaMovimientoTexto, { minYear: 2000, maxFutureYears: 1 })) {
      errores.push('La fecha del movimiento está fuera del rango permitido para el sistema.');
    }

    if (inmueble_id && inmueble_id <= 0) {
      errores.push('El inmueble seleccionado no es válido.');
    }

    if (concepto && concepto.length > 150) {
      errores.push('El concepto no debe superar los 150 caracteres.');
    }

    if (descripcion && descripcion.length > 500) {
      errores.push('La descripción no debe superar los 500 caracteres.');
    }

    if (referencia_externa && referencia_externa.length > 100) {
      errores.push('La referencia externa no debe superar los 100 caracteres.');
    }

    if (observaciones && observaciones.length > 500) {
      errores.push('Las observaciones no deben superar los 500 caracteres.');
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

    const categoria = await obtenerCategoriaGastoPorId(
      categoria_movimiento_id
    );

    if (!categoria) {
      return res.status(404).json({
        mensaje: 'No se encontró la categoría de gasto.'
      });
    }

    if (inmueble_id) {
      const inmueble = await obtenerInmueblePorEmpresa(
        empresa_id,
        inmueble_id
      );

      if (!inmueble) {
        return res.status(404).json({
          mensaje: 'No se encontró el inmueble seleccionado.'
        });
      }
    }

    const gasto = await registrarGastoMantenimiento(empresa_id, {
      cuenta_bancaria_id,
      categoria_movimiento_id,
      inmueble_id,
      reserva_id: null,
      fecha_movimiento,
      concepto,
      descripcion,
      importe,
      referencia_externa,
      observaciones
    });

    return res.status(201).json({
      mensaje: 'Gasto de mantenimiento registrado correctamente.',
      gasto
    });
  } catch (error) {
    console.error('Error al registrar gasto de mantenimiento:', error);

    if (error.message === 'CUENTA_NO_VALIDA') {
      return res.status(400).json({
        mensaje: 'La cuenta bancaria no es válida para esta empresa.'
      });
    }

    return res.status(500).json({
      mensaje: 'Error interno al registrar el gasto de mantenimiento.'
    });
  }
};

module.exports = {
  obtenerDatosFormularioGasto,
  listarGastos,
  registrarGasto
};
