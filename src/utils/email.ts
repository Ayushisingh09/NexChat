import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

export const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  if (env.RESEND_API_KEY) {
    try {
      logger.debug(`Sending email via Resend to ${to}...`);
      const resend = new Resend(env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: 'NexChat <noreply@92lrcorps.xyz>',
        to: [to],
        subject,
        html,
      });

      if (error) {
        logger.error(`Resend API failed:`, error);
      } else {
        logger.debug(`Email sent successfully via Resend to ${to}`);
        return true;
      }
    } catch (error) {
      logger.error(`Resend email failed:`, error);
    }
  }

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    try {
      logger.debug(`Sending email via SMTP to ${to}...`);
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_USER}>`,
        to,
        subject,
        html,
      });

      logger.debug(`Email sent successfully via SMTP to ${to}`);
      return true;
    } catch (error) {
      logger.error(`SMTP email failed:`, error);
    }
  }

  logger.warn(`[FALLBACK] Email not delivered — no working provider configured. To: ${to} | Subject: ${subject}`);
  return true;
};
export type SendEmailFn = typeof sendEmail;