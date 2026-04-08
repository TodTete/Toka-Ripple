const DEFAULT_BASE_URL = 'https://talentland-toka.eastus2.cloudapp.azure.com';

function getConfig() {
  const baseUrl = process.env.TOKA_API_BASE_URL || DEFAULT_BASE_URL;
  const appId = process.env.TOKA_APP_ID || '3500020265490631';
  const merchantCode = process.env.TOKA_MERCHANT_CODE || '';

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    appId,
    merchantCode,
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
  request,
};