const DEFAULT_ERROR = 'Something went wrong on our side. Please try again in a moment.';
const RATE_LIMIT_ERROR = 'Too many sign-ups right now. Please wait a few minutes and try again.';
const SIGNUP_ERROR = 'Sign-up isn’t available right now. Please try again later.';
const POST_ERROR = 'Your post didn’t go through. Check your connection and tap retry. Your caption is saved.';
const OFFLINE_ERROR = 'You seem to be offline. Check your connection and try again.';

export function getFriendlyError(error, context = 'general') {
  console.error(`[VYBE] ${context} failed.`, error);

  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  const status = Number.isInteger(error?.status) ? error.status : null;

  if (['over_email_send_rate_limit', 'over_request_rate_limit', 'over_sms_send_rate_limit'].includes(code) ||
      status === 429) {
    return RATE_LIMIT_ERROR;
  }
  if (['email_exists', 'user_already_exists'].includes(code)) {
    return 'This email already has an account. Try logging in instead.';
  }
  if (code === 'invalid_credentials') {
    return 'Email or password is incorrect. Please check and try again.';
  }
  if (code === 'email_not_confirmed') {
    return 'Please confirm your email first. Check your inbox and spam folder.';
  }
  if (code === 'weak_password') {
    return 'Your password is too weak. Use at least 8 characters.';
  }
  if (code === 'email_address_invalid') {
    return 'That email doesn’t look right. Please check it.';
  }
  if (['oauth_provider_not_supported', 'provider_disabled'].includes(code) && context !== 'signup') {
    return 'Google sign-in is not available right now. Please use email or try again later.';
  }
  if (['signup_disabled', 'email_provider_disabled', 'provider_disabled'].includes(code)) {
    return SIGNUP_ERROR;
  }
  if (['request_timeout'].includes(code) || status === 408 || status === 504 || status === 0) {
    return OFFLINE_ERROR;
  }

  if (!code) {
    const message = typeof error?.message === 'string' ? error.message : '';
    if (error instanceof TypeError ||
        /failed to fetch|networkerror|network request failed|timed out|timeout|offline/i.test(message)) {
      return OFFLINE_ERROR;
    }
    if (/email.*already (?:exists|registered)|user already registered/i.test(message)) {
      return 'This email already has an account. Try logging in instead.';
    }
    if (/invalid login credentials|email or password is incorrect/i.test(message)) {
      return 'Email or password is incorrect. Please check and try again.';
    }
    if (/email not confirmed/i.test(message)) {
      return 'Please confirm your email first. Check your inbox and spam folder.';
    }
    if (/password.*(?:weak|short)|(?:weak|short).*password/i.test(message)) {
      return 'Your password is too weak. Use at least 8 characters.';
    }
    if (/invalid email|email address.*invalid/i.test(message)) {
      return 'That email doesn’t look right. Please check it.';
    }
    if (/signup.*disabled|sign.?up.*not available|email provider.*disabled/i.test(message)) {
      return SIGNUP_ERROR;
    }
  }

  if (context === 'signup') return SIGNUP_ERROR;
  if (context === 'onboarding') {
    return 'We couldn’t save your answers. Please log in again and retry. Your account is safe.';
  }
  if (context === 'post' || context === 'post-upload') return POST_ERROR;
  return DEFAULT_ERROR;
}

export function isSessionExpiredError(error) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  if (error?.status === 401) return true;
  if (['bad_jwt', 'session_expired', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(code)) {
    return true;
  }
  if (code) return false;

  const message = typeof error?.message === 'string' ? error.message : '';
  return error?.status === 401 || /session (?:is )?(?:missing|expired)|refresh token/i.test(message);
}
