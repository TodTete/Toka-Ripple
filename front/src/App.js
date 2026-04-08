import { useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  authenticate,
  closePayment,
  createPayment,
  getBackendConfig,
  getUserInfo,
  inquiryPayment,
  inquiryRefund,
  refundPayment,
} from './services/tokaApi';
import { alipayAuthScopes, isAlipayWebView, openPayment, requestAuthCode } from './lib/alipayBridge';

const defaultResponse = {
  label: 'Esperando acción',
  title: 'La aplicación ya está conectada a la base técnica.',
  message:
    'Aquí se irán montando las vistas que me compartas. La capa de autenticación, pagos y consultas ya queda lista desde esta primera versión.',
};

const authOptions = Object.keys(alipayAuthScopes).map((key) => ({
  key,
  label: key,
  scopes: alipayAuthScopes[key],
}));

function App() {
  const [backendConfig, setBackendConfig] = useState(null);
  const [response, setResponse] = useState(defaultResponse);
  const [loadingAction, setLoadingAction] = useState('');
  const [authType, setAuthType] = useState('DigitalIdentity');
  const [authCode, setAuthCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [userId, setUserId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [refundId, setRefundId] = useState('');
  const [orderTitle, setOrderTitle] = useState('Entrada Toka Ripple');
  const [orderAmount, setOrderAmount] = useState('500');
  const [currency, setCurrency] = useState('MXN');
  const [merchantCode, setMerchantCode] = useState('');
  const [selectedAuthCodes, setSelectedAuthCodes] = useState({
    DigitalIdentity: true,
    ContactInformation: true,
    AddressInformation: true,
    PersonalInformation: true,
    KYCStatus: true,
  });

  const selectedScopes = useMemo(
    () =>
      authOptions
        .filter((option) => selectedAuthCodes[option.key])
        .flatMap((option) => option.scopes),
    [selectedAuthCodes]
  );

  useEffect(() => {
    getBackendConfig()
      .then((config) => setBackendConfig(config.data))
      .catch((error) => {
        setResponse({
          label: 'Backend no disponible',
          title: 'No se pudo cargar la configuración.',
          message: error.message,
        });
      });
  }, []);

  function showResult(label, title, value) {
    setResponse({
      label,
      title,
      message: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    });
  }

  async function handleRequestAuthCode() {
    setLoadingAction('authCode');
    try {
      const result = await requestAuthCode(authType);
      const code = result?.authCode || result?.authcode || result?.result?.authCode || '';
      setAuthCode(code);
      showResult('Auth Code', `Código obtenido para ${authType}.`, result);
    } catch (error) {
      showResult(
        'Auth Code',
        'No se pudo abrir el flujo de autorización.',
        isAlipayWebView()
          ? error?.message || 'El puente Alipay respondió con error.'
          : 'Abre esta aplicación dentro de Alipay H5 para solicitar auth codes.'
      );
    } finally {
      setLoadingAction('');
    }
  }

  async function handleAuthenticate() {
    setLoadingAction('authenticate');
    try {
      const result = await authenticate(authCode);
      const token = result?.data?.accessToken || '';
      const nextUserId = result?.data?.userId || '';
      setAccessToken(token);
      setUserId(nextUserId);
      showResult('Autenticación', 'JWT y userId obtenidos correctamente.', result);
    } catch (error) {
      showResult('Autenticación', 'La autenticación falló.', error?.payload || error.message);
    } finally {
      setLoadingAction('');
    }
  }

  async function handleLoadUserInfo() {
    setLoadingAction('userInfo');
    try {
      const result = await getUserInfo(accessToken, selectedScopes);
      showResult('Usuario', 'Información de usuario combinada correctamente.', result);
    } catch (error) {
      showResult('Usuario', 'No se pudo recuperar la información del usuario.', error?.payload || error.message);
    } finally {
      setLoadingAction('');
    }
  }

  async function handleCreatePayment() {
    setLoadingAction('createPayment');
    try {
      const result = await createPayment({
        accessToken,
        userId,
        orderTitle,
        orderAmount: {
          value: orderAmount,
          currency,
        },
        merchantCode,
      });
      const createdPaymentId = result?.data?.paymentId || '';
      const paymentUrl = result?.data?.paymentUrl || '';
      setPaymentId(createdPaymentId);
      showResult('Pago', 'Orden creada correctamente.', result);

      if (paymentUrl && isAlipayWebView()) {
        await openPayment(paymentUrl);
      }
    } catch (error) {
      showResult('Pago', 'No se pudo crear el pago.', error?.payload || error.message);
    } finally {
      setLoadingAction('');
    }
  }

  async function handleInquiryPayment() {
    setLoadingAction('inquiryPayment');
    try {
      const result = await inquiryPayment(accessToken, paymentId);
      showResult('Consulta de pago', 'Pago consultado correctamente.', result);
    } catch (error) {
      showResult('Consulta de pago', 'No se pudo consultar el pago.', error?.payload || error.message);
    } finally {
      setLoadingAction('');
    }
  }

  async function handleClosePayment() {
    setLoadingAction('closePayment');
    try {
      const result = await closePayment(accessToken, paymentId);
      showResult('Cierre', 'Pago cerrado correctamente.', result);
    } catch (error) {
      showResult('Cierre', 'No se pudo cerrar el pago.', error?.payload || error.message);
    } finally {
      setLoadingAction('');
    }
  }

  async function handleRefund() {
    setLoadingAction('refund');
    try {
      const result = await refundPayment({
        accessToken,
        userId,
        paymentId,
        refundAmount: {
          value: orderAmount,
          currency,
        },
        merchantCode,
      });
      const createdRefundId = result?.data?.refundId || '';
      setRefundId(createdRefundId);
      showResult('Reembolso', 'Reembolso solicitado correctamente.', result);
    } catch (error) {
      showResult('Reembolso', 'No se pudo solicitar el reembolso.', error?.payload || error.message);
    } finally {
      setLoadingAction('');
    }
  }

  async function handleInquiryRefund() {
    setLoadingAction('inquiryRefund');
    try {
      const result = await inquiryRefund(accessToken, refundId);
      showResult('Consulta de reembolso', 'Reembolso consultado correctamente.', result);
    } catch (error) {
      showResult('Consulta de reembolso', 'No se pudo consultar el reembolso.', error?.payload || error.message);
    } finally {
      setLoadingAction('');
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Toka Ripple · Base técnica</p>
          <h1>Web app lista para Alipay H5, auth codes y pagos.</h1>
          <p className="hero-text">
            Esta primera versión deja listo el esqueleto funcional para autenticar usuarios, pedir
            información, crear pagos, consultar estados y preparar reembolsos. Las pantallas finales
            las iremos montando sobre esta base.
          </p>

          <div className="hero-badges">
            <span>{backendConfig ? `App ID ${backendConfig.appId}` : 'Cargando App ID'}</span>
            <span>{backendConfig?.hasMerchantCode ? 'Merchant configurado' : 'Merchant pendiente'}</span>
            <span>{isAlipayWebView() ? 'Ejecutándose en Alipay' : 'Ejecutándose en navegador'}</span>
          </div>
        </div>

        <aside className="hero-card">
          <div>
            <p className="card-label">Respuesta actual</p>
            <h2>{response.title}</h2>
            <p>{response.message}</p>
          </div>
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </aside>
      </section>

      <section className="controls-grid">
        <article className="control-card">
          <div className="card-heading">
            <p className="card-label">Paso 1</p>
            <h3>Autorización</h3>
          </div>

          <div className="field-grid">
            <label>
              Tipo de auth
              <select value={authType} onChange={(event) => setAuthType(event.target.value)}>
                {authOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Auth code
              <input value={authCode} onChange={(event) => setAuthCode(event.target.value)} placeholder="QZvGrF" />
            </label>
          </div>

          <div className="button-row">
            <button type="button" onClick={handleRequestAuthCode} disabled={loadingAction === 'authCode'}>
              {loadingAction === 'authCode' ? 'Solicitando...' : 'Pedir auth code'}
            </button>
            <button type="button" className="secondary" onClick={handleAuthenticate} disabled={loadingAction === 'authenticate'}>
              {loadingAction === 'authenticate' ? 'Autenticando...' : 'Canjear JWT'}
            </button>
          </div>
        </article>

        <article className="control-card">
          <div className="card-heading">
            <p className="card-label">Paso 2</p>
            <h3>Información de usuario</h3>
          </div>

          <div className="field-grid">
            <label>
              Access token
              <textarea value={accessToken} onChange={(event) => setAccessToken(event.target.value)} rows={4} placeholder="Bearer token del backend" />
            </label>
          </div>

          <div className="scope-list">
            {authOptions.map((option) => (
              <label key={option.key} className="scope-item">
                <input
                  type="checkbox"
                  checked={Boolean(selectedAuthCodes[option.key])}
                  onChange={(event) =>
                    setSelectedAuthCodes((current) => ({
                      ...current,
                      [option.key]: event.target.checked,
                    }))
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <div className="button-row">
            <button type="button" onClick={handleLoadUserInfo} disabled={loadingAction === 'userInfo'}>
              {loadingAction === 'userInfo' ? 'Consultando...' : 'Obtener info'}
            </button>
          </div>
        </article>

        <article className="control-card">
          <div className="card-heading">
            <p className="card-label">Paso 3</p>
            <h3>Pago y reembolso</h3>
          </div>

          <div className="field-grid">
            <label>
              User ID
              <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="0000000000000000" />
            </label>

            <label>
              Merchant code
              <input value={merchantCode} onChange={(event) => setMerchantCode(event.target.value)} placeholder="ABCDE" maxLength={5} />
            </label>

            <label>
              Título de orden
              <input value={orderTitle} onChange={(event) => setOrderTitle(event.target.value)} />
            </label>

            <label>
              Monto
              <input value={orderAmount} onChange={(event) => setOrderAmount(event.target.value)} />
            </label>

            <label>
              Moneda
              <input value={currency} onChange={(event) => setCurrency(event.target.value)} />
            </label>

            <label>
              Payment ID
              <input value={paymentId} onChange={(event) => setPaymentId(event.target.value)} placeholder="202604011001100100011171003629010" />
            </label>

            <label>
              Refund ID
              <input value={refundId} onChange={(event) => setRefundId(event.target.value)} placeholder="202604011001130100011171000213601" />
            </label>
          </div>

          <div className="button-row">
            <button type="button" onClick={handleCreatePayment} disabled={loadingAction === 'createPayment'}>
              {loadingAction === 'createPayment' ? 'Creando...' : 'Crear pago'}
            </button>
            <button type="button" className="secondary" onClick={handleInquiryPayment} disabled={loadingAction === 'inquiryPayment'}>
              {loadingAction === 'inquiryPayment' ? 'Consultando...' : 'Consultar pago'}
            </button>
            <button type="button" className="secondary" onClick={handleClosePayment} disabled={loadingAction === 'closePayment'}>
              {loadingAction === 'closePayment' ? 'Cerrando...' : 'Cerrar pago'}
            </button>
            <button type="button" className="secondary" onClick={handleRefund} disabled={loadingAction === 'refund'}>
              {loadingAction === 'refund' ? 'Reembolsando...' : 'Solicitar reembolso'}
            </button>
            <button type="button" className="secondary" onClick={handleInquiryRefund} disabled={loadingAction === 'inquiryRefund'}>
              {loadingAction === 'inquiryRefund' ? 'Consultando...' : 'Consultar reembolso'}
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}

export default App;