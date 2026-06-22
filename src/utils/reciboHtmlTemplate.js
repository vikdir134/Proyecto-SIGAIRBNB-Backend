const escaparHtml = (valor) => {
  if (valor === null || valor === undefined) return '';

  return String(valor)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const formatearFecha = (valor) => {
  if (!valor) return '-';

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return '-';
  }

  return fecha.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const formatearMoneda = (valor, moneda = 'PEN') => {
  const numero = Number(valor || 0);

  const simbolo = moneda === 'USD' ? '$' : 'S/';

  return `${simbolo} ${numero.toFixed(2)}`;
};

const obtenerNombreInquilino = (recibo) => {
  const nombreCompleto = `${recibo.nombres_inquilino || ''} ${recibo.apellidos_inquilino || ''}`.trim();

  return nombreCompleto || recibo.correo_inquilino || 'Inquilino';
};

const generarReciboHtml = ({
  recibo,
  detalles
}) => {
  const moneda = recibo.moneda || 'PEN';

  const numeroRecibo =
  recibo.serie_empresa && recibo.correlativo_empresa
    ? `${recibo.serie_empresa}-${String(
        recibo.correlativo_empresa
      ).padStart(6, '0')}`
    : `B-${String(recibo.recibo_id).padStart(6, '0')}`;

  const direccionInmueble = [
    recibo.direccion_linea1,
    recibo.numero,
    recibo.distrito,
    recibo.ciudad,
    recibo.departamento
  ]
    .filter(Boolean)
    .join(', ');

  const filasDetalle = detalles.map((detalle) => {
    const importe = Number(detalle.importe || 0);
    const igv = detalle.aplica_igv
      ? importe * 0.18
      : 0;

    const totalLinea = importe + igv;

    return `
      <tr>
        <td>
          <strong>${escaparHtml(detalle.descripcion)}</strong>
          <span>${escaparHtml(detalle.codigo_concepto || '')}</span>
        </td>
        <td class="text-center">${Number(detalle.cantidad || 0).toFixed(2)}</td>
        <td class="text-right">${formatearMoneda(detalle.precio_unitario, moneda)}</td>
        <td class="text-right">${formatearMoneda(detalle.importe, moneda)}</td>
        <td class="text-right">${formatearMoneda(igv, moneda)}</td>
        <td class="text-right total-linea">${formatearMoneda(totalLinea, moneda)}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Boleta Digital ${escaparHtml(numeroRecibo)}</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      background: #ffffff;
      font-size: 12px;
    }

    .page {
      width: 100%;
      padding: 4px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 3px solid #7f0000;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }

    .empresa h1 {
      margin: 0 0 6px;
      color: #7f0000;
      font-size: 24px;
      letter-spacing: 0.5px;
    }

    .empresa p {
      margin: 3px 0;
      color: #4b5563;
    }

    .documento-box {
      width: 220px;
      border: 2px solid #7f0000;
      border-radius: 10px;
      overflow: hidden;
      text-align: center;
      align-self: flex-start;
    }

    .documento-box .tipo {
      background: #7f0000;
      color: #ffffff;
      padding: 10px 8px;
      font-size: 15px;
      font-weight: bold;
      text-transform: uppercase;
    }

    .documento-box .numero {
      padding: 14px 8px;
      font-size: 18px;
      font-weight: bold;
      color: #111827;
    }

    .section-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 18px;
    }

    .card {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 14px;
      background: #fafafa;
    }

    .card h2 {
      margin: 0 0 10px;
      color: #7f0000;
      font-size: 14px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
    }

    .dato {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin: 6px 0;
    }

    .dato .label {
      color: #6b7280;
      font-weight: bold;
      min-width: 110px;
    }

    .dato .value {
      text-align: right;
      color: #111827;
      font-weight: 500;
    }

    .tabla-section {
      margin-top: 14px;
    }

    .tabla-section h2 {
      color: #7f0000;
      font-size: 15px;
      margin: 0 0 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 10px;
    }

    thead {
      background: #7f0000;
      color: #ffffff;
    }

    th {
      padding: 10px 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      text-align: left;
    }

    td {
      padding: 10px 8px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }

    td span {
      display: block;
      margin-top: 3px;
      color: #6b7280;
      font-size: 10px;
    }

    tbody tr:nth-child(even) {
      background: #fafafa;
    }

    .text-center {
      text-align: center;
    }

    .text-right {
      text-align: right;
    }

    .total-linea {
      font-weight: bold;
      color: #111827;
    }

    .resumen {
      display: flex;
      justify-content: flex-end;
      margin-top: 18px;
    }

    .resumen-box {
      width: 320px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }

    .resumen-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid #e5e7eb;
    }

    .resumen-row:last-child {
      border-bottom: none;
    }

    .resumen-row.total {
      background: #7f0000;
      color: #ffffff;
      font-size: 16px;
      font-weight: bold;
    }

    .estado {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: #fff7ed;
      color: #c2410c;
      font-weight: bold;
      font-size: 11px;
    }

    .footer {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 10px;
      line-height: 1.5;
    }

    .observaciones {
      margin-top: 18px;
      border-left: 4px solid #ff6600;
      background: #fff7ed;
      padding: 10px 12px;
      color: #7c2d12;
      border-radius: 6px;
    }
  </style>
</head>

<body>
  <div class="page">
    <div class="header">
      <div class="empresa">
        <h1>${escaparHtml(recibo.nombre_comercial || recibo.razon_social || 'Stay.pe')}</h1>
        <p><strong>Razón social:</strong> ${escaparHtml(recibo.razon_social || '-')}</p>
        <p><strong>Sistema:</strong> Gestión de inmuebles y reservas</p>
        <p><strong>Fecha de emisión:</strong> ${formatearFecha(recibo.fecha_emision)}</p>
      </div>

      <div class="documento-box">
        <div class="tipo">Boleta Digital</div>
        <div class="numero">${escaparHtml(numeroRecibo)}</div>
      </div>
    </div>

    <div class="section-grid">
      <div class="card">
        <h2>Datos del inquilino</h2>

        <div class="dato">
          <div class="label">Nombre</div>
          <div class="value">${escaparHtml(obtenerNombreInquilino(recibo))}</div>
        </div>

        <div class="dato">
          <div class="label">Documento</div>
          <div class="value">${escaparHtml(recibo.tipo_documento || '-')} ${escaparHtml(recibo.numero_documento || '')}</div>
        </div>

        <div class="dato">
          <div class="label">Correo</div>
          <div class="value">${escaparHtml(recibo.correo_inquilino || '-')}</div>
        </div>

        <div class="dato">
          <div class="label">Teléfono</div>
          <div class="value">${escaparHtml(recibo.telefono_inquilino || '-')}</div>
        </div>
      </div>

      <div class="card">
        <h2>Datos del inmueble</h2>

        <div class="dato">
          <div class="label">Código</div>
          <div class="value">${escaparHtml(recibo.codigo_inmueble || '-')}</div>
        </div>

        <div class="dato">
          <div class="label">Inmueble</div>
          <div class="value">${escaparHtml(recibo.nombre_inmueble || '-')}</div>
        </div>

        <div class="dato">
          <div class="label">Tipo</div>
          <div class="value">${escaparHtml(recibo.tipo_inmueble || '-')}</div>
        </div>

        <div class="dato">
          <div class="label">Dirección</div>
          <div class="value">${escaparHtml(direccionInmueble || '-')}</div>
        </div>
      </div>
    </div>

    <div class="section-grid">
      <div class="card">
        <h2>Periodo de reserva</h2>

        <div class="dato">
          <div class="label">Fecha inicio</div>
          <div class="value">${formatearFecha(recibo.fecha_inicio)}</div>
        </div>

        <div class="dato">
          <div class="label">Fecha fin</div>
          <div class="value">${formatearFecha(recibo.fecha_fin)}</div>
        </div>

        <div class="dato">
          <div class="label">Periodo</div>
          <div class="value">${escaparHtml(recibo.periodo_mes)}/${escaparHtml(recibo.periodo_anio)}</div>
        </div>
      </div>

      <div class="card">
        <h2>Estado del documento</h2>

        <div class="dato">
          <div class="label">Estado</div>
          <div class="value">
            <span class="estado">${escaparHtml(recibo.estado_recibo || 'EMITIDO')}</span>
          </div>
        </div>

        <div class="dato">
          <div class="label">Vencimiento</div>
          <div class="value">${formatearFecha(recibo.fecha_vencimiento)}</div>
        </div>

        <div class="dato">
          <div class="label">Saldo pendiente</div>
          <div class="value">${formatearMoneda(recibo.saldo_pendiente, moneda)}</div>
        </div>
      </div>
    </div>

    <div class="tabla-section">
      <h2>Detalle de conceptos cobrados</h2>

      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th class="text-center">Cant.</th>
            <th class="text-right">P. Unitario</th>
            <th class="text-right">Subtotal</th>
            <th class="text-right">IGV</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>

        <tbody>
          ${filasDetalle}
        </tbody>
      </table>
    </div>

    <div class="resumen">
      <div class="resumen-box">
        <div class="resumen-row">
          <span>Subtotal</span>
          <strong>${formatearMoneda(recibo.subtotal, moneda)}</strong>
        </div>

        <div class="resumen-row">
          <span>IGV 18%</span>
          <strong>${formatearMoneda(recibo.igv_total, moneda)}</strong>
        </div>

        <div class="resumen-row total">
          <span>Total</span>
          <strong>${formatearMoneda(recibo.total, moneda)}</strong>
        </div>
      </div>
    </div>

    ${
      recibo.observaciones
        ? `
          <div class="observaciones">
            <strong>Observaciones:</strong>
            ${escaparHtml(recibo.observaciones)}
          </div>
        `
        : ''
    }

    <div class="footer">
      Este documento corresponde a una boleta digital interna generada por el sistema Stay.pe.
      No representa un comprobante electrónico validado por SUNAT.
      El detalle de conceptos se emite de acuerdo con la reserva registrada y los conceptos de cobro configurados por la empresa.
    </div>
  </div>
</body>
</html>
`;
};

module.exports = {
  generarReciboHtml
};