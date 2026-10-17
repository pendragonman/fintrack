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

export async function sendPasswordResetEmail(to, name, link) {
  await transporter.sendMail({
    from: `"FinTrack" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Reset your FinTrack password",
    text: `Hi ${name},\n\nSomeone asked to reset the password for your FinTrack account.\n\nSet a new password here: ${link}\n\nThis link expires in 30 minutes. If you didn't request it, you can safely ignore this email — your password will not change.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Hi ${name},</p>
        <p>Someone asked to reset the password for your FinTrack account.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #7c3aed; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Set a new password</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">This link expires in 30 minutes.</p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request it, you can safely ignore this email — your password will not change.</p>
        <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Or paste this into your browser: ${link}</p>
      </div>
    `,
  });
}

export default transporter;
