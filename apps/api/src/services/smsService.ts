import { env } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';

export type SmsChannel = 'twilio' | 'webhook' | 'dev';

export interface SmsSendResult {
  delivered: boolean;
  channel: SmsChannel;
  maskedPhone: string;
}

/** Normaliza um número de telefone para formato E.164 (+55... por padrão para 10-11 dígitos). */
export function normalizePhoneToE164(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  return `+${digits}`;
}

/** Mascara o número cadastrado mantendo apenas os últimos 4 dígitos visíveis. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) {
    return '••••';
  }
  const last4 = digits.slice(-4);
  return `••••-${last4}`;
}

/**
 * Envia o código de recuperação de senha por SMS para o número cadastrado.
 * Suporta Twilio REST API, Webhook HTTP customizado ou fallback de log em dev.
 */
export async function sendPasswordResetSms(phone: string, code: string): Promise<SmsSendResult> {
  const to = normalizePhoneToE164(phone);
  const maskedPhone = maskPhone(phone);
  const message = `Converse: seu codigo de recuperacao e ${code}. Valido por 15 minutos.`;

  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER) {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`;
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const body = new URLSearchParams({
      To: to,
      From: env.TWILIO_FROM_NUMBER,
      Body: message,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[SMS][TWILIO] Falha ao enviar para ${maskedPhone}: ${response.status} ${errorText}`);
      throw new HttpError(502, 'Não foi possível enviar o SMS de recuperação no momento.');
    }

    return { delivered: true, channel: 'twilio', maskedPhone };
  }

  if (env.SMS_WEBHOOK_URL) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.SMS_WEBHOOK_TOKEN) {
      headers.Authorization = `Bearer ${env.SMS_WEBHOOK_TOKEN}`;
    }

    const response = await fetch(env.SMS_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to, message, code }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[SMS][WEBHOOK] Falha ao enviar para ${maskedPhone}: ${response.status} ${errorText}`);
      throw new HttpError(502, 'Não foi possível enviar o SMS de recuperação no momento.');
    }

    return { delivered: true, channel: 'webhook', maskedPhone };
  }

  if (process.env.NODE_ENV !== 'test') {
    console.info(`[SMS][DEV] Para ${to}: ${message}`);
  }
  return { delivered: false, channel: 'dev', maskedPhone };
}
