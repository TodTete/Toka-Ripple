const TOKA_APP_ID = process.env.TOKA_APP_ID;
const TOKA_MERCHANT_CODE = process.env.TOKA_MERCHANT_CODE;
const TOKA_API_BASE_URL = process.env.TOKA_API_BASE_URL;

function validateConfig() {
  const errors = [];

  if (!TOKA_APP_ID) {
    errors.push('TOKA_APP_ID is required.');
  } else if (TOKA_APP_ID.length !== 16) {
    errors.push('TOKA_APP_ID must contain exactly 16 characters.');
  }

  if (!TOKA_MERCHANT_CODE) {
    errors.push('TOKA_MERCHANT_CODE is required.');
  }

  if (!TOKA_API_BASE_URL) {
    errors.push('TOKA_API_BASE_URL is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function getConfig() {
  const validation = validateConfig();

  return {
    baseUrl: (TOKA_API_BASE_URL || '').replace(/\/$/, ''),
    appId: TOKA_APP_ID || '',
    merchantCode: TOKA_MERCHANT_CODE || '',
    validation,
  };
}

function buildHeaders({ accessToken, merchantCode } = {}) {
  const { appId, merchantCode: defaultMerchantCode } = getConfig();
  const headers = {
    'Content-Type': 'application/json',
    'X-App-Id': appId,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (merchantCode || defaultMerchantCode) {
    headers['Alipay-MerchantCode'] = merchantCode || defaultMerchantCode;
  }

  return headers;
}

async function request(path, { method = 'POST', body, accessToken, merchantCode } = {}) {
  const { baseUrl } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: buildHeaders({ accessToken, merchantCode }),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    return {
      status: response.status,
      ok: response.ok,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  getConfig,
  validateConfig,
  request,
};