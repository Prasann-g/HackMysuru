import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { OtpProvider, DeliveryMethod } from '../types/otp.js';
import { CONFIG } from '../config.js';

export class NodemailerOtpProvider implements OtpProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: CONFIG.SMTP_HOST,
      port: CONFIG.SMTP_PORT,
      secure: CONFIG.SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: CONFIG.SMTP_USER,
        pass: CONFIG.SMTP_PASS,
      },
    });
  }

  async sendChallenge(identifier: string, code: string, method: DeliveryMethod): Promise<void> {
    // Only handle EMAIL for now. SMS would require a different provider logic.
    if (method !== 'EMAIL') {
      throw new Error(`NodemailerOtpProvider does not support delivery method: ${method}`);
    }

    try {
      await this.transporter.sendMail({
        from: `"${CONFIG.EMAIL_FROM_NAME}" <${CONFIG.EMAIL_FROM_ADDRESS}>`,
        to: identifier,
        subject: 'Your CivicTrust Verification Code',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
            <h2 style="color: #008080;">CivicTrust Verification</h2>
            <p>Your one-time password (OTP) is:</p>
            <h1 style="letter-spacing: 5px; color: #333; background: #f4f4f4; padding: 15px; border-radius: 8px;">${code}</h1>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
      // Important: Log success safely without exposing the code or user identity exactly (though identifier is passed)
      console.log(`[OtpProvider] Successfully delivered OTP via SMTP.`);
    } catch (error: any) {
      // Do not log the raw error in production if it contains the email content, 
      // but nodemailer errors usually just contain connection failure details.
      console.error('[OtpProvider] Failed to send email via SMTP:', error.message);
      throw new Error('Failed to send OTP challenge via SMTP.');
    }
  }
}
