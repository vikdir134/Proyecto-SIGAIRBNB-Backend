const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const { getConnection } = require('./config/db');

// Aqui conectamos las rutas
const authRoutes = require('./routes/auth.routes');
const edificioRoutes = require('./routes/edificio.routes');
const perfilRoutes = require('./routes/perfil.routes');
const adminRoutes = require('./routes/admin.routes');
const disponibilidadRoutes = require('./routes/disponibilidad.routes');
const publicacionRoutes = require('./routes/publicacion.routes');
const reservaRoutes = require('./routes/reserva.routes');
const secretarioRoutes = require('./routes/secretario.routes');
const notificacionRoutes = require('./routes/notificacion.routes');
const conceptoCobroRoutes = require('./routes/conceptoCobro.routes');
const reciboRoutes = require('./routes/recibo.routes');
const pagoRoutes = require('./routes/pago.routes');
const mantenimientoRoutes = require('./routes/mantenimiento.routes');
const ingresoAlquilerRoutes = require('./routes/ingresoAlquiler.routes');
const tarifaRoutes = require('./routes/tarifa.routes');
const reporteRoutes = require('./routes/reporte.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/edificios', edificioRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);
app.use('/api/publicaciones', publicacionRoutes);
app.use('/api/reservas', reservaRoutes);
app.use('/api/secretarios', secretarioRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/conceptos-cobro', conceptoCobroRoutes);
app.use('/api/recibos', reciboRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/mantenimiento', mantenimientoRoutes);
app.use('/api/ingresos-alquiler', ingresoAlquilerRoutes);
app.use('/api/tarifas', tarifaRoutes);
app.use('/api/reportes', reporteRoutes);

app.get('/', (req, res) => {
  res.json({
    mensaje: 'Backend del Sistema Integral de Gestión Airbnb funcionando correctamente'
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT 
        DB_NAME() AS base_datos,
        SYSDATETIME() AS fecha_servidor
    `);

    res.json({
      mensaje: 'Conexión correcta con SQL Server',
      data: result.recordset[0]
    });
  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al conectar con SQL Server',
      error: error.message
    });
  }
});

app.get('/api/test-usuarios', async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT TOP 5
        usuario_id,
        correo,
        estado,
        email_verificado,
        activo,
        created_at
      FROM auth.Usuario
      ORDER BY usuario_id DESC
    `);

    res.json({
      mensaje: 'Consulta a auth.Usuario realizada correctamente',
      total: result.recordset.length,
      data: result.recordset
    });
  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al consultar usuarios',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor backend ejecutándose en http://localhost:${PORT}`);
});