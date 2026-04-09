const AUTH_SCOPE_MAP = {
  DigitalIdentity: ['USER_ID', 'USER_AVATAR', 'USER_NICKNAME'],
  ContactInformation: ['PLAINTEXT_MOBILE_PHONE', 'PLAINTEXT_EMAIL_ADDRESS'],
  AddressInformation: ['USER_ADDRESS'],
  PersonalInformation: [
    'USER_NAME',
    'USER_FIRST_SURNAME',
    'USER_SECOND_SURNAME',
    'USER_GENDER',
    'USER_BIRTHDAY',
    'USER_STATE_OF_BIRTH',
    'USER_NATIONALITY',
  ],
  KYCStatus: ['USER_KYC_STATUS'],
};

const OAUTH_SCOPE_CANDIDATES = ['auth_user', 'auth_base'];

function parseMaybeJson(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseQueryStringMaybe(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  if (!value.includes('=') || value.trim().startsWith('{')) {
    return null;
  }

  const result = {};
  const pairs = value.split('&');
  for (const pair of pairs) {
    const [rawKey, rawValue] = pair.split('=');
    if (!rawKey) {
      continue;
    }

    const key = decodeURIComponent(rawKey);
    const val = decodeURIComponent(rawValue || '');
    result[key] = val;
  }

  return Object.keys(result).length ? result : null;
}

function findAuthCodeDeep(value, depth = 0) {
  if (!value || depth > 5) {
    return '';
  }

  if (typeof value === 'string') {
    const parsed = parseMaybeJson(value);
    if (parsed) {
      return findAuthCodeDeep(parsed, depth + 1);
    }
    return '';
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findAuthCodeDeep(item, depth + 1);
      if (nested) {
        return nested;
      }
    }
    return '';
  }

  if (typeof value === 'object') {
    const directKeys = ['authCode', 'authcode', 'auth_code', 'authorizationCode', 'code'];
    for (const key of directKeys) {
      if (typeof value[key] === 'string' && value[key].trim()) {
        return value[key].trim();
      }
    }

    for (const key of Object.keys(value)) {
      const nested = findAuthCodeDeep(value[key], depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  return '';
}

export function extractAuthCodeFromBridgeResponse(response) {
  const parsedResult = parseMaybeJson(response?.result);
  const parsedData = parseMaybeJson(response?.data);
  const queryResult = parseQueryStringMaybe(response?.result);
  const queryData = parseQueryStringMaybe(response?.data);

  return (
    response?.authCode ||
    response?.authcode ||
    response?.auth_code ||
    response?.data?.authCode ||
    response?.data?.authcode ||
    response?.result?.authCode ||
    response?.result?.authcode ||
    response?.result?.data?.authCode ||
    response?.result?.data?.authcode ||
    parsedResult?.authCode ||
    parsedResult?.authcode ||
    parsedResult?.data?.authCode ||
    parsedResult?.data?.authcode ||
    parsedData?.authCode ||
    parsedData?.authcode ||
    queryResult?.authCode ||
    queryResult?.authcode ||
    queryData?.authCode ||
    queryData?.authcode ||
    findAuthCodeDeep(response) ||
    ''
  );
}

function isAlipayUserAgent() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /AlipayClient|MiniProgram/i.test(navigator.userAgent || '');
}

export function isAlipayWebView() {
  return Boolean(window.AlipayJSBridge || isAlipayUserAgent());
}

function normalizeBridgeError(method, response) {
  const detail =
    response?.errorMessage ||
    response?.errorMsg ||
    response?.message ||
    response?.memo ||
    'Unknown bridge error.';
  const error = new Error(`Bridge method ${method} failed: ${detail}`);
  error.response = response;
  error.method = method;
  error.detail = detail;
  return error;
}

export function getBridgeRuntimeInfo() {
  const bridge = window.AlipayJSBridge || window.my;

  return {
    hasMy: Boolean(window.my),
    hasAlipayJSBridge: Boolean(window.AlipayJSBridge),
    hasBridge: Boolean(bridge),
    hasBridgeCall: Boolean(bridge && typeof bridge.call === 'function'),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
  };
}

function hasBridgeError(response) {
  return Boolean(
    response &&
      (response.error ||
        response.success === false ||
        response.errorCode ||
        response.error === 'DENIED' ||
        response.error === 'NO_PERMISSION' ||
        response.errorMessage ||
        response.errorMsg)
  );
}

function listAvailableBridges() {
  return [
    { name: 'AlipayJSBridge', bridge: window.AlipayJSBridge },
    { name: 'my', bridge: window.my },
  ].filter((item) => Boolean(item.bridge));
}

function callBridgeByMethodOn(bridgeName, bridge, method, params, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (handler, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      handler(value);
    };

    const timeout = setTimeout(() => {
      finish(
        reject,
        new Error(
          `Bridge ${bridgeName} method ${method} timed out after ${timeoutMs}ms. The container did not return success/fail callback.`
        )
      );
    }, timeoutMs);

    if (typeof bridge.call === 'function') {
      const onResponse = (response) => {
        if (hasBridgeError(response)) {
          finish(reject, normalizeBridgeError(method, response));
          return;
        }

        if (/AuthCode$/i.test(method) && !extractAuthCodeFromBridgeResponse(response)) {
          const missingCodeError = new Error(
            `Bridge ${bridgeName} method ${method} returned success but no authCode in payload.`
          );
          missingCodeError.response = response;
          finish(
            reject,
            missingCodeError
          );
          return;
        }

        finish(resolve, response);
      };

      const maybePromise = bridge.call(method, params, onResponse);

      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise
          .then((response) => onResponse(response || {}))
          .catch((error) => {
            if (error && error.errorMessage) {
              finish(reject, normalizeBridgeError(method, error));
              return;
            }

            finish(reject, new Error(`Bridge ${bridgeName} method ${method} promise rejected.`));
          });
      }
      return;
    }

    if (typeof bridge[method] === 'function') {
      const invokeParams =
        Object.assign({}, params, {
          success: (response) => {
            if (/AuthCode$/i.test(method) && !extractAuthCodeFromBridgeResponse(response)) {
              const missingCodeError = new Error(
                `Bridge ${bridgeName} method ${method} returned success but no authCode in payload.`
              );
              missingCodeError.response = response;
              finish(
                reject,
                missingCodeError
              );
              return;
            }

            finish(resolve, response);
          },
          fail: (response) => finish(reject, normalizeBridgeError(method, response)),
        });

      const maybePromise = bridge[method](invokeParams);

      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise
          .then((response) => {
            if (/AuthCode$/i.test(method) && !extractAuthCodeFromBridgeResponse(response || {})) {
              const missingCodeError = new Error(
                `Bridge ${bridgeName} method ${method} returned success but no authCode in payload.`
              );
              missingCodeError.response = response || null;
              finish(reject, missingCodeError);
              return;
            }

            finish(resolve, response || {});
          })
          .catch((error) => {
            if (error && error.errorMessage) {
              finish(reject, normalizeBridgeError(method, error));
              return;
            }

            finish(reject, new Error(`Bridge ${bridgeName} method ${method} promise rejected.`));
          });
      }

      return;
    }

    const availableKeys = Object.keys(bridge).slice(0, 20).join(', ') || 'none';
    finish(
      reject,
      new Error(
        `Bridge ${bridgeName} method ${method} is not available. bridge.call=${typeof bridge.call === 'function'} availableKeys=${availableKeys}`
      )
    );
  });
}

async function callBridgeByMethod(method, params, timeoutMs = 15000) {
  const bridges = listAvailableBridges();

  if (bridges.length === 0) {
    throw new Error('Alipay bridge is not available.');
  }

  const failures = [];

  for (const item of bridges) {
    try {
      return await callBridgeByMethodOn(item.name, item.bridge, method, params, timeoutMs);
    } catch (error) {
      failures.push({
        bridge: item.name,
        method,
        params,
        message: error?.message || 'Unknown bridge error',
        response: error?.response || null,
      });
    }
  }

  const aggregated = new Error(failures.map((item) => `${item.bridge}: ${item.message}`).join(' | '));
  aggregated.details = failures;
  throw aggregated;
}

function waitForBridgeReady(timeoutMs = 10000) {
  if (window.AlipayJSBridge || window.my) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer = null;

    const cleanup = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      document.removeEventListener('AlipayJSBridgeReady', onReady);
    };

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error('Alipay bridge readiness timed out.'));
    }, timeoutMs);

    function onReady() {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      cleanup();
      resolve();
    }

    document.addEventListener('AlipayJSBridgeReady', onReady);

    pollTimer = setInterval(() => {
      if (window.AlipayJSBridge || window.my) {
        onReady();
      }
    }, 100);
  });
}

async function callBridgeWithFallback(candidates) {
  const errors = [];
  const attempts = [];

  for (const candidate of candidates) {
    try {
      const result = await callBridgeByMethod(candidate.method, candidate.params);
      return { result, method: candidate.method, params: candidate.params, attempts };
    } catch (error) {
      const detailList = Array.isArray(error?.details) ? error.details : null;
      attempts.push({
        method: candidate.method,
        params: candidate.params,
        message: error?.message || 'Unknown bridge error',
        response: error?.response || null,
        bridgeDetails: detailList,
      });
      errors.push(error);
    }
  }

  const mergedError = new Error(
    errors.map((error) => error.message).join(' | ') || 'Unable to execute bridge auth method.'
  );
  mergedError.causes = errors;
  mergedError.attempts = attempts;
  throw mergedError;
}

function getAuthMethodCandidates(authType, usage, strictMethodOnly = false) {
  const scopes = AUTH_SCOPE_MAP[authType];

  if (!scopes) {
    throw new Error('Unsupported auth type.');
  }

  const methodName = `getUser${authType}AuthCode`;
  const candidates = [
    {
      method: methodName,
      params: {
        scopes,
        usage: usage || 'Authorization requested by Toka Ripple.',
      },
    },
    {
      method: methodName,
      params: {
        scopes: scopes.join(','),
        usage: usage || 'Authorization requested by Toka Ripple.',
      },
    },
    {
      method: methodName,
      params: {
        scopeNicks: scopes,
        usage: usage || 'Authorization requested by Toka Ripple.',
      },
    },
    {
      method: methodName,
      params: {
        scopeNicks: scopes.join(','),
        usage: usage || 'Authorization requested by Toka Ripple.',
      },
    },
    {
      method: methodName,
      params: {
        usage: usage || 'Authorization requested by Toka Ripple.',
      },
    },
  ];

  if (strictMethodOnly) {
    return candidates;
  }

  for (const scopeNick of OAUTH_SCOPE_CANDIDATES) {
    candidates.push(
      {
        method: 'getAuthCode',
        params: {},
      },
      {
        method: 'getAuthCode',
        params: { scopeNicks: [scopeNick] },
      },
      {
        method: 'getAuthCode',
        params: { scopeNicks: scopeNick },
      },
      {
        method: 'getAuthCode',
        params: { scopeNicks: `${scopeNick}` },
      },
      {
        method: 'getAuthCode',
        params: { scopes: [scopeNick] },
      },
      {
        method: 'getAuthCode',
        params: { scopes: scopeNick },
      },
      {
        method: 'getAuthCode',
        params: { scopeNicks: [scopeNick], scopes: [scopeNick] },
      }
    );
  }

  return candidates;
}

export async function requestAuthCode(authType, usage, strictMethodOnly = false) {
  await waitForBridgeReady();
  const candidates = getAuthMethodCandidates(authType, usage, strictMethodOnly);
  const { result, method, attempts } = await callBridgeWithFallback(candidates);
  return {
    ...result,
    __meta: {
      method,
      attempts,
      strictMethodOnly,
    },
  };
}

export function openPayment(paymentUrl) {
  return callBridgeByMethod('pay', { paymentUrl });
}

export const alipayAuthScopes = AUTH_SCOPE_MAP;