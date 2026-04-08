import { useEffect, useState } from 'react';
import './App.css';
import {
  authenticate,
  closePayment,
  createPayment,
  getBackendConfig,
  inquiryPayment,
  inquiryRefund,
  refundPayment,
} from './services/tokaApi';
import { isAlipayWebView, openPayment, requestAuthCode } from './lib/alipayBridge';

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

function formatErrorDetail(error, fallbackText) {
  if (!error) {
    return fallbackText;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallbackText;
  }
}

function App() {
  const [backendConfig, setBackendConfig] = useState(null);
  const [activeView, setActiveView] = useState('challenge');
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [message, setMessage] = useState({
    title: 'Base lista',
    detail: 'La aplicacion ya tiene auth, usuario, pago y reembolso conectados al backend.',
  });
  const [activityLog, setActivityLog] = useState([]);
  const [authCode, setAuthCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [userId, setUserId] = useState('');
  const [userInfo, setUserInfo] = useState(null);
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
  const [digitalIdentityAuthorized, setDigitalIdentityAuthorized] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [permissionsGatePassed, setPermissionsGatePassed] = useState(false);
  const [permissionsError, setPermissionsError] = useState('');

  useEffect(() => {
    const savedSession = safeParse(window.localStorage.getItem(SESSION_KEY), null);
    if (savedSession) {
      setAccessToken(savedSession.accessToken || '');
      setUserId(savedSession.userId || '');
      setAuthCode(savedSession.authCode || '');
      setUserInfo(savedSession.userInfo || null);
      setPaymentForm((current) => ({ ...current, ...savedSession.paymentForm }));
      setWalletState((current) => ({ ...current, ...savedSession.walletState }));

      if (savedSession.accessToken && savedSession.userId) {
        setDigitalIdentityAuthorized(true);
        setPermissionsGatePassed(true);
      }
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

  async function handleAuthorizeAccess() {
    setLoadingAction('authorize');
    setPermissionsError('');
    try {
      if (!isAlipayWebView()) {
        throw new Error('Esta función solo está disponible dentro de la SuperApp de Toka/Alipay.');
      }

      const authorizationMsg = 
        'Toka Ripple needs your authorization to access your Digital Identity (user ID, avatar y nickname) para iniciar sesión y sincronizar tu perfil.';

      pushActivity(
        'Solicitando autorización',
        'Se abrirá el popup de Data Usage Authorization para DigitalIdentity.'
      );
      
      let result;

      try {
        result = await requestAuthCode('DigitalIdentity', authorizationMsg, true);
      } catch (strictError) {
        const strictDetail = formatErrorDetail(strictError, 'DigitalIdentity authorization failed.');

        if (/denied|no permission|jsapi call denied/i.test(strictDetail)) {
          pushActivity(
            'DigitalIdentity denegado',
            'Reintentando con método alterno de auth para obtener JWT.'
          );
          result = await requestAuthCode('DigitalIdentity', authorizationMsg, false);
        } else {
          throw strictError;
        }
      }

      const code = extractAuthCode(result);
      
      if (!code) {
        throw new Error('No se recibió un código de autorización del puente Alipay.');
      }

      const authResult = await authenticate(code);
      const token = authResult?.data?.accessToken || '';
      const nextUserId = authResult?.data?.userId || '';

      if (!token || !nextUserId) {
        throw new Error('La autenticación devolvió un token o userId vacío.');
      }

      setAuthCode(code);
      setAccessToken(token);
      setUserId(nextUserId);
      setDigitalIdentityAuthorized(true);
      setModalOpen(false);
      pushActivity('Sesión iniciada', 'Te has autenticado correctamente con tu cuenta Alipay.');
    } catch (error) {
      const detail = formatErrorDetail(error, 'No se pudo obtener el código de autorización del puente Alipay.');
      const enrichedDetail = /denied|no permission|jsapi call denied/i.test(detail)
        ? `${detail} Verifica en Alipay/Toka: app release en ambiente Test, feature User_Digital_Identity_Information activo para tu appId y apertura dentro de la SuperApp.`
        : detail;
      setPermissionsError(enrichedDetail);
      pushActivity(
        'Error al autorizar',
        enrichedDetail
      );
    } finally {
      setLoadingAction('');
    }
  }

  function handleContinueFromPermissions() {
    const missing = [];

    if (!digitalIdentityAuthorized) {
      missing.push('Debes autorizar DigitalIdentity.');
    }

    if (!termsAccepted) {
      missing.push('Debes aceptar términos y condiciones.');
    }

    if (missing.length > 0) {
      const detail = missing.join(' ');
      setPermissionsError(detail);
      pushActivity('Permisos incompletos', detail);
      return;
    }

    setPermissionsError('');
    setPermissionsGatePassed(true);
    pushActivity('Permisos verificados', 'Ya puedes continuar al contenido principal.');
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
      pushActivity('Reto bloqueado', 'Primero autoriza DigitalIdentity para obtener auth code y token.');
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

  if (!permissionsGatePassed) {
    return (
      <main className="app-shell">
        <section className="permissions-layout">
          <article className="panel">
            <p className="panel-tag">Sección de permisos</p>
            <h1>Autoriza tu acceso antes de continuar</h1>
            <p>
              Para iniciar sesión necesitamos tu autorización de DigitalIdentity dentro de la SuperApp.
            </p>

            <div className="permission-item">
              <div>
                <strong>DigitalIdentity</strong>
                <p className="permission-help">
                  Data usage authorization: USER_ID, USER_AVATAR y USER_NICKNAME.
                </p>
              </div>
              <div className="permission-actions">
                <span className={digitalIdentityAuthorized ? 'permission-ok' : 'permission-pending'}>
                  {digitalIdentityAuthorized ? 'Verificado' : 'Pendiente'}
                </span>
                <button type="button" onClick={handleAuthorizeAccess} disabled={loadingAction === 'authorize'}>
                  {loadingAction === 'authorize' ? 'Autorizando...' : 'Autorizar DigitalIdentity'}
                </button>
              </div>
            </div>

            <div className="terms-box">
              <p className="terms-legend">Leyenda</p>
              <p>
                Al continuar aceptas el uso de datos autorizados para autenticación, sesión y funcionamiento de la mini app.
              </p>
              <label className="terms-check">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                />
                Acepto términos y condiciones
              </label>
            </div>

            {permissionsError ? <p className="error-banner">{permissionsError}</p> : null}

            <div className="action-row wrap">
              <button type="button" onClick={handleContinueFromPermissions}>
                {digitalIdentityAuthorized && termsAccepted ? 'Continuar' : 'Continuar (bloqueado)'}
              </button>
            </div>
          </article>

          <article className="panel">
            <p className="panel-tag">Estado actual</p>
            <div className="mini-metrics">
              <div>
                <strong>{isAlipayWebView() ? '✓' : '○'}</strong>
                <span>Dentro de SuperApp</span>
              </div>
              <div>
                <strong>{digitalIdentityAuthorized ? '✓' : '○'}</strong>
                <span>DigitalIdentity</span>
              </div>
              <div>
                <strong>{termsAccepted ? '✓' : '○'}</strong>
                <span>Términos</span>
              </div>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Toka Ripple</p>
          <h1>Mini App de entretenimiento y wallet</h1>
        </div>
        <div className="status-strip">
          <span>{userId ? `✓ Conectado` : '○ Conectando...'}</span>
          <span>{backendConfig ? `Backend OK` : 'Backend...'}</span>
          <span>{isAlipayWebView() ? 'Dentro de Toka' : 'H5'}</span>
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
              <button type="button" onClick={handleAuthorizeAccess} disabled={loadingAction === 'authorize'}>
                Autorizar acceso
              </button>
              <button type="button" className="secondary" onClick={() => setActiveView('wallet')}>
                Ir a wallet
              </button>
            </div>
          </article>

          <article className="panel">
            <p className="panel-tag">Estado de sesion</p>
            <h2>Conectado a Toka</h2>
            <p>
              La sesión requiere tu autorización explícita dentro de la SuperApp para obtener authCode y JWT.
            </p>

            <div className="mini-metrics">
              <div>
                <strong>{userId ? '✓' : '○'}</strong>
                <span>Usuario</span>
              </div>
              <div>
                <strong>{accessToken ? '✓' : '○'}</strong>
                <span>Token</span>
              </div>
              <div>
                <strong>{userInfo?.nickName ? '✓' : '○'}</strong>
                <span>Perfil</span>
              </div>
            </div>

            <div className="identity-box">
              <strong>{userInfo?.nickName || userInfo?.fullName || 'Cargando...'}</strong>
              <span>{userInfo?.email || userInfo?.mobilePhone || 'Sincronizando datos'}</span>
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
            <h2>Tu cartera y transacciones</h2>
            <p>
              Gestiona tus pagos y reembolsos con cero fricción directamente desde Toka.
            </p>

            <div className="mini-metrics">
              <div>
                <strong>{userId ? 'Activo' : 'Inactivo'}</strong>
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
                Merchant Code
                <input 
                  value={paymentForm.merchantCode} 
                  onChange={(event) => setPaymentForm((current) => ({ ...current, merchantCode: event.target.value }))} 
                  placeholder="ABCDE" 
                  maxLength={5} 
                />
              </label>

              <label>
                Titulo de orden
                <input 
                  value={paymentForm.orderTitle} 
                  onChange={(event) => setPaymentForm((current) => ({ ...current, orderTitle: event.target.value }))} 
                />
              </label>

              <label>
                Monto
                <input 
                  value={paymentForm.orderAmount} 
                  onChange={(event) => setPaymentForm((current) => ({ ...current, orderAmount: event.target.value }))} 
                />
              </label>

              <label>
                Moneda
                <input 
                  value={paymentForm.currency} 
                  onChange={(event) => setPaymentForm((current) => ({ ...current, currency: event.target.value }))} 
                />
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
            <p className="panel-tag">Tu Identidad</p>
            <h2>Datos de perfil sincronizados</h2>
            <p>Información verificada y segura desde Toka.</p>

            <div className="identity-box">
              <strong>{userInfo?.fullName || userInfo?.nickName || 'Nombre de usuario'}</strong>
              <span>{userInfo?.email || userInfo?.mobilePhone || 'email@example.com'}</span>
              <pre style={{marginTop: '1rem', fontSize: '0.85rem', maxHeight: '200px', overflow: 'auto'}}>
                {JSON.stringify(userInfo || {}, null, 2)}
              </pre>
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
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAuthorizeAccess();
                }}
                disabled={loadingAction === 'authorize'}
              >
                {loadingAction === 'authorize' ? 'Autorizando...' : 'Autorizar DigitalIdentity'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;