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
    const error = new Error((payload && payload.message) || 'Request failed.');
    error.payload = payload;
    error.status = response.status;
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

export function authenticate(authcode) {
  return fetchJson('/api/alipay/authenticate', { authcode });
}

export function getUserInfo(accessToken, authCodes) {
  return fetchJson('/api/alipay/user-info', { accessToken, authCodes });
}

export function createPayment(payload) {
  return fetchJson('/api/alipay/payment/create', payload);
}

export function inquiryPayment(accessToken, paymentId) {
  return fetchJson('/api/alipay/payment/inquiry', { accessToken, paymentId });
}

export function closePayment(accessToken, paymentId) {
  return fetchJson('/api/alipay/payment/close', { accessToken, paymentId });
}

export function refundPayment(payload) {
  return fetchJson('/api/alipay/payment/refund', payload);
}

export function inquiryRefund(accessToken, refundId) {
  return fetchJson('/api/alipay/payment/inquiry-refund', { accessToken, refundId });
}
