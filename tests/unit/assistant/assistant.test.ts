import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AssistantStore,
  encryptSecret,
  decryptSecret,
} from '../../../src/assistant/store';
import {
  SettingsSchema,
  localClock,
  type MailRecord,
  type Analysis,
} from '../../../src/assistant/types';
import {
  blockedAutomaticMessage,
  eligibleAcknowledgment,
  acknowledgmentText,
  groundedAnalysis,
  buildBriefing,
  renderBriefing,
  deliverDaily,
  withFollowUp,
  applyCategory,
  analyzeEmail,
} from '../../../src/assistant/engine';
import type { Email, EmailProvider, LLMAdapter } from '../../../src/core/types';
const now = new Date('2026-10-28T07:00:00Z');
const email = (): Email => ({
  id: '1',
  threadId: 'thread-1',
  provider: 'gmail',
  from: { address: 'customer@example.test' },
  to: [{ address: 'owner@example.test' }],
  cc: [],
  bcc: [],
  subject: 'Offerte website',
  body: {
    text: 'Graag een offerte voor onze website. Bevestig voor 2026-10-30.',
  },
  attachments: [],
  labels: ['INBOX'],
  folder: 'inbox',
  date: now,
  receivedDate: now,
  isRead: false,
  isStarred: false,
  isDraft: false,
  headers: { messageId: '<1@example.test>' },
});
const analysis = (): Analysis => ({
  categoryId: 'leads',
  confidence: 0.95,
  summary: 'Een aanvraag voor een website.',
  urgent: true,
  requiresReply: true,
  potentialLead: true,
  leadEvidence: 'Graag een offerte voor onze website.',
  actions: ['Offerte opstellen'],
  deadlines: [{ date: '2026-10-30', evidence: 'Bevestig voor 2026-10-30.' }],
});
const record = (): MailRecord => ({
  id: '1',
  threadId: 'thread-1',
  sender: 'customer@example.test',
  senderName: 'Customer',
  subject: 'Website',
  receivedAt: '2026-10-25T07:00:00Z',
  unread: true,
  categoryId: 'leads',
  analysis: analysis(),
  contactKind: 'unknown',
  resolved: false,
  answered: false,
  overdue: false,
  originalUrl: 'https://mail.google.com/mail/u/0/#all/1',
});
let directory: string;
let store: AssistantStore;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'assistant-test-'));
  store = new AssistantStore(directory);
});
afterEach(() => {
  store.close();
  rmSync(directory, { recursive: true, force: true });
});
describe('settings and local time', () => {
  it('defaults to Dutch, 08:00 and disabled automations', () => {
    const s = store.settings();
    expect(s.language).toBe('nl');
    expect(s.briefingTime).toBe('08:00');
    expect(s.acknowledgment.enabled).toBe(false);
    expect(s.autoSort).toBe(false);
  });
  it.each(['25:00', '8:00', '08:60'])(
    'rejects invalid time %s',
    (briefingTime) =>
      expect(() => SettingsSchema.parse({ briefingTime })).toThrow(),
  );
  it('rejects invalid timezone', () =>
    expect(() => SettingsSchema.parse({ timezone: 'Invalid/Zone' })).toThrow());
  it('rejects duplicate names case-insensitively', () => {
    const s = store.settings();
    s.categories.push({ id: 'x', name: ' urgent ', description: '' });
    expect(() => SettingsSchema.parse(s)).toThrow();
  });
  it('preserves review category', () => {
    const s = store.settings();
    s.categories = s.categories.filter((c) => c.id !== 'review');
    expect(() => SettingsSchema.parse(s)).toThrow();
  });
  it('handles DST and local day independently from UTC', () => {
    expect(
      localClock(new Date('2026-07-01T06:00:00Z'), 'Europe/Brussels').time,
    ).toBe('08:00');
    expect(localClock(now, 'Europe/Brussels').time).toBe('08:00');
    expect(
      localClock(new Date('2026-10-28T23:30:00Z'), 'Europe/Brussels').date,
    ).toBe('2026-10-29');
  });
  it('renders configured business days', () => {
    const s = store.settings();
    s.acknowledgment.businessDays = 3;
    expect(acknowledgmentText(s)).toContain('3 werkdagen');
  });
});
describe('acknowledgment safety', () => {
  it('never sends by default or without confirmation', () => {
    const s = store.settings();
    expect(
      eligibleAcknowledgment(
        email(),
        analysis(),
        s,
        'unknown',
        'owner@example.test',
      ),
    ).toBe(false);
    s.acknowledgment.enabled = true;
    expect(
      eligibleAcknowledgment(
        email(),
        analysis(),
        s,
        'unknown',
        'owner@example.test',
      ),
    ).toBe(false);
  });
  it.each([
    'no-reply@example.test',
    'mailer-daemon@example.test',
    'postmaster@example.test',
    'bounce@example.test',
  ])('blocks %s', (address) => {
    const e = email();
    e.from.address = address;
    expect(blockedAutomaticMessage(e, 'owner@example.test')).toBe(true);
  });
  it.each([
    ['auto-submitted', 'auto-replied'],
    ['list-id', 'newsletter'],
    ['list-unsubscribe', '<https://example.test>'],
    ['precedence', 'bulk'],
    ['x-auto-response-suppress', 'All'],
    ['content-type', 'multipart/report; report-type=delivery-status'],
  ])('blocks header %s', (key, value) => {
    const e = email();
    e.headers[key] = value;
    expect(blockedAutomaticMessage(e, 'owner@example.test')).toBe(true);
  });
  it('normalizes header casing and own address', () => {
    const e = email();
    e.headers['Auto-Submitted'] = 'auto-generated';
    expect(blockedAutomaticMessage(e, 'owner@example.test')).toBe(true);
    e.headers = { messageId: '1' };
    e.from.address = 'OWNER@example.test';
    expect(blockedAutomaticMessage(e, 'owner@example.test')).toBe(true);
  });
  it('blocks different reply-to, spam and drafts', () => {
    const e = email();
    e.replyTo = { address: 'other@example.test' };
    expect(blockedAutomaticMessage(e, '')).toBe(true);
    e.replyTo = undefined;
    e.labels = ['SPAM'];
    expect(blockedAutomaticMessage(e, '')).toBe(true);
    e.labels = [];
    e.isDraft = true;
    expect(blockedAutomaticMessage(e, '')).toBe(true);
  });
  it('requires confidence, action and per-contact permission', () => {
    const s = store.settings();
    s.acknowledgment = {
      ...s.acknowledgment,
      enabled: true,
      confirmedAt: now.toISOString(),
    };
    expect(
      eligibleAcknowledgment(
        email(),
        analysis(),
        s,
        'unknown',
        'owner@example.test',
      ),
    ).toBe(true);
    expect(
      eligibleAcknowledgment(
        email(),
        analysis(),
        s,
        'client',
        'owner@example.test',
      ),
    ).toBe(false);
    expect(
      eligibleAcknowledgment(
        email(),
        analysis(),
        s,
        'irrelevant',
        'owner@example.test',
      ),
    ).toBe(false);
    expect(
      eligibleAcknowledgment(
        email(),
        { ...analysis(), confidence: 0.2 },
        s,
        'unknown',
        '',
      ),
    ).toBe(false);
    expect(
      eligibleAcknowledgment(
        email(),
        { ...analysis(), requiresReply: false },
        s,
        'unknown',
        '',
      ),
    ).toBe(false);
  });
});
describe('grounding and follow-ups', () => {
  it('requires a source quote for lead detection', () => {
    expect(
      groundedAnalysis(analysis(), email(), store.settings()).potentialLead,
    ).toBe(true);
    expect(
      groundedAnalysis(
        { ...analysis(), leadEvidence: 'invented' },
        email(),
        store.settings(),
      ).potentialLead,
    ).toBe(false);
  });
  it('drops invented or invalid deadlines', () => {
    const a = analysis();
    a.deadlines.push({ date: '2026-11-01', evidence: 'invented' });
    expect(
      groundedAnalysis(a, email(), store.settings()).deadlines,
    ).toHaveLength(1);
    const e = email();
    e.body.text = '2026-02-30';
    a.deadlines = [{ date: '2026-02-30', evidence: '2026-02-30' }];
    expect(groundedAnalysis(a, e, store.settings()).deadlines).toHaveLength(0);
  });
  it('falls back to Review for unknown categories or uncertainty', () => {
    expect(
      groundedAnalysis(
        { ...analysis(), categoryId: 'delete-all' },
        email(),
        store.settings(),
      ).categoryId,
    ).toBe('review');
    expect(
      groundedAnalysis(
        { ...analysis(), confidence: 0.5 },
        email(),
        store.settings(),
      ).categoryId,
    ).toBe('review');
  });
  it('rejects malformed model output', () =>
    expect(() =>
      groundedAnalysis(
        { categoryId: 'leads', confidence: 5 },
        email(),
        store.settings(),
      ),
    ).toThrow());
  it('highlights overdue only when action remains', () => {
    expect(withFollowUp(record(), store.settings(), now).overdue).toBe(true);
    for (const patch of [
      { resolved: true },
      { answered: true },
      { analysis: { ...analysis(), requiresReply: false } },
    ])
      expect(
        withFollowUp({ ...record(), ...patch }, store.settings(), now).overdue,
      ).toBe(false);
  });
  it('deduplicates conversations and excludes resolved latest messages', () => {
    const r = record();
    const next = {
      ...r,
      id: '2',
      receivedAt: '2026-10-27T07:00:00Z',
      answered: true,
    };
    const b = buildBriefing([r, next], 3, store.settings(), now);
    expect(b.followUps).toHaveLength(0);
    expect(b.unread).toBe(3);
  });
  it('limits top priorities to five', () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({
      ...record(),
      id: String(i),
      threadId: String(i),
    }));
    expect(
      buildBriefing(rows, 9, store.settings(), now).priorities,
    ).toHaveLength(5);
  });
  it('escapes email content and refuses unsafe URLs in HTML', () => {
    const r = record();
    r.subject = '<script>alert(1)</script>';
    r.originalUrl = 'javascript:alert(1)';
    const html = renderBriefing(
      buildBriefing([r], 1, store.settings(), now),
      store.settings(),
    ).html;
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('&lt;script&gt;');
  });
  it('uses existing classify and summarize engines and restricts final AI output', async () => {
    const completeJSON = vi
      .fn()
      .mockResolvedValueOnce({
        category: 'sales',
        confidence: 0.9,
        reasoning: 'request',
        labels: [],
        sentiment: 'neutral',
        isUrgent: true,
        isActionRequired: true,
      })
      .mockResolvedValueOnce({
        summary: 'request',
        keyPoints: [],
        participants: [],
        actionItems: [],
        sentiment: 'neutral',
        topicTags: [],
      })
      .mockResolvedValueOnce(analysis());
    const adapter = {
      name: 'test',
      completeJSON,
      complete: vi.fn(),
      embed: vi.fn(),
    } as unknown as LLMAdapter;
    expect(
      (await analyzeEmail(email(), store.settings(), adapter)).potentialLead,
    ).toBe(true);
    expect(completeJSON).toHaveBeenCalledTimes(3);
    expect(completeJSON.mock.calls[2][2].systemPrompt).toContain('untrusted');
  });
});
describe('safe retry policy', () => {
  it('retries failed additive labels but never retries an uncertain send', () => {
    store.claim('label:1', 'category');
    store.finish('label:1', 'error');
    expect(store.claim('label:1', 'category', now, true)).toBe(true);
    expect(store.claim('label:1', 'category', now, true)).toBe(false);
    store.claim('ack:retry', 'acknowledgment');
    store.finish('ack:retry', 'uncertain');
    expect(store.claim('ack:retry', 'acknowledgment', now, true)).toBe(false);
  });
});
describe('persistent delivery, isolation, retention and credentials', () => {
  it('atomically claims once across two connections', () => {
    const second = new AssistantStore(directory);
    expect(store.claim('ack:thread', 'ack')).toBe(true);
    expect(second.claim('ack:thread', 'ack')).toBe(false);
    second.close();
  });
  it('recovers interrupted sends as uncertain without retry', () => {
    store.claim('ack:1', 'ack');
    store.recoverPending();
    expect(store.history()[0].status).toBe('uncertain');
    expect(store.claim('ack:1', 'ack')).toBe(false);
  });
  it('keeps customers in different data directories separate', () => {
    const second = new AssistantStore(join(directory, 'other'));
    store.markContact('a@example.test', 'client');
    expect(second.contact('a@example.test')).toBe('unknown');
    store.saveMail(record());
    expect(second.mails()).toHaveLength(0);
    second.close();
  });
  it('prunes retained email records but retains opaque send claims', () => {
    store.saveMail({ ...record(), receivedAt: '2020-01-01T00:00:00Z' });
    store.claim('ack:opaque', 'ack');
    store.prune(now);
    expect(store.mails()).toHaveLength(0);
    expect(store.claim('ack:opaque', 'ack')).toBe(false);
  });
  it('encrypts credentials with authentication and rejects tampering', () => {
    const key = 'ab'.repeat(32);
    const secret = encryptSecret('sensitive-refresh-token', key);
    expect(secret).not.toContain('sensitive-refresh-token');
    expect(decryptSecret(secret, key)).toBe('sensitive-refresh-token');
    expect(() => decryptSecret(secret, 'cd'.repeat(32))).toThrow();
  });
  it('clears all local state', () => {
    store.saveMail(record());
    store.set('secret', 'x');
    store.claim('ack:1', 'ack');
    store.clear();
    expect(store.mails()).toHaveLength(0);
    expect(store.get('secret')).toBeNull();
    expect(store.history()).toHaveLength(0);
  });
  it('sends a scheduled daily report only once including after clock repeats', async () => {
    const s = store.settings();
    s.briefingEnabled = true;
    store.saveSettings(s);
    const deliver = vi.fn().mockResolvedValue(undefined);
    const b = buildBriefing([record()], 1, s, now);
    await Promise.all([
      deliverDaily(store, b, { deliver }, 'owner@example.test', false, now),
      deliverDaily(store, b, { deliver }, 'owner@example.test', false, now),
    ]);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(store.history()[0].status).toBe('sent');
  });
  it('does not deliver before the configured time or when disabled', async () => {
    const deliver = vi.fn();
    const s = store.settings();
    const b = buildBriefing([], 0, s, now);
    await deliverDaily(store, b, { deliver }, 'owner@example.test', false, now);
    s.briefingEnabled = true;
    s.briefingTime = '09:00';
    store.saveSettings(s);
    await deliverDaily(store, b, { deliver }, 'owner@example.test', false, now);
    expect(deliver).not.toHaveBeenCalled();
  });
  it('simulates demo delivery and never calls a channel', async () => {
    const s = store.settings();
    s.briefingEnabled = true;
    store.saveSettings(s);
    const deliver = vi.fn();
    await deliverDaily(
      store,
      buildBriefing([], 0, s, now),
      { deliver },
      '',
      true,
      now,
    );
    expect(deliver).not.toHaveBeenCalled();
    expect(store.history()[0].status).toBe('demo');
  });
  it('does not blindly retry ambiguous send errors', async () => {
    const s = store.settings();
    s.briefingEnabled = true;
    store.saveSettings(s);
    const deliver = vi
      .fn()
      .mockRejectedValue(Error('timeout with confidential email'));
    const b = buildBriefing([], 0, s, now);
    await deliverDaily(store, b, { deliver }, '', false, now);
    await deliverDaily(store, b, { deliver }, '', false, now);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(store.history()[0].code).toBe('DELIVERY_NOT_CONFIRMED');
    expect(JSON.stringify(store.history())).not.toContain('confidential');
  });
  it('reuses an existing provider label without destructive operations', async () => {
    const p = {
      type: 'gmail',
      listLabels: vi
        .fn()
        .mockResolvedValue([{ id: 'existing', name: 'Clients' }]),
      createLabel: vi.fn(),
      addLabel: vi.fn(),
    } as unknown as EmailProvider;
    await applyCategory(p, 'mail', 'clients');
    expect(p.createLabel).not.toHaveBeenCalled();
    expect(p.addLabel).toHaveBeenCalledWith('mail', 'existing');
  });
});
