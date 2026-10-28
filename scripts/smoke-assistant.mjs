import assert from 'node:assert/strict';
const origin = process.env.ASSISTANT_TEST_ORIGIN ?? 'http://localhost:4000';
const api = async (body) => {
  const response = await fetch(
    `${origin}/api/assistant`,
    body
      ? {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {},
  );
  return { response, data: await response.json() };
};
let { data: initial } = await api();
assert.equal(
  initial.connection.demo,
  true,
  'Only run smoke checks in demo mode',
);
let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
check(initial.mails.length === 6, 'fictional fixture loaded');
check(
  !JSON.stringify(initial).includes('refreshToken'),
  'credentials not exposed',
);
for (const path of ['/api/config', '/api/emai'])
  check((await fetch(origin + path)).status === 403, 'legacy API blocked');
check(
  (
    await fetch(origin + '/api/assistant', {
      headers: { Origin: 'https://untrusted.example' },
    })
  ).status === 403,
  'cross-origin rejected',
);
check(
  (
    await fetch(origin + '/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  ).status === 403,
  'mutating requests require origin',
);
const original = initial.settings;
try {
  const enabled = {
    ...original,
    acknowledgment: {
      ...original.acknowledgment,
      enabled: true,
      confirmedAt: new Date().toISOString(),
    },
  };
  check(
    (await api({ action: 'settings', settings: enabled })).response.status ===
      400,
    'client timestamp cannot enable sending',
  );
  const tested = await api({ action: 'testAck', settings: original });
  check(
    tested.data.sent === false && tested.data.preview.includes('2'),
    'preview does not send',
  );
  const brief = await api({ action: 'briefing' });
  check(
    brief.data.sent === false && brief.data.text.includes('mailoverzicht'),
    'briefing preview is grounded',
  );
  const duplicate = {
    ...original,
    categories: [
      ...original.categories,
      { id: 'duplicate', name: original.categories[0].name, description: '' },
    ],
  };
  check(
    (await api({ action: 'settings', settings: duplicate })).response.status ===
      400,
    'duplicate categories rejected',
  );
  check(
    (
      await api({
        action: 'settings',
        settings: { ...original, language: 'en' },
      })
    ).data.settings.language === 'en',
    'English settings persist',
  );
  check(
    (await api({ action: 'settings', settings: original })).response.ok,
    'Dutch settings restored',
  );
  const corrected = await api({
    action: 'category',
    id: 'demo2',
    categoryId: 'clients',
  });
  check(
    corrected.data.mails.find((m) => m.id === 'demo2').manualCategory === true,
    'manual classification persists',
  );
  check(
    (await api({ action: 'resolve', id: 'demo1' })).data.mails.find(
      (m) => m.id === 'demo1',
    ).resolved === true,
    'follow-up can be resolved',
  );
  check(
    !(await api()).data.briefing.followUps.some((m) => m.id === 'demo1'),
    'resolved thread excluded',
  );
  check(
    (
      await api({
        action: 'contact',
        address: 'tom@example.test',
        kind: 'irrelevant',
      })
    ).response.ok,
    'contact correction accepted',
  );
  check(
    !(await api()).data.briefing.leads.some((m) => m.id === 'demo2'),
    'irrelevant contact excluded from leads',
  );
} finally {
  await api({ action: 'clear', confirmDelete: true });
}
console.log(`${checks} HTTP smoke assertions passed; demo reset.`);
