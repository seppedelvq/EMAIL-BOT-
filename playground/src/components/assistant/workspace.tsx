'use client';
import { useEffect, useState } from 'react';
import {
  Mail,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Clock3,
  Users,
  Check,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Search,
  Send,
  Plus,
  Trash2,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/header';
import type {
  Settings,
  MailRecord,
  AutomationRecord,
  Briefing,
} from '@petter100/emai';
type Snapshot = {
  settings: Settings;
  mails: MailRecord[];
  briefing: Briefing;
  history: AutomationRecord[];
  connection: {
    demo: boolean;
    connected: boolean;
    account: string | null;
    oauthConfigured: boolean;
    aiConfigured: boolean;
    lastSync: string | null;
    error: string | null;
    analysisWarning: string | null;
    scopes: string[];
  };
  coverage: string;
};
const enCategories: Record<string, string> = {
  urgent: 'Urgent',
  clients: 'Clients',
  leads: 'Potential clients',
  invoices: 'Invoices',
  internal: 'Internal',
  newsletters: 'Newsletters',
  review: 'Other / Review',
};
const enDemo: Record<string, string> = {
  demo1: 'Lisa is waiting for your approval of the campaign proposal.',
  demo2: 'Tom requests a proposal for a new business website.',
  demo3: 'Review the invoice before approving it.',
  demo4: 'A newsletter with tips for business owners.',
  demo5:
    'Eva refers to meeting you; there is no concrete customer enquiry yet.',
  demo6: 'Sarah asks when you are available for a team meeting.',
};
export function Workspace({
  screen,
}: {
  screen: 'dashboard' | 'emails' | 'settings';
}) {
  const [data, setData] = useState<Snapshot>();
  const [settings, setSettings] = useState<Settings>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [preview, setPreview] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nl = settings?.language !== 'en';
  const t = (a: string, b: string) => (nl ? a : b);
  async function load() {
    try {
      const res = await fetch('/api/assistant', { cache: 'no-store' });
      if (!res.ok) throw Error('Laden mislukt / Unable to load');
      const snapshot = (await res.json()) as Snapshot;
      setData(snapshot);
      setSettings(snapshot.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verbinding mislukt');
    }
  }
  useEffect(() => {
    void load();
    const result = new URLSearchParams(window.location.search).get(
      'connection',
    );
    if (result === 'configure')
      setError(
        'Configureer eerst Gmail OAuth en ASSISTANT_MODE=live volgens de installatiehandleiding. / Configure Gmail OAuth and live mode first.',
      );
    if (result === 'failed')
      setError(
        'Gmail-aanmelding mislukt. Probeer opnieuw. / Gmail sign-in failed. Try again.',
      );
    if (result === 'cancelled')
      setMessage('Aanmelding geannuleerd. / Sign-in cancelled.');
    if (result === 'connected')
      setMessage('Gmail verbonden. / Gmail connected.');
  }, []);
  useEffect(() => {
    if (settings) {
      document.documentElement.lang = settings.language;
      window.dispatchEvent(
        new CustomEvent('assistant-language', { detail: settings.language }),
      );
    }
  }, [settings?.language]);
  async function perform(body: Record<string, unknown>, success?: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw Error(result.error ?? 'Actie mislukt');
      if (result.mails) {
        setData(result);
        setSettings(result.settings);
      }
      if (result.preview) setPreview(result.preview);
      if (result.text) setPreview(result.text);
      if (success) setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Actie mislukt');
    } finally {
      setBusy(false);
    }
  }
  if (!data || !settings)
    return (
      <>
        <Header title="Post" />
        <main className="p-8" role="status">
          {error || 'Je overzicht wordt geladen… / Loading…'}
        </main>
      </>
    );
  const originalNames: Record<string, string> = {
    urgent: 'Urgent',
    clients: 'Klanten',
    leads: 'Potentiële klanten',
    invoices: 'Facturen',
    internal: 'Intern',
    newsletters: 'Nieuwsbrieven',
    review: 'Overig / Nakijken',
  };
  const category = (id: string) => {
    const name = settings.categories.find((c) => c.id === id)?.name;
    return !nl && name === originalNames[id]
      ? enCategories[id]
      : (name ?? t('Nakijken', 'Review'));
  };
  const summary = (m: MailRecord) =>
    !nl && data.connection.demo
      ? (enDemo[m.id] ?? m.analysis.summary)
      : m.analysis.summary;
  const active = data.mails.filter((m) => !m.resolved && !m.answered);
  const leads = active.filter(
    (m) =>
      m.contactKind !== 'irrelevant' &&
      (m.contactKind === 'lead' ||
        (m.analysis.potentialLead &&
          !['client', 'known'].includes(m.contactKind))),
  );
  const due = active.filter((m) => m.analysis.requiresReply);
  const filtered = data.mails.filter(
    (m) =>
      `${m.sender} ${m.subject} ${summary(m)}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'leads' && leads.some((l) => l.id === m.id)) ||
        (filter === 'followup' &&
          m.analysis.requiresReply &&
          !m.resolved &&
          !m.answered) ||
        (filter === 'unknown' && m.contactKind === 'unknown') ||
        filter === m.categoryId),
  );
  const patch = (value: Partial<Settings>) =>
    setSettings({ ...settings, ...value });
  const ack = (value: Partial<Settings['acknowledgment']>) => {
    setConfirmation(false);
    patch({ acknowledgment: { ...settings.acknowledgment, ...value } });
  };
  const save = () =>
    perform(
      { action: 'settings', settings, confirmSending: confirmation },
      t('Je instellingen zijn opgeslagen.', 'Your settings have been saved.'),
    );
  const mailCard = (mail: MailRecord, compact = false) => (
    <Card
      key={mail.id}
      className="overflow-hidden border-[#e1e7e3] shadow-none"
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-[#eef2eb] font-medium text-[#49634d] sm:flex">
            {mail.senderName.slice(0, 2).toUpperCase() || '@'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">
                {mail.senderName || mail.sender}
                <span className="ml-2 hidden text-xs font-normal text-muted-foreground md:inline">
                  {mail.sender}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(mail.receivedAt).toLocaleDateString(
                  nl ? 'nl-BE' : 'en-GB',
                  { day: 'numeric', month: 'short' },
                )}
              </span>
            </div>
            <h3 className="font-semibold leading-6">{mail.subject}</h3>
            <p className="mt-2 text-sm leading-6 text-[#63716a]">
              {summary(mail)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-[#edf4ef] text-[#36634d]"
              >
                {category(mail.categoryId)}
              </Badge>
              {mail.analysis.urgent && (
                <Badge className="bg-[#fff0e9] text-[#b34e2d]">Urgent</Badge>
              )}
              {mail.overdue && (
                <Badge className="bg-[#fff5dc] text-[#8d641b]">
                  {t('Antwoord achterstallig', 'Reply overdue')}
                </Badge>
              )}
              {mail.resolved || mail.answered ? (
                <Badge variant="outline">{t('Afgerond', 'Resolved')}</Badge>
              ) : null}
              {leads.some((l) => l.id === mail.id) && (
                <Badge variant="outline">
                  {t('Mogelijke klant', 'Potential customer')}
                </Badge>
              )}
            </div>
            {mail.analysis.deadlines.map((d) => (
              <p key={d.date + d.evidence} className="mt-2 text-sm">
                {d.date}: {d.evidence}
              </p>
            ))}
          </div>
        </div>
        {!compact && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
            <label className="sr-only" htmlFor={`category-${mail.id}`}>
              {t('Categorie', 'Category')}
            </label>
            <select
              id={`category-${mail.id}`}
              className="post-select"
              value={mail.categoryId}
              disabled={busy}
              onChange={(e) =>
                void perform(
                  {
                    action: 'category',
                    id: mail.id,
                    categoryId: e.target.value,
                  },
                  t('Categorie gecorrigeerd.', 'Category corrected.'),
                )
              }
            >
              {settings.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {category(c.id)}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`contact-${mail.id}`}>
              {t('Afzender', 'Sender')}
            </label>
            <select
              id={`contact-${mail.id}`}
              className="post-select"
              value={mail.contactKind}
              disabled={busy}
              onChange={(e) =>
                void perform({
                  action: 'contact',
                  address: mail.sender,
                  kind: e.target.value,
                })
              }
            >
              {[
                ['unknown', t('Onbekende afzender', 'Unknown sender')],
                ['client', t('Klant', 'Client')],
                ['lead', t('Potentiële klant', 'Lead')],
                ['known', t('Bekend contact', 'Known contact')],
                ['irrelevant', t('Niet relevant', 'Irrelevant')],
              ].map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void perform({ action: 'resolve', id: mail.id })}
            >
              <Check size={14} />
              {mail.resolved
                ? t('Heropenen', 'Reopen')
                : t('Afgerond', 'Resolve')}
            </Button>
            {mail.originalUrl ? (
              <a
                href={mail.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-sm text-[#28634b]"
              >
                {t('Open e-mail', 'Open email')}
                <ArrowUpRight size={15} />
              </a>
            ) : (
              <span className="ml-auto text-xs text-muted-foreground">
                {t('Fictief voorbeeld', 'Fictional example')}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
  return (
    <>
      <Header
        title={
          screen === 'settings'
            ? t('Instellingen', 'Settings')
            : screen === 'emails'
              ? t('E-mails', 'Emails')
              : 'Dashboard'
        }
      />
      <main className="mx-auto w-full max-w-[1250px] px-5 py-6 md:px-10 md:py-9">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-[#63756b]">
            <span
              className={`size-2 rounded-full ${data.connection.error ? 'bg-orange-500' : 'bg-[#5d9273]'}`}
            />
            {data.connection.demo
              ? t(
                  'Demomodus · fictieve e-mails',
                  'Demo mode · fictional emails',
                )
              : data.connection.connected
                ? data.connection.account
                : t('Geen mailbox verbonden', 'No mailbox connected')}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {data.connection.lastSync && (
              <span>
                {t('Bijgewerkt', 'Updated')}{' '}
                {new Date(data.connection.lastSync).toLocaleTimeString(
                  nl ? 'nl-BE' : 'en-GB',
                  { hour: '2-digit', minute: '2-digit' },
                )}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void perform(
                  { action: 'sync' },
                  t('Overzicht bijgewerkt.', 'Overview updated.'),
                )
              }
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
              {t('Bijwerken', 'Refresh')}
            </Button>
          </div>
        </div>
        {error && (
          <div
            role="alert"
            className="post-notice border-red-200 bg-red-50 text-red-800"
          >
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="post-notice border-green-200 bg-green-50 text-green-900"
          >
            <Check size={18} />
            {message}
          </div>
        )}
        {data.connection.error && (
          <div className="post-notice border-orange-200 bg-orange-50">
            {t(
              'De mailboxverbinding is onderbroken. Je ziet het laatst opgeslagen overzicht. Verbind opnieuw via Instellingen.',
              'Mailbox connection interrupted. Showing the last saved overview. Reconnect in Settings.',
            )}
          </div>
        )}
        {data.connection.analysisWarning && (
          <div className="post-notice border-orange-200 bg-orange-50">
            {t(
              'Sommige AI-analyses zijn mislukt. Deze berichten staan onder Nakijken en kunnen nog open vragen bevatten.',
              'Some AI analyses failed. These messages are in Review and may still contain unanswered requests.',
            )}
          </div>
        )}
        {data.coverage.startsWith('partial') && (
          <div className="post-notice border-orange-200 bg-orange-50">
            {t(
              'Het ongelezen aantal telt de hele inbox. AI-analyse en prioriteiten omvatten maximaal de 200 recentste berichten binnen de bewaartermijn.',
              'Unread count covers the whole inbox. AI analysis and priorities cover up to 200 recent messages within the retention period.',
            )}
          </div>
        )}
        {screen === 'dashboard' && (
          <>
            <div className="mb-7">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#699077]">
                {new Intl.DateTimeFormat(nl ? 'nl-BE' : 'en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  timeZone: settings.timezone,
                }).format(new Date())}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {t(
                  'Goedendag, tijd voor overzicht.',
                  'Hello, let’s clear your mind.',
                )}
              </h1>
              <p className="mt-3 text-[#6b786f]">
                {t(
                  'Dit verdient vandaag jouw aandacht.',
                  'Here’s what deserves your attention today.',
                )}
              </p>
            </div>
            <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  label: t('Ongelezen e-mails', 'Unread emails'),
                  value: data.briefing.unread,
                  icon: Mail,
                  color: '#eaf1f8',
                  filter: 'all',
                },
                {
                  label: t('Urgente berichten', 'Urgent messages'),
                  value: data.briefing.urgent,
                  icon: Bell,
                  color: '#fff0e7',
                  filter: 'urgent',
                },
                {
                  label: t('Potentiële klanten', 'Potential customers'),
                  value: leads.length,
                  icon: Users,
                  color: '#edf3e5',
                  filter: 'leads',
                },
                {
                  label: t('Nog te beantwoorden', 'Awaiting reply'),
                  value: due.length,
                  icon: Clock3,
                  color: '#f0ebf8',
                  filter: 'followup',
                },
              ].map((stat) => (
                <Card key={stat.label} className="border-[#e1e7e3] shadow-none">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <span
                        className="flex size-9 items-center justify-center rounded-xl"
                        style={{ background: stat.color }}
                      >
                        <stat.icon size={18} />
                      </span>
                      <ArrowUpRight size={16} className="text-[#9ba89f]" />
                    </div>
                    <strong className="text-3xl font-semibold">
                      {stat.value}
                    </strong>
                    <p className="mt-1 text-sm text-[#748075]">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[1.65fr_1fr]">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {t('Jouw prioriteiten', 'Your priorities')}
                  </h2>
                  <a
                    href="/emails"
                    className="inline-flex items-center gap-1 text-sm text-[#397052]"
                  >
                    {t('Alle e-mails', 'All emails')}
                    <ArrowRight size={15} />
                  </a>
                </div>
                <div className="space-y-3">
                  {data.briefing.priorities.map((m) => mailCard(m, true))}
                  {!data.briefing.priorities.length && (
                    <Card className="p-6">
                      {t(
                        'Geen open prioriteiten. Verbind je mailbox of bekijk je e-mails.',
                        'No open priorities. Connect your mailbox or review your emails.',
                      )}
                    </Card>
                  )}
                </div>
              </section>
              <aside className="space-y-5">
                <Card className="border-[#d9e8db] bg-[#eaf2e8] shadow-none">
                  <CardContent className="p-6">
                    <Sparkles size={23} className="mb-4 text-[#48794d]" />
                    <h2 className="mb-3 text-lg font-semibold">
                      {t(
                        'Een helder begin van je dag',
                        'A clear start to your day',
                      )}
                    </h2>
                    <p className="text-sm leading-7 text-[#4d6951]">
                      {data.briefing.recommendation}
                    </p>
                    <p className="mt-4 text-xs text-[#6b806d]">
                      {t(
                        'Advies, geen automatische actie.',
                        'A recommendation, no automatic action.',
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <Clock3 size={18} />
                      <h2 className="font-semibold">
                        {t('Jouw ochtendoverzicht', 'Your morning briefing')}
                      </h2>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {settings.briefingEnabled
                        ? t(
                            `Iedere dag om ${settings.briefingTime} (${settings.timezone}).`,
                            `Every day at ${settings.briefingTime} (${settings.timezone}).`,
                          )
                        : t(
                            'Start je dag met één rustig overzicht in je inbox.',
                            'Start your day with one clear overview in your inbox.',
                          )}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4 w-full"
                      disabled={busy}
                      onClick={() => void perform({ action: 'briefing' })}
                    >
                      {t('Voorbeeld bekijken', 'Preview briefing')}
                      <ArrowUpRight size={15} />
                    </Button>
                    <a
                      href="/settings"
                      className="mt-3 block text-center text-xs text-[#4d765b]"
                    >
                      {t('Tijdstip instellen', 'Set delivery time')}
                    </a>
                  </CardContent>
                </Card>
                <div className="flex gap-2 px-2 text-xs leading-5 text-muted-foreground">
                  <ShieldCheck size={16} className="shrink-0" />
                  {t(
                    'Geen e-mails verwijderd of gearchiveerd. Automatisch antwoorden staat standaard uit.',
                    'No messages deleted or archived. Automatic replies are off by default.',
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
        {screen === 'emails' && (
          <>
            <h1 className="text-3xl font-semibold">
              {t('Je mailbox, overzichtelijk.', 'Your mailbox, organized.')}
            </h1>
            <p className="mb-6 mt-3 text-muted-foreground">
              {t(
                'Korte samenvattingen. Duidelijke volgende stappen.',
                'Short summaries. Clear next steps.',
              )}
            </p>
            <div className="mb-5 flex flex-wrap gap-3">
              <div className="relative min-w-48 flex-1">
                <Search
                  size={17}
                  className="absolute left-3 top-3 text-muted-foreground"
                />
                <Input
                  aria-label={t('Zoek e-mails', 'Search emails')}
                  placeholder={t(
                    'Zoek op afzender of onderwerp…',
                    'Search sender or subject…',
                  )}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-11 bg-white pl-10"
                />
              </div>
              <select
                aria-label={t('Filter e-mails', 'Filter emails')}
                className="post-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">{t('Alle e-mails', 'All emails')}</option>
                <option value="leads">
                  {t('Potentiële klanten', 'Potential customers')}
                </option>
                <option value="followup">
                  {t('Nog te beantwoorden', 'Awaiting reply')}
                </option>
                <option value="unknown">
                  {t('Onbekende afzenders', 'Unknown senders')}
                </option>
                {settings.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {category(c.id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              {filtered.map((m) => mailCard(m))}
              {!filtered.length && (
                <Card className="p-8 text-muted-foreground">
                  {t('Geen e-mails gevonden.', 'No emails found.')}
                </Card>
              )}
            </div>
          </>
        )}
        {screen === 'settings' && (
          <>
            <h1 className="text-3xl font-semibold">
              {t('Stel je assistent in.', 'Make your assistant yours.')}
            </h1>
            <p className="mb-7 mt-3 text-muted-foreground">
              {t(
                'Jouw mailbox. Jouw voorkeuren. Jij houdt de controle.',
                'Your mailbox. Your preferences. You stay in control.',
              )}
            </p>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="post-settings-card">
                <CardContent className="p-6">
                  <h2>
                    {t('1. Verbind je mailbox', '1. Connect your mailbox')}
                  </h2>
                  <p>
                    {data.connection.demo
                      ? t(
                          'Je verkent een veilige demo. Echte e-mails worden niet gelezen of verstuurd. Voor echt gebruik: volg de lokale installatiehandleiding en stel Gmail OAuth in.',
                          'You are exploring a safe demo. Real emails are not read or sent. For live use, follow the local setup guide and configure Gmail OAuth.',
                        )
                      : t(
                          'Meld je veilig aan via Google. We vragen nooit je mailboxwachtwoord.',
                          'Sign in securely through Google. We never ask for your mailbox password.',
                        )}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild className="bg-[#245c43]">
                      <a href="/api/oauth/gmail">
                        {data.connection.connected
                          ? t('Gmail opnieuw verbinden', 'Reconnect Gmail')
                          : t('Gmail verbinden', 'Connect Gmail')}
                        <ArrowUpRight size={16} />
                      </a>
                    </Button>
                    {data.connection.connected && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void perform(
                            { action: 'disconnect' },
                            t('Mailbox losgekoppeld.', 'Mailbox disconnected.'),
                          )
                        }
                      >
                        {t('Loskoppelen', 'Disconnect')}
                      </Button>
                    )}
                  </div>
                  <p className="mt-3 text-xs">
                    {t(
                      'Microsoft 365: latere fase; nog niet getest.',
                      'Microsoft 365: later phase; not yet tested.',
                    )}
                  </p>
                  <label className="post-label">
                    {t('Taal', 'Language')}
                    <select
                      className="post-select w-full"
                      value={settings.language}
                      onChange={(e) =>
                        patch({ language: e.target.value as 'nl' | 'en' })
                      }
                    >
                      <option value="nl">Nederlands</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                </CardContent>
              </Card>
              <Card className="post-settings-card">
                <CardContent className="p-6">
                  <h2>{t('2. Dagelijks overzicht', '2. Daily briefing')}</h2>
                  <label className="post-check">
                    <input
                      type="checkbox"
                      checked={settings.briefingEnabled}
                      onChange={(e) =>
                        patch({ briefingEnabled: e.target.checked })
                      }
                    />
                    {t(
                      'Ontvang mijn overzicht per e-mail',
                      'Receive my briefing by email',
                    )}
                  </label>
                  <label className="post-label">
                    {t('Tijdstip', 'Time')}
                    <Input
                      type="time"
                      value={settings.briefingTime}
                      onChange={(e) => patch({ briefingTime: e.target.value })}
                    />
                  </label>
                  <label className="post-label">
                    {t('Tijdzone', 'Time zone')}
                    <Input
                      value={settings.timezone}
                      onChange={(e) => patch({ timezone: e.target.value })}
                      placeholder="Europe/Brussels"
                    />
                  </label>
                  <p>
                    {t(
                      'Je computer en de app moeten actief zijn. De demo registreert alleen een simulatie. Na wijzigingen in rechten: sla op en verbind Gmail opnieuw.',
                      'Your computer and the app must be running. Demo deliveries are simulated. After permission changes, save and reconnect Gmail.',
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card className="post-settings-card">
                <CardContent className="p-6">
                  <h2>{t('Categorieën & sorteren', 'Categories & sorting')}</h2>
                  <label className="post-check">
                    <input
                      type="checkbox"
                      checked={settings.autoSort}
                      onChange={(e) => patch({ autoSort: e.target.checked })}
                    />
                    {t(
                      'Automatisch Gmail-labels toevoegen',
                      'Automatically add Gmail labels',
                    )}
                  </label>
                  <p>
                    {t(
                      'Bestaande labels blijven behouden. Onzekere analyses gaan naar Nakijken. Verwijderen hieronder wist nooit een Gmail-label of e-mail.',
                      'Existing labels are preserved. Uncertain analyses go to Review. Removing a category here never deletes a Gmail label or email.',
                    )}
                  </p>
                  <div className="mt-4 space-y-2">
                    {settings.categories.map((c, i) => (
                      <div className="flex gap-2" key={c.id}>
                        <Input
                          aria-label={t('Categorienaam', 'Category name')}
                          value={c.name}
                          onChange={(e) =>
                            patch({
                              categories: settings.categories.map((x, j) =>
                                i === j ? { ...x, name: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          aria-label={t(
                            'Categorie verwijderen',
                            'Remove category',
                          )}
                          disabled={c.id === 'review'}
                          onClick={() =>
                            patch({
                              categories: settings.categories.filter(
                                (x) => x.id !== c.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() =>
                      patch({
                        categories: [
                          ...settings.categories,
                          {
                            id: crypto.randomUUID(),
                            name: t('Nieuwe categorie', 'New category'),
                            description: '',
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={16} />
                    {t('Categorie toevoegen', 'Add category')}
                  </Button>
                </CardContent>
              </Card>
              <Card className="post-settings-card">
                <CardContent className="p-6">
                  <h2>{t('Opvolging & privacy', 'Follow-ups & privacy')}</h2>
                  <label className="post-label">
                    {t(
                      'Herinner aan onbeantwoorde vragen na (uren)',
                      'Remind me of unanswered requests after (hours)',
                    )}
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={settings.followUpHours}
                      onChange={(e) =>
                        patch({ followUpHours: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="post-label">
                    {t(
                      'Bewaar lokale samenvattingen (dagen)',
                      'Keep local summaries (days)',
                    )}
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={settings.retentionDays}
                      onChange={(e) =>
                        patch({ retentionDays: Number(e.target.value) })
                      }
                    />
                  </label>
                  <p>
                    {t(
                      'Alleen afzender, onderwerp, analyse en status worden lokaal bewaard; geen volledige mailinhoud of bijlagen. Opvolging stopt na een antwoord of handmatig afronden.',
                      'Only sender, subject, analysis and status are stored locally; no full messages or attachments. Follow-ups stop after a reply or manual resolution.',
                    )}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 text-red-700"
                    onClick={() => setDeleting(true)}
                  >
                    {t('Lokale gegevens wissen', 'Delete local data')}
                  </Button>
                  {deleting && (
                    <div role="alert" className="mt-3 rounded border p-3">
                      <p>
                        {t(
                          'Alle lokale gegevens, instellingen en de mailboxverbinding worden gewist. Je echte e-mails blijven behouden.',
                          'All local data, settings and the mailbox connection will be deleted. Your original emails are preserved.',
                        )}
                      </p>
                      <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => {
                          setDeleting(false);
                          void perform(
                            { action: 'clear', confirmDelete: true },
                            t(
                              'Lokale gegevens gewist. De demo is opnieuw beschikbaar.',
                              'Local data deleted. The demo is available again.',
                            ),
                          );
                        }}
                      >
                        {t('Ja, lokaal wissen', 'Yes, delete local data')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setDeleting(false)}
                      >
                        {t('Annuleren', 'Cancel')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="post-settings-card lg:col-span-2">
                <CardContent className="p-6">
                  <h2>
                    {t(
                      'Automatische ontvangstbevestiging',
                      'Automatic acknowledgment',
                    )}
                  </h2>
                  <p>
                    {t(
                      'Alleen voor geschikte, recente berichten met een antwoordvraag. Geen nieuwsbrieven, spam of automatische berichten. Maximaal één bevestiging per gesprek.',
                      'Only for eligible recent messages requiring a reply. No newsletters, spam or automated messages. At most one acknowledgment per conversation.',
                    )}
                  </p>
                  <label className="post-check">
                    <input
                      type="checkbox"
                      checked={settings.acknowledgment.enabled}
                      onChange={(e) => ack({ enabled: e.target.checked })}
                    />
                    {t(
                      'Ontvangstbevestigingen inschakelen',
                      'Enable acknowledgments',
                    )}
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="post-check">
                        <input
                          type="checkbox"
                          checked={settings.acknowledgment.newContacts}
                          onChange={(e) =>
                            ack({ newContacts: e.target.checked })
                          }
                        />
                        {t(
                          'Nieuwe en overige contacten',
                          'New and other contacts',
                        )}
                      </label>
                      <label className="post-check">
                        <input
                          type="checkbox"
                          checked={settings.acknowledgment.clients}
                          onChange={(e) => ack({ clients: e.target.checked })}
                        />
                        {t('Bestaande klanten', 'Existing clients')}
                      </label>
                      <label className="post-label">
                        {t(
                          'Antwoordtermijn (werkdagen)',
                          'Response timeframe (business days)',
                        )}
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={settings.acknowledgment.businessDays}
                          onChange={(e) =>
                            ack({ businessDays: Number(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                    <label className="post-label">
                      {t(
                        'Jouw bericht · {days} wordt vervangen',
                        'Your message · {days} is replaced',
                      )}
                      <textarea
                        className="post-select min-h-36 w-full resize-y"
                        value={settings.acknowledgment.message}
                        onChange={(e) => ack({ message: e.target.value })}
                      />
                    </label>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void perform({ action: 'testAck', settings })
                    }
                  >
                    <Send size={15} />
                    {t(
                      'Voorbeeld testen (verstuurt niets)',
                      'Test preview (sends nothing)',
                    )}
                  </Button>
                  {settings.acknowledgment.enabled && (
                    <label className="post-check rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <input
                        type="checkbox"
                        checked={confirmation}
                        onChange={(e) => setConfirmation(e.target.checked)}
                      />
                      {t(
                        'Ik geef toestemming om deze ontvangstbevestiging automatisch te versturen volgens de ingestelde regels. In demomodus wordt niets verzonden.',
                        'I authorize automatic sending of this acknowledgment under the configured rules. Nothing is sent in demo mode.',
                      )}
                    </label>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="sticky bottom-0 mt-5 flex items-center justify-between gap-4 rounded-xl border bg-white/95 p-4 shadow-sm">
              <span className="text-xs text-muted-foreground">
                {t(
                  'Wijzigingen worden pas na opslaan actief.',
                  'Changes take effect after saving.',
                )}
              </span>
              <Button
                disabled={busy}
                onClick={() => void save()}
                className="bg-[#245c43]"
              >
                <Check size={16} />
                {t('Instellingen opslaan', 'Save settings')}
              </Button>
            </div>
            <section className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">
                {t('Automatiseringsgeschiedenis', 'Automation history')}
              </h2>
              <Card className="overflow-x-auto p-5 shadow-none">
                {!data.history.length ? (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'Nog geen automatische acties.',
                      'No automatic actions yet.',
                    )}
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th>{t('Tijd', 'Time')}</th>
                        <th>{t('Actie', 'Action')}</th>
                        <th>Status</th>
                        <th>{t('Melding', 'Detail')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.history.map((h) => (
                        <tr key={h.key} className="border-t">
                          <td className="py-3">
                            {new Date(h.at).toLocaleString(
                              nl ? 'nl-BE' : 'en-GB',
                            )}
                          </td>
                          <td>{h.kind}</td>
                          <td>
                            {h.status === 'demo'
                              ? t('Gesimuleerd', 'Simulated')
                              : h.status === 'sent'
                                ? t('Verstuurd', 'Sent')
                                : h.status === 'uncertain'
                                  ? t(
                                      'Onzeker — controleer verzonden e-mails',
                                      'Uncertain — check sent mail',
                                    )
                                  : h.status}
                          </td>
                          <td>{h.code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </section>
          </>
        )}
        {preview && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          >
            <Card className="flex max-h-[85vh] w-full max-w-2xl flex-col p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 id="preview-title" className="font-semibold">
                  {t('Voorbeeld · niet verzonden', 'Preview · not sent')}
                </h2>
                <Button
                  variant="outline"
                  autoFocus
                  onClick={() => setPreview('')}
                >
                  {t('Sluiten', 'Close')}
                </Button>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap text-sm leading-6">
                {preview}
              </pre>
            </Card>
          </div>
        )}
        <footer className="mt-10 border-t pt-5 text-xs text-[#8a968d]">
          post. ·{' '}
          {t(
            'Rust in je inbox, ruimte voor je zaak.',
            'A calmer inbox. More room for your business.',
          )}
        </footer>
      </main>
    </>
  );
}
