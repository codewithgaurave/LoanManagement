const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
  // If email credentials are not set, log and return true so caller does not block or timeout
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[EMAIL] EMAIL_USER or EMAIL_PASS not configured. Skipping SMTP send to:', to);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
    });

    const mailOptions = {
      from: `"HAUS NUO-Pay" <${process.env.EMAIL_USER || 'no-reply@hausnuopay.com'}>`,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return true;
  } catch (error) {
    console.error('Error sending email:', error.message);
    // Return true with fallback so UI does not hang or error out for the user
    return true;
  }
};

module.exports = sendEmail;
