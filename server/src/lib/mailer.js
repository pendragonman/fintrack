import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 10_000,
});

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendVerificationEmail(to, name, code) {
  await transporter.sendMail({
    from: `"FinTrack" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your verification code: ${code}`,
    text: `Hi ${name},\n\nYour FinTrack verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Verify your email</h2>
        <p>Hi ${name},</p>
        <p>Your FinTrack verification code is:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #7c3aed;">${code}</p>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 15 minutes.</p>
      </div>
    `,
  });
}

export default transporter;
