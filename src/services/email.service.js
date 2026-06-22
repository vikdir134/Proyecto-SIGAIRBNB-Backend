const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const enviarCorreoVerificacion = async ({ correo, nombres, token }) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/VerificarEmail?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: correo,
    subject: 'Verifica tu cuenta en Stay.pe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Bienvenido a Stay.pe, ${nombres}</h2>

        <p>Gracias por registrarte en nuestra plataforma.</p>

        <p>Para activar tu cuenta, haz clic en el siguiente botón:</p>

        <p style="margin: 24px 0;">
          <a href="${verificationUrl}"
             style="background:#ff385c;color:white;padding:12px 20px;text-decoration:none;border-radius:8px;">
            Verificar mi correo
          </a>
        </p>

        <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>

        <p>${verificationUrl}</p>

        <p>Este enlace vencerá en 24 horas.</p>
      </div>
    `
  });
};

const enviarCorreoRecuperacionPassword = async ({ correo, token }) => {
  const resetUrl = `${process.env.FRONTEND_URL}/RestablecerPassword?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: correo,
    subject: 'Restablece tu contraseña en Stay.pe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Restablecimiento de contraseña</h2>

        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Stay.pe.</p>

        <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>

        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background:#a20f46;color:white;padding:12px 20px;text-decoration:none;border-radius:8px;">
            Restablecer contraseña
          </a>
        </p>

        <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>

        <p>${resetUrl}</p>

        <p>Este enlace vencerá en 1 hora.</p>

        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      </div>
    `
  });
};
module.exports = {
  enviarCorreoVerificacion,
  enviarCorreoRecuperacionPassword
};