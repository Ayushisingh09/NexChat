import twilio from 'twilio';
import { env } from '../config/env';
import { logger } from './logger';

export const sendSMS = async (to: string, message: string): Promise<boolean> => {
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
    try {
      logger.debug(`Sending SMS via Twilio to ${to}...`);
      const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

      await client.messages.create({
        body: message,
        from: env.TWILIO_PHONE_NUMBER,
        to,
      });

      logger.debug(`SMS sent successfully via Twilio to ${to}`);
      return true;
    } catch (error) {
      logger.error(`Twilio SMS failed:`, error);
    }
  }

  logger.debug(`[MOCK SMS] To: ${to} | Message: ${message}`);
  return true;
};
export type SendSMSFn = typeof sendSMS;
