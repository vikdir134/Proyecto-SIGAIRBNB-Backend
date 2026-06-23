const { getConnection, sql } = require('../config/db');

const IGV_PORCENTAJE = 0.18;

const redondear2 = (valor) => {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
};

const obtenerFechaYYYYMMDD = (valor) => {
  if (!valor) return null;

  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  return String(valor).slice(0, 10);
};

/*
  Mantiene la misma lógica que tienes actualmente en recibo.model.js:
  fecha_fin - fecha_inicio.

  Ejemplo:
  2026-07-01 a 2026-07-31 = 30 días.
*/
const calcularDiasReserva = (fechaInicio, fechaFin) => {
  const inicioTexto = obtenerFechaYYYYMMDD(fechaInicio);
  const finTexto = obtenerFechaYYYYMMDD(fechaFin);

  const inicio = new Date(`${inicioTexto}T00:00:00`);
  const fin = new Date(`${finTexto}T00:00:00`);

  const diferenciaMs = fin.getTime() - inicio.getTime();
  const dias = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

  return Math.max(dias, 1);
};

const calcularRentaProporcional = ({
  rentaMensual,
  diasReserva
}) => {
  const renta = Number(rentaMensual || 0);

  if (renta <= 0) {
    return {
      renta_mensual: renta,
      renta_diaria: 0,
      meses_completos: 0,
      dias_restantes: diasReserva,
      total_esperado: 0
    };
  }

  const mesesCompletos = Math.floor(diasReserva / 30);
  const diasRestantes = diasReserva % 30;
  const rentaDiaria = redondear2(renta / 30);

  const totalEsperado = redondear2(
    mesesCompletos * renta + diasRestantes * rentaDiaria
  );

  return {
    renta_mensual: redondear2(renta),
    renta_diaria: rentaDiaria,
    meses_completos: mesesCompletos,
    dias_restantes: diasRestantes,
    total_esperado: totalEsperado
  };
};

const calcularLineaEsperada = ({
  concepto,
  reserva,
  diasReserva
}) => {
  const montoDefault = Number(concepto.monto_default || 0);

  const rentaMensual = Number(
    reserva.renta_pactada_mensual ||
    reserva.precio_publicado_mensual ||
    0
  );

  if (
    concepto.codigo === 'RENTA_RESERVA' ||
    concepto.metodo_calculo === 'RENTA_RESERVA'
  ) {
    const renta = calcularRentaProporcional({
      rentaMensual,
      diasReserva
    });

    return {
      regla: 'RENTA_RESERVA proporcional por días',
      cantidad_esperada: diasReserva,
      precio_unitario_esperado: renta.renta_diaria,
      importe_esperado: renta.total_esperado,
      detalle_calculo:
        `${renta.meses_completos} mes(es) completo(s) + ` +
        `${renta.dias_restantes} día(s) restante(s)`
    };
  }

  if (concepto.metodo_calculo === 'POR_DIA') {
    return {
      regla: 'POR_DIA',
      cantidad_esperada: diasReserva,
      precio_unitario_esperado: redondear2(montoDefault),
      importe_esperado: redondear2(montoDefault * diasReserva),
      detalle_calculo: `${montoDefault} x ${diasReserva} día(s)`
    };
  }

  if (concepto.metodo_calculo === 'POR_MES') {
    const mesesCompletos = Math.floor(diasReserva / 30);
    const diasRestantes = diasReserva % 30;

    if (concepto.prorrateable) {
      const montoDiario = redondear2(montoDefault / 30);

      return {
        regla: 'POR_MES prorrateable',
        cantidad_esperada: redondear2(diasReserva / 30),
        precio_unitario_esperado: redondear2(montoDefault),
        importe_esperado: redondear2(
          mesesCompletos * montoDefault + diasRestantes * montoDiario
        ),
        detalle_calculo:
          `${mesesCompletos} mes(es) + ` +
          `${diasRestantes} día(s) prorrateado(s)`
      };
    }

    return {
      regla: 'POR_MES no prorrateable',
      cantidad_esperada: Math.max(mesesCompletos, 1),
      precio_unitario_esperado: redondear2(montoDefault),
      importe_esperado: redondear2(
        montoDefault * Math.max(mesesCompletos, 1)
      ),
      detalle_calculo: 'Se cobra como bloque mensual'
    };
  }

  if (concepto.metodo_calculo === 'MONTO_FIJO') {
    return {
      regla: 'MONTO_FIJO / servicio único',
      cantidad_esperada: 1,
      precio_unitario_esperado: redondear2(montoDefault),
      importe_esperado: redondear2(montoDefault),
      detalle_calculo: 'Se cobra una sola vez'
    };
  }

  if (concepto.metodo_calculo === 'MANUAL') {
    return {
      regla: 'MANUAL',
      cantidad_esperada: 1,
      precio_unitario_esperado: redondear2(montoDefault),
      importe_esperado: redondear2(montoDefault),
      detalle_calculo:
        'Solo debería entrar automático si monto_default > 0 y la regla de negocio lo permite'
    };
  }

  return {
    regla: concepto.metodo_calculo || 'SIN_METODO',
    cantidad_esperada: 1,
    precio_unitario_esperado: redondear2(montoDefault),
    importe_esperado: redondear2(montoDefault),
    detalle_calculo: 'Método no reconocido por el diagnóstico'
  };
};

const imprimirTitulo = (texto) => {
  console.log('\n========================================');
  console.log(texto);
  console.log('========================================');
};

const obtenerReserva = async (pool, reservaId) => {
  const request = pool.request();

  let where = '';

  if (reservaId) {
    request.input('reserva_id', sql.Int, reservaId);
    where = 'WHERE r.reserva_id = @reserva_id';
  }

  const result = await request.query(`
    SELECT TOP ${reservaId ? 1 : 10}
      r.reserva_id,
      r.inmueble_id,
      r.inquilino_id,
      r.estado_reserva,
      r.fecha_inicio,
      r.fecha_fin,
      r.renta_pactada_mensual,
      r.monto_total_estimado,
      r.deposito_garantia,
      r.moneda,

      i.empresa_id,
      i.codigo AS codigo_inmueble,
      i.nombre AS nombre_inmueble,
      i.tipo_inmueble,

      pub.publicacion_id,
      pub.titulo AS titulo_publicacion,
      pub.precio_publicado_mensual,

      rec.recibo_id,
      rec.estado_recibo,
      rec.total AS total_recibo,
      rec.saldo_pendiente
    FROM booking.Reserva r
    INNER JOIN catalog.Inmueble i
      ON i.inmueble_id = r.inmueble_id
    OUTER APPLY (
      SELECT TOP 1
        p.publicacion_id,
        p.titulo,
        p.precio_publicado_mensual
      FROM catalog.Publicacion p
      WHERE p.inmueble_id = r.inmueble_id
      ORDER BY p.publicacion_id DESC
    ) pub
    OUTER APPLY (
      SELECT TOP 1
        rb.recibo_id,
        rb.estado_recibo,
        rb.total,
        rb.saldo_pendiente
      FROM finance.Recibo rb
      WHERE rb.reserva_id = r.reserva_id
        AND rb.estado_recibo <> 'ANULADO'
      ORDER BY rb.recibo_id DESC
    ) rec
    ${where}
    ORDER BY r.reserva_id DESC;
  `);

  return result.recordset;
};

const obtenerConceptosAplicables = async (pool, diasReserva) => {
  const result = await pool.request()
    .input('dias_reserva', sql.Int, diasReserva)
    .query(`
      SELECT
        concepto_cobro_id,
        codigo,
        nombre,
        descripcion,
        tipo_concepto,
        categoria,
        metodo_calculo,
        aplica_en,
        aplica_desde_dias,
        prorrateable,
        permite_pago_online,
        es_sistema,
        editable,
        aplica_igv,
        monto_default,
        orden_impresion,
        activo
      FROM finance.ConceptoCobro
      WHERE activo = 1
        AND deleted_at IS NULL
        AND (
          codigo = 'RENTA_RESERVA'
          OR (
            codigo <> 'RENTA_RESERVA'
            AND aplica_en IN ('RESERVA', 'AMBOS')
            AND aplica_desde_dias <= @dias_reserva
            AND monto_default > 0
          )
        )
      ORDER BY
        CASE WHEN codigo = 'RENTA_RESERVA' THEN 0 ELSE 1 END,
        orden_impresion ASC,
        nombre ASC;
    `);

  return result.recordset;
};

const obtenerDetallesRecibo = async (pool, reciboId) => {
  if (!reciboId) return [];

  const result = await pool.request()
    .input('recibo_id', sql.Int, reciboId)
    .query(`
      SELECT
        rd.recibo_detalle_id,
        rd.recibo_id,
        rd.concepto_cobro_id,
        cc.codigo,
        cc.nombre,
        cc.metodo_calculo,
        cc.categoria,
        rd.descripcion,
        rd.cantidad,
        rd.precio_unitario,
        rd.importe,
        rd.orden_impresion
      FROM finance.ReciboDetalle rd
      INNER JOIN finance.ConceptoCobro cc
        ON cc.concepto_cobro_id = rd.concepto_cobro_id
      WHERE rd.recibo_id = @recibo_id
      ORDER BY rd.orden_impresion ASC;
    `);

  return result.recordset;
};

const obtenerTablasFinancierasRelacionadas = async (pool) => {
  const result = await pool.request().query(`
    SELECT
      TABLE_SCHEMA,
      TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'finance'
      AND (
        TABLE_NAME LIKE '%Pago%'
        OR TABLE_NAME LIKE '%Movimiento%'
        OR TABLE_NAME LIKE '%Ingreso%'
        OR TABLE_NAME LIKE '%Recibo%'
      )
    ORDER BY TABLE_NAME;
  `);

  return result.recordset;
};

const analizarReserva = async (pool, reserva) => {
  const diasReserva = calcularDiasReserva(
    reserva.fecha_inicio,
    reserva.fecha_fin
  );

  const renta = calcularRentaProporcional({
    rentaMensual:
      reserva.renta_pactada_mensual ||
      reserva.precio_publicado_mensual,
    diasReserva
  });

  imprimirTitulo(`RESERVA ${reserva.reserva_id}`);

  console.table([
    {
      reserva_id: reserva.reserva_id,
      estado_reserva: reserva.estado_reserva,
      inmueble: reserva.codigo_inmueble || reserva.nombre_inmueble,
      fecha_inicio: obtenerFechaYYYYMMDD(reserva.fecha_inicio),
      fecha_fin: obtenerFechaYYYYMMDD(reserva.fecha_fin),
      dias_reserva: diasReserva,
      renta_pactada_mensual: Number(reserva.renta_pactada_mensual || 0),
      precio_publicado_mensual: Number(reserva.precio_publicado_mensual || 0),
      monto_total_estimado: Number(reserva.monto_total_estimado || 0),
      recibo_id: reserva.recibo_id || null,
      estado_recibo: reserva.estado_recibo || null,
      total_recibo: Number(reserva.total_recibo || 0),
      saldo_pendiente: Number(reserva.saldo_pendiente || 0)
    }
  ]);

  console.log('\nCálculo de renta esperado:');
  console.table([renta]);

  const montoActualSistema = redondear2(
    Number(reserva.monto_total_estimado || 0) > 0
      ? reserva.monto_total_estimado
      : reserva.renta_pactada_mensual
  );

  console.log('\nComparación de renta:');
  console.table([
    {
      actual_que_usaria_el_sistema: montoActualSistema,
      esperado_proporcional: renta.total_esperado,
      diferencia: redondear2(montoActualSistema - renta.total_esperado),
      observacion:
        montoActualSistema === renta.total_esperado
          ? 'OK'
          : 'REVISAR: parece estar cobrando monto mensual o monto no proporcional'
    }
  ]);

  const conceptos = await obtenerConceptosAplicables(pool, diasReserva);

  console.log('\nConceptos activos aplicables según la consulta actual:');
  console.table(
    conceptos.map((c) => ({
      id: c.concepto_cobro_id,
      codigo: c.codigo,
      nombre: c.nombre,
      categoria: c.categoria,
      metodo: c.metodo_calculo,
      aplica_en: c.aplica_en,
      desde_dias: c.aplica_desde_dias,
      monto_default: Number(c.monto_default || 0),
      prorrateable: Boolean(c.prorrateable),
      aplica_igv: Boolean(c.aplica_igv)
    }))
  );

  console.log('\nLíneas esperadas según regla propuesta:');

  const lineasEsperadas = conceptos.map((concepto) => {
    const esperado = calcularLineaEsperada({
      concepto,
      reserva,
      diasReserva
    });

    const igv = concepto.aplica_igv
      ? redondear2(esperado.importe_esperado * IGV_PORCENTAJE)
      : 0;

    return {
      codigo: concepto.codigo,
      metodo: concepto.metodo_calculo,
      regla: esperado.regla,
      cantidad_esperada: esperado.cantidad_esperada,
      precio_unitario_esperado: esperado.precio_unitario_esperado,
      importe_esperado: esperado.importe_esperado,
      igv_esperado: igv,
      total_linea_esperado: redondear2(esperado.importe_esperado + igv),
      detalle: esperado.detalle_calculo
    };
  });

  console.table(lineasEsperadas);

  const subtotalEsperado = redondear2(
    lineasEsperadas.reduce((total, linea) => {
      return total + Number(linea.importe_esperado || 0);
    }, 0)
  );

  const igvEsperado = redondear2(
    lineasEsperadas.reduce((total, linea) => {
      return total + Number(linea.igv_esperado || 0);
    }, 0)
  );

  console.log('\nTotales esperados según regla propuesta:');
  console.table([
    {
      subtotal_esperado: subtotalEsperado,
      igv_esperado: igvEsperado,
      total_esperado: redondear2(subtotalEsperado + igvEsperado)
    }
  ]);

  const detalles = await obtenerDetallesRecibo(
    pool,
    reserva.recibo_id
  );

  if (detalles.length > 0) {
    console.log('\nDetalles reales guardados en finance.ReciboDetalle:');

    console.table(
      detalles.map((d) => ({
        detalle_id: d.recibo_detalle_id,
        codigo: d.codigo,
        metodo: d.metodo_calculo,
        descripcion: d.descripcion,
        cantidad_guardada: Number(d.cantidad || 0),
        precio_unitario_guardado: Number(d.precio_unitario || 0),
        importe_guardado: Number(d.importe || 0)
      }))
    );

    console.log('\nComparación detalle real vs esperado:');

    const comparacion = detalles.map((detalle) => {
      const esperado = lineasEsperadas.find((linea) => {
        return linea.codigo === detalle.codigo;
      });

      if (!esperado) {
        return {
          codigo: detalle.codigo,
          estado: 'SIN_ESPERADO',
          cantidad_guardada: Number(detalle.cantidad || 0),
          cantidad_esperada: null,
          importe_guardado: Number(detalle.importe || 0),
          importe_esperado: null,
          diferencia_importe: null
        };
      }

      const cantidadGuardada = redondear2(detalle.cantidad);
      const cantidadEsperada = redondear2(esperado.cantidad_esperada);

      const importeGuardado = redondear2(detalle.importe);
      const importeEsperado = redondear2(esperado.importe_esperado);

      return {
        codigo: detalle.codigo,
        estado:
          importeGuardado === importeEsperado &&
          cantidadGuardada === cantidadEsperada
            ? 'OK'
            : 'REVISAR',
        cantidad_guardada: Number(detalle.cantidad || 0),
        cantidad_esperada: esperado.cantidad_esperada,
        importe_guardado: Number(detalle.importe || 0),
        importe_esperado: esperado.importe_esperado,
        diferencia_importe: redondear2(
          Number(detalle.importe || 0) -
            Number(esperado.importe_esperado || 0)
        )
      };
    });

    console.table(comparacion);
  } else {
    console.log(
      '\nEsta reserva aún no tiene detalles reales de recibo, o no tiene recibo activo.'
    );
  }

  const tablasFinancieras = await obtenerTablasFinancierasRelacionadas(pool);

  console.log('\nTablas financieras encontradas relacionadas con pagos/ingresos/recibos:');
  console.table(tablasFinancieras);
};

const main = async () => {
  try {
    const reservaIdArg = process.argv[2];
    const reservaId = reservaIdArg ? Number(reservaIdArg) : null;

    if (
      reservaIdArg &&
      (!Number.isInteger(reservaId) || reservaId <= 0)
    ) {
      console.error(
        'El argumento reserva_id debe ser un número entero positivo.'
      );
      console.error(
        'Ejemplo: node src/scripts/verRelacionesRecibosConceptos.js 21'
      );
      process.exit(1);
    }

    imprimirTitulo(
      'DIAGNÓSTICO DE RESERVA, CONCEPTOS, RECIBO Y DETALLES'
    );

    const pool = await getConnection();

    const reservas = await obtenerReserva(pool, reservaId);

    if (reservas.length === 0) {
      console.log('No se encontraron reservas para analizar.');
      process.exit(0);
    }

    if (!reservaId) {
      console.log(
        'No enviaste reserva_id. Se analizarán las últimas 10 reservas.'
      );
      console.log('Para analizar una específica:');
      console.log(
        'node src/scripts/verRelacionesRecibosConceptos.js 21'
      );
    }

    for (const reserva of reservas) {
      await analizarReserva(pool, reserva);
    }

    imprimirTitulo('DIAGNÓSTICO FINALIZADO');
    process.exit(0);
  } catch (error) {
    console.error('\nERROR EN DIAGNÓSTICO:');
    console.error(error);
    process.exit(1);
  }
};

main();