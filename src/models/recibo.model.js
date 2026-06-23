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

const obtenerPeriodoDesdeFecha = (fecha) => {
  const fechaTexto = obtenerFechaYYYYMMDD(fecha);
  const fechaDate = new Date(`${fechaTexto}T00:00:00`);

  return {
    anio: fechaDate.getFullYear(),
    mes: fechaDate.getMonth() + 1
  };
};

const calcularDiasReserva = (fechaInicio, fechaFin) => {
  const inicioTexto = obtenerFechaYYYYMMDD(fechaInicio);
  const finTexto = obtenerFechaYYYYMMDD(fechaFin);

  const inicio = new Date(`${inicioTexto}T00:00:00`);
  const fin = new Date(`${finTexto}T00:00:00`);

  const diferenciaMs = fin.getTime() - inicio.getTime();
  const dias = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

  return Math.max(dias, 1);
};

const calcularFechaVencimientoReserva = (fechaInicio, fechaEmision = new Date()) => {
  const inicioTexto = obtenerFechaYYYYMMDD(fechaInicio);
  const emisionTexto = obtenerFechaYYYYMMDD(fechaEmision);

  const inicio = new Date(`${inicioTexto}T00:00:00`);
  const emision = new Date(`${emisionTexto}T00:00:00`);

  const fechaVencimiento = new Date(inicio);
  fechaVencimiento.setDate(fechaVencimiento.getDate() - 1);

  if (fechaVencimiento < emision) {
    throw new Error('FECHA_VENCIMIENTO_RESERVA_EXPIRADA');
  }

  return fechaVencimiento;
};

const obtenerReservaParaReciboGestion = async ({
  usuario_gestor_id,
  reserva_id
}) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_gestor_id', sql.Int, usuario_gestor_id)
    .input('reserva_id', sql.Int, reserva_id)
    .query(`
      SELECT
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
        i.direccion_linea1,
        i.numero,
        i.distrito,
        i.ciudad,
        i.provincia,
        i.departamento,

        e.razon_social,
        e.nombre_comercial,

        p.publicacion_id,
        p.titulo AS titulo_publicacion,
        p.publicado_por_usuario_id,

        u.correo AS correo_inquilino,
        pu.nombres AS nombres_inquilino,
        pu.apellidos AS apellidos_inquilino,
        pu.tipo_documento,
        pu.numero_documento,
        pu.telefono AS telefono_inquilino

      FROM booking.Reserva r
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = r.inmueble_id
      INNER JOIN core.Empresa e
        ON e.empresa_id = i.empresa_id
      INNER JOIN catalog.Publicacion p
        ON p.inmueble_id = i.inmueble_id
      INNER JOIN auth.Usuario u
        ON u.usuario_id = r.inquilino_id
      LEFT JOIN core.PerfilUsuario pu
        ON pu.usuario_id = r.inquilino_id

      WHERE r.reserva_id = @reserva_id
        AND i.activo = 1
        AND i.deleted_at IS NULL
        AND (
          p.publicado_por_usuario_id = @usuario_gestor_id

          OR EXISTS (
            SELECT 1
            FROM core.EmpresaSecretario es
            WHERE es.empresa_id = i.empresa_id
              AND es.secretario_usuario_id = @usuario_gestor_id
              AND es.activo = 1
          )

          OR EXISTS (
            SELECT 1
            FROM auth.Usuario ua
            INNER JOIN auth.UsuarioRol ur
              ON ur.usuario_id = ua.usuario_id
            INNER JOIN auth.Rol rol
              ON rol.rol_id = ur.rol_id
            WHERE ua.usuario_id = @usuario_gestor_id
              AND ua.empresa_id = i.empresa_id
              AND ua.activo = 1
              AND ua.deleted_at IS NULL
              AND rol.nombre = 'ADMIN'
              AND rol.activo = 1
          )
        );
    `);

  return result.recordset[0] || null;
};

const obtenerCuentaCobroPorInmueble = async ({
  transaction,
  inmueble_id,
  codigo_inmueble
}) => {
  const cuentaExistenteResult = await new sql.Request(transaction)
    .input('inmueble_id', sql.Int, inmueble_id)
    .query(`
      SELECT
        cuenta_cobro_inmueble_id,
        inmueble_id,
        numero_recibo_base,
        dia_vencimiento,
        activo
      FROM finance.CuentaCobroInmueble
      WHERE inmueble_id = @inmueble_id;
    `);

  const cuentaExistente = cuentaExistenteResult.recordset[0];

  if (cuentaExistente) {
    return cuentaExistente;
  }

  const numeroReciboBase = `REC-${inmueble_id}-${String(codigo_inmueble || 'INM').slice(0, 20)}`;

  const cuentaCreadaResult = await new sql.Request(transaction)
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('numero_recibo_base', sql.NVarChar(50), numeroReciboBase)
    .query(`
      INSERT INTO finance.CuentaCobroInmueble (
        inmueble_id,
        numero_recibo_base,
        dia_vencimiento,
        activo
      )
      OUTPUT
        INSERTED.cuenta_cobro_inmueble_id,
        INSERTED.inmueble_id,
        INSERTED.numero_recibo_base,
        INSERTED.dia_vencimiento,
        INSERTED.activo
      VALUES (
        @inmueble_id,
        @numero_recibo_base,
        5,
        1
      );
    `);

  return cuentaCreadaResult.recordset[0];
};

const obtenerConceptosActivosParaReserva = async ({
  transaction,
  dias_reserva
}) => {
  const result = await new sql.Request(transaction)
    .input('dias_reserva', sql.Int, dias_reserva)
    .query(`
      SELECT
        concepto_cobro_id,
        codigo,
        nombre,
        descripcion,
        tipo_concepto,
        aplica_igv,
        monto_default,
        orden_impresion,
        categoria,
        metodo_calculo,
        aplica_en,
        aplica_desde_dias
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

const construirLineasRecibo = ({
  reserva,
  conceptos,
  dias_reserva
}) => {
  const conceptoRenta = conceptos.find(
    (concepto) => concepto.codigo === 'RENTA_RESERVA'
  );

  if (!conceptoRenta) {
    return {
      ok: false,
      codigo: 'CONCEPTO_RENTA_NO_CONFIGURADO',
      mensaje:
        'No existe el concepto del sistema RENTA_RESERVA. Verifica la configuración de conceptos.'
    };
  }

  const montoRenta = redondear2(
    Number(reserva.monto_total_estimado || 0) > 0
      ? reserva.monto_total_estimado
      : reserva.renta_pactada_mensual
  );

  if (montoRenta <= 0) {
    return {
      ok: false,
      codigo: 'RENTA_INVALIDA',
      mensaje:
        'La reserva no tiene un monto de renta válido para generar el recibo.'
    };
  }

  const lineas = [];

  lineas.push({
    concepto_cobro_id: conceptoRenta.concepto_cobro_id,
    codigo: conceptoRenta.codigo,
    descripcion: `Renta de reserva (${dias_reserva} día(s))`,
    cantidad: 1,
    precio_unitario: montoRenta,
    importe: montoRenta,
    aplica_igv: Boolean(conceptoRenta.aplica_igv),
    orden_impresion: 1
  });

  conceptos
    .filter((concepto) => concepto.codigo !== 'RENTA_RESERVA')
    .forEach((concepto, index) => {
      const monto = redondear2(concepto.monto_default);

      if (monto <= 0) return;

      lineas.push({
        concepto_cobro_id: concepto.concepto_cobro_id,
        codigo: concepto.codigo,
        descripcion: concepto.nombre,
        cantidad: 1,
        precio_unitario: monto,
        importe: monto,
        aplica_igv: Boolean(concepto.aplica_igv),
        orden_impresion: index + 2
      });
    });

  const subtotal = redondear2(
    lineas.reduce((total, linea) => total + Number(linea.importe || 0), 0)
  );

  const igv_total = redondear2(
    lineas.reduce((total, linea) => {
      if (!linea.aplica_igv) return total;

      return total + Number(linea.importe || 0) * IGV_PORCENTAJE;
    }, 0)
  );

  const total = redondear2(subtotal + igv_total);

  return {
    ok: true,
    lineas,
    subtotal,
    igv_total,
    total
  };
};

const obtenerReciboCompletoPorId = async (recibo_id) => {
  const pool = await getConnection();

  const reciboResult = await pool.request()
    .input('recibo_id', sql.Int, recibo_id)
    .query(`
      SELECT
        r.recibo_id,
        r.cuenta_cobro_inmueble_id,
        r.reserva_id,
        r.periodo_anio,
        r.periodo_mes,
        r.fecha_emision,
        r.fecha_vencimiento,
        r.estado_recibo,
        r.subtotal,
        r.igv_total,
        r.total,
        r.saldo_pendiente,
        r.emitido_por_usuario_id,
        r.pdf_url,
        r.observaciones,
        r.created_at,
        r.updated_at,

        cc.numero_recibo_base,

        res.inmueble_id,
        res.inquilino_id,
        res.fecha_inicio,
        res.fecha_fin,
        res.renta_pactada_mensual,
        res.moneda,

        i.empresa_id,

CONCAT(
  'B',
  RIGHT('000' + CAST(i.empresa_id AS VARCHAR(10)), 3)
) AS serie_empresa,

(
  SELECT COUNT(*)
  FROM finance.Recibo r2
  INNER JOIN booking.Reserva res2
    ON res2.reserva_id = r2.reserva_id
  INNER JOIN catalog.Inmueble i2
    ON i2.inmueble_id = res2.inmueble_id
  WHERE i2.empresa_id = i.empresa_id
    AND r2.estado_recibo <> 'ANULADO'
    AND r2.recibo_id <= r.recibo_id
) AS correlativo_empresa,

i.codigo AS codigo_inmueble,
        i.nombre AS nombre_inmueble,
        i.tipo_inmueble,
        i.direccion_linea1,
        i.numero,
        i.distrito,
        i.ciudad,
        i.provincia,
        i.departamento,

        e.razon_social,
        e.nombre_comercial,

        u.correo AS correo_inquilino,
        pu.nombres AS nombres_inquilino,
        pu.apellidos AS apellidos_inquilino,
        pu.tipo_documento,
        pu.numero_documento,
        pu.telefono AS telefono_inquilino

      FROM finance.Recibo r
      INNER JOIN finance.CuentaCobroInmueble cc
        ON cc.cuenta_cobro_inmueble_id = r.cuenta_cobro_inmueble_id
      LEFT JOIN booking.Reserva res
        ON res.reserva_id = r.reserva_id
      LEFT JOIN catalog.Inmueble i
        ON i.inmueble_id = res.inmueble_id
      LEFT JOIN core.Empresa e
        ON e.empresa_id = i.empresa_id
      LEFT JOIN auth.Usuario u
        ON u.usuario_id = res.inquilino_id
      LEFT JOIN core.PerfilUsuario pu
        ON pu.usuario_id = res.inquilino_id
      WHERE r.recibo_id = @recibo_id;
    `);

  const recibo = reciboResult.recordset[0];

  if (!recibo) {
    return null;
  }

  const detallesResult = await pool.request()
    .input('recibo_id', sql.Int, recibo_id)
    .query(`
      SELECT
        rd.recibo_detalle_id,
        rd.recibo_id,
        rd.concepto_cobro_id,
        rd.descripcion,
        rd.cantidad,
        rd.precio_unitario,
        rd.importe,
        rd.orden_impresion,
        rd.created_at,

        cc.codigo AS codigo_concepto,
        cc.nombre AS nombre_concepto,
        cc.aplica_igv
      FROM finance.ReciboDetalle rd
      INNER JOIN finance.ConceptoCobro cc
        ON cc.concepto_cobro_id = rd.concepto_cobro_id
      WHERE rd.recibo_id = @recibo_id
      ORDER BY rd.orden_impresion ASC;
    `);

  return {
    recibo,
    detalles: detallesResult.recordset
  };
};


const obtenerVistaPreviaReciboReservaGestion = async ({
  usuario_gestor_id,
  reserva_id
}) => {
  const pool = await getConnection();

  const reserva = await obtenerReservaParaReciboGestion({
    usuario_gestor_id,
    reserva_id
  });

  if (!reserva) {
    return {
      ok: false,
      codigo: 'RESERVA_NO_ENCONTRADA',
      mensaje:
        'La reserva no existe o no pertenece a la empresa gestionada.'
    };
  }

  const estadosPermitidos = ['APROBADA', 'ACTIVA', 'FINALIZADA'];

  if (!estadosPermitidos.includes(reserva.estado_reserva)) {
    return {
      ok: false,
      codigo: 'ESTADO_NO_PERMITIDO',
      mensaje:
        'Solo se puede revisar boleta para reservas aprobadas, activas o finalizadas.',
      estado_actual: reserva.estado_reserva
    };
  }

  const reciboExistenteResult = await pool.request()
    .input('reserva_id', sql.Int, reserva.reserva_id)
    .query(`
      SELECT TOP 1
        recibo_id
      FROM finance.Recibo
      WHERE reserva_id = @reserva_id
        AND estado_recibo <> 'ANULADO'
      ORDER BY recibo_id DESC;
    `);

  const reciboExistente = reciboExistenteResult.recordset[0];

  if (reciboExistente) {
    const reciboCompleto = await obtenerReciboCompletoPorId(
      reciboExistente.recibo_id
    );

    return {
      ok: false,
      codigo: 'RECIBO_EXISTENTE',
      mensaje:
        'Esta reserva ya tiene una boleta digital generada.',
      recibo: reciboCompleto?.recibo || null,
      detalles: reciboCompleto?.detalles || []
    };
  }

  const diasReserva = calcularDiasReserva(
    reserva.fecha_inicio,
    reserva.fecha_fin
  );

  const conceptos = await obtenerConceptosActivosParaReserva({
    transaction: pool,
    dias_reserva: diasReserva
  });

  const calculo = construirLineasRecibo({
    reserva,
    conceptos,
    dias_reserva: diasReserva
  });

  if (!calculo.ok) {
    return {
      ok: false,
      codigo: calculo.codigo,
      mensaje: calculo.mensaje
    };
  }

  const fechaVencimiento = calcularFechaVencimientoReserva(
    reserva.fecha_inicio
  );

  const conceptosPreview = calculo.lineas.map((linea) => {
    const igv = linea.aplica_igv
      ? redondear2(Number(linea.importe || 0) * IGV_PORCENTAJE)
      : 0;

    const totalLinea = redondear2(
      Number(linea.importe || 0) + igv
    );

    return {
      ...linea,
      igv,
      total_linea: totalLinea,
      obligatorio: linea.codigo === 'RENTA_RESERVA',
      editable: linea.codigo !== 'RENTA_RESERVA'
    };
  });

  return {
    ok: true,
    reserva,
    conceptos: conceptosPreview,
    subtotal: calculo.subtotal,
    igv_total: calculo.igv_total,
    total: calculo.total,
    dias_reserva: diasReserva,
    fecha_vencimiento: fechaVencimiento
  };
};

const generarReciboReservaGestion = async ({
  usuario_gestor_id,
  reserva_id,
  observaciones = null
}) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const reserva = await obtenerReservaParaReciboGestion({
      usuario_gestor_id,
      reserva_id
    });

    if (!reserva) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'RESERVA_NO_ENCONTRADA',
        mensaje:
          'La reserva no existe o no pertenece a la empresa gestionada.'
      };
    }

    const estadosPermitidos = ['APROBADA', 'ACTIVA', 'FINALIZADA'];

    if (!estadosPermitidos.includes(reserva.estado_reserva)) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'ESTADO_NO_PERMITIDO',
        mensaje:
          'Solo se puede generar boleta para reservas aprobadas, activas o finalizadas.',
        estado_actual: reserva.estado_reserva
      };
    }

    const reciboExistenteResult = await new sql.Request(transaction)
      .input('reserva_id', sql.Int, reserva.reserva_id)
      .query(`
        SELECT TOP 1
          recibo_id
        FROM finance.Recibo
        WHERE reserva_id = @reserva_id
          AND estado_recibo <> 'ANULADO'
        ORDER BY recibo_id DESC;
      `);

    const reciboExistente = reciboExistenteResult.recordset[0];

    if (reciboExistente) {
      await transaction.rollback();

      const reciboCompleto = await obtenerReciboCompletoPorId(
        reciboExistente.recibo_id
      );

      return {
        ok: false,
        codigo: 'RECIBO_EXISTENTE',
        mensaje:
          'Esta reserva ya tiene una boleta digital generada.',
        recibo: reciboCompleto?.recibo || null,
        detalles: reciboCompleto?.detalles || []
      };
    }

    const cuentaCobro = await obtenerCuentaCobroPorInmueble({
      transaction,
      inmueble_id: reserva.inmueble_id,
      codigo_inmueble: reserva.codigo_inmueble
    });

    const { anio, mes } = obtenerPeriodoDesdeFecha(
      reserva.fecha_inicio
    );

    

    const diasReserva = calcularDiasReserva(
      reserva.fecha_inicio,
      reserva.fecha_fin
    );

    const conceptos = await obtenerConceptosActivosParaReserva({
      transaction,
      dias_reserva: diasReserva
    });

    const calculo = construirLineasRecibo({
      reserva,
      conceptos,
      dias_reserva: diasReserva
    });

    if (!calculo.ok) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: calculo.codigo,
        mensaje: calculo.mensaje
      };
    }

    const fechaVencimiento = calcularFechaVencimientoReserva(
  reserva.fecha_inicio
);

    const reciboResult = await new sql.Request(transaction)
      .input(
        'cuenta_cobro_inmueble_id',
        sql.Int,
        cuentaCobro.cuenta_cobro_inmueble_id
      )
      .input('reserva_id', sql.Int, reserva.reserva_id)
      .input('periodo_anio', sql.Int, anio)
      .input('periodo_mes', sql.TinyInt, mes)
      .input('fecha_vencimiento', sql.Date, fechaVencimiento)
      .input('subtotal', sql.Decimal(12, 2), calculo.subtotal)
      .input('igv_total', sql.Decimal(12, 2), calculo.igv_total)
      .input('total', sql.Decimal(12, 2), calculo.total)
      .input('saldo_pendiente', sql.Decimal(12, 2), calculo.total)
      .input('emitido_por_usuario_id', sql.Int, usuario_gestor_id)
      .input(
        'observaciones',
        sql.NVarChar(500),
        observaciones || 'Boleta digital generada desde la reserva.'
      )
      .query(`
        INSERT INTO finance.Recibo (
          cuenta_cobro_inmueble_id,
          reserva_id,
          periodo_anio,
          periodo_mes,
          fecha_vencimiento,
          estado_recibo,
          subtotal,
          igv_total,
          total,
          saldo_pendiente,
          emitido_por_usuario_id,
          observaciones
        )
        OUTPUT
          INSERTED.recibo_id,
          INSERTED.cuenta_cobro_inmueble_id,
          INSERTED.reserva_id,
          INSERTED.periodo_anio,
          INSERTED.periodo_mes,
          INSERTED.fecha_emision,
          INSERTED.fecha_vencimiento,
          INSERTED.estado_recibo,
          INSERTED.subtotal,
          INSERTED.igv_total,
          INSERTED.total,
          INSERTED.saldo_pendiente,
          INSERTED.emitido_por_usuario_id,
          INSERTED.observaciones,
          INSERTED.created_at
        VALUES (
          @cuenta_cobro_inmueble_id,
          @reserva_id,
          @periodo_anio,
          @periodo_mes,
          @fecha_vencimiento,
          'EMITIDO',
          @subtotal,
          @igv_total,
          @total,
          @saldo_pendiente,
          @emitido_por_usuario_id,
          @observaciones
        );
      `);

    const recibo = reciboResult.recordset[0];

    for (const linea of calculo.lineas) {
      await new sql.Request(transaction)
        .input('recibo_id', sql.Int, recibo.recibo_id)
        .input('concepto_cobro_id', sql.Int, linea.concepto_cobro_id)
        .input('descripcion', sql.NVarChar(200), linea.descripcion)
        .input('cantidad', sql.Decimal(12, 2), linea.cantidad)
        .input('precio_unitario', sql.Decimal(12, 2), linea.precio_unitario)
        .input('importe', sql.Decimal(12, 2), linea.importe)
        .input('orden_impresion', sql.Int, linea.orden_impresion)
        .query(`
          INSERT INTO finance.ReciboDetalle (
            recibo_id,
            concepto_cobro_id,
            descripcion,
            cantidad,
            precio_unitario,
            importe,
            orden_impresion
          )
          VALUES (
            @recibo_id,
            @concepto_cobro_id,
            @descripcion,
            @cantidad,
            @precio_unitario,
            @importe,
            @orden_impresion
          );
        `);
    }

    await transaction.commit();

    const reciboCompleto = await obtenerReciboCompletoPorId(
      recibo.recibo_id
    );

    return {
      ok: true,
      recibo: reciboCompleto.recibo,
      detalles: reciboCompleto.detalles,
      reserva
    };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        'Error al revertir generación de recibo:',
        rollbackError
      );
    }

    throw error;
  }
};

const listarRecibosReservaAutorizados = async ({
  usuario_id,
  reserva_id
}) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('reserva_id', sql.Int, reserva_id)
    .query(`
      SELECT
        r.recibo_id,
        r.cuenta_cobro_inmueble_id,
        r.reserva_id,
        r.periodo_anio,
        r.periodo_mes,
        r.fecha_emision,
        r.fecha_vencimiento,
        r.estado_recibo,
        r.subtotal,
        r.igv_total,
        r.total,
        r.saldo_pendiente,
        r.pdf_url,
        r.observaciones,
        r.created_at,

        cc.numero_recibo_base,

        res.inquilino_id,
        res.fecha_inicio,
        res.fecha_fin,
        res.moneda,

       i.empresa_id,

CONCAT(
  'B',
  RIGHT('000' + CAST(i.empresa_id AS VARCHAR(10)), 3)
) AS serie_empresa,

(
  SELECT COUNT(*)
  FROM finance.Recibo r2
  INNER JOIN booking.Reserva res2
    ON res2.reserva_id = r2.reserva_id
  INNER JOIN catalog.Inmueble i2
    ON i2.inmueble_id = res2.inmueble_id
  WHERE i2.empresa_id = i.empresa_id
    AND r2.estado_recibo <> 'ANULADO'
    AND r2.recibo_id <= r.recibo_id
) AS correlativo_empresa,

i.codigo AS codigo_inmueble,
        i.nombre AS nombre_inmueble,
        i.tipo_inmueble

      FROM finance.Recibo r
      INNER JOIN finance.CuentaCobroInmueble cc
        ON cc.cuenta_cobro_inmueble_id = r.cuenta_cobro_inmueble_id
      INNER JOIN booking.Reserva res
        ON res.reserva_id = r.reserva_id
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = res.inmueble_id
      WHERE r.reserva_id = @reserva_id
        AND r.estado_recibo <> 'ANULADO'
        AND (
          res.inquilino_id = @usuario_id

          OR EXISTS (
            SELECT 1
            FROM catalog.Publicacion p
            WHERE p.inmueble_id = i.inmueble_id
              AND p.publicado_por_usuario_id = @usuario_id
          )

          OR EXISTS (
            SELECT 1
            FROM core.EmpresaSecretario es
            WHERE es.empresa_id = i.empresa_id
              AND es.secretario_usuario_id = @usuario_id
              AND es.activo = 1
          )

          OR EXISTS (
            SELECT 1
            FROM auth.Usuario ua
            INNER JOIN auth.UsuarioRol ur
              ON ur.usuario_id = ua.usuario_id
            INNER JOIN auth.Rol rol
              ON rol.rol_id = ur.rol_id
            WHERE ua.usuario_id = @usuario_id
              AND ua.empresa_id = i.empresa_id
              AND ua.activo = 1
              AND ua.deleted_at IS NULL
              AND rol.nombre = 'ADMIN'
              AND rol.activo = 1
          )
        )
      ORDER BY r.fecha_emision DESC;
    `);

  return result.recordset;
};

const obtenerReciboCompletoAutorizado = async ({
  usuario_id,
  recibo_id
}) => {
  const pool = await getConnection();

  const accesoResult = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('recibo_id', sql.Int, recibo_id)
    .query(`
      SELECT TOP 1
        r.recibo_id
      FROM finance.Recibo r
      INNER JOIN booking.Reserva res
        ON res.reserva_id = r.reserva_id
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = res.inmueble_id
      WHERE r.recibo_id = @recibo_id
        AND r.estado_recibo <> 'ANULADO'
        AND (
          res.inquilino_id = @usuario_id

          OR EXISTS (
            SELECT 1
            FROM catalog.Publicacion p
            WHERE p.inmueble_id = i.inmueble_id
              AND p.publicado_por_usuario_id = @usuario_id
          )

          OR EXISTS (
            SELECT 1
            FROM core.EmpresaSecretario es
            WHERE es.empresa_id = i.empresa_id
              AND es.secretario_usuario_id = @usuario_id
              AND es.activo = 1
          )

          OR EXISTS (
            SELECT 1
            FROM auth.Usuario ua
            INNER JOIN auth.UsuarioRol ur
              ON ur.usuario_id = ua.usuario_id
            INNER JOIN auth.Rol rol
              ON rol.rol_id = ur.rol_id
            WHERE ua.usuario_id = @usuario_id
              AND ua.empresa_id = i.empresa_id
              AND ua.activo = 1
              AND ua.deleted_at IS NULL
              AND rol.nombre = 'ADMIN'
              AND rol.activo = 1
          )
        );
    `);

  const acceso = accesoResult.recordset[0];

  if (!acceso) {
    return null;
  }

  return obtenerReciboCompletoPorId(recibo_id);
};

module.exports = {
  obtenerReservaParaReciboGestion,
  obtenerVistaPreviaReciboReservaGestion,
  generarReciboReservaGestion,
  obtenerReciboCompletoPorId,
  listarRecibosReservaAutorizados,
  obtenerReciboCompletoAutorizado
};