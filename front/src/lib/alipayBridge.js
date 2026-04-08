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

export function isAlipayWebView() {
  return Boolean(window.AlipayJSBridge || window.my);
}

function callBridge(method, params) {
  return new Promise((resolve, reject) => {
    const bridge = window.AlipayJSBridge || window.my;

    if (!bridge || typeof bridge.call !== 'function') {
      reject(new Error('Alipay bridge is not available.'));
      return;
    }

    bridge.call(method, params, (response) => {
      const hasError = response && (response.error || response.success === false);
      if (hasError) {
        reject(response);
        return;
      }

      resolve(response);
    });
  });
}

export function requestAuthCode(authType) {
  const scopes = AUTH_SCOPE_MAP[authType];

  if (!scopes) {
    return Promise.reject(new Error('Unsupported auth type.'));
  }

  const methodName = `getUser${authType}AuthCode`;
  return callBridge(methodName, {
    scopes,
    usage: 'Authorization requested by Toka Ripple.',
  });
}

export function openPayment(paymentUrl) {
  return callBridge('pay', { paymentUrl });
}

export const alipayAuthScopes = AUTH_SCOPE_MAP;