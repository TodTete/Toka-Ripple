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

function isAlipayUserAgent() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /AlipayClient|MiniProgram/i.test(navigator.userAgent || '');
}

export function isAlipayWebView() {
  return Boolean(window.AlipayJSBridge || window.my || isAlipayUserAgent());
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
  return error;
}

function hasBridgeError(response) {
  return Boolean(
    response &&
      (response.error ||
        response.success === false ||
        response.errorCode ||
        response.errorMessage ||
        response.errorMsg)
  );
}

function callBridgeByMethod(method, params) {
  return new Promise((resolve, reject) => {
    const bridge = window.AlipayJSBridge || window.my;

    if (!bridge) {
      reject(new Error('Alipay bridge is not available.'));
      return;
    }

    if (typeof bridge.call === 'function') {
      bridge.call(method, params, (response) => {
        if (hasBridgeError(response)) {
          reject(normalizeBridgeError(method, response));
          return;
        }

        resolve(response);
      });
      return;
    }

    if (typeof bridge[method] === 'function') {
      bridge[method](
        Object.assign({}, params, {
          success: (response) => resolve(response),
          fail: (response) => reject(normalizeBridgeError(method, response)),
        })
      );
      return;
    }

    reject(new Error(`Bridge method ${method} is not available.`));
  });
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

  for (const candidate of candidates) {
    try {
      const result = await callBridgeByMethod(candidate.method, candidate.params);
      return { result, method: candidate.method, params: candidate.params };
    } catch (error) {
      errors.push(error);
    }
  }

  const mergedError = new Error(
    errors.map((error) => error.message).join(' | ') || 'Unable to execute bridge auth method.'
  );
  mergedError.causes = errors;
  throw mergedError;
}

function getAuthMethodCandidates(authType, usage) {
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
        usage:usage || 'Authorization requested by Toka Ripple.',
      },
    },
  ];

  for (const scopeNick of OAUTH_SCOPE_CANDIDATES) {
    candidates.push(
      {
        method: 'getAuthCode',
        params: { scopeNicks: [scopeNick] },
      },
      {
        method: 'getAuthCode',
        params: { scopes: [scopeNick] },
      }
    );
  }

  return candidates;
}

export async function requestAuthCode(authType, usage) {
  await waitForBridgeReady();
  const candidates = getAuthMethodCandidates(authType, usage);
  const { result } = await callBridgeWithFallback(candidates);
  return result;
}

export function openPayment(paymentUrl) {
  return callBridgeByMethod('pay', { paymentUrl });
}

export const alipayAuthScopes = AUTH_SCOPE_MAP;