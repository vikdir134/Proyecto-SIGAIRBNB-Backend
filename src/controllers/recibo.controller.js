const {
  obtenerVistaPreviaReciboReservaGestion,
  generarReciboReservaGestion,
  listarRecibosReservaAutorizados,
  obtenerReciboCompletoAutorizado
} = require('../models/recibo.model');

const {
  crearNotificacion
} = require('../models/notificacion.model');

const {
  generarReciboPdfBuffer
} = require('../utils/generarReciboPdf');

const previsualizarReciboReserva = async (req, res) => {
  try {
    const usuario_gestor_id = Number(req.usuario?.usuario_id);
    const reserva_id = Number(req.params.reserva_id);

    if (
      !Number.isInteger(usuario_gestor_id) ||
      usuario_gestor_id <= 0
    ) {
      return res.status(401).json({
        mensaje: 'Usuario autenticado no válido'
      });
    }

    if (
      !Number.isInteger(reserva_id) ||
      reserva_id <= 0
    ) {
      return res.status(400).json({
        mensaje: 'El identificador de la reserva no es válido'
      });
    }

    const resultado =
      await obtenerVistaPreviaReciboReservaGestion({
        usuario_gestor_id,
        reserva_id
      });

    if (!resultado.ok) {
      const estadosPorCodigo = {
        RESERVA_NO_ENCONTRADA: 404,
        ESTADO_NO_PERMITIDO: 409,
        RECIBO_EXISTENTE: 409,
        CONCEPTO_RENTA_NO_CONFIGURADO: 409,
        RENTA_INVALIDA: 409
      };

      return res
        .status(estadosPorCodigo[resultado.codigo] || 400)
        .json({
          mensaje: resultado.mensaje,
          codigo: resultado.codigo,
          estado_actual: resultado.estado_actual,
          recibo: resultado.recibo,
          detalles: resultado.detalles
        });
    }

    return res.status(200).json({
      mensaje: 'Vista previa de boleta generada correctamente',
      reserva: resultado.reserva,
      conceptos: resultado.conceptos,
      subtotal: resultado.subtotal,
      igv_total: resultado.igv_total,
      total: resultado.total,
      dias_reserva: resultado.dias_reserva,
      fecha_vencimiento: resultado.fecha_vencimiento
    });
  } catch (error) {
    console.error(
      'Error al generar vista previa de recibo:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Ocurrió un error al generar la vista previa de la boleta',
      error: error.message
    });
  }
};

const generarReciboReserva = async (req, res) => {
  try {
    const usuario_gestor_id = req.usuario.usuario_id;
    const reserva_id = Number(req.params.reserva_id);

    const {
      observaciones,
      conceptos_editados
    } = req.body || {};

    if (!Number.isInteger(reserva_id) || reserva_id <= 0) {
      return res.status(400).json({
        mensaje: 'El identificador de la reserva no es válido.'
      });
    }

    const resultado = await generarReciboReservaGestion({
      usuario_gestor_id,
      reserva_id,
      observaciones,
      conceptos_editados: Array.isArray(conceptos_editados)
        ? conceptos_editados
        : []
    });

    if (!resultado.ok) {
      if (resultado.codigo === 'RESERVA_NO_ENCONTRADA') {
        return res.status(404).json({
          mensaje: resultado.mensaje
        });
      }

      if (resultado.codigo === 'ESTADO_NO_PERMITIDO') {
        return res.status(409).json({
          mensaje: resultado.mensaje,
          estado_actual: resultado.estado_actual
        });
      }

      if (resultado.codigo === 'RECIBO_EXISTENTE') {
        return res.status(409).json({
          mensaje: resultado.mensaje,
          recibo: resultado.recibo,
          detalles: resultado.detalles
        });
      }

      if (resultado.codigo === 'CONCEPTO_RENTA_NO_CONFIGURADO') {
        return res.status(400).json({
          mensaje: resultado.mensaje
        });
      }

      if (resultado.codigo === 'RENTA_INVALIDA') {
        return res.status(400).json({
          mensaje: resultado.mensaje
        });
      }

      return res.status(400).json({
        mensaje: resultado.mensaje || 'No se pudo generar la boleta digital.'
      });
    }

    return res.status(201).json({
      mensaje: 'Boleta digital generada correctamente.',
      recibo: resultado.recibo,
      detalles: resultado.detalles
    });
  } catch (error) {
    console.error('Error al generar recibo de reserva:', error);

    if (error.message === 'FECHA_VENCIMIENTO_RESERVA_EXPIRADA') {
      return res.status(400).json({
        mensaje:
          'No se puede generar la boleta porque la fecha de vencimiento ya expiró.'
      });
    }

    return res.status(500).json({
      mensaje: 'Ocurrió un error al generar la boleta digital.'
    });
  }
};
const obtenerRecibosReserva = async (req, res) => {
  try {
    const usuario_id = Number(req.usuario?.usuario_id);
    const reserva_id = Number(req.params.reserva_id);

    if (
      !Number.isInteger(usuario_id) ||
      usuario_id <= 0
    ) {
      return res.status(401).json({
        mensaje: 'Usuario autenticado no válido'
      });
    }

    if (
      !Number.isInteger(reserva_id) ||
      reserva_id <= 0
    ) {
      return res.status(400).json({
        mensaje: 'El identificador de la reserva no es válido'
      });
    }

    const recibos = await listarRecibosReservaAutorizados({
      usuario_id,
      reserva_id
    });

    return res.status(200).json({
      mensaje: 'Boletas de la reserva obtenidas correctamente',
      recibos
    });
  } catch (error) {
    console.error('Error al obtener recibos de reserva:', error);

    return res.status(500).json({
      mensaje: 'Ocurrió un error al obtener las boletas de la reserva',
      error: error.message
    });
  }
};

const obtenerReciboDetalle = async (req, res) => {
  try {
    const usuario_id = Number(req.usuario?.usuario_id);
    const recibo_id = Number(req.params.recibo_id);

    if (
      !Number.isInteger(usuario_id) ||
      usuario_id <= 0
    ) {
      return res.status(401).json({
        mensaje: 'Usuario autenticado no válido'
      });
    }

    if (
      !Number.isInteger(recibo_id) ||
      recibo_id <= 0
    ) {
      return res.status(400).json({
        mensaje: 'El identificador del recibo no es válido'
      });
    }

    const reciboCompleto = await obtenerReciboCompletoAutorizado({
      usuario_id,
      recibo_id
    });

    if (!reciboCompleto) {
      return res.status(404).json({
        mensaje:
          'No se encontró la boleta o no tienes permiso para verla'
      });
    }

    return res.status(200).json({
      mensaje: 'Detalle de boleta obtenido correctamente',
      recibo: reciboCompleto.recibo,
      detalles: reciboCompleto.detalles
    });
  } catch (error) {
    console.error('Error al obtener detalle de recibo:', error);

    return res.status(500).json({
      mensaje: 'Ocurrió un error al obtener el detalle de la boleta',
      error: error.message
    });
  }
};

const descargarReciboPdf = async (req, res) => {
  try {
    const usuario_id = Number(req.usuario?.usuario_id);
    const recibo_id = Number(req.params.recibo_id);

    if (
      !Number.isInteger(usuario_id) ||
      usuario_id <= 0
    ) {
      return res.status(401).json({
        mensaje: 'Usuario autenticado no válido'
      });
    }

    if (
      !Number.isInteger(recibo_id) ||
      recibo_id <= 0
    ) {
      return res.status(400).json({
        mensaje: 'El identificador del recibo no es válido'
      });
    }

    const reciboCompleto = await obtenerReciboCompletoAutorizado({
      usuario_id,
      recibo_id
    });

    if (!reciboCompleto) {
      return res.status(404).json({
        mensaje:
          'No se encontró la boleta o no tienes permiso para descargarla'
      });
    }

    const pdfBuffer = await generarReciboPdfBuffer({
      recibo: reciboCompleto.recibo,
      detalles: reciboCompleto.detalles
    });

const numeroRecibo =
  reciboCompleto.recibo.serie_empresa &&
  reciboCompleto.recibo.correlativo_empresa
    ? `${reciboCompleto.recibo.serie_empresa}-${String(
        reciboCompleto.recibo.correlativo_empresa
      ).padStart(6, '0')}`
    : `B-${String(recibo_id).padStart(6, '0')}`;

  const modo = req.query.modo === 'ver'
  ? 'inline'
  : 'attachment';

res.setHeader('Content-Type', 'application/pdf');
res.setHeader(
  'Content-Disposition',
  `${modo}; filename="boleta-digital-${numeroRecibo}.pdf"`
);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (error) {
    console.error('Error al descargar PDF de recibo:', error);

    return res.status(500).json({
      mensaje: 'Ocurrió un error al generar el PDF de la boleta',
      error: error.message
    });
  }
};

module.exports = {
  previsualizarReciboReserva,
  generarReciboReserva,
  obtenerRecibosReserva,
  obtenerReciboDetalle,
  descargarReciboPdf
};