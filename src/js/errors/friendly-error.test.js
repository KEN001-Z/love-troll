import test from 'node:test';
import assert from 'node:assert/strict';
import { getFriendlyError } from './friendly-error.js';

const messages = [
  [{ code: 'over_email_send_rate_limit', status: 429 }, 'Too many sign-ups right now. Please wait a few minutes and try again.'],
  [{ status: 429 }, 'Too many sign-ups right now. Please wait a few minutes and try again.'],
  [{ code: 'email_exists', status: 422 }, 'This email already has an account. Try logging in instead.'],
  [{ code: 'user_already_exists', status: 422 }, 'This email already has an account. Try logging in instead.'],
  [{ code: 'invalid_credentials', status: 400 }, 'Email or password is incorrect. Please check and try again.'],
  [{ code: 'email_not_confirmed', status: 400 }, 'Please confirm your email first. Check your inbox and spam folder.'],
  [{ code: 'weak_password', status: 422 }, 'Your password is too weak. Use at least 8 characters.'],
  [{ code: 'email_address_invalid', status: 400 }, 'That email doesn’t look right. Please check it.'],
  [{ code: 'signup_disabled', status: 403 }, 'Sign-up isn’t available right now. Please try again later.'],
  [{ status: 0 }, 'You seem to be offline. Check your connection and try again.'],
  [{ code: 'unknown', message: 'permission denied for table profiles' }, 'Something went wrong on our side. Please try again in a moment.'],
  [new Error('Failed to fetch'), 'You seem to be offline. Check your connection and try again.']
];

test('maps Supabase and network errors to safe friendly messages', t => {
  t.mock.method(console, 'error', () => {});
  for (const [error, expected] of messages) {
    assert.equal(getFriendlyError(error), expected);
  }
});

test('uses safe task-specific messages for sign-up, onboarding, and posting', t => {
  t.mock.method(console, 'error', () => {});
  assert.equal(
    getFriendlyError({ code: 'unexpected_failure' }, 'signup'),
    'Sign-up isn’t available right now. Please try again later.'
  );
  assert.equal(
    getFriendlyError({ code: '42501' }, 'onboarding'),
    'We couldn’t save your answers. Please log in again and retry. Your account is safe.'
  );
  assert.equal(
    getFriendlyError({ code: 'storage_error' }, 'post-upload'),
    'Your post didn’t go through. Check your connection and tap retry. Your caption is saved.'
  );
});

test('does not fall back to raw message text when a code is present', t => {
  t.mock.method(console, 'error', () => {});
  assert.equal(
    getFriendlyError({ code: 'unknown', message: 'new row violates row-level security policy' }),
    'Something went wrong on our side. Please try again in a moment.'
  );
});
