const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const sendEmail = async (to, subject, text) => {
  console.log("\n=========================================");
  console.log(`[EMAIL SIMULATOR] To: ${to}`);
  console.log(`[EMAIL SIMULATOR] Subject: ${subject}`);
  console.log(`[EMAIL SIMULATOR] Body: ${text}`);
  console.log("=========================================\n");

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Energy Mgmt System" <no-reply@energymgmt.com>',
        to,
        subject,
        text,
      });
      console.log(`Email sent successfully to ${to}`);
    } catch (err) {
      console.error(`Failed to send email to ${to}:`, err.message);
    }
  }
};

module.exports = { sendEmail };
