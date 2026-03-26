// Notification service for sending emails and SMS.
// Providers are loaded lazily so the backend can still start when
// optional notification packages or credentials are unavailable.

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

  if (!nodemailer || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function sendEmail(to, subject, text) {
  const transporter = await getTransporter();

  if (!transporter) {
    console.warn('[notification] Email provider unavailable; skipping email send.');
    return { skipped: true, channel: 'email' };
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
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
