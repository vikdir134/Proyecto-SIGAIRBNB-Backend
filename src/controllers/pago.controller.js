const {
  listarRecibosPendientesInquilino,
  obtenerReciboPendienteParaPago,
  registrarPagoOnline,
  listarMisPagos
} = require('../models/pago.model');

const obtenerUsuarioId = (req) => {
  return req.usuario?.usuario_id || req.usuario?.id;
};

const obtenerMisRecibosPendientes = async (req, res) => {
  try {
    const empresa_id = req.usuario?.empresa_id;
    const usuario_id = obtenerUsuarioId(req);

    if (!usuario_id) {
      return res.status(401).json({
        mensaje: 'No se pudo identificar al usuario autenticado.'
      });
    }

    const recibos = await listarRecibosPendientesInquilino(
      empresa_id,
      usuario_id
    );

    return res.status(200).json({
      mensaje: 'Recibos pendientes obtenidos correctamente.',
      recibos
    });

  } catch (error) {
    console.error('Error al obtener recibos pendientes:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener los recibos pendientes.'
    });
  }
};

const obtenerDetalleReciboParaPago = async (req, res) => {
  try {
    const empresa_id = req.usuario?.empresa_id;
    const usuario_id = obtenerUsuarioId(req);
    const { recibo_id } = req.params;

    if (!usuario_id) {
      return res.status(401).json({
        mensaje: 'No se pudo identificar al usuario autenticado.'
      });
    }

    if (!recibo_id || isNaN(Number(recibo_id))) {
      return res.status(400).json({
        mensaje: 'El recibo_id no es válido.'
      });
    }

    const recibo = await obtenerReciboPendienteParaPago(
      empresa_id,
      usuario_id,
      Number(recibo_id)
    );

    if (!recibo) {
      return res.status(404).json({
        mensaje: 'Recibo no encontrado o no pertenece al inquilino.'
      });
    }

    return res.status(200).json({
      mensaje: 'Detalle del recibo obtenido correctamente.',
      recibo
    });

  } catch (error) {
    console.error('Error al obtener detalle del recibo:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener el detalle del recibo.'
    });
  }
};

const pagarReciboOnline = async (req, res) => {
  try {
    const empresa_id = req.usuario?.empresa_id;
    const usuario_id = obtenerUsuarioId(req);
    const { recibo_id } = req.params;

    if (!usuario_id) {
      return res.status(401).json({
        mensaje: 'No se pudo identificar al usuario autenticado.'
      });
    }

    if (!recibo_id || isNaN(Number(recibo_id))) {
      return res.status(400).json({
        mensaje: 'El recibo_id no es válido.'
      });
    }

    const {
      metodo_pago = 'ONLINE',
      proveedor_pasarela = 'SIMULADO',
      referencia = null
    } = req.body || {};

    const metodoPagoNormalizado = String(metodo_pago).trim().toUpperCase();

    const metodosPermitidos = [
      'ONLINE',
      'TARJETA',
      'TRANSFERENCIA',
      'EFECTIVO'
    ];

    if (!metodosPermitidos.includes(metodoPagoNormalizado)) {
      return res.status(400).json({
        mensaje: 'Método de pago no válido.'
      });
    }

    const proveedorPasarelaFinal =
      metodoPagoNormalizado === 'ONLINE' || metodoPagoNormalizado === 'TARJETA'
        ? proveedor_pasarela || 'SIMULADO'
        : null;

    const resultado = await registrarPagoOnline({
      empresa_id,
      usuario_id,
      recibo_id: Number(recibo_id),
      metodo_pago: metodoPagoNormalizado,
      proveedor_pasarela: proveedorPasarelaFinal,
      referencia
    });

    if (!resultado.ok) {
      return res.status(resultado.status || 400).json({
        mensaje: resultado.mensaje
      });
    }

    return res.status(201).json({
      mensaje: 'Pago procesado correctamente.',
      pago: resultado.pago,
      monto_pagado: resultado.monto_pagado
    });

    } catch (error) {
    console.error('Error al pagar recibo:', error);

    if (error.message === 'RECIBO_NO_VALIDO') {
      return res.status(404).json({
        mensaje: 'El recibo no existe, no pertenece al inquilino autenticado o no está disponible para pago.'
      });
    }

    if (error.message === 'RECIBO_YA_PAGADO') {
      return res.status(409).json({
        mensaje: 'Este recibo ya fue pagado anteriormente.'
      });
    }

    if (error.message === 'RECIBO_ANULADO') {
      return res.status(409).json({
        mensaje: 'No se puede pagar un recibo anulado.'
      });
    }

    return res.status(500).json({
      mensaje: error.message || 'Error interno al procesar el pago.'
    });
  }
};

const obtenerMisPagos = async (req, res) => {
  try {
    const empresa_id = req.usuario?.empresa_id;
    const usuario_id = obtenerUsuarioId(req);

    if (!usuario_id) {
      return res.status(401).json({
        mensaje: 'No se pudo identificar al usuario autenticado.'
      });
    }

    const pagos = await listarMisPagos(
      empresa_id,
      usuario_id
    );

    return res.status(200).json({
      mensaje: 'Pagos obtenidos correctamente.',
      pagos
    });

  } catch (error) {
    console.error('Error al obtener pagos:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener los pagos.'
    });
  }
};

module.exports = {
  obtenerMisRecibosPendientes,
  obtenerDetalleReciboParaPago,
  pagarReciboOnline,
  obtenerMisPagos
};