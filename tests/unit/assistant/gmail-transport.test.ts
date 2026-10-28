import { describe, it, expect, vi } from 'vitest';
import { GmailProvider } from '../../../src/providers/gmail';
import * as utils from '../../../src/core/utils';

describe('Gmail acknowledgment transport', () => {
  it('reuses the existing provider, keeps the original thread and loop prevention headers', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: 'sent1', threadId: 'thread1' } });
    const get = vi.fn().mockResolvedValue({
      data: {
        id: 'sent1',
        threadId: 'thread1',
        labelIds: ['SENT'],
        payload: {
          headers: [
            { name: 'Message-ID', value: '<sent1@example.test>' },
            { name: 'From', value: 'owner@example.test' },
          ],
        },
      },
    });
    class OAuth2 {
      setCredentials = vi.fn();
      getAccessToken = vi
        .fn()
        .mockResolvedValue({ token: 'fictional-test-token' });
    }
    const imported = vi
      .spyOn(utils, 'tryImport')
      .mockResolvedValue({
        google: {
          auth: { OAuth2 },
          gmail: () => ({ users: { messages: { send, get } } }),
        },
      });
    try {
      const provider = new GmailProvider({
        type: 'gmail',
        credentials: {
          clientId: 'fictional',
          clientSecret: 'fictional',
          refreshToken: 'fictional',
        },
      });
      await provider.connect();
      await provider.sendEmail({
        threadId: 'thread1',
        to: 'customer@example.test',
        subject: 'Re: Website',
        text: 'Bedankt voor uw bericht.',
        headers: {
          'Auto-Submitted': 'auto-replied',
          'X-Assistant-Ack': 'yes',
          'In-Reply-To': '<original@example.test>',
        },
      });
      expect(send).toHaveBeenCalledTimes(1);
      const request = send.mock.calls[0][0];
      expect(request.requestBody.threadId).toBe('thread1');
      const mime = Buffer.from(request.requestBody.raw, 'base64url').toString(
        'utf8',
      );
      expect(mime).toContain('Auto-Submitted: auto-replied');
      expect(mime).toContain('X-Assistant-Ack: yes');
      expect(mime).toContain('In-Reply-To: <original@example.test>');
      await provider.disconnect();
    } finally {
      imported.mockRestore();
    }
  });
});
