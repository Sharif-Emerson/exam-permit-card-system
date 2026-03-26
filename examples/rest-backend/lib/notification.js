// Notification service for sending emails and SMS
// Uses nodemailer for email and Twilio for SMS
import nodemailer from 'nodemailer';
import twilio from 'twilio';

// Email setup (using Gmail SMTP for demo; use SendGrid/Mailgun in production)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendEmail(to, subject, text) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  };
  await transporter.sendMail(mailOptions);
}

// Twilio SMS setup
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

export async function sendSms(to, body) {
  await twilioClient.messages.create({
    body,
    from: twilioFrom,
    to,
  });
}
