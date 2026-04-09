import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CircleUserRound,
  CreditCard,
  House,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  TerminalSquare,
  Trophy,
  Wallet,
} from 'lucide-react';
import './App.css';
import {
  authenticate,
  closePayment,
  createPayment,
  getBackendConfig,
  getUserInfo,
  inquiryPayment,
} from './services/tokaApi';
import {
  extractAuthCodeFromBridgeResponse,
  getBridgeRuntimeInfo,
  isAlipayWebView,
  openPayment,
  requestAuthCode,
} from './lib/alipayBridge';

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

const RANKING_SEED = [
  { id: 'rk-1', name: 'Ana Sofia', points: 5200, streak: 26 },
  { id: 'rk-2', name: 'Valentina', points: 4410, streak: 21 },
  { id: 'rk-3', name: 'Carlos M', points: 3980, streak: 18 },
  { id: 'rk-4', name: 'Lucia P', points: 3300, streak: 16 },
];

const NAV_ITEMS = [
  { id: 'home', label: 'Inicio', icon: House },
  { id: 'feed', label: 'Feed', icon: MessageSquareText },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'profile', label: 'Perfil', icon: CircleUserRound },
];

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function extractJsapiExchange(result) {
  return {
    authCode: extractAuthCodeFromBridgeResponse(result),
    resultCode:
      result?.resultCode ||
      result?.result?.resultCode ||
      result?.result_status ||
      result?.status ||
      '',
    resultMsg:
      result?.resultMsg ||
      result?.result?.resultMsg ||
      result?.errorMessage ||
      result?.errorMsg ||
      result?.message ||
      '',
    startTime:
      result?.startTime ||
      result?.result?.startTime ||
      result?.time ||
      null,
    rawResultShape: {
      topKeys: Object.keys(result || {}),
      hasResultAsString: typeof result?.result === 'string',
      hasDataAsString: typeof result?.data === 'string',
    },
    rawResponse: result,
  };
}

function isJsapiExchangeValid(exchange) {
  if (!exchange.authCode) {
    return false;
  }

  if (!exchange.resultCode) {
    return true;
  }

  const codeStr = String(exchange.resultCode).trim();
  return /success|ok|s|0|10000|20000000/i.test(codeStr);
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

async function collectProfileAuthCodes(primaryAuthCode) {
  const profileAuthCodes = [primaryAuthCode];
  const profileRequests = [
    {
      type: 'ContactInformation',
      message: 'Toka Ripple needs your authorization to access your contact information for profile sync.',
    },
    {
      type: 'AddressInformation',
      message: 'Toka Ripple needs your authorization to access your address information for profile sync.',
    },
    {
      type: 'PersonalInformation',
      message: 'Toka Ripple needs your authorization to access your personal information for profile sync.',
    },
    {
      type: 'KYCStatus',
      message: 'Toka Ripple needs your authorization to access your KYC status for profile sync.',
    },
  ];

  for (const requestItem of profileRequests) {
    try {
      const authResult = await requestAuthCode(requestItem.type, requestItem.message, true);
      const authCode = extractAuthCodeFromBridgeResponse(authResult);
      if (authCode) {
        profileAuthCodes.push(authCode);
      }
    } catch {
      // Optional feature grants may be missing; continue with the codes we already have.
    }
  }

  return profileAuthCodes;
}

function App() {
  const [backendConfig, setBackendConfig] = useState(null);
  const [activeView, setActiveView] = useState('home');
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [message, setMessage] = useState({
    title: 'Base lista',
    detail: 'La aplicacion ya tiene auth, usuario y pagos conectados al backend.',
  });
  const [activityLog, setActivityLog] = useState([]);
  const [authCode, setAuthCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [tokenType, setTokenType] = useState('Bearer');
  const [userId, setUserId] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [contactInfo, setContactInfo] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    merchantCode: '',
    orderTitle: 'Entrada Toka Ripple',
    orderAmount: '500',
    currency: 'USD',
    paymentId: '',
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
  const [bridgeDiagnostics, setBridgeDiagnostics] = useState('');

  useEffect(() => {
    const savedSession = safeParse(window.localStorage.getItem(SESSION_KEY), null);
    if (savedSession) {
      setAccessToken(savedSession.accessToken || '');
      setTokenType(savedSession.tokenType || 'Bearer');
      setUserId(savedSession.userId || '');
      setAuthCode(savedSession.authCode || '');
      setUserInfo(savedSession.userInfo || null);
      setContactInfo(savedSession.contactInfo || null);
      setPaymentForm((current) => ({
        ...current,
        ...savedSession.paymentForm,
        currency: 'USD',
      }));
      setWalletState((current) => ({ ...current, ...savedSession.walletState }));

      if (savedSession.accessToken && savedSession.userId) {
        setDigitalIdentityAuthorized(true);
        setPermissionsGatePassed(true);
      }
    }

    getBackendConfig()
      .then((config) => {
        setBackendConfig(config.data);
        if (config?.data?.merchantCodePrefix) {
          setPaymentForm((current) => ({
            ...current,
            merchantCode: config.data.merchantCodePrefix,
          }));
        }
      })
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
        tokenType,
        userId,
        authCode,
        userInfo,
        contactInfo,
        paymentForm,
        walletState,
      })
    );
  }, [accessToken, tokenType, userId, authCode, userInfo, contactInfo, paymentForm, walletState]);

  const rankingItems = useMemo(() => {
    const me = {
      id: 'rk-me',
      name: userInfo?.nickName || userInfo?.fullName || 'Tu perfil',
      points: walletState.points,
      streak: walletState.streak,
      isMe: true,
    };

    return [...RANKING_SEED, me].sort((a, b) => b.points - a.points);
  }, [userInfo, walletState.points, walletState.streak]);

  function pushActivity(title, detail) {
    setActivityLog((current) => [{ id: `${Date.now()}-${current.length}`, title, detail }, ...current].slice(0, 6));
    setMessage({ title, detail: typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2) });
  }

  async function handleAuthorizeAccess() {
    setLoadingAction('authorize');
    setPermissionsError('');
    let rawExchange = null;
    let latestAuthExchangeMeta = null;
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

        if (/denied|no permission|jsapi call denied|not available|timed out/i.test(strictDetail)) {
          pushActivity(
            'DigitalIdentity no disponible',
            'Reintentando con método alterno de auth para obtener JWT.'
          );
          result = await requestAuthCode('DigitalIdentity', authorizationMsg, false);
        } else {
          throw strictError;
        }
      }

      if (result?.__meta) {
        pushActivity(
          'Método de autorización',
          `Método exitoso: ${result.__meta.method || 'unknown'}`
        );
      }

      rawExchange = result || null;
      const exchange = extractJsapiExchange(rawExchange);
      latestAuthExchangeMeta = exchange;

      if (!isJsapiExchangeValid(exchange)) {
        throw new Error(
          `Intercambio JSAPI inválido. resultCode=${exchange.resultCode || 'empty'} resultMsg=${exchange.resultMsg || 'empty'} startTime=${exchange.startTime || 'empty'}`
        );
      }

      const code = exchange.authCode;

      pushActivity(
        'Intercambio JSAPI',
        `resultCode=${exchange.resultCode || 'n/a'} resultMsg=${exchange.resultMsg || 'n/a'} startTime=${exchange.startTime || 'n/a'}`
      );

      const authResult = await authenticate(code, exchange);
      const token = authResult?.data?.accessToken || '';
      const authTokenType = authResult?.data?.tokenType || 'Bearer';
      const nextUserId = authResult?.data?.userId || '';

      if (!token || !nextUserId) {
        throw new Error('La autenticación devolvió un token o userId vacío.');
      }

      setAuthCode(code);
      setAccessToken(token);
      setTokenType(authTokenType);
      setUserId(nextUserId);
      setUserInfo({ userId: nextUserId });

      try {
        const profileAuthCodes = await collectProfileAuthCodes(code);
        const userInfoResult = await getUserInfo(token, profileAuthCodes, authTokenType);
        setUserInfo(userInfoResult?.data || null);
        setContactInfo({ authCodes: profileAuthCodes.slice(1) });
      } catch (userInfoError) {
        pushActivity(
          'Perfil pendiente',
          userInfoError?.payload?.message || userInfoError?.message || 'No se pudo sincronizar perfil por ahora.'
        );
      }

      setDigitalIdentityAuthorized(true);
      setModalOpen(false);
      pushActivity('Sesion iniciada', 'Te has autenticado correctamente con tu cuenta Alipay.');
      return {
        token,
        tokenType: authTokenType,
        userId: nextUserId,
        authCode: code,
        profileAuthCodes: [],
      };
    } catch (error) {
      const detail = formatErrorDetail(error, 'No se pudo obtener el código de autorización del puente Alipay.');
      const enrichedDetail = /denied|no permission|jsapi call denied/i.test(detail)
        ? `${detail} Verifica en Alipay/Toka: app release en ambiente Test, feature User_Digital_Identity_Information activo para tu appId y apertura dentro de la SuperApp.`
        : detail;

      const runtimeInfo = getBridgeRuntimeInfo();
      const diagnosticsPayload = {
        errorMessage: detail,
        runtimeInfo,
        authExchangeMeta: latestAuthExchangeMeta,
        authExchangeRaw: rawExchange,
        attempts: error?.attempts || error?.causes?.map((item) => ({
          method: item?.method,
          message: item?.message,
          response: item?.response || null,
        })) || [],
        checklist: [
          'App Type = H5+ y URL abierta desde SuperApp real (no navegador externo).',
          'Version liberada en ambiente Test para ese Mini Program ID.',
          'Feature User_Digital_Identity_Information = Activated para el mismo appId.',
          'Global config Test vinculado (Client ID / Merchant ID) y release aplicado.',
          'Si se queda en "Autorizando...", revisar timeout/método no disponible en contenedor y usar fallback getAuthCode.',
          'TOKA_MERCHANT_CODE largo (12 chars) solo afecta pagos, no auth; para pagos debe enviarse prefijo de 5 chars cuando aplique.',
          'No usar cached WebView viejo: cerrar y reabrir mini app después del release.',
        ],
      };
      setBridgeDiagnostics(JSON.stringify(diagnosticsPayload, null, 2));

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

  async function handleAuthorizeAndPay() {
    setLoadingAction('authorize-pay');
    try {
      if (!backendConfig?.merchantCodePrefix) {
        throw new Error('No se cargó el merchant prefix del backend.');
      }

      const refreshedSession = await handleAuthorizeAccess();
      const paymentToken = refreshedSession?.token || accessToken;
      const paymentTokenType = refreshedSession?.tokenType || tokenType || 'Bearer';
      const paymentUserId = refreshedSession?.userId || userId;

      if (!paymentToken || !paymentUserId) {
        throw new Error('Necesitas una sesión activa antes de autorizar un pago.');
      }

      const result = await createPayment({
        accessToken: paymentToken,
        tokenType: paymentTokenType,
        userId: paymentUserId,
        merchantCode: backendConfig.merchantCodePrefix,
        orderTitle: paymentForm.orderTitle,
        orderAmount: {
          value: paymentForm.orderAmount,
          currency: 'USD',
        },
      });

      const paymentUrl = result?.data?.paymentUrl || '';
      const createdPaymentId = result?.data?.paymentId || '';
      setPaymentForm((current) => ({ ...current, paymentId: createdPaymentId }));

      if (!paymentUrl) {
        throw new Error('La respuesta de pago no devolvió paymentUrl.');
      }

      pushActivity('Pago autorizado', 'Se generó la orden y ahora se abrirá el cashier de Toka.');

      if (isAlipayWebView()) {
        await openPayment(paymentUrl);
      } else {
        pushActivity('Pago listo', 'Abre este flujo dentro de la SuperApp para completar el pago.');
      }
    } catch (error) {
      const debugPayload = error?.payload?.data?.debug
        ? ` | debug=${JSON.stringify(error.payload.data.debug)}`
        : '';
      const detail = error?.payload?.message || error.responseText || error.message || 'No se pudo crear el pago.';
      pushActivity('Pago fallido', `${detail}${error?.status ? ` (HTTP ${error.status})` : ''}${debugPayload}`);
    } finally {
      setLoadingAction('');
    }
  }

  async function handleInquiryPayment() {
    setLoadingAction('inquiry-payment');
    try {
      if (!paymentForm.paymentId) {
        throw new Error('Primero crea un pago para obtener paymentId.');
      }
      const result = await inquiryPayment(accessToken, paymentForm.paymentId, tokenType);
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
      if (!paymentForm.paymentId) {
        throw new Error('Primero crea un pago para obtener paymentId.');
      }
      const result = await closePayment(accessToken, paymentForm.paymentId, tokenType);
      pushActivity('Pago cerrado', result?.message || 'El pago se cerro correctamente.');
    } catch (error) {
      pushActivity('Cierre fallido', error?.payload?.message || error.message || 'No se pudo cerrar el pago.');
    } finally {
      setLoadingAction('');
    }
  }

  const selectedChallenge =
    DAILY_CHALLENGES.find((item) => item.id === walletState.selectedChallengeId) || DAILY_CHALLENGES[0];

  function renderHomeView() {
    return (
      <>
        <article className="surface-card hero-card">
          <div className="card-topline">Reto activo</div>
          <h2>{selectedChallenge.title}</h2>
          <p>{selectedChallenge.description}</p>
          <div className="metric-grid">
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
            <button type="button" className="btn-soft" onClick={() => setModalOpen(true)}>
              Ver detalles
            </button>
            <button type="button" className="btn-soft" onClick={handleChallengeChange}>
              Cambiar
            </button>
            <button type="button" onClick={handleChallengeAccept}>
              Aceptar reto
            </button>
          </div>
        </article>

        <article className="surface-card session-card">
          <div className="card-topline">Estado de sesion</div>
          <h3>Acceso y sincronizacion</h3>
          <div className="session-list">
            <div>
              <BadgeCheck size={16} />
              <span>{userId ? 'Usuario autenticado' : 'Usuario pendiente'}</span>
            </div>
            <div>
              <LockKeyhole size={16} />
              <span>{accessToken ? 'JWT activo' : 'JWT pendiente'}</span>
            </div>
            <div>
              <ShieldCheck size={16} />
              <span>{isAlipayWebView() ? 'Contenedor Toka detectado' : 'Modo navegador detectado'}</span>
            </div>
          </div>
          <div className="action-row">
            <button type="button" onClick={handleAuthorizeAccess} disabled={loadingAction === 'authorize'}>
              {loadingAction === 'authorize' ? 'Autorizando...' : 'Autorizar acceso'}
            </button>
            <button type="button" className="btn-soft" onClick={() => setActiveView('wallet')}>
              Ir a wallet
            </button>
          </div>
        </article>
      </>
    );
  }

  function renderFeedView() {
    return (
      <article className="surface-card">
        <div className="card-topline">Comunidad</div>
        <h3>Feed de actividad</h3>
        <div className="feed-stack">
          {COMMUNITY_ITEMS.map((item) => (
            <div key={item.id} className="feed-card">
              <div className="feed-meta">{item.author}</div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </article>
    );
  }

  function renderRankingView() {
    return (
      <article className="surface-card">
        <div className="card-topline">Competencia</div>
        <h3>Tabla de ranking</h3>
        <div className="ranking-list">
          {rankingItems.map((entry, index) => (
            <div key={entry.id} className={`rank-row ${entry.isMe ? 'is-me' : ''}`}>
              <div className="rank-num">#{index + 1}</div>
              <div className="rank-user">
                <strong>{entry.name}</strong>
                <span>{entry.streak} dias de racha</span>
              </div>
              <div className="rank-points">{entry.points}</div>
            </div>
          ))}
        </div>
      </article>
    );
  }

  function renderWalletView() {
    return (
      <>
        <article className="surface-card">
          <div className="card-topline">Wallet Toka</div>
          <h3>Pago y gestion de orden</h3>
          <p className="muted-copy">La API de pago usa prefijo de 5 caracteres para el header de merchant.</p>

          <div className="form-grid">
            <label>
              Merchant completo
              <input value={backendConfig?.merchantCode || 'Cargando merchant id...'} readOnly />
            </label>

            <label>
              Merchant prefix
              <input value={backendConfig?.merchantCodePrefix || paymentForm.merchantCode} readOnly />
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
              <input value="USD" readOnly />
            </label>
          </div>

          <div className="action-row action-grid">
            <button type="button" onClick={handleAuthorizeAndPay} disabled={loadingAction === 'authorize-pay'}>
              <CreditCard size={16} />
              <span>{loadingAction === 'authorize-pay' ? 'Autorizando pago...' : 'Autorizar y pagar'}</span>
            </button>

            <button
              type="button"
              className="btn-soft"
              onClick={handleInquiryPayment}
              disabled={loadingAction === 'inquiry-payment' || !paymentForm.paymentId}
            >
              <ScrollText size={16} />
              <span>Consultar pago</span>
            </button>

            <button
              type="button"
              className="btn-soft"
              onClick={handleClosePayment}
              disabled={loadingAction === 'close-payment' || !paymentForm.paymentId}
            >
              <LockKeyhole size={16} />
              <span>Cerrar pago</span>
            </button>

            <button type="button" className="btn-soft" onClick={handleAuthorizeAccess} disabled={loadingAction === 'authorize'}>
              <RefreshCw size={16} />
              <span>Sincronizar perfil</span>
            </button>
          </div>
        </article>

        <article className="surface-card compact-card">
          <div className="card-topline">Operacion</div>
          <div className="metric-grid tiny">
            <div>
              <strong>{userId ? 'Activo' : 'Inactivo'}</strong>
              <span>Sesion</span>
            </div>
            <div>
              <strong>{paymentForm.paymentId ? '1' : '0'}</strong>
              <span>Pagos abiertos</span>
            </div>
            <div>
              <strong>{backendConfig?.appId || '---'}</strong>
              <span>App ID</span>
            </div>
          </div>
        </article>
      </>
    );
  }

  function renderProfileView() {
    return (
      <>
        <article className="surface-card">
          <div className="card-topline">Identidad</div>
          <h3>Perfil sincronizado</h3>
          <div className="profile-heading">
            <CircleUserRound size={22} />
            <div>
              <strong>{userInfo?.fullName || userInfo?.nickName || userInfo?.userId || userId || 'Perfil no sincronizado'}</strong>
              <span>{userInfo?.email || userInfo?.mobilePhone || 'Sin email o telefono disponible'}</span>
            </div>
          </div>

          <div className="profile-grid">
            <div>
              <span>ID</span>
              <strong>{userInfo?.userId || userId || 'No disponible'}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{userInfo?.email || 'No disponible'}</strong>
            </div>
            <div>
              <span>Telefono</span>
              <strong>{userInfo?.mobilePhone || 'No disponible'}</strong>
            </div>
            <div>
              <span>Token</span>
              <strong>{accessToken ? 'Activo' : 'No disponible'}</strong>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="card-topline">Debug</div>
          <h3>Estado tecnico</h3>
          <pre>{JSON.stringify({ userInfo, contactInfo, bridgeDiagnostics }, null, 2)}</pre>
        </article>
      </>
    );
  }

  if (!permissionsGatePassed) {
    return (
      <main className="app-root gate-root">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />
        <section className="gate-shell">
          <article className="surface-card gate-card">
            <div className="card-topline">Permisos iniciales</div>
            <h1>Activa tu acceso para entrar a Toka Ripple</h1>
            <p>Necesitamos autorizacion de DigitalIdentity y aceptacion de terminos para iniciar sesion.</p>

            <div className="permission-item">
              <div className="permission-copy">
                <ShieldCheck size={18} />
                <div>
                  <strong>DigitalIdentity</strong>
                  <p>Permisos: USER_ID, USER_AVATAR, USER_NICKNAME.</p>
                </div>
              </div>
              <div className="permission-actions">
                <span className={digitalIdentityAuthorized ? 'permission-ok' : 'permission-pending'}>
                  {digitalIdentityAuthorized ? 'Verificado' : 'Pendiente'}
                </span>
                <button type="button" onClick={handleAuthorizeAccess} disabled={loadingAction === 'authorize'}>
                  {loadingAction === 'authorize' ? 'Autorizando...' : 'Autorizar'}
                </button>
              </div>
            </div>

            <div className="terms-box">
              <label className="terms-check">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                />
                Acepto terminos y condiciones
              </label>
            </div>

            {permissionsError ? <p className="error-banner">{permissionsError}</p> : null}

            <div className="action-row">
              <button type="button" onClick={handleContinueFromPermissions}>
                <ArrowRight size={16} />
                <span>{digitalIdentityAuthorized && termsAccepted ? 'Continuar' : 'Continuar bloqueado'}</span>
              </button>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="app-root">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="app-header">
        <div>
          <p className="brand-kicker">Toka Ripple</p>
          <h1>Social wallet experiencial</h1>
        </div>
        <div className="header-pills">
          <span>{userId ? 'Conectado' : 'Sin sesion'}</span>
          <span>{backendConfig ? 'Backend OK' : 'Backend...'}</span>
          <span>{isAlipayWebView() ? 'SuperApp' : 'H5'}</span>
        </div>
      </header>

      <section className="content-shell">
        <AnimatePresence mode="wait">
          <motion.section
            key={activeView}
            className="view-grid"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {activeView === 'home' ? renderHomeView() : null}
            {activeView === 'feed' ? renderFeedView() : null}
            {activeView === 'ranking' ? renderRankingView() : null}
            {activeView === 'wallet' ? renderWalletView() : null}
            {activeView === 'profile' ? renderProfileView() : null}
          </motion.section>
        </AnimatePresence>
      </section>

      <section className="log-shell">
        <article className="surface-card">
          <div className="card-topline">
            <TerminalSquare size={15} />
            <span>Resumen tecnico</span>
          </div>
          <h3>{message.title}</h3>
          <pre>{message.detail}</pre>
        </article>

        <article className="surface-card">
          <div className="card-topline">
            <Activity size={15} />
            <span>Actividad reciente</span>
          </div>
          <div className="log-list">
            {activityLog.length === 0 ? (
              <p className="muted-copy">Aqui apareceran eventos de autenticacion, perfil y pagos.</p>
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

      <nav className="bottom-nav" aria-label="Navegacion principal">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? 'active' : ''}
              onClick={() => setActiveView(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-label="Reto diario">
            <div className="card-topline">Reto diario</div>
            <h2>{selectedChallenge.title}</h2>
            <p>{selectedChallenge.description}</p>
            <p className="reward-line">Recompensa: {selectedChallenge.reward}</p>
            <div className="action-row">
              <button type="button" className="btn-soft" onClick={() => setModalOpen(false)}>
                Cerrar
              </button>
              <button type="button" onClick={handleAuthorizeAccess} disabled={loadingAction === 'authorize'}>
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