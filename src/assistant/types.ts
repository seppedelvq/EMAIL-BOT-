import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  description: z.string().max(300).default(''),
});
export const SettingsSchema = z.object({
  language: z.enum(['nl', 'en']).default('nl'),
  timezone: z
    .string()
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Invalid time zone')
    .default('Europe/Brussels'),
  briefingTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default('08:00'),
  briefingEnabled: z.boolean().default(false),
  autoSort: z.boolean().default(false),
  followUpHours: z.number().int().min(1).max(720).default(48),
  retentionDays: z.number().int().min(1).max(90).default(30),
  categories: z
    .array(CategorySchema)
    .min(1)
    .max(30)
    .default([
      { id: 'urgent', name: 'Urgent', description: 'Tijdkritische actie' },
      {
        id: 'clients',
        name: 'Klanten',
        description: 'Berichten van bestaande klanten',
      },
      {
        id: 'leads',
        name: 'Potentiële klanten',
        description: 'Concrete aanvragen voor onze diensten',
      },
      {
        id: 'invoices',
        name: 'Facturen',
        description: 'Facturen en betalingen',
      },
      { id: 'internal', name: 'Intern', description: 'Interne communicatie' },
      {
        id: 'newsletters',
        name: 'Nieuwsbrieven',
        description: 'Nieuwsbrieven en marketing',
      },
      {
        id: 'review',
        name: 'Overig / Nakijken',
        description: 'Onzeker of overige berichten',
      },
    ])
    .superRefine((categories, ctx) => {
      const names = categories.map((c) => c.name.toLocaleLowerCase());
      if (
        new Set(names).size !== names.length ||
        new Set(categories.map((c) => c.id)).size !== categories.length
      )
        ctx.addIssue({ code: 'custom', message: 'Duplicate categories' });
      if (!categories.some((c) => c.id === 'review'))
        ctx.addIssue({
          code: 'custom',
          message: 'Review category is required',
        });
    }),
  acknowledgment: z
    .object({
      enabled: z.boolean().default(false),
      confirmedAt: z.string().datetime().nullable().default(null),
      newContacts: z.boolean().default(true),
      clients: z.boolean().default(false),
      businessDays: z.number().int().min(1).max(30).default(2),
      message: z
        .string()
        .trim()
        .min(1)
        .max(2000)
        .default(
          'Bedankt voor uw e-mail. Wij hebben uw bericht ontvangen en reageren binnen {days} werkdagen.',
        ),
    })
    .prefault({}),
});
export type Settings = z.infer<typeof SettingsSchema>;
export type ContactKind =
  'client' | 'lead' | 'known' | 'unknown' | 'irrelevant';
export const AnalysisSchema = z.object({
  categoryId: z.string().max(64),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(1200),
  urgent: z.boolean(),
  requiresReply: z.boolean(),
  potentialLead: z.boolean(),
  leadEvidence: z.string().max(500),
  actions: z.array(z.string().max(300)).max(8),
  deadlines: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        evidence: z.string().min(1).max(300),
      }),
    )
    .max(8),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
export interface MailRecord {
  id: string;
  threadId: string;
  sender: string;
  senderName: string;
  subject: string;
  receivedAt: string;
  unread: boolean;
  categoryId: string;
  analysis: Analysis;
  contactKind: ContactKind;
  resolved: boolean;
  answered: boolean;
  overdue: boolean;
  originalUrl?: string;
  manualCategory?: boolean;
}
export interface AutomationRecord {
  key: string;
  kind: string;
  status: string;
  at: string;
  code: string;
}
export function localClock(
  now: Date,
  timezone: string,
): { date: string; time: string } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (key: string) => p.find((x) => x.type === key)!.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}
