// WhatsApp deep-link helper.
//
// Free-tier alternative to MSG91 SMS: opens WhatsApp with a pre-filled
// message to the borrower. Owner taps Send. Used by the Overdue +
// Borrower screens for friendly reminders.
//
// Falls back to wa.me web link if WhatsApp isn't installed (covers users
// who only have WhatsApp Business or are on tablets without WA).

import { Linking } from 'react-native';

function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length > 10 && digits.length <= 15) return digits;
  return null;
}

export interface WhatsAppMessage {
  phone: string;
  body: string;
}

export async function openWhatsApp(input: WhatsAppMessage): Promise<boolean> {
  const phone = normalisePhone(input.phone);
  if (!phone) return false;
  const text = encodeURIComponent(input.body);
  const native = `whatsapp://send?phone=${phone}&text=${text}`;
  const web = `https://wa.me/${phone}?text=${text}`;
  try {
    const canOpen = await Linking.canOpenURL(native);
    await Linking.openURL(canOpen ? native : web);
    return true;
  } catch {
    try { await Linking.openURL(web); return true; } catch { return false; }
  }
}

export const WhatsAppTemplates = {
  // 1 — friendly reminder for an overdue borrower
  overdueReminder: (params: {
    borrowerName: string;
    daysOverdue: number;
    amount: number;
    orgName?: string;
  }): string => {
    const tag = params.orgName ? `\n— ${params.orgName}` : '';
    return [
      `Vanakkam ${params.borrowerName},`,
      ``,
      `Today is the ${params.daysOverdue} day of pending payment.`,
      `Amount due: ₹${params.amount.toLocaleString('en-IN')}`,
      ``,
      `Please pay at your earliest convenience.${tag}`,
    ].join('\n');
  },

  // 2 — receipt confirmation (free-tier alternative to MSG91 SMS)
  receipt: (params: {
    borrowerName: string;
    amount: number;
    balance?: number;
    orgName?: string;
  }): string => {
    const bal = params.balance != null && params.balance > 0
      ? `\nBalance: ₹${params.balance.toLocaleString('en-IN')}`
      : '';
    const tag = params.orgName ? `\n— ${params.orgName}` : '';
    return `₹${params.amount.toLocaleString('en-IN')} received from ${params.borrowerName}.${bal}\nThank you!${tag}`;
  },

  // 3 — promissory-note share (sent at loan disbursement)
  newLoan: (params: {
    borrowerName: string;
    principal: number;
    emi: number;
    installments: number;
    frequency: string;
    orgName?: string;
  }): string => {
    const tag = params.orgName ? `\n— ${params.orgName}` : '';
    return [
      `${params.borrowerName}, your new loan details:`,
      ``,
      `Principal: ₹${params.principal.toLocaleString('en-IN')}`,
      `Per installment: ₹${params.emi.toLocaleString('en-IN')}`,
      `Total: ${params.installments} ${params.frequency} installments`,
      ``,
      `Please save this message for your records.${tag}`,
    ].join('\n');
  },
};
