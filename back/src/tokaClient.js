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

function normalizeMerchantCode(rawMerchantCode) {
  const candidate = String(rawMerchantCode || '').trim();
  if (!candidate) {
    return '';
  }

  // Toka API expects Alipay-MerchantCode with exactly 5 characters (merchant prefix).
  return candidate.slice(0, 5);
}

function buildHeaders({ accessToken, tokenType, merchantCode } = {}) {
  const { appId, merchantCode: defaultMerchantCode } = getConfig();
  const headers = {
    'Content-Type': 'application/json',
    'X-App-Id': appId,
  };

  if (accessToken) {
    const normalizedToken = String(accessToken).trim();
    const normalizedType = String(tokenType || 'Bearer').trim() || 'Bearer';
    headers.Authorization = /^\S+\s+/i.test(normalizedToken)
      ? normalizedToken
      : `${normalizedType} ${normalizedToken}`;
  }

  const normalizedMerchantCode = normalizeMerchantCode(merchantCode || defaultMerchantCode);
  if (normalizedMerchantCode) {
    headers['Alipay-MerchantCode'] = normalizedMerchantCode;
  }

  return headers;
}

async function request(path, { method = 'POST', body, accessToken, tokenType, merchantCode } = {}) {
  const { baseUrl } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: buildHeaders({ accessToken, tokenType, merchantCode }),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    let payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const isEmptyStringPayload = typeof payload === 'string' && payload.trim() === '';
      const isMissingPayload = payload === null || typeof payload === 'undefined';

      if (isEmptyStringPayload || isMissingPayload) {
        payload = {
          success: false,
          statusCode: response.status,
          message: `Toka API rejected request ${method} ${path} with HTTP ${response.status}.`,
          data: {},
        };
      }
    }

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