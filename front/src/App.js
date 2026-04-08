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

const SESSION_KEY = 'toka-ripple-session';

const DAILY_CHALLENGES = [
  {
    id: 'ch-1',
    title: 'Carrera Relampago',
    description: 'Completa 3 interacciones para sumar puntos y mantener la racha.',
    reward: '+120 puntos',
  },
  {
    id: 'ch-2',
    title: 'Trivia Express',
    description: 'Responde una mini trivia para desbloquear recompensas del dia.',
    reward: '+1 ticket',
  },
  {
    id: 'ch-3',
    title: 'Reto Social',
    description: 'Comparte o reacciona a una actividad para impulsar tu perfil.',
    reward: '+80 puntos',
  },
];

const COMMUNITY_ITEMS = [
  {
    id: 'post-1',
    author: 'Toka Arcade',
    title: 'Top reto del dia',
    body: 'Hoy desbloqueamos una cadena de retos cortos para mantener la racha activa.',
  },
  {
    id: 'post-2',
    author: 'Wallet Crew',
    title: 'Monetiza sin friccion',
    body: 'Los pagos se crean desde backend y el cliente solo abre la experiencia final.',
  },
  {
    id: 'post-3',
    author: 'Community',
    title: 'Comparte y compite',
    body: 'Cada accion suma puntos que luego pueden usarse para recompensas o contenido.',
  },
];

const authTypes = Object.keys(alipayAuthScopes);

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function extractAuthCode(result) {
  return result?.authCode || result?.authcode || result?.result?.authCode || result?.result?.authcode || '';
}

function App() {
  const [backendConfig, setBackendConfig] = useState(null);
  const [activeView, setActiveView] = useState('challenge');
  const [modalOpen, setModalOpen] = useState(true);
  const [loadingAction, setLoadingAction] = useState('');
  const [message, setMessage] = useState({
    title: 'Base lista',
    detail: 'La aplicacion ya tiene auth, usuario, pago y reembolso conectados al backend.',
  });
  const [activityLog, setActivityLog] = useState([]);
  const [authType, setAuthType] = useState('DigitalIdentity');
  const [authCode, setAuthCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [userId, setUserId] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [userScopes, setUserScopes] = useState({
    DigitalIdentity: true,
    ContactInformation: true,
    AddressInformation: true,
    PersonalInformation: true,
    KYCStatus: true,
  });
  const [paymentForm, setPaymentForm] = useState({
    merchantCode: '',
    orderTitle: 'Entrada Toka Ripple',
    orderAmount: '500',
    currency: 'MXN',
    paymentId: '',
    refundId: '',
  });
  const [walletState, setWalletState] = useState({
    points: 0,
    streak: 1,
    completedChallengeIds: [],
    selectedChallengeId: DAILY_CHALLENGES[0].id,
    challengeAccepted: false,
  });

  const selectedScopes = useMemo(
    () =>
      authTypes
        .filter((type) => userScopes[type])
        .flatMap((type) => alipayAuthScopes[type]),
    [userScopes]
  );

  useEffect(() => {
    const savedSession = safeParse(window.localStorage.getItem(SESSION_KEY), null);
    if (savedSession) {
      setAccessToken(savedSession.accessToken || '');
      setUserId(savedSession.userId || '');
      setAuthCode(savedSession.authCode || '');
      setUserInfo(savedSession.userInfo || null);
      setPaymentForm((current) => ({ ...current, ...savedSession.paymentForm }));
      setWalletState((current) => ({ ...current, ...savedSession.walletState }));
    }

    getBackendConfig()
      .then((config) => setBackendConfig(config.data))
      .catch(() => {
        setMessage({
          title: 'Backend no disponible',
          detail: 'No se pudo cargar la configuracion del backend.',
        });
      });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        accessToken,
        userId,
        authCode,
        userInfo,
        paymentForm,
        walletState,
      })
    );
  }, [accessToken, userId, authCode, userInfo, paymentForm, walletState]);

  function pushActivity(title, detail) {
    setActivityLog((current) => [{ id: `${Date.now()}-${current.length}`, title, detail }, ...current].slice(0, 6));
    setMessage({ title, detail: typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2) });
  }

  async function handleRequestAuthCode() {
    setLoadingAction('auth-code');
    try {
      const result = await requestAuthCode(authType);
      const code = extractAuthCode(result);
      setAuthCode(code);
      pushActivity('Auth code obtenido', code ? `Se obtuvo un codigo para ${authType}.` : 'El bridge respondio sin codigo visible.');
    } catch (error) {
      pushActivity(
        'Auth code fallido',
        isAlipayWebView()
          ? 'El puente Alipay respondio con error.'
          : 'Abre esta URL dentro de Alipay para poder solicitar auth codes.'
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
      pushActivity('Sesion iniciada', 'JWT y userId obtenidos desde el backend.');
      setActiveView('wallet');
    } catch (error) {
      pushActivity('Autenticacion fallida', error?.payload?.message || error.message || 'No se pudo autenticar.');
    } finally {
      setLoadingAction('');
    }
  }

  async function handleLoadUserInfo() {
    setLoadingAction('user-info');
    try {
      const result = await getUserInfo(accessToken, selectedScopes);
      setUserInfo(result?.data || result);
      pushActivity('Perfil cargado', 'La informacion combinada del usuario quedo lista.');
    } catch (error) {
      pushActivity('Perfil fallido', error?.payload?.message || error.message || 'No se pudo cargar el perfil.');
    } finally {
      setLoadingAction('');
    }
  }

  function handleChallengeChange() {
    const currentIndex = DAILY_CHALLENGES.findIndex((item) => item.id === walletState.selectedChallengeId);
    const nextChallenge = DAILY_CHALLENGES[(currentIndex + 1) % DAILY_CHALLENGES.length];
    setWalletState((current) => ({
      ...current,
      selectedChallengeId: nextChallenge.id,
      challengeAccepted: false,
    }));
    pushActivity('Reto cambiado', `Nuevo reto activo: ${nextChallenge.title}.`);
  }

  function handleChallengeAccept() {
    const selectedChallenge = DAILY_CHALLENGES.find((item) => item.id === walletState.selectedChallengeId);
    if (!accessToken) {
      pushActivity('Reto bloqueado', 'Primero autentica al usuario con un auth code.');
      return;
    }

    if (walletState.completedChallengeIds.includes(selectedChallenge.id)) {
      pushActivity('Reto ya completado', `El reto ${selectedChallenge.title} ya habia sido contabilizado.`);
      return;
    }

    setWalletState((current) => ({
      ...current,
      challengeAccepted: true,
      completedChallengeIds: [...current.completedChallengeIds, selectedChallenge.id],
      points: current.points + 120,
      streak: current.streak + 1,
    }));
    pushActivity('Reto aceptado', `Se activo ${selectedChallenge.title} y se sumaron puntos de progreso.`);
  }

  async function handleCreatePayment() {
    setLoadingAction('create-payment');
    try {
      const result = await createPayment({
        accessToken,
        userId,
        merchantCode: paymentForm.merchantCode,
        orderTitle: paymentForm.orderTitle,
        orderAmount: {
          value: paymentForm.orderAmount,
          currency: paymentForm.currency,
        },
      });
      const createdPaymentId = result?.data?.paymentId || '';
      const paymentUrl = result?.data?.paymentUrl || '';
      setPaymentForm((current) => ({ ...current, paymentId: createdPaymentId }));
      pushActivity('Pago creado', 'La orden se creo correctamente desde el backend.');

      if (paymentUrl && isAlipayWebView()) {
        await openPayment(paymentUrl);
      }
    } catch (error) {
      pushActivity('Pago fallido', error?.payload?.message || error.message || 'No se pudo crear el pago.');
    } finally {
      setLoadingAction('');
    }
  }

  async function handleInquiryPayment() {
    setLoadingAction('inquiry-payment');
    try {
      const result = await inquiryPayment(accessToken, paymentForm.paymentId);
      pushActivity('Pago consultado', result?.message || 'Consulta completada.');
    } catch (error) {
      pushActivity('Consulta fallida', error?.payload?.message || error.message || 'No se pudo consultar el pago.');
    } finally {
      setLoadingAction('');
    }
  }

  async function handleClosePayment() {
    setLoadingAction('close-payment');
    try {
      const result = await closePayment(accessToken, paymentForm.paymentId);
      pushActivity('Pago cerrado', result?.message || 'El pago se cerro correctamente.');
    } catch (error) {
      pushActivity('Cierre fallido', error?.payload?.message || error.message || 'No se pudo cerrar el pago.');
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
        paymentId: paymentForm.paymentId,
        merchantCode: paymentForm.merchantCode,
        refundAmount: {
          value: paymentForm.orderAmount,
          currency: paymentForm.currency,
        },
      });
      setPaymentForm((current) => ({ ...current, refundId: result?.data?.refundId || '' }));
      pushActivity('Reembolso solicitado', 'Se genero el reembolso de prueba.');
    } catch (error) {
      pushActivity('Reembolso fallido', error?.payload?.message || error.message || 'No se pudo solicitar el reembolso.');
    } finally {
      setLoadingAction('');
    }
  }

  async function handleInquiryRefund() {
    setLoadingAction('inquiry-refund');
    try {
      const result = await inquiryRefund(accessToken, paymentForm.refundId);
      pushActivity('Reembolso consultado', result?.message || 'Consulta completada.');
    } catch (error) {
      pushActivity('Consulta de reembolso fallida', error?.payload?.message || error.message || 'No se pudo consultar el reembolso.');
    } finally {
      setLoadingAction('');
    }
  }

  const selectedChallenge = DAILY_CHALLENGES.find((item) => item.id === walletState.selectedChallengeId) || DAILY_CHALLENGES[0];

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Toka Ripple</p>
          <h1>Mini App web funcional para entretenimiento y wallet</h1>
        </div>
        <div className="status-strip">
          <span>{backendConfig ? `App ID ${backendConfig.appId}` : 'Cargando backend'}</span>
          <span>{backendConfig?.hasMerchantCode ? 'Merchant listo' : 'Merchant pendiente'}</span>
          <span>{isAlipayWebView() ? 'Dentro de Alipay' : 'Modo navegador'}</span>
        </div>
      </header>

      <nav className="view-tabs" aria-label="Navegacion principal">
        <button type="button" className={activeView === 'challenge' ? 'active' : ''} onClick={() => setActiveView('challenge')}>
          Inicio
        </button>
        <button type="button" className={activeView === 'wallet' ? 'active' : ''} onClick={() => setActiveView('wallet')}>
          Wallet
        </button>
      </nav>

      {activeView === 'challenge' ? (
        <section className="two-column-layout">
          <article className="panel">
            <p className="panel-tag">Reto diario</p>
            <h2>{selectedChallenge.title}</h2>
            <p>{selectedChallenge.description}</p>

            <div className="mini-metrics">
              <div>
                <strong>{walletState.points}</strong>
                <span>Puntos</span>
              </div>
              <div>
                <strong>{walletState.streak}</strong>
                <span>Racha</span>
              </div>
              <div>
                <strong>{walletState.completedChallengeIds.length}</strong>
                <span>Retos</span>
              </div>
            </div>

            <div className="action-row">
              <button type="button" className="secondary" onClick={() => setModalOpen(true)}>
                Ver reto
              </button>
              <button type="button" onClick={handleChallengeChange} disabled={loadingAction === 'challenge'}>
                Cambiar reto
              </button>
              <button type="button" className="secondary" onClick={handleChallengeAccept} disabled={loadingAction === 'challenge'}>
                Aceptar reto
              </button>
              <button type="button" className="secondary" onClick={() => setActiveView('wallet')}>
                Ir a wallet
              </button>
            </div>
          </article>

          <article className="panel">
            <p className="panel-tag">Integracion SSO</p>
            <h2>Autenticacion y perfil</h2>
            <p>
              La app puede pedir auth codes de Alipay, canjearlos por JWT y luego recuperar datos de usuario.
            </p>

            <div className="form-grid">
              <label>
                Tipo de auth
                <select value={authType} onChange={(event) => setAuthType(event.target.value)}>
                  {authTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Auth code
                <input value={authCode} onChange={(event) => setAuthCode(event.target.value)} placeholder="QZvGrF" />
              </label>
            </div>

            <div className="action-row">
              <button type="button" onClick={handleRequestAuthCode} disabled={loadingAction === 'auth-code'}>
                Pedir auth code
              </button>
              <button type="button" className="secondary" onClick={handleAuthenticate} disabled={loadingAction === 'authenticate'}>
                Canjear JWT
              </button>
              <button type="button" className="secondary" onClick={handleLoadUserInfo} disabled={loadingAction === 'user-info'}>
                Cargar perfil
              </button>
            </div>
          </article>

          <article className="panel full-span">
            <p className="panel-tag">Contenido social</p>
            <div className="feed-list">
              {COMMUNITY_ITEMS.map((item) => (
                <div key={item.id} className="feed-item">
                  <strong>{item.title}</strong>
                  <span>{item.author}</span>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : (
        <section className="two-column-layout">
          <article className="panel">
            <p className="panel-tag">Wallet Toka</p>
            <h2>Estado y transacciones</h2>
            <p>
              Crea pagos, consulta el estado, cierra intentos y solicita reembolsos usando el backend proxy.
            </p>

            <div className="mini-metrics">
              <div>
                <strong>{userId ? 'SSO' : '--'}</strong>
                <span>Sesion</span>
              </div>
              <div>
                <strong>{paymentForm.paymentId ? '1' : '0'}</strong>
                <span>Pagos</span>
              </div>
              <div>
                <strong>{paymentForm.refundId ? '1' : '0'}</strong>
                <span>Reembolsos</span>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Access token
                <textarea value={accessToken} onChange={(event) => setAccessToken(event.target.value)} rows={4} placeholder="JWT" />
              </label>

              <label>
                User ID
                <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="0000000000000000" />
              </label>

              <label>
                Merchant code
                <input value={paymentForm.merchantCode} onChange={(event) => setPaymentForm((current) => ({ ...current, merchantCode: event.target.value }))} placeholder="ABCDE" maxLength={5} />
              </label>

              <label>
                Titulo de orden
                <input value={paymentForm.orderTitle} onChange={(event) => setPaymentForm((current) => ({ ...current, orderTitle: event.target.value }))} />
              </label>

              <label>
                Monto
                <input value={paymentForm.orderAmount} onChange={(event) => setPaymentForm((current) => ({ ...current, orderAmount: event.target.value }))} />
              </label>

              <label>
                Moneda
                <input value={paymentForm.currency} onChange={(event) => setPaymentForm((current) => ({ ...current, currency: event.target.value }))} />
              </label>

              <label>
                Payment ID
                <input value={paymentForm.paymentId} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentId: event.target.value }))} placeholder="202604011001100100011171003629010" />
              </label>

              <label>
                Refund ID
                <input value={paymentForm.refundId} onChange={(event) => setPaymentForm((current) => ({ ...current, refundId: event.target.value }))} placeholder="202604011001130100011171000213601" />
              </label>
            </div>

            <div className="action-row wrap">
              <button type="button" onClick={handleCreatePayment} disabled={loadingAction === 'create-payment'}>
                Crear pago
              </button>
              <button type="button" className="secondary" onClick={handleInquiryPayment} disabled={loadingAction === 'inquiry-payment'}>
                Consultar pago
              </button>
              <button type="button" className="secondary" onClick={handleClosePayment} disabled={loadingAction === 'close-payment'}>
                Cerrar pago
              </button>
              <button type="button" className="secondary" onClick={handleRefund} disabled={loadingAction === 'refund'}>
                Reembolsar
              </button>
              <button type="button" className="secondary" onClick={handleInquiryRefund} disabled={loadingAction === 'inquiry-refund'}>
                Consultar reembolso
              </button>
            </div>
          </article>

          <article className="panel">
            <p className="panel-tag">Perfil</p>
            <h2>Datos de identidad</h2>
            <p>Los scopes se pueden activar o desactivar antes de consultar el perfil consolidado.</p>

            <div className="scope-list">
              {authTypes.map((type) => (
                <label key={type} className="scope-item">
                  <input
                    type="checkbox"
                    checked={Boolean(userScopes[type])}
                    onChange={(event) => setUserScopes((current) => ({ ...current, [type]: event.target.checked }))}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>

            <div className="identity-box">
              <strong>{userInfo?.fullName || 'Sin perfil cargado'}</strong>
              <span>{userInfo?.nickName || 'Usa el boton Cargar perfil'}</span>
              <pre>{JSON.stringify(userInfo || {}, null, 2)}</pre>
            </div>
          </article>
        </section>
      )}

      <section className="log-panel">
        <article className="panel">
          <p className="panel-tag">Resumen tecnico</p>
          <h2>{message.title}</h2>
          <pre>{message.detail}</pre>
        </article>

        <article className="panel">
          <p className="panel-tag">Actividad reciente</p>
          <div className="log-list">
            {activityLog.length === 0 ? (
              <p>Aqui apareceran los eventos de autenticacion, retos y pagos.</p>
            ) : (
              activityLog.map((entry) => (
                <div key={entry.id} className="log-item">
                  <strong>{entry.title}</strong>
                  <span>{entry.detail}</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-label="Reto diario">
            <p className="panel-tag">Reto diario</p>
            <h2>{selectedChallenge.title}</h2>
            <p>{selectedChallenge.description}</p>
            <p className="reward-line">Recompensa: {selectedChallenge.reward}</p>

            <div className="action-row wrap">
              <button type="button" className="secondary" onClick={() => setModalOpen(false)}>
                Cambiar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleChallengeAccept();
                  setModalOpen(false);
                }}
              >
                Aceptar
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;