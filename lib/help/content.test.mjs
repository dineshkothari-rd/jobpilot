import assert from 'node:assert/strict';
import test from 'node:test';
import { HELP_ARTICLES, searchHelp, parseSupportTicket, parseSupportReply } from './content.ts';
test('help search matches all words across titles and content without case sensitivity', () => {
  assert.equal(searchHelp(' ').length, HELP_ARTICLES.length);
  assert.ok(searchHelp('PASSWORD reset').some(article => article.id === 'sign-in'));
  assert.ok(searchHelp('PDF private').some(article => article.id === 'resume'));
  assert.equal(searchHelp('nonexistent-help-topic').length, 0);
  assert.equal(new Set(HELP_ARTICLES.map(article => article.id)).size, HELP_ARTICLES.length);
  assert.ok(!HELP_ARTICLES.some(article => article.id === 'support'));
});
test('ticket and reply validation rejects forged fields, invalid categories, short details and invalid versions', () => {
  const request = { category: 'account', subject: 'Login problem', details: 'Unable to sign in after resetting my password.' };
  assert.equal(parseSupportTicket(request).subject, 'Login problem');
  for (const input of [null, [], { ...request, user_id: 'other' }, { ...request, category: '__proto__' }, { ...request, details: 'short' }, { ...request, subject: 'x'.repeat(161) }]) assert.throws(() => parseSupportTicket(input));
  const reply = { id: '00000000-0000-4000-8000-000000000039', status: 'resolved', response: 'Please request a fresh password reset link.', version: 1 };
  assert.equal(parseSupportReply(reply).version, 1);
  for (const input of [{ ...reply, version: 0 }, { ...reply, version: 2147483647 }, { ...reply, version: 1.5 }, { ...reply, status: 'invalid' }, { ...reply, user_id: 'other' }, { ...reply, response: 'short' }]) assert.throws(() => parseSupportReply(input));
});
