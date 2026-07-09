import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del transportador SMTP leyendo del .env
const smtpConfig = {
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  },
  tls: {
    rejectUnauthorized: false
  }
};

// Comprobación de si las variables SMTP están completas
const isSmtpConfigured = () => {
  return (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

// Genera el contenido HTML del correo según el tipo
function buildEmailHtml(code, type) {
  const isLogin = type === 'login';
  const title = isLogin ? 'Código de Seguridad (2FA)' : 'Verifica tu cuenta en JobAuto';
  const description = isLogin
    ? 'Has iniciado sesión en JobAuto. Usa el siguiente código de seguridad de 6 dígitos para confirmar tu acceso:'
    : 'Has solicitado registrarte en JobAuto. Usa el siguiente código de verificación de 6 dígitos para activar tu cuenta de inmediato:';
  const validity = isLogin ? '10 minutos' : '15 minutos';
  const gradientStart = isLogin ? '#6366f1' : '#10b981';
  const gradientEnd = isLogin ? '#8b5cf6' : '#6366f1';
  const emoji = isLogin ? '🔒' : '🚀';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #060913; color: #f3f4f6; padding: 40px 20px; text-align: center; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.08);">
      <div style="width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px;">
        <span style="font-size: 28px; color: white; line-height: 56px;">${emoji}</span>
      </div>
      
      <h2 style="font-size: 24px; color: white; margin: 0 0 10px 0; font-weight: 700; letter-spacing: -0.5px;">${title}</h2>
      <p style="font-size: 14px; color: #9ca3af; margin: 0 0 24px 0; line-height: 1.5;">${description}</p>
      
      <div style="background-color: #121829; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 16px; font-size: 32px; font-weight: 700; color: #10b981; letter-spacing: 6px; display: inline-block; margin-bottom: 24px; font-family: monospace;">
        ${code}
      </div>
      
      <p style="font-size: 12px; color: #6b7280; margin: 0 0 24px 0;">Este código de un solo uso es válido por ${validity}.</p>
      
      <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; font-size: 11px; color: #4b5563;">
        Si no solicitaste este código, puedes ignorar este correo de forma segura.
      </div>
    </div>
  `;
}

/**
 * Envía un correo de verificación OTP.
 * @param {string} toEmail - Correo destino
 * @param {string} code - Código OTP de 6 dígitos
 * @param {'register'|'login'} type - Tipo de verificación
 */
export async function sendVerificationEmail(toEmail, code, type = 'register') {
  // 1. Fallback a consola si no hay SMTP configurado
  if (!isSmtpConfigured()) {
    console.log(`\n==================================================`);
    console.log(`[SMTP NO CONFIGURADO] Imprimiendo OTP en consola.`);
    console.log(`Código para ${toEmail}: ${code}`);
    console.log(`==================================================\n`);
    return { sent: false, fallback: true };
  }

  // 2. Envío real mediante SMTP
  try {
    const transporter = nodemailer.createTransport(smtpConfig);

    const isLogin = type === 'login';
    const fromName = isLogin ? 'JobAuto Seguridad' : 'JobAuto';
    const subject = isLogin
      ? `Código de Seguridad 2FA: ${code}`
      : `Código de Verificación JobAuto: ${code}`;

    const htmlContent = buildEmailHtml(code, type);
    const ccEmail = process.env.SMTP_CC || '';

    const mailOptions = {
      from: `"${fromName}" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      text: `Tu código de ${isLogin ? 'seguridad 2FA' : 'verificación'} de JobAuto es: ${code}`,
      html: htmlContent
    };

    if (ccEmail) {
      mailOptions.cc = ccEmail;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log(`[SMTP] Correo de ${type} enviado con éxito a ${toEmail}. MessageID: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SMTP ERROR] Fallo al enviar correo de ${type} a ${toEmail}:`, error.message);
    
    // Fallback a consola por seguridad si falla el SMTP configurado
    console.log(`\n==================================================`);
    console.log(`[SMTP ERROR FALLBACK] Código OTP para ${toEmail}: ${code}`);
    console.log(`==================================================\n`);
    
    return { sent: false, error: error.message };
  }
}
