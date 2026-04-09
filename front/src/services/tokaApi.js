const DEFAULT_API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

async function fetchJson(path, body) {
  const response = await fetch(`${DEFAULT_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const payloadMessage =
      typeof payload === 'string'
        ? payload.trim()
        : payload?.message || payload?.error || payload?.title || '';
    const error = new Error(
      payloadMessage || `Request failed (${response.status}).`
    );
    error.payload = payload;
    error.status = response.status;
    error.responseText = typeof payload === 'string' ? payload : '';
    throw error;
  }

  return payload;
}

export function getBackendConfig() {
  return fetch(`${DEFAULT_API_BASE_URL}/api/config`).then(async (response) => {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || 'Unable to load backend config.');
    }
    return payload;
  });
}

export function authenticate(authcode, jsapiMeta = null) {
  return fetchJson('/api/alipay/authenticate', { authcode, jsapiMeta });
}

export function getUserInfo(accessToken, authCodes, tokenType = 'Bearer') {
  return fetchJson('/api/alipay/user-info', { accessToken, authCodes, tokenType });
}

export function createPayment(payload) {
  return fetchJson('/api/alipay/payment/create', payload);
}

export function inquiryPayment(accessToken, paymentId, tokenType = 'Bearer') {
  return fetchJson('/api/alipay/payment/inquiry', { accessToken, paymentId, tokenType });
}

export function closePayment(accessToken, paymentId, tokenType = 'Bearer') {
  return fetchJson('/api/alipay/payment/close', { accessToken, paymentId, tokenType });
}

export function refundPayment(payload) {
  return fetchJson('/api/alipay/payment/refund', payload);
}

export function inquiryRefund(accessToken, refundId) {
  return fetchJson('/api/alipay/payment/inquiry-refund', { accessToken, refundId });
}
