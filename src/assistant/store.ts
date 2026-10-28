import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  SettingsSchema,
  type Settings,
  type MailRecord,
  type ContactKind,
  type AutomationRecord,
} from './types.js';

/** One installation/account per private data directory. No cross-account singleton. */
export class AssistantStore {
  private readonly db: DatabaseSync;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(directory, 'assistant.db'));
    chmodSync(join(directory, 'assistant.db'), 0o600);
    this.db
      .exec(`PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS mail (id TEXT PRIMARY KEY, received TEXT NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS contacts (address TEXT PRIMARY KEY, kind TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS automation (key TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, at TEXT NOT NULL, code TEXT NOT NULL DEFAULT '');`);
  }
  get(key: string): string | null {
    return (
      (
        this.db.prepare('SELECT value FROM kv WHERE key=?').get(key) as
          { value: string } | undefined
      )?.value ?? null
    );
  }
  set(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO kv VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      )
      .run(key, value);
  }
  remove(key: string): void {
    this.db.prepare('DELETE FROM kv WHERE key=?').run(key);
  }
  settings(): Settings {
    return SettingsSchema.parse(JSON.parse(this.get('settings') ?? '{}'));
  }
  saveSettings(value: unknown): Settings {
    const settings = SettingsSchema.parse(value);
    this.set('settings', JSON.stringify(settings));
    return settings;
  }
  mails(): MailRecord[] {
    return (
      this.db
        .prepare('SELECT value FROM mail ORDER BY received DESC')
        .all() as { value: string }[]
    ).map((r) => JSON.parse(r.value) as MailRecord);
  }
  saveMail(mail: MailRecord): void {
    this.db
      .prepare(
        'INSERT INTO mail VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET received=excluded.received,value=excluded.value',
      )
      .run(mail.id, mail.receivedAt, JSON.stringify(mail));
  }
  contact(address: string): ContactKind {
    return (
      (
        this.db
          .prepare('SELECT kind FROM contacts WHERE address=?')
          .get(address.toLowerCase()) as { kind: ContactKind } | undefined
      )?.kind ?? 'unknown'
    );
  }
  markContact(address: string, kind: ContactKind): void {
    this.db
      .prepare(
        'INSERT INTO contacts VALUES (?,?) ON CONFLICT(address) DO UPDATE SET kind=excluded.kind',
      )
      .run(address.toLowerCase(), kind);
  }
  claim(
    key: string,
    kind: string,
    now = new Date(),
    retryFailedCategory = false,
  ): boolean {
    const created =
      Number(
        this.db
          .prepare(
            "INSERT OR IGNORE INTO automation(key,kind,status,at) VALUES (?,?,'pending',?)",
          )
          .run(key, kind, now.toISOString()).changes,
      ) === 1;
    if (created) return true;
    // Only additive labels are safe to retry. Never reclaim a send or uncertain job.
    return (
      retryFailedCategory &&
      kind === 'category' &&
      Number(
        this.db
          .prepare(
            "UPDATE automation SET status='pending',at=?,code='' WHERE key=? AND kind='category' AND status='error'",
          )
          .run(now.toISOString(), key).changes,
      ) === 1
    );
  }

  finish(
    key: string,
    status: 'sent' | 'demo' | 'error' | 'uncertain' | 'applied',
    code = '',
  ): void {
    this.db
      .prepare('UPDATE automation SET status=?,code=? WHERE key=?')
      .run(status, code, key);
  }
  history(): AutomationRecord[] {
    return this.db
      .prepare('SELECT * FROM automation ORDER BY at DESC LIMIT 100')
      .all() as unknown as AutomationRecord[];
  }
  recoverPending(): void {
    this.db.exec(
      "UPDATE automation SET status=CASE WHEN kind='category' THEN 'error' ELSE 'uncertain' END,code='PROCESS_INTERRUPTED' WHERE status='pending'",
    );
  }
  prune(now: Date): void {
    const cutoff = new Date(
      now.getTime() - this.settings().retentionDays * 86400000,
    ).toISOString();
    this.db.prepare('DELETE FROM mail WHERE received < ?').run(cutoff);
    // Keep only opaque deduplication keys. Do not prune them and risk resending old acknowledgments.
  }
  clear(): void {
    this.db.exec(
      'DELETE FROM mail; DELETE FROM contacts; DELETE FROM automation; DELETE FROM kv; VACUUM;',
    );
  }
  close(): void {
    this.db.close();
  }
}
export function encryptSecret(value: string, key: string): string {
  const bytes = Buffer.from(key, 'hex');
  if (bytes.length !== 32)
    throw new Error(
      'ASSISTANT_MASTER_KEY must contain 64 hexadecimal characters',
    );
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', bytes, iv);
  return [
    iv.toString('base64'),
    cipher.update(value, 'utf8', 'base64') + cipher.final('base64'),
    cipher.getAuthTag().toString('base64'),
  ].join('.');
}
export function decryptSecret(value: string, key: string): string {
  const [iv, data, tag] = value.split('.');
  const cipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(iv, 'base64'),
  );
  cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return cipher.update(data, 'base64', 'utf8') + cipher.final('utf8');
}
