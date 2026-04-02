// Notification service for sending emails and SMS.
// Providers are loaded lazily so the backend can still start when
// optional notification packages or credentials are unavailable.
//
// SMTP configuration (add to your .env / .env.local):
//   Generic SMTP (recommended for custom domains like admin@kiu.examcard.com):
//     SMTP_HOST=mail.kiu.examcard.com   (or smtp.gmail.com / smtp.office365.com etc.)
//     SMTP_PORT=587
//     SMTP_SECURE=false                 (true for port 465 / SSL, false for STARTTLS on 587)
//     SMTP_USER=admin@kiu.examcard.com
//     SMTP_PASS=your-email-password
//     EMAIL_FROM=KIU Exam Portal <admin@kiu.examcard.com>
//
//   Legacy Gmail shortcut (backward-compat, still works):
//     EMAIL_USER=you@gmail.com
//     EMAIL_PASS=your-app-password

let nodemailerLoader;
let twilioLoader;

async function loadNodemailer() {
  if (!nodemailerLoader) {
    nodemailerLoader = import('nodemailer')
      .then((module) => module.default ?? module)
      .catch(() => null);
  }

  return nodemailerLoader;
}

async function loadTwilio() {
  if (!twilioLoader) {
    twilioLoader = import('twilio')
      .then((module) => module.default ?? module)
      .catch(() => null);
  }

  return twilioLoader;
}

async function getTransporter() {
  const nodemailer = await loadNodemailer();
  if (!nodemailer) return null;

  // Prefer generic SMTP config (supports any domain / host)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Legacy Gmail shortcut
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  return null;
}

function getSenderAddress() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.SMTP_USER) return process.env.SMTP_USER;
  return process.env.EMAIL_USER ?? 'noreply@kiu.examcard.com';
}

export async function getEmailStatus() {
  const nodemailer = await loadNodemailer();
  const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const hasGmail = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  return {
    configured: !!(nodemailer && (hasSmtp || hasGmail)),
    provider: hasSmtp ? 'smtp' : hasGmail ? 'gmail' : 'none',
    from: getSenderAddress(),
    host: process.env.SMTP_HOST ?? (hasGmail ? 'smtp.gmail.com' : null),
  };
}

export async function sendEmail(to, subject, text) {
  const transporter = await getTransporter();

  if (!transporter) {
    console.warn('[notification] Email provider unavailable; skipping email send.');
    return { skipped: true, channel: 'email' };
  }

  const mailOptions = {
    from: getSenderAddress(),
    to,
    subject,
    text,
  };

  await transporter.sendMail(mailOptions);
  return { skipped: false, channel: 'email' };
}

export async function sendSms(to, body) {
  const twilio = await loadTwilio();

  if (!twilio || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn('[notification] SMS provider unavailable; skipping SMS send.');
    return { skipped: true, channel: 'sms' };
  }

  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  await twilioClient.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  });

  return { skipped: false, channel: 'sms' };
}
