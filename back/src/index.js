const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { getConfig, request } = require('./tokaClient');

const app = express();
const port = process.env.PORT || 4000;
const frontendBuildPath = path.join(__dirname, '../../front/build');
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');

app.use(cors({ origin: true }));
app.use(express.json());

function validateAuthCode(body) {
  return typeof body?.authcode === 'string' && body.authcode.trim().length > 0;
}

function validateAccessToken(body) {
  return typeof body?.accessToken === 'string' && body.accessToken.trim().length > 0;
}

function validatePaymentAmount(amount) {
  return amount && typeof amount.value !== 'undefined' && typeof amount.currency === 'string';
}

function validateJsapiMeta(jsapiMeta) {
  if (!jsapiMeta) {
    return { valid: true };
  }

  const resultCode = String(jsapiMeta.resultCode || '').trim();

  if (!resultCode) {
    return { valid: true };
  }

  if (!/success|ok|s|0|10000|20000000/i.test(resultCode)) {
    return {
      valid: false,
      message: `JSAPI exchange rejected. resultCode=${resultCode} resultMsg=${jsapiMeta.resultMsg || ''}`,
    };
  }

  return { valid: true };
}

function validateBaseRequest(req, res, next) {
  const config = getConfig();

  if (!config.validation.isValid) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Backend TOKA configuration is invalid.',
      data: {
        errors: config.validation.errors,
      },
    });
  }

  next();
}

function forwardResult(res, result) {
  if (typeof result.payload === 'string') {
    return res.status(result.status).send(result.payload);
  }

  return res.status(result.status).json(result.payload);
}

app.get('/health', (_req, res) => {
  res.status(200).send('Healthy');
});

app.get('/api/config', (_req, res) => {
  const config = getConfig();
  res.json({
    success: config.validation.isValid,
    statusCode: config.validation.isValid ? 200 : 500,
    message: config.validation.isValid
      ? 'Configuration loaded.'
      : 'Backend TOKA configuration is invalid.',
    data: {
      appId: config.appId,
      hasMerchantCode: Boolean(config.merchantCode),
      tokaApiBaseUrl: config.baseUrl,
      errors: config.validation.errors,
    },
  });
});

app.post('/api/alipay/authenticate', validateBaseRequest, async (req, res) => {
  if (!validateAuthCode(req.body)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'authcode is required.',
      data: {},
    });
  }

  const jsapiMetaValidation = validateJsapiMeta(req.body.jsapiMeta);
  if (!jsapiMetaValidation.valid) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: jsapiMetaValidation.message,
      data: {
        jsapiMeta: req.body.jsapiMeta || null,
      },
    });
  }

  try {
    const result = await request('/v1/user/authenticate', {
      body: { authcode: req.body.authcode },
    });
    return forwardResult(res, result);
  } catch (error) {
    return res.status(502).json({
      success: false,
      statusCode: 502,
      message: error.name === 'AbortError' ? 'Toka API request timed out.' : 'Unable to reach Toka API.',
      data: {},
    });
  }
});

app.post('/api/alipay/user-info', validateBaseRequest, async (req, res) => {
  if (!validateAccessToken(req.body)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'accessToken is required.',
      data: {},
    });
  }

  const authCodes = Array.isArray(req.body.authCodes) ? req.body.authCodes.slice(0, 5) : [];

  if (authCodes.length === 0) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'authCodes must be a non-empty array.',
      data: {},
    });
  }

  try {
    const result = await request('/v1/user/info', {
      body: { authCodes },
      accessToken: req.body.accessToken,
    });
    return forwardResult(res, result);
  } catch (error) {
    return res.status(502).json({
      success: false,
      statusCode: 502,
      message: error.name === 'AbortError' ? 'Toka API request timed out.' : 'Unable to reach Toka API.',
      data: {},
    });
  }
});

app.post('/api/alipay/payment/create', validateBaseRequest, async (req, res) => {
  if (!validateAccessToken(req.body)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'accessToken is required.',
      data: {},
    });
  }

  if (!req.body.userId || !req.body.orderTitle || !validatePaymentAmount(req.body.orderAmount)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'userId, orderTitle and orderAmount are required.',
      data: {},
    });
  }

  try {
    const result = await request('/v1/payment/create', {
      body: {
        userId: req.body.userId,
        orderTitle: req.body.orderTitle,
        orderAmount: req.body.orderAmount,
      },
      accessToken: req.body.accessToken,
      merchantCode: req.body.merchantCode,
    });
    return forwardResult(res, result);
  } catch (error) {
    return res.status(502).json({
      success: false,
      statusCode: 502,
      message: error.name === 'AbortError' ? 'Toka API request timed out.' : 'Unable to reach Toka API.',
      data: {},
    });
  }
});

app.post('/api/alipay/payment/inquiry', validateBaseRequest, async (req, res) => {
  if (!validateAccessToken(req.body)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'accessToken is required.',
      data: {},
    });
  }

  if (!req.body.paymentId) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'paymentId is required.',
      data: {},
    });
  }

  try {
    const result = await request('/v1/payment/inquiry', {
      body: { paymentId: req.body.paymentId },
      accessToken: req.body.accessToken,
    });
    return forwardResult(res, result);
  } catch (error) {
    return res.status(502).json({
      success: false,
      statusCode: 502,
      message: error.name === 'AbortError' ? 'Toka API request timed out.' : 'Unable to reach Toka API.',
      data: {},
    });
  }
});

app.post('/api/alipay/payment/close', validateBaseRequest, async (req, res) => {
  if (!validateAccessToken(req.body)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'accessToken is required.',
      data: {},
    });
  }

  if (!req.body.paymentId) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'paymentId is required.',
      data: {},
    });
  }

  try {
    const result = await request('/v1/payment/close', {
      body: { paymentId: req.body.paymentId },
      accessToken: req.body.accessToken,
    });
    return forwardResult(res, result);
  } catch (error) {
    return res.status(502).json({
      success: false,
      statusCode: 502,
      message: error.name === 'AbortError' ? 'Toka API request timed out.' : 'Unable to reach Toka API.',
      data: {},
    });
  }
});

app.post('/api/alipay/payment/refund', validateBaseRequest, async (req, res) => {
  if (!validateAccessToken(req.body)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'accessToken is required.',
      data: {},
    });
  }

  if (!req.body.userId || !req.body.paymentId || !validatePaymentAmount(req.body.refundAmount)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'userId, paymentId and refundAmount are required.',
      data: {},
    });
  }

  try {
    const result = await request('/v1/payment/refund', {
      body: {
        userId: req.body.userId,
        paymentId: req.body.paymentId,
        refundAmount: req.body.refundAmount,
      },
      accessToken: req.body.accessToken,
      merchantCode: req.body.merchantCode,
    });
    return forwardResult(res, result);
  } catch (error) {
    return res.status(502).json({
      success: false,
      statusCode: 502,
      message: error.name === 'AbortError' ? 'Toka API request timed out.' : 'Unable to reach Toka API.',
      data: {},
    });
  }
});

app.post('/api/alipay/payment/inquiry-refund', validateBaseRequest, async (req, res) => {
  if (!validateAccessToken(req.body)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'accessToken is required.',
      data: {},
    });
  }

  if (!req.body.refundId) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'refundId is required.',
      data: {},
    });
  }

  try {
    const result = await request('/v1/payment/inquiry-refund', {
      body: { refundId: req.body.refundId },
      accessToken: req.body.accessToken,
    });
    return forwardResult(res, result);
  } catch (error) {
    return res.status(502).json({
      success: false,
      statusCode: 502,
      message: error.name === 'AbortError' ? 'Toka API request timed out.' : 'Unable to reach Toka API.',
      data: {},
    });
  }
});

app.use(express.static(frontendBuildPath));

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: 'Route not found.',
      data: {},
    });
  }

  if (req.method === 'GET') {
    if (!fs.existsSync(frontendIndexPath)) {
      return res.status(500).send('Frontend build not found. Run the build step before starting the server.');
    }

    return res.sendFile(frontendIndexPath);
  }

  return res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found.',
    data: {},
  });
});

app.listen(port, () => {
  const config = getConfig();
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Proxying Toka requests to ${config.baseUrl}`);
});