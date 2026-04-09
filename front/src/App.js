import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Bell,
  CircleUserRound,
  CreditCard,
  Gift,
  House,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
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
    reward: 120,
    rewardLabel: '+120 puntos',
  },
  {
    id: 'ch-2',
    title: 'Trivia Express',
    description: 'Responde rondas de 5 preguntas y desbloquea recompensas.',
    reward: 180,
    rewardLabel: '+180 puntos',
  },
  {
    id: 'ch-3',
    title: 'Reto Social',
    description: 'Comparte actividad en el muro y suma impacto en comunidad.',
    reward: 80,
    rewardLabel: '+80 puntos',
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

const GIFTS_CATALOG = [
  { id: 'g-1', title: 'Ticket cine', cost: 180, stock: 8 },
  { id: 'g-2', title: 'Cupon cafeteria', cost: 120, stock: 18 },
  { id: 'g-3', title: 'Saldo wallet', cost: 260, stock: 12 },
  { id: 'g-4', title: 'Pase premium 7 dias', cost: 340, stock: 5 },
  { id: 'g-5', title: 'Gift box gaming', cost: 420, stock: 4 },
  { id: 'g-6', title: 'Experiencia sorpresa', cost: 520, stock: 2 },
];

const TRIVIA_QUESTIONS = [
  {
    id: 'q-1',
    question: 'Que practica ayuda a mejorar habitos de ahorro diario?',
    options: ['Anotar gastos', 'Ignorar compras pequenas', 'Comprar sin plan', 'No revisar saldo'],
    answer: 0,
  },
  {
    id: 'q-2',
    question: 'Cual es una buena accion para cuidar seguridad digital?',
    options: ['Usar PIN fuerte', 'Compartir contrasena', 'No actualizar apps', 'Reusar passwords'],
    answer: 0,
  },
  {
    id: 'q-3',
    question: 'Que beneficio da completar retos diarios?',
    options: ['Suma puntos y racha', 'Pierdes historial', 'Bloquea wallet', 'Reduce saldo'],
    answer: 0,
  },
  {
    id: 'q-4',
    question: 'Que conviene hacer antes de pagar en app?',
    options: ['Verificar monto', 'Aceptar cualquier monto', 'Cerrar sesion', 'Desactivar seguridad'],
    answer: 0,
  },
  {
    id: 'q-5',
    question: 'Que accion fortalece comunidad en Toka Ripple?',
    options: ['Compartir actividad', 'Reportar sin motivo', 'No interactuar', 'Ocultar todo'],
    answer: 0,
  },
  {
    id: 'q-6',
    question: 'Si falta telefono en perfil, que procede?',
    options: ['Agregar telefono en ajustes', 'Eliminar cuenta', 'Reinstalar app', 'Ignorar para siempre'],
    answer: 0,
  },
  {
    id: 'q-7',
    question: 'Que indica una racha de 10 dias?',
    options: ['Constancia del usuario', 'Error de sistema', 'Pago duplicado', 'Cuenta bloqueada'],
    answer: 0,
  },
  {
    id: 'q-8',
    question: 'Como mantener wallet ordenada?',
    options: ['Consultar historial', 'No revisar movimientos', 'Usar datos falsos', 'Cerrar app siempre'],
    answer: 0,
  },
  {
    id: 'q-9',
    question: 'Que practica apoya metas financieras?',
    options: ['Definir presupuesto semanal', 'Gastar sin limite', 'No usar categorias', 'Evitar metas'],
    answer: 0,
  },
  {
    id: 'q-10',
    question: 'Que aporta activar notificaciones utiles?',
    options: ['Alertas de actividad', 'Mas errores', 'Menos seguridad', 'Pagos fallidos'],
    answer: 0,
  },
  {
    id: 'q-11',
    question: 'Para que sirve consultar un pago?',
    options: ['Confirmar estatus', 'Borrar perfil', 'Cambiar appId', 'Cerrar backend'],
    answer: 0,
  },
  {
    id: 'q-12',
    question: 'Que dato debe revisarse en orden de pago?',
    options: ['Moneda y monto', 'Color de interfaz', 'Version OS', 'Tamano de texto'],
    answer: 0,
  },
  {
    id: 'q-13',
    question: 'Que refleja completar Trivia Express?',
    options: ['Conocimiento y progreso', 'Fallo de login', 'Reset de racha', 'Error de token'],
    answer: 0,
  },
  {
    id: 'q-14',
    question: 'Que favorece decisiones sanas de gasto?',
    options: ['Comparar opciones', 'Comprar impulsivamente', 'Ocultar costos', 'Ignorar promociones'],
    answer: 0,
  },
  {
    id: 'q-15',
    question: 'Que hacer si paymentId esta vacio?',
    options: ['Crear pago primero', 'Cerrar app', 'Cambiar idioma', 'Borrar cache local'],
    answer: 0,
  },
  {
    id: 'q-16',
    question: 'Que beneficio tiene sincronizar perfil?',
    options: ['Datos actualizados', 'Perder historial', 'Eliminar puntos', 'Bloquear recompensas'],
    answer: 0,
  },
  {
    id: 'q-17',
    question: 'Que mejora la experiencia de comunidad?',
    options: ['Comentarios utiles', 'Spam continuo', 'Insultos', 'No responder'],
    answer: 0,
  },
  {
    id: 'q-18',
    question: 'Que se recomienda para canjear regalo?',
    options: ['Validar costo en puntos', 'Canjear sin saldo', 'Repetir compra rapida', 'Ignorar stock'],
    answer: 0,
  },
  {
    id: 'q-19',
    question: 'Que representa ranking semanal?',
    options: ['Actividad y avance', 'Solo azar', 'Fallos de API', 'Tiempo de carga'],
    answer: 0,
  },
  {
    id: 'q-20',
    question: 'Que hacer ante error de auth en app?',
    options: ['Reautorizar DigitalIdentity', 'Borrar todo al instante', 'Cambiar de app', 'Forzar cierre sin revisar'],
    answer: 0,
  },
  {
    id: 'q-21',
    question: 'Que ayuda a evitar compras duplicadas?',
    options: ['Esperar confirmacion', 'Repetir click sin revisar', 'Recargar sin control', 'Ignorar estatus'],
    answer: 0,
  },
  {
    id: 'q-22',
    question: 'Que aporta tener ajustes configurados?',
    options: ['Experiencia personalizada', 'Mas friccion', 'Menos seguridad', 'Sin beneficios'],
    answer: 0,
  },
  {
    id: 'q-23',
    question: 'Que conviene hacer con gastos pequenos?',
    options: ['Agrupar y revisar', 'Olvidarlos siempre', 'Duplicarlos', 'No registrarlos'],
    answer: 0,
  },
  {
    id: 'q-24',
    question: 'Que permite el scroll infinito en feed?',
    options: ['Ver mas contenido sin corte', 'Bloquear interfaz', 'Cerrar sesion', 'Perder actividad'],
    answer: 0,
  },
  {
    id: 'q-25',
    question: 'Que mejora una app wallet sin friccion?',
    options: ['Flujo claro y rapido', 'Pantallas confusas', 'Datos incompletos', 'Acciones duplicadas'],
    answer: 0,
  },
];

const RANKING_SEED = [
  { id: 'rk-1', name: 'Ana Sofia', points: 5200, streak: 26 },
  { id: 'rk-2', name: 'Valentina', points: 4410, streak: 21 },
  { id: 'rk-3', name: 'Carlos M', points: 3980, streak: 18 },
  { id: 'rk-4', name: 'Lucia P', points: 3300, streak: 16 },
  { id: 'rk-5', name: 'Diego H', points: 2900, streak: 14 },
  { id: 'rk-6', name: 'Mariana L', points: 2460, streak: 10 },
];

const ALERT_ITEMS = [
  {
    id: 'al-1',
    title: 'Racha activa',
    detail: 'Llevas varios dias seguidos. Mantente activo para sumar bonus.',
    time: 'Hace 8 min',
  },
  {
    id: 'al-2',
    title: 'Orden lista',
    detail: 'Tu flujo de pago se puede consultar desde Wallet.',
    time: 'Hace 35 min',
  },
  {
    id: 'al-3',
    title: 'Perfil sincronizable',
    detail: 'Si faltan datos de contacto, usa Sincronizar perfil.',
    time: 'Hace 1 h',
  },
];

const NAV_ITEMS = [
  { id: 'home', label: 'Inicio', icon: House },
  { id: 'retos', label: 'Retos', icon: Sparkles },
  { id: 'feed', label: 'Feed', icon: MessageSquareText },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'gifts', label: 'Regalos', icon: Gift },
  { id: 'alerts', label: 'Alertas', icon: Bell },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'settings', label: 'Ajustes', icon: Settings },
  { id: 'profile', label: 'Perfil', icon: CircleUserRound },
];

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function shuffleArray(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildFeedItem(index) {
  const author = ['Toka Arcade', 'Wallet Crew', 'Ripple Labs', 'Community', 'Play Zone'][index % 5];
  const mood = ['Racha activa', 'Reto completado', 'Meta semanal', 'Tip de ahorro', 'Bonus desbloqueado'][index % 5];
  return {
    id: `fd-${index}`,
    author,
    title: `${mood} #${index + 1}`,
    body: `Publicacion dinamica ${index + 1}. Esta tarjeta se genera para mantener scroll infinito en el feed de comunidad.`,
  };
}

function extractJsapiExchange(result) {
  return {
    authCode: extractAuthCodeFromBridgeResponse(result),
    resultCode:
      result?.resultCode || result?.result?.resultCode || result?.result_status || result?.status || '',
    resultMsg:
      result?.resultMsg ||
      result?.result?.resultMsg ||
      result?.errorMessage ||
      result?.errorMsg ||
      result?.message ||
      '',
    startTime: result?.startTime || result?.result?.startTime || result?.time || null,
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
      message:
        'Toka Ripple needs your authorization to access your contact information for profile sync.',
    },
    {
      type: 'AddressInformation',
      message:
        'Toka Ripple needs your authorization to access your address information for profile sync.',
    },
    {
      type: 'PersonalInformation',
      message:
        'Toka Ripple needs your authorization to access your personal information for profile sync.',
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
      // Optional grants can fail in some environments.
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

  const [homeMode, setHomeMode] = useState('muro');
  const [feedItems, setFeedItems] = useState(() => Array.from({ length: 12 }, (_, i) => buildFeedItem(i)));
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [feedPage, setFeedPage] = useState(1);

  const [giftStocks, setGiftStocks] = useState(() =>
    GIFTS_CATALOG.reduce((acc, item) => ({ ...acc, [item.id]: item.stock }), {})
  );

  const [settingsState, setSettingsState] = useState({
    notificationsEnabled: true,
    autoplayFeed: true,
    privateProfile: false,
    compactMode: false,
    language: 'es',
    profileName: '',
    profileEmail: '',
    profilePhone: '',
  });

  const [triviaState, setTriviaState] = useState({
    roundQuestions: [],
    remainingPool: shuffleArray(TRIVIA_QUESTIONS.map((q) => q.id)),
    currentIndex: 0,
    roundScore: 0,
    answeredCount: 0,
    totalRounds: 0,
    active: false,
    selectedAnswer: null,
    feedback: '',
  });

  const feedContainerRef = useRef(null);

  useEffect(() => {
    const savedSession = safeParse(window.localStorage.getItem(SESSION_KEY), null);
    if (savedSession) {
      setAccessToken(savedSession.accessToken || '');
      setTokenType(savedSession.tokenType || 'Bearer');
      setUserId(savedSession.userId || '');
      setAuthCode(savedSession.authCode || '');
      setUserInfo(savedSession.userInfo || null);
      setContactInfo(savedSession.contactInfo || null);
      setPaymentForm((current) => ({ ...current, ...savedSession.paymentForm, currency: 'USD' }));
      setWalletState((current) => ({ ...current, ...savedSession.walletState }));
      setSettingsState((current) => ({ ...current, ...savedSession.settingsState }));
      if (savedSession.accessToken && savedSession.userId) {
        setDigitalIdentityAuthorized(true);
        setPermissionsGatePassed(true);
      }
    }

    getBackendConfig()
      .then((config) => {
        setBackendConfig(config.data);
        if (config?.data?.merchantCodePrefix) {
          setPaymentForm((current) => ({ ...current, merchantCode: config.data.merchantCodePrefix }));
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
        settingsState,
      })
    );
  }, [
    accessToken,
    tokenType,
    userId,
    authCode,
    userInfo,
    contactInfo,
    paymentForm,
    walletState,
    settingsState,
  ]);

  const rankingItems = useMemo(() => {
    const me = {
      id: 'rk-me',
      name:
        settingsState.profileName ||
        userInfo?.fullName ||
        userInfo?.nickName ||
        userInfo?.nickname ||
        userInfo?.displayName ||
        'Tu perfil',
      points: walletState.points,
      streak: walletState.streak,
      isMe: true,
    };
    return [...RANKING_SEED, me].sort((a, b) => b.points - a.points);
  }, [settingsState.profileName, userInfo, walletState.points, walletState.streak]);

  const profileDisplay = useMemo(() => {
    const fullName =
      settingsState.profileName ||
      userInfo?.fullName ||
      userInfo?.nickName ||
      userInfo?.nickname ||
      userInfo?.displayName ||
      '';
    const email =
      settingsState.profileEmail ||
      userInfo?.email ||
      userInfo?.mail ||
      userInfo?.contactEmail ||
      userInfo?.personalEmail ||
      '';
    const phone =
      settingsState.profilePhone ||
      userInfo?.mobilePhone ||
      userInfo?.phoneNumber ||
      userInfo?.phone ||
      userInfo?.cellphone ||
      '';
    const id = userInfo?.userId || userInfo?.id || userId || '';

    return {
      name: fullName || id || 'Agregar nombre',
      email: email || 'Agregar email',
      phone: phone || 'Agregar telefono',
      id: id || 'Agregar identificador',
      token: accessToken ? 'Activo' : 'Agregar token',
    };
  }, [accessToken, settingsState, userId, userInfo]);

  const selectedChallenge =
    DAILY_CHALLENGES.find((item) => item.id === walletState.selectedChallengeId) || DAILY_CHALLENGES[0];

  const currentTriviaQuestion = useMemo(() => {
    const currentId = triviaState.roundQuestions[triviaState.currentIndex];
    return TRIVIA_QUESTIONS.find((item) => item.id === currentId) || null;
  }, [triviaState.currentIndex, triviaState.roundQuestions]);

  function pushActivity(title, detail) {
    setActivityLog((current) =>
      [{ id: `${Date.now()}-${current.length}`, title, detail }, ...current].slice(0, 7)
    );
    setMessage({ title, detail: typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2) });
  }

  function loadMoreFeed() {
    if (!hasMoreFeed) {
      return;
    }
    const nextPage = feedPage + 1;
    const nextItems = Array.from({ length: 8 }, (_, i) => buildFeedItem(feedItems.length + i));
    const cap = feedItems.length + nextItems.length;
    setFeedItems((current) => [...current, ...nextItems]);
    setFeedPage(nextPage);
    if (cap >= 52) {
      setHasMoreFeed(false);
    }
  }

  function handleFeedScroll(event) {
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < 120) {
      loadMoreFeed();
    }
  }

  function getNextTriviaRound(prevPool) {
    let pool = [...prevPool];
    if (pool.length < 5) {
      pool = shuffleArray(TRIVIA_QUESTIONS.map((q) => q.id));
    }
    const roundQuestions = pool.slice(0, 5);
    const remainingPool = pool.slice(5);
    return { roundQuestions, remainingPool };
  }

  function startTriviaRound() {
    setTriviaState((current) => {
      const { roundQuestions, remainingPool } = getNextTriviaRound(current.remainingPool);
      return {
        ...current,
        active: true,
        roundQuestions,
        remainingPool,
        currentIndex: 0,
        roundScore: 0,
        answeredCount: 0,
        selectedAnswer: null,
        feedback: '',
      };
    });
    pushActivity('Trivia iniciada', 'Arranco una ronda de 5 preguntas.');
  }

  function answerTrivia(optionIndex) {
    if (!currentTriviaQuestion || triviaState.selectedAnswer !== null) {
      return;
    }

    const isCorrect = optionIndex === currentTriviaQuestion.answer;
    setTriviaState((current) => ({
      ...current,
      selectedAnswer: optionIndex,
      roundScore: isCorrect ? current.roundScore + 1 : current.roundScore,
      answeredCount: current.answeredCount + 1,
      feedback: isCorrect ? 'Respuesta correcta' : 'Respuesta incorrecta',
    }));
  }

  function nextTriviaQuestion() {
    if (!triviaState.active) {
      return;
    }

    const lastQuestion = triviaState.currentIndex >= 4;
    if (!lastQuestion) {
      setTriviaState((current) => ({
        ...current,
        currentIndex: current.currentIndex + 1,
        selectedAnswer: null,
        feedback: '',
      }));
      return;
    }

    const earnedPoints = triviaState.roundScore * 36;
    setWalletState((current) => ({
      ...current,
      points: current.points + earnedPoints,
      streak: current.streak + (triviaState.roundScore >= 3 ? 1 : 0),
      challengeAccepted: true,
      completedChallengeIds: current.completedChallengeIds.includes('ch-2')
        ? current.completedChallengeIds
        : [...current.completedChallengeIds, 'ch-2'],
    }));

    setTriviaState((current) => ({
      ...current,
      active: false,
      totalRounds: current.totalRounds + 1,
      selectedAnswer: null,
      feedback: '',
    }));

    pushActivity(
      'Trivia completada',
      `Ronda finalizada con ${triviaState.roundScore}/5. Ganaste ${earnedPoints} puntos.`
    );
  }

  function redeemGift(gift) {
    const currentStock = giftStocks[gift.id] ?? 0;
    if (currentStock <= 0) {
      pushActivity('Sin stock', `El regalo ${gift.title} ya no tiene unidades.`);
      return;
    }
    if (walletState.points < gift.cost) {
      pushActivity('Puntos insuficientes', `Necesitas ${gift.cost} puntos para canjear ${gift.title}.`);
      return;
    }

    setWalletState((current) => ({ ...current, points: current.points - gift.cost }));
    setGiftStocks((current) => ({ ...current, [gift.id]: Math.max(0, (current[gift.id] ?? 0) - 1) }));
    pushActivity('Regalo canjeado', `Canjeaste ${gift.title} por ${gift.cost} puntos.`);
  }

  async function handleAuthorizeAccess() {
    setLoadingAction('authorize');
    setPermissionsError('');
    let rawExchange = null;
    let latestAuthExchangeMeta = null;

    try {
      if (!isAlipayWebView()) {
        throw new Error('Esta funcion solo esta disponible dentro de la SuperApp de Toka/Alipay.');
      }

      const authorizationMsg =
        'Toka Ripple needs your authorization to access your Digital Identity (user ID, avatar y nickname) para iniciar sesion y sincronizar tu perfil.';

      pushActivity(
        'Solicitando autorizacion',
        'Se abrira el popup de Data Usage Authorization para DigitalIdentity.'
      );

      let result;

      try {
        result = await requestAuthCode('DigitalIdentity', authorizationMsg, true);
      } catch (strictError) {
        const strictDetail = formatErrorDetail(strictError, 'DigitalIdentity authorization failed.');

        if (/denied|no permission|jsapi call denied|not available|timed out/i.test(strictDetail)) {
          pushActivity('DigitalIdentity no disponible', 'Reintentando con metodo alterno.');
          result = await requestAuthCode('DigitalIdentity', authorizationMsg, false);
        } else {
          throw strictError;
        }
      }

      rawExchange = result || null;
      const exchange = extractJsapiExchange(rawExchange);
      latestAuthExchangeMeta = exchange;

      if (!isJsapiExchangeValid(exchange)) {
        throw new Error(
          `Intercambio JSAPI invalido. resultCode=${exchange.resultCode || 'empty'} resultMsg=${exchange.resultMsg || 'empty'}`
        );
      }

      const code = exchange.authCode;
      const authResult = await authenticate(code, exchange);
      const token = authResult?.data?.accessToken || '';
      const authTokenType = authResult?.data?.tokenType || 'Bearer';
      const nextUserId = authResult?.data?.userId || '';

      if (!token || !nextUserId) {
        throw new Error('La autenticacion devolvio token o userId vacio.');
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
      pushActivity('Sesion iniciada', 'Te autenticaste correctamente con tu cuenta Alipay.');
      return {
        token,
        tokenType: authTokenType,
        userId: nextUserId,
      };
    } catch (error) {
      const detail = formatErrorDetail(error, 'No se pudo obtener autorizacion del puente Alipay.');
      const runtimeInfo = getBridgeRuntimeInfo();
      setBridgeDiagnostics(
        JSON.stringify(
          {
            errorMessage: detail,
            runtimeInfo,
            authExchangeMeta: latestAuthExchangeMeta,
            authExchangeRaw: rawExchange,
          },
          null,
          2
        )
      );
      setPermissionsError(detail);
      pushActivity('Error al autorizar', detail);
    } finally {
      setLoadingAction('');
    }

    return null;
  }

  function handleContinueFromPermissions() {
    const missing = [];
    if (!digitalIdentityAuthorized) {
      missing.push('Debes autorizar DigitalIdentity.');
    }
    if (!termsAccepted) {
      missing.push('Debes aceptar terminos y condiciones.');
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

  function selectChallenge(challengeId) {
    setWalletState((current) => ({
      ...current,
      selectedChallengeId: challengeId,
      challengeAccepted: false,
    }));
    const challenge = DAILY_CHALLENGES.find((item) => item.id === challengeId);
    pushActivity('Reto seleccionado', challenge?.title || challengeId);
  }

  function handleChallengeAccept() {
    if (!accessToken) {
      pushActivity('Reto bloqueado', 'Primero autoriza DigitalIdentity para obtener token.');
      return;
    }

    if (selectedChallenge.id === 'ch-2') {
      if (!triviaState.active) {
        startTriviaRound();
      }
      return;
    }

    if (walletState.completedChallengeIds.includes(selectedChallenge.id)) {
      pushActivity('Reto ya completado', `El reto ${selectedChallenge.title} ya fue contabilizado.`);
      return;
    }

    setWalletState((current) => ({
      ...current,
      challengeAccepted: true,
      completedChallengeIds: [...current.completedChallengeIds, selectedChallenge.id],
      points: current.points + selectedChallenge.reward,
      streak: current.streak + 1,
    }));

    pushActivity('Reto aceptado', `Se activo ${selectedChallenge.title} y sumaste ${selectedChallenge.reward} puntos.`);
  }

  async function handleAuthorizeAndPay() {
    setLoadingAction('authorize-pay');
    try {
      if (!backendConfig?.merchantCodePrefix) {
        throw new Error('No se cargo el merchant prefix del backend.');
      }

      const refreshedSession = await handleAuthorizeAccess();
      const paymentToken = refreshedSession?.token || accessToken;
      const paymentTokenType = refreshedSession?.tokenType || tokenType || 'Bearer';
      const paymentUserId = refreshedSession?.userId || userId;

      if (!paymentToken || !paymentUserId) {
        throw new Error('Necesitas una sesion activa antes de autorizar un pago.');
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
        throw new Error('La respuesta de pago no devolvio paymentUrl.');
      }

      pushActivity('Pago autorizado', 'Se genero la orden y ahora se abrira el cashier de Toka.');
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

  function updateSettings(key, value) {
    setSettingsState((current) => ({ ...current, [key]: value }));
  }

  function saveSettings() {
    pushActivity('Ajustes guardados', 'Configuracion aplicada correctamente.');
  }

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
            <button type="button" className="btn-soft" onClick={() => setActiveView('retos')}>
              Ir a retos
            </button>
            <button type="button" onClick={handleChallengeAccept}>
              Aceptar reto
            </button>
          </div>

          <div className="story-row">
            <div className="story-chip">Top semanal</div>
            <div className="story-chip">Modo wallet</div>
            <div className="story-chip">Trivia live</div>
          </div>
        </article>

        <article className="surface-card">
          <div className="home-switch">
            <button
              type="button"
              className={homeMode === 'muro' ? 'active' : ''}
              onClick={() => setHomeMode('muro')}
            >
              Muro
            </button>
            <button
              type="button"
              className={homeMode === 'feed' ? 'active' : ''}
              onClick={() => setHomeMode('feed')}
            >
              Feed
            </button>
          </div>

          {homeMode === 'muro' ? (
            <div className="feed-stack">
              {COMMUNITY_ITEMS.map((item) => (
                <div key={item.id} className="feed-card">
                  <div className="feed-meta">{item.author}</div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="home-feed-preview">
              <p>El modo feed tambien esta disponible con scroll infinito en la pestaña Feed.</p>
              <button type="button" onClick={() => setActiveView('feed')}>
                Abrir feed completo
              </button>
            </div>
          )}
        </article>
      </>
    );
  }

  function renderRetosView() {
    const isTriviaChallenge = selectedChallenge.id === 'ch-2';

    return (
      <>
        <article className="surface-card">
          <div className="card-topline">Retos diarios</div>
          <h3>Selecciona y activa tu siguiente reto</h3>
          <div className="challenge-list">
            {DAILY_CHALLENGES.map((challenge) => {
              const isActive = challenge.id === walletState.selectedChallengeId;
              const isDone = walletState.completedChallengeIds.includes(challenge.id);
              return (
                <div key={challenge.id} className={`challenge-card ${isActive ? 'is-active' : ''}`}>
                  <div>
                    <strong>{challenge.title}</strong>
                    <p>{challenge.description}</p>
                    <span className="challenge-reward">{challenge.rewardLabel}</span>
                  </div>
                  <div className="challenge-actions">
                    <span className={`challenge-state ${isDone ? 'done' : 'pending'}`}>
                      {isDone ? 'Completado' : 'Pendiente'}
                    </span>
                    <button type="button" className="btn-soft" onClick={() => selectChallenge(challenge.id)}>
                      Seleccionar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="surface-card">
          <div className="card-topline">Accion del reto</div>
          <h3>{selectedChallenge.title}</h3>
          <p>{selectedChallenge.description}</p>

          {!isTriviaChallenge ? (
            <div className="action-row">
              <button type="button" onClick={handleChallengeAccept}>
                Aceptar reto
              </button>
            </div>
          ) : (
            <div className="trivia-shell">
              {!triviaState.active ? (
                <>
                  <p>
                    Trivia Express usa un banco de 25 preguntas y en cada ronda te presenta 5 preguntas distintas.
                  </p>
                  <div className="trivia-stats">
                    <span>Rondas completadas: {triviaState.totalRounds}</span>
                    <span>Preguntas por ronda: 5</span>
                    <span>Total banco: 25</span>
                  </div>
                  <button type="button" onClick={startTriviaRound}>
                    {triviaState.totalRounds > 0 ? 'Siguiente 5 preguntas' : 'Iniciar ronda de trivia'}
                  </button>
                </>
              ) : (
                <>
                  <p className="trivia-counter">
                    Pregunta {triviaState.currentIndex + 1} de 5
                  </p>
                  <h4>{currentTriviaQuestion?.question}</h4>
                  <div className="trivia-options">
                    {currentTriviaQuestion?.options.map((option, optionIndex) => {
                      const selected = triviaState.selectedAnswer === optionIndex;
                      const isCorrect = optionIndex === currentTriviaQuestion.answer;
                      const reveal = triviaState.selectedAnswer !== null;
                      return (
                        <button
                          type="button"
                          key={option}
                          className={`trivia-option ${
                            reveal && isCorrect ? 'correct' : reveal && selected ? 'wrong' : ''
                          }`}
                          onClick={() => answerTrivia(optionIndex)}
                          disabled={triviaState.selectedAnswer !== null}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>

                  <div className="trivia-footer">
                    <span>Score: {triviaState.roundScore}/5</span>
                    <button
                      type="button"
                      onClick={nextTriviaQuestion}
                      disabled={triviaState.selectedAnswer === null}
                    >
                      {triviaState.currentIndex >= 4 ? 'Finalizar ronda' : 'Siguiente'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </article>
      </>
    );
  }

  function renderFeedView() {
    return (
      <article className="surface-card">
        <div className="card-topline">Feed infinito</div>
        <h3>Explora contenido continuo</h3>
        <div className="infinite-feed" ref={feedContainerRef} onScroll={handleFeedScroll}>
          {feedItems.map((item) => (
            <div key={item.id} className="feed-card">
              <div className="feed-meta">{item.author}</div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
          <div className="feed-status">{hasMoreFeed ? 'Desliza para cargar mas' : 'No hay mas contenido por ahora'}</div>
        </div>
      </article>
    );
  }

  function renderRankingView() {
    const podium = rankingItems.slice(0, 3);
    const rest = rankingItems.slice(3);

    return (
      <article className="surface-card ranking-shell">
        <div className="card-topline">Competencia</div>
        <h3>Ranking semanal</h3>

        <div className="podium">
          {podium.map((entry, idx) => (
            <div key={entry.id} className={`podium-item p-${idx + 1}`}>
              <div className="podium-rank">#{idx + 1}</div>
              <strong>{entry.name}</strong>
              <span>{entry.points} pts</span>
            </div>
          ))}
        </div>

        <div className="ranking-list">
          {rest.map((entry, index) => (
            <div key={entry.id} className={`rank-row ${entry.isMe ? 'is-me' : ''}`}>
              <div className="rank-num">#{index + 4}</div>
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

  function renderGiftsView() {
    return (
      <article className="surface-card">
        <div className="card-topline">Regalos</div>
        <h3>Canjea tus puntos en recompensas</h3>
        <div className="gift-header">
          <span>Puntos disponibles</span>
          <strong>{walletState.points}</strong>
        </div>

        <div className="gifts-list">
          {GIFTS_CATALOG.map((gift) => {
            const stock = giftStocks[gift.id] ?? 0;
            return (
              <div key={gift.id} className="gift-card">
                <div>
                  <strong>{gift.title}</strong>
                  <p>{gift.cost} puntos</p>
                  <span>Stock: {stock}</span>
                </div>
                <button type="button" onClick={() => redeemGift(gift)} disabled={stock <= 0}>
                  Canjear
                </button>
              </div>
            );
          })}
        </div>
      </article>
    );
  }

  function renderAlertsView() {
    return (
      <article className="surface-card">
        <div className="card-topline">Alertas</div>
        <h3>Actividad importante</h3>
        <div className="alerts-list">
          {ALERT_ITEMS.map((item) => (
            <div key={item.id} className="alert-card">
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              <span>{item.time}</span>
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
                onChange={(event) =>
                  setPaymentForm((current) => ({ ...current, orderTitle: event.target.value }))
                }
              />
            </label>

            <label>
              Monto
              <input
                value={paymentForm.orderAmount}
                onChange={(event) =>
                  setPaymentForm((current) => ({ ...current, orderAmount: event.target.value }))
                }
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

            <button
              type="button"
              className="btn-soft"
              onClick={handleAuthorizeAccess}
              disabled={loadingAction === 'authorize'}
            >
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

  function renderSettingsView() {
    return (
      <article className="surface-card">
        <div className="card-topline">Ajustes</div>
        <h3>Configura tu experiencia</h3>

        <div className="settings-list">
          <label className="setting-row">
            <span>Notificaciones</span>
            <input
              type="checkbox"
              checked={settingsState.notificationsEnabled}
              onChange={(event) => updateSettings('notificationsEnabled', event.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>Autoplay en feed</span>
            <input
              type="checkbox"
              checked={settingsState.autoplayFeed}
              onChange={(event) => updateSettings('autoplayFeed', event.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>Perfil privado</span>
            <input
              type="checkbox"
              checked={settingsState.privateProfile}
              onChange={(event) => updateSettings('privateProfile', event.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>Modo compacto</span>
            <input
              type="checkbox"
              checked={settingsState.compactMode}
              onChange={(event) => updateSettings('compactMode', event.target.checked)}
            />
          </label>
        </div>

        <div className="form-grid">
          <label>
            Nombre para mostrar
            <input
              value={settingsState.profileName}
              onChange={(event) => updateSettings('profileName', event.target.value)}
              placeholder="Agregar nombre"
            />
          </label>
          <label>
            Email de contacto
            <input
              value={settingsState.profileEmail}
              onChange={(event) => updateSettings('profileEmail', event.target.value)}
              placeholder="Agregar email"
            />
          </label>
          <label>
            Telefono de contacto
            <input
              value={settingsState.profilePhone}
              onChange={(event) => updateSettings('profilePhone', event.target.value)}
              placeholder="Agregar telefono"
            />
          </label>
        </div>

        <div className="action-row">
          <button type="button" onClick={saveSettings}>
            Guardar ajustes
          </button>
        </div>
      </article>
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
              <strong>{profileDisplay.name}</strong>
              <span>{profileDisplay.email !== 'Agregar email' ? profileDisplay.email : profileDisplay.phone}</span>
            </div>
          </div>

          <div className="profile-grid">
            <div>
              <span>ID</span>
              <strong>{profileDisplay.id}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{profileDisplay.email}</strong>
            </div>
            <div>
              <span>Telefono</span>
              <strong>{profileDisplay.phone}</strong>
            </div>
            <div>
              <span>Token</span>
              <strong>{profileDisplay.token}</strong>
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
    <main className={`app-root ${settingsState.compactMode ? 'compact' : ''}`}>
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
            {activeView === 'retos' ? renderRetosView() : null}
            {activeView === 'feed' ? renderFeedView() : null}
            {activeView === 'ranking' ? renderRankingView() : null}
            {activeView === 'gifts' ? renderGiftsView() : null}
            {activeView === 'alerts' ? renderAlertsView() : null}
            {activeView === 'wallet' ? renderWalletView() : null}
            {activeView === 'settings' ? renderSettingsView() : null}
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
            <p className="reward-line">Recompensa: {selectedChallenge.rewardLabel}</p>
            <div className="action-row">
              <button type="button" className="btn-soft" onClick={() => setModalOpen(false)}>
                Cerrar
              </button>
              <button type="button" onClick={handleChallengeAccept}>
                Aceptar reto
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
