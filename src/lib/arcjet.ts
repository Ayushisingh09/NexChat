import arcjet, { detectBot, shield } from '@arcjet/node';
import { env } from '../config/env';

export const aj = arcjet({
  key: env.ARCJET_KEY ?? '',
  characteristics: ['ip.src'],
  rules: [
    shield({ mode: env.ARCJET_KEY ? 'LIVE' : 'DRY_RUN' }),
    detectBot({
      mode: env.ARCJET_KEY ? 'LIVE' : 'DRY_RUN',
      allow: [],
    }),
  ],
});
