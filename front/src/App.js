import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CircleUserRound,
  Gift,
  House,
  LockKeyhole,
  MessageSquare,
  PlaySquare,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
  X,
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

const USERS = [
  { id: 'u-1', name: 'Ana Sofia', rank: 1, streak: 24, points: 5200 },
  { id: 'u-2', name: 'Valentina', rank: 2, streak: 19, points: 4400 },
  { id: 'u-3', name: 'Carlos M', rank: 3, streak: 17, points: 3980 },
  { id: 'u-4', name: 'Lucia P', rank: 4, streak: 14, points: 3300 },
  { id: 'u-5', name: 'Diego H', rank: 5, streak: 10, points: 2980 },
  { id: 'u-6', name: 'Mariana L', rank: 6, streak: 9, points: 2510 },
];

const DAILY_CHALLENGES = [
  {
    id: 'ch-1',
    title: 'Gratitud en accion',
    description: 'Comparte un mensaje positivo en el muro para impulsar comunidad.',
    rewardPoints: 120,
    participants: 847,
  },
  {
    id: 'ch-2',
    title: 'Trivia express',
    description: 'Responde 5 preguntas por ronda del banco de 25.',
    rewardPoints: 180,
    participants: 623,
  },
  {
    id: 'ch-3',
    title: 'Movimiento diario',
    description: 'Completa una actividad corta y registra tu avance.',
    rewardPoints: 90,
    participants: 534,
  },
];

const WALL_POSTS = [
  {
    id: 'w-1',
    author: 'Toka Arcade',
    title: 'Hoy hay bonus de racha',
    body: 'Completa tu reto diario y suma puntos extra al ranking semanal.',
    likes: 144,
    comments: ['Excelente tip', 'Ya voy por mi reto'],
  },
  {
    id: 'w-2',
    author: 'Wallet Crew',
    title: 'Consejo de wallet',
    body: 'Revisa tu historial antes de canjear regalos para planear mejor tus puntos.',
    likes: 87,
    comments: ['Me sirvio bastante'],
  },
  {
    id: 'w-3',
    author: 'Community',
    title: 'Reto de comunidad activo',
    body: 'Publica una accion positiva y motiva a otros usuarios a participar.',
    likes: 203,
    comments: ['Vamos comunidad', 'Ya publique mi avance'],
  },
];

const YOUTUBE_POOL = [
  { id: 'yt-1', videoId: '58KBz9po3H8', author: USERS[0] },
  { id: 'yt-2', videoId: 'dQw4w9WgXcQ', author: USERS[1] },
  { id: 'yt-3', videoId: 'kXYiU_JCYtU', author: USERS[2] },
  { id: 'yt-4', videoId: '9bZkp7q19f0', author: USERS[3] },
  { id: 'yt-5', videoId: '3JZ_D3ELwOQ', author: USERS[4] },
  { id: 'yt-6', videoId: 'L_jWHffIx5E', author: USERS[5] },
];

const GIFTS_CATALOG = [
  {
    id: 'g-1',
    title: 'Spotify Premium 1 mes',
    detail: 'Tarjeta digital para escuchar sin anuncios y con descarga offline.',
    cost: 780,
    stock: 12,
  },
  {
    id: 'g-2',
    title: 'Netflix 1 mes',
    detail: 'Canjea un mes de streaming para compartir valor real desde la wallet.',
    cost: 980,
    stock: 9,
  },
  {
    id: 'g-3',
    title: 'Uber / movilidad',
    detail: 'Apoyo para traslados puntuales con saldo de wallet.',
    cost: 620,
    stock: 14,
  },
  {
    id: 'g-4',
    title: 'Amazon gift card',
    detail: 'Saldo digital para compras online o regalos de mayor valor.',
    cost: 1100,
    stock: 8,
  },
  {
    id: 'g-5',
    title: 'Gaming pass',
    detail: 'Pase premium con beneficios para contenido y juegos.',
    cost: 1360,
    stock: 6,
  },
];

const NOTIFICATIONS_BASE = [
  { id: 'n-1', title: 'Nuevo reto disponible', detail: 'Tienes un nuevo reto para sumar puntos.', read: false, kind: 'alert' },
  { id: 'n-2', title: 'Ranking actualizado', detail: 'Tu posicion semanal acaba de cambiar.', read: false, kind: 'alert' },
  { id: 'n-3', title: 'Wallet lista', detail: 'Puedes enviar Tokadrop a otros usuarios.', read: true, kind: 'info' },
];

const SYSTEM_NOTIFICATION_ID = 'tech-summary';

const TRIVIA_QUESTIONS = [
  { id: 'q-1', question: 'Que mejora una wallet sin friccion?', options: ['Flujo claro', 'Pantallas confusas', 'Sin seguridad', 'Sin historial'], answer: 0 },
  { id: 'q-2', question: 'Que conviene revisar antes de pagar?', options: ['Monto y moneda', 'Color del fondo', 'Tamano de letra', 'Avatar'], answer: 0 },
  { id: 'q-3', question: 'Que beneficio da completar retos?', options: ['Puntos y racha', 'Bloqueo de cuenta', 'Perdida de saldo', 'Sin cambios'], answer: 0 },
  { id: 'q-4', question: 'Para seguridad digital conviene...', options: ['PIN fuerte', 'Compartir password', 'No actualizar', 'Desactivar bloqueos'], answer: 0 },
  { id: 'q-5', question: 'Que accion mejora comunidad?', options: ['Publicar contenido util', 'Enviar spam', 'Insultar', 'Ignorar todo'], answer: 0 },
  { id: 'q-6', question: 'Si falta email en perfil, debes...', options: ['Agregarlo en ajustes', 'Borrar cuenta', 'Salir de app', 'Ignorarlo siempre'], answer: 0 },
  { id: 'q-7', question: 'Para consultar pago necesitas...', options: ['paymentId valido', 'Cambiar appId', 'Borrar cache', 'Cerrar sesion'], answer: 0 },
  { id: 'q-8', question: 'Que refleja una racha alta?', options: ['Constancia', 'Error tecnico', 'Saldo negativo', 'Fallo de red'], answer: 0 },
  { id: 'q-9', question: 'Que ayuda a ordenar gastos?', options: ['Registrar movimientos', 'Comprar al azar', 'No revisar wallet', 'Desactivar alertas'], answer: 0 },
  { id: 'q-10', question: 'Al canjear regalos, primero...', options: ['Revisar puntos', 'Reiniciar app', 'Cambiar idioma', 'Eliminar perfil'], answer: 0 },
  { id: 'q-11', question: 'Que aporta notificaciones utiles?', options: ['Avisos de actividad', 'Mas errores', 'Menos control', 'Sin utilidad'], answer: 0 },
  { id: 'q-12', question: 'Que es Tokadrop en este flujo?', options: ['Envio desde wallet', 'Borrar movimientos', 'Cerrar pagos', 'Restaurar sesion'], answer: 0 },
  { id: 'q-13', question: 'Que hacer si auth falla?', options: ['Reautorizar', 'Eliminar app', 'Cambiar telefono', 'Desactivar backend'], answer: 0 },
  { id: 'q-14', question: 'Que mejora experiencia en feed?', options: ['Scroll continuo', 'Cortes constantes', 'Sin contenido', 'Pantallas vacias'], answer: 0 },
  { id: 'q-15', question: 'Para perfil confiable conviene...', options: ['Datos reales', 'Datos inventados', 'Campos vacios', 'Sin telefono'], answer: 0 },
  { id: 'q-16', question: 'Que hacer antes de canjear?', options: ['Ver stock', 'Ignorar stock', 'Cerrar app', 'Cambiar PIN'], answer: 0 },
  { id: 'q-17', question: 'Que muestra ranking semanal?', options: ['Actividad acumulada', 'Solo azar', 'Nada', 'Errores API'], answer: 0 },
  { id: 'q-18', question: 'Para enviar Tokadrop se necesita...', options: ['Sesion activa', 'Modo avion', 'Borrar auth', 'Sin token'], answer: 0 },
  { id: 'q-19', question: 'Que conviene para friccion cero?', options: ['Boton unico y claro', 'Flujos duplicados', 'Errores sin mensaje', 'Inputs ocultos'], answer: 0 },
  { id: 'q-20', question: 'Que valida inquiry payment?', options: ['Estado de pago', 'Avatar del usuario', 'Color del tema', 'Idioma'], answer: 0 },
  { id: 'q-21', question: 'Que reduce errores de compra?', options: ['Confirmacion visible', 'Clicks repetidos', 'Sin validacion', 'Sin logs'], answer: 0 },
  { id: 'q-22', question: 'Que aporta ajustes funcionales?', options: ['Personalizacion real', 'Mas friccion', 'Sin impacto', 'Menos seguridad'], answer: 0 },
  { id: 'q-23', question: 'Que debe verse en perfil?', options: ['Nombre, email, telefono', 'Solo color', 'Solo avatar', 'Nada'], answer: 0 },
  { id: 'q-24', question: 'Que hacer con token ausente?', options: ['Autorizar acceso', 'Forzar pago', 'Canjear regalo', 'Desinstalar'], answer: 0 },
  { id: 'q-25', question: 'Que resultado esperas de Trivia?', options: ['Subir puntos', 'Borrar racha', 'Perder cuenta', 'Romper app'], answer: 0 },
];

const NAV_ITEMS = [
  { id: 'home', label: 'Inicio', icon: House },
  { id: 'feed', label: 'Feed', icon: PlaySquare },
  { id: 'reto', label: 'Reto', icon: Sparkles },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'perfil', label: 'Perfil', icon: CircleUserRound },
];

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function shuffle(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function createNotification(title, detail, kind = 'activity') {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    detail: typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2),
    read: false,
    kind,
  };
}

function createConfettiPieces(label) {
  const palette = ['#f5a623', '#00c9b1', '#ffffff', '#ff6b9a', '#7ed957'];
  return Array.from({ length: 36 }, (_, index) => ({
    id: `${label}-${Date.now()}-${index}`,
    left: Math.random() * 100,
    size: 6 + Math.random() * 7,
    duration: 1.8 + Math.random() * 1.1,
    delay: Math.random() * 0.3,
    drift: -120 + Math.random() * 240,
    rotation: 280 + Math.random() * 640,
    color: palette[index % palette.length],
  }));
}

function createFeedItem(index) {
  const source = YOUTUBE_POOL[Math.floor(Math.random() * YOUTUBE_POOL.length)];
  return {
    id: `fd-${index}-${Date.now()}`,
    videoId: source.videoId,
    author: source.author,
    title: `Clip destacado #${index + 1}`,
    likes: 50 + (index % 25) * 3,
    comments: 12 + (index % 14),
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
    { type: 'ContactInformation', message: 'Toka Ripple needs your authorization to access your contact information for profile sync.' },
    { type: 'AddressInformation', message: 'Toka Ripple needs your authorization to access your address information for profile sync.' },
    { type: 'PersonalInformation', message: 'Toka Ripple needs your authorization to access your personal information for profile sync.' },
    { type: 'KYCStatus', message: 'Toka Ripple needs your authorization to access your KYC status for profile sync.' },
  ];

  for (const requestItem of profileRequests) {
    try {
      const authResult = await requestAuthCode(requestItem.type, requestItem.message, true);
      const code = extractAuthCodeFromBridgeResponse(authResult);
      if (code) {
        profileAuthCodes.push(code);
      }
    } catch {
      // Some scopes may be unavailable depending on environment.
    }
  }

  return profileAuthCodes;
}

function App() {
  const [backendConfig, setBackendConfig] = useState(null);
  const [screen, setScreen] = useState('home');
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [message, setMessage] = useState({
    title: 'Base lista',
    detail: 'App lista con auth, wallet, retos, feed y perfil conectados.',
  });
  const [authCode, setAuthCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [tokenType, setTokenType] = useState('Bearer');
  const [userId, setUserId] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [contactInfo, setContactInfo] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ merchantCode: '', orderTitle: 'Entrada Toka Ripple', orderAmount: '500', paymentId: '' });
  const [walletState, setWalletState] = useState({ points: 780, streak: 7, completedChallengeIds: [], selectedChallengeId: DAILY_CHALLENGES[0].id });
  const [giftStock, setGiftStock] = useState(() => GIFTS_CATALOG.reduce((acc, gift) => ({ ...acc, [gift.id]: gift.stock }), {}));
  const [notifications, setNotifications] = useState(() => [{ id: SYSTEM_NOTIFICATION_ID, title: 'Base lista', detail: 'App lista con auth, wallet, retos, feed y perfil conectados.', read: false, kind: 'system' }, ...NOTIFICATIONS_BASE]);
  const [wallState, setWallState] = useState(() => WALL_POSTS.reduce((acc, post) => ({ ...acc, [post.id]: { liked: false, likes: post.likes, comments: [...post.comments], draft: '', showComments: false } }), {}));
  const [feedItems, setFeedItems] = useState(() => Array.from({ length: 10 }, (_, index) => createFeedItem(index)));
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [pendingTokadropUser, setPendingTokadropUser] = useState(null);
  const [settingsState, setSettingsState] = useState({ notificationsEnabled: true, privateProfile: false, compactMode: false, profileName: '', profileEmail: '', profilePhone: '' });
  const [triviaState, setTriviaState] = useState({ active: false, pool: shuffle(TRIVIA_QUESTIONS.map((item) => item.id)), roundQuestions: [], questionIndex: 0, selectedOption: null, roundScore: 0, roundsCompleted: 0 });
  const [digitalIdentityAuthorized, setDigitalIdentityAuthorized] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [permissionsGatePassed, setPermissionsGatePassed] = useState(false);
  const [permissionsError, setPermissionsError] = useState('');
  const [bridgeDiagnostics, setBridgeDiagnostics] = useState('');
  const [confettiBurst, setConfettiBurst] = useState(null);
  const confettiTimerRef = useRef(null);

  useEffect(() => {
    const savedSession = safeParse(window.localStorage.getItem(SESSION_KEY), null);
    if (savedSession) {
      setAccessToken(savedSession.accessToken || '');
      setTokenType(savedSession.tokenType || 'Bearer');
      setUserId(savedSession.userId || '');
      setAuthCode(savedSession.authCode || '');
      setUserInfo(savedSession.userInfo || null);
      setContactInfo(savedSession.contactInfo || null);
      setPaymentForm((current) => ({ ...current, ...savedSession.paymentForm }));
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
        setMessage({ title: 'Backend no disponible', detail: 'No se pudo cargar la configuracion del backend.' });
      });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ accessToken, tokenType, userId, authCode, userInfo, contactInfo, paymentForm, walletState, settingsState })
    );
  }, [accessToken, tokenType, userId, authCode, userInfo, contactInfo, paymentForm, walletState, settingsState]);

  useEffect(() => {
    setNotifications((current) => {
      const nextMessage = { id: SYSTEM_NOTIFICATION_ID, title: message.title, detail: message.detail, read: false, kind: 'system' };
      const filtered = current.filter((item) => item.id !== SYSTEM_NOTIFICATION_ID);
      return [nextMessage, ...filtered];
    });
  }, [message]);

  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) {
        window.clearTimeout(confettiTimerRef.current);
      }
    };
  }, []);

  const selectedChallenge = useMemo(() => DAILY_CHALLENGES.find((item) => item.id === walletState.selectedChallengeId) || DAILY_CHALLENGES[0], [walletState.selectedChallengeId]);
  const ranking = useMemo(() => {
    const me = { id: 'me', name: settingsState.profileName || userInfo?.fullName || userInfo?.nickName || userInfo?.userId || 'Tu perfil', rank: 0, streak: walletState.streak, points: walletState.points, isMe: true };
    return [...USERS, me].sort((a, b) => b.points - a.points).map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [settingsState.profileName, userInfo, walletState.points, walletState.streak]);
  const currentTriviaQuestion = useMemo(() => {
    const questionId = triviaState.roundQuestions[triviaState.questionIndex];
    return TRIVIA_QUESTIONS.find((item) => item.id === questionId) || null;
  }, [triviaState.questionIndex, triviaState.roundQuestions]);
  const profileDisplay = useMemo(() => {
    const fullName = settingsState.profileName || userInfo?.fullName || userInfo?.nickName || userInfo?.nickname || userInfo?.displayName || '';
    const email = settingsState.profileEmail || userInfo?.email || userInfo?.mail || '';
    const phone = settingsState.profilePhone || userInfo?.mobilePhone || userInfo?.phoneNumber || '';
    const id = userInfo?.userId || userId || '';
    return { name: fullName || id || 'Agregar nombre', email: email || 'Agregar email', phone: phone || 'Agregar telefono', id: id || 'Agregar identificador', token: accessToken ? 'Activo' : 'Agregar token' };
  }, [settingsState, userInfo, userId, accessToken]);

  function pushActivity(title, detail) {
    const normalizedDetail = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
    setMessage({ title, detail: normalizedDetail });
    setNotifications((current) => [createNotification(title, normalizedDetail), ...current].slice(0, 18));
  }

  function triggerConfetti(label) {
    setConfettiBurst({ label, pieces: createConfettiPieces(label) });
    if (confettiTimerRef.current) {
      window.clearTimeout(confettiTimerRef.current);
    }
    confettiTimerRef.current = window.setTimeout(() => {
      setConfettiBurst(null);
      confettiTimerRef.current = null;
    }, 2400);
  }

  function loadMoreFeed() {
    if (!hasMoreFeed) {
      return;
    }
    const nextItems = Array.from({ length: 7 }, (_, index) => createFeedItem(feedItems.length + index));
    setFeedItems((current) => [...current, ...nextItems]);
    if (feedItems.length + nextItems.length >= 60) {
      setHasMoreFeed(false);
    }
  }

  function handleFeedScroll(event) {
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < 180) {
      loadMoreFeed();
    }
  }

  function toggleWallLike(postId) {
    setWallState((current) => {
      const post = current[postId];
      if (!post) {
        return current;
      }
      const nextLiked = !post.liked;
      return { ...current, [postId]: { ...post, liked: nextLiked, likes: post.likes + (nextLiked ? 1 : -1) } };
    });
  }

  function toggleWallComments(postId) {
    setWallState((current) => ({ ...current, [postId]: { ...current[postId], showComments: !current[postId]?.showComments } }));
  }

  function updateWallCommentDraft(postId, value) {
    setWallState((current) => ({ ...current, [postId]: { ...current[postId], draft: value } }));
  }

  function submitWallComment(postId) {
    const draft = wallState[postId]?.draft?.trim();
    if (!draft) {
      return;
    }
    setWallState((current) => ({ ...current, [postId]: { ...current[postId], comments: [...current[postId].comments, draft], draft: '' } }));
    pushActivity('Comentario agregado', `Publicaste comentario en ${postId}.`);
  }

  function startTriviaRound() {
    setTriviaState((current) => {
      let pool = [...current.pool];
      if (pool.length < 5) {
        pool = shuffle(TRIVIA_QUESTIONS.map((item) => item.id));
      }
      return { ...current, active: true, pool: pool.slice(5), roundQuestions: pool.slice(0, 5), questionIndex: 0, selectedOption: null, roundScore: 0 };
    });
    pushActivity('Trivia iniciada', 'Nueva ronda de 5 preguntas activada.');
  }

  function answerTrivia(optionIndex) {
    if (!currentTriviaQuestion || triviaState.selectedOption !== null) {
      return;
    }
    const isCorrect = optionIndex === currentTriviaQuestion.answer;
    setTriviaState((current) => ({ ...current, selectedOption: optionIndex, roundScore: isCorrect ? current.roundScore + 1 : current.roundScore }));
  }

  function advanceTrivia() {
    const isLastQuestion = triviaState.questionIndex >= 4;
    if (!isLastQuestion) {
      setTriviaState((current) => ({ ...current, questionIndex: current.questionIndex + 1, selectedOption: null }));
      return;
    }
    const earnedPoints = triviaState.roundScore * 36;
    setWalletState((current) => ({ ...current, points: current.points + earnedPoints, streak: current.streak + (triviaState.roundScore >= 3 ? 1 : 0), completedChallengeIds: current.completedChallengeIds.includes('ch-2') ? current.completedChallengeIds : [...current.completedChallengeIds, 'ch-2'] }));
    setTriviaState((current) => ({ ...current, active: false, selectedOption: null, roundsCompleted: current.roundsCompleted + 1 }));
    pushActivity('Trivia completada', `Ronda ${triviaState.roundScore}/5. Sumaste ${earnedPoints} puntos.`);
    triggerConfetti('reto completado');
  }

  function acceptChallenge() {
    if (!accessToken) {
      pushActivity('Reto bloqueado', 'Primero autoriza acceso para habilitar retos.');
      return;
    }
    if (selectedChallenge.id === 'ch-2') {
      if (!triviaState.active) {
        startTriviaRound();
      }
      return;
    }
    if (walletState.completedChallengeIds.includes(selectedChallenge.id)) {
      pushActivity('Reto ya completado', `${selectedChallenge.title} ya fue registrado.`);
      return;
    }
    setWalletState((current) => ({ ...current, points: current.points + selectedChallenge.rewardPoints, streak: current.streak + 1, completedChallengeIds: [...current.completedChallengeIds, selectedChallenge.id] }));
    pushActivity('Reto completado', `Ganaste ${selectedChallenge.rewardPoints} puntos en ${selectedChallenge.title}.`);
    triggerConfetti(selectedChallenge.title);
  }

  function redeemGift(gift) {
    const stock = giftStock[gift.id] ?? 0;
    if (stock <= 0) {
      pushActivity('Sin stock', `${gift.title} agotado.`);
      return;
    }
    if (walletState.points < gift.cost) {
      pushActivity('Puntos insuficientes', `Necesitas ${gift.cost} puntos para canjear ${gift.title}.`);
      return;
    }
    setWalletState((current) => ({ ...current, points: current.points - gift.cost }));
    setGiftStock((current) => ({ ...current, [gift.id]: Math.max(0, stock - 1) }));
    pushActivity('Regalo canjeado', `Canjeaste ${gift.title} por ${gift.cost} puntos.`);
    triggerConfetti(gift.title);
  }

  function markAllNotificationsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }

  function clearNotificationInbox() {
    setNotifications([]);
  }

  function openTokadrop(user) {
    setPendingTokadropUser(user);
    setPaymentForm((current) => ({ ...current, orderTitle: `Tokadrop para ${user.name}`, orderAmount: '50' }));
    setScreen('wallet');
    pushActivity('Tokadrop preparado', `Listo para enviar Tokadrop a ${user.name}.`);
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
      const authorizationMsg = 'Toka Ripple needs your authorization to access your Digital Identity (user ID, avatar y nickname) para iniciar sesion y sincronizar tu perfil.';
      let result;
      try {
        result = await requestAuthCode('DigitalIdentity', authorizationMsg, true);
      } catch (strictError) {
        const strictDetail = formatErrorDetail(strictError, 'DigitalIdentity authorization failed.');
        if (/denied|no permission|jsapi call denied|not available|timed out/i.test(strictDetail)) {
          result = await requestAuthCode('DigitalIdentity', authorizationMsg, false);
        } else {
          throw strictError;
        }
      }

      rawExchange = result || null;
      const exchange = extractJsapiExchange(rawExchange);
      latestAuthExchangeMeta = exchange;
      if (!isJsapiExchangeValid(exchange)) {
        throw new Error(`Intercambio JSAPI invalido. resultCode=${exchange.resultCode || 'empty'} resultMsg=${exchange.resultMsg || 'empty'}`);
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
        const profileCodes = await collectProfileAuthCodes(code);
        const userInfoResult = await getUserInfo(token, profileCodes, authTokenType);
        setUserInfo(userInfoResult?.data || null);
        setContactInfo({ authCodes: profileCodes.slice(1) });
      } catch (userInfoError) {
        pushActivity('Perfil pendiente', userInfoError?.payload?.message || userInfoError?.message || 'No se pudo sincronizar perfil por ahora.');
      }

      setDigitalIdentityAuthorized(true);
      pushActivity('Sesion iniciada', 'Autenticacion completada correctamente.');
      return { token, tokenType: authTokenType, userId: nextUserId };
    } catch (error) {
      const detail = formatErrorDetail(error, 'No se pudo obtener autorizacion del puente Alipay.');
      const runtimeInfo = getBridgeRuntimeInfo();
      setBridgeDiagnostics(JSON.stringify({ errorMessage: detail, runtimeInfo, authExchangeMeta: latestAuthExchangeMeta, authExchangeRaw: rawExchange }, null, 2));
      setPermissionsError(detail);
      pushActivity('Error de autorizacion', detail);
    } finally {
      setLoadingAction('');
    }

    return null;
  }

  function continueFromPermissions() {
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
  }

  async function createWalletPayment() {
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
        throw new Error('Necesitas sesion activa antes de crear pago.');
      }
      const result = await createPayment({ accessToken: paymentToken, tokenType: paymentTokenType, userId: paymentUserId, merchantCode: backendConfig.merchantCodePrefix, orderTitle: paymentForm.orderTitle, orderAmount: { value: paymentForm.orderAmount, currency: 'USD' } });
      const paymentUrl = result?.data?.paymentUrl || '';
      const createdPaymentId = result?.data?.paymentId || '';
      setPaymentForm((current) => ({ ...current, paymentId: createdPaymentId }));
      if (!paymentUrl) {
        throw new Error('La respuesta de pago no devolvio paymentUrl.');
      }
      if (isAlipayWebView()) {
        await openPayment(paymentUrl);
      }
      pushActivity('Pago creado', pendingTokadropUser ? `Tokadrop enviado a ${pendingTokadropUser.name}.` : 'Pago generado correctamente.');
      setPendingTokadropUser(null);
    } catch (error) {
      const detail = error?.payload?.message || error.responseText || error.message || 'No se pudo crear el pago.';
      pushActivity('Pago fallido', detail);
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
      pushActivity('Consulta de pago', result?.message || 'Consulta completada.');
    } catch (error) {
      pushActivity('Consulta fallida', error?.payload?.message || error.message || 'No se pudo consultar pago.');
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
      pushActivity('Pago cerrado', result?.message || 'Pago cerrado correctamente.');
    } catch (error) {
      pushActivity('Cierre fallido', error?.payload?.message || error.message || 'No se pudo cerrar pago.');
    } finally {
      setLoadingAction('');
    }
  }

  function renderHomeScreen() {
    return (
      <div className="screen-content screen-enter">
        <div className="home-top-row">
          <div className="home-title">
            <strong>Muro</strong>
            <span>Comunidad activa</span>
          </div>
          <button type="button" className="icon-btn" onClick={() => setShowNotifications(true)}>
            <Bell size={16} />
            {notifications.some((item) => !item.read) ? <span className="dot" /> : null}
            {notifications.length > 0 ? <span className="count-badge">{notifications.length}</span> : null}
          </button>
        </div>

        <div className="stack-list">
          {WALL_POSTS.map((post) => {
            const state = wallState[post.id];
            return (
              <article key={post.id} className="glass-card floating-card">
                <div className="card-kicker">{post.author}</div>
                <h3>{post.title}</h3>
                <p>{post.body}</p>
                <div className="wall-actions">
                  <button type="button" className={`react-btn ${state?.liked ? 'liked' : ''}`} onClick={() => toggleWallLike(post.id)}>
                    <Sparkles size={14} />
                    {state?.likes || 0}
                  </button>
                  <button type="button" className="react-btn" onClick={() => toggleWallComments(post.id)}>
                    <MessageSquare size={14} />
                    {state?.comments?.length || 0}
                  </button>
                </div>
                {state?.showComments ? (
                  <div className="comment-area">
                    <div className="comment-list">
                      {state.comments.map((comment, index) => (
                        <p key={`${post.id}-c-${index}`} className="comment-item">{comment}</p>
                      ))}
                    </div>
                    <div className="comment-form">
                      <input value={state.draft} onChange={(event) => updateWallCommentDraft(post.id, event.target.value)} placeholder="Escribe un comentario" />
                      <button type="button" onClick={() => submitWallComment(post.id)}>Enviar</button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  function renderFeedScreen() {
    return (
      <div className="screen-content screen-enter">
        <div className="section-title-row">
          <h2>Feed</h2>
          <span>Videos y Tokadrop</span>
        </div>
        <article className="glass-card floating-card">
          <div className="card-kicker">Feed infinito con YouTube iframe</div>
          <div className="infinite-feed" onScroll={handleFeedScroll}>
            {feedItems.map((item) => (
              <div key={item.id} className="video-card">
                <div className="video-header">
                  <div>
                    <strong>{item.author.name}</strong>
                    <span>{item.title}</span>
                  </div>
                  <button type="button" className="tokadrop-btn" onClick={() => openTokadrop(item.author)}>Tokadrop</button>
                </div>
                <div className="video-frame-wrap">
                  <iframe title={item.id} src={`https://www.youtube.com/embed/${item.videoId}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                </div>
                <div className="video-meta">
                  <span>{item.likes} likes</span>
                  <span>{item.comments} comentarios</span>
                </div>
              </div>
            ))}
            <p className="feed-end">{hasMoreFeed ? 'Desliza para cargar mas contenido' : 'No hay mas contenido por ahora'}</p>
          </div>
        </article>
      </div>
    );
  }

  function renderRetoScreen() {
    return (
      <div className="screen-content screen-enter">
        <div className="section-title-row">
          <h2>Reto</h2>
          <span>Semana 3</span>
        </div>
        <article className="glass-card reto-hero floating-card">
          <div className="reto-logo">TR</div>
          <h3>{selectedChallenge.title}</h3>
          <p>{selectedChallenge.description}</p>
          <div className="metric-row">
            <span>{selectedChallenge.participants} participantes</span>
            <span>{selectedChallenge.rewardPoints} puntos</span>
          </div>
          <div className="reto-actions">
            <button type="button" onClick={acceptChallenge}>{selectedChallenge.id === 'ch-2' ? 'Iniciar trivia' : 'Participar en reto'}</button>
            <button type="button" className="soft-btn" onClick={() => { const currentIndex = DAILY_CHALLENGES.findIndex((item) => item.id === selectedChallenge.id); const next = DAILY_CHALLENGES[(currentIndex + 1) % DAILY_CHALLENGES.length]; setWalletState((current) => ({ ...current, selectedChallengeId: next.id })); }}>Cambiar reto</button>
          </div>
        </article>
        <div className="stack-list">
          {DAILY_CHALLENGES.map((challenge) => {
            const isActive = challenge.id === walletState.selectedChallengeId;
            const isDone = walletState.completedChallengeIds.includes(challenge.id);
            return (
              <article key={challenge.id} className={`glass-card floating-card ${isActive ? 'active-card' : ''}`}>
                <h3>{challenge.title}</h3>
                <p>{challenge.description}</p>
                <div className="challenge-footer">
                  <span>{challenge.rewardPoints} puntos</span>
                  <span className={isDone ? 'state-done' : 'state-pending'}>{isDone ? 'Completado' : 'Pendiente'}</span>
                </div>
              </article>
            );
          })}
        </div>
        {selectedChallenge.id === 'ch-2' ? (
          <article className="glass-card floating-card">
            <div className="card-kicker">Trivia</div>
            {!triviaState.active ? (
              <>
                <p>Banco de 25 preguntas. Cada ronda muestra 5 y luego rota al siguiente bloque.</p>
                <div className="metric-row">
                  <span>Rondas: {triviaState.roundsCompleted}</span>
                  <span>Preguntas por ronda: 5</span>
                </div>
                <button type="button" onClick={startTriviaRound}>{triviaState.roundsCompleted > 0 ? 'Siguiente 5 preguntas' : 'Iniciar 5 preguntas'}</button>
              </>
            ) : (
              <>
                <div className="card-kicker">Pregunta {triviaState.questionIndex + 1} de 5</div>
                <h3>{currentTriviaQuestion?.question}</h3>
                <div className="options-list">
                  {currentTriviaQuestion?.options.map((option, index) => {
                    const selected = triviaState.selectedOption === index;
                    const correct = index === currentTriviaQuestion.answer;
                    const reveal = triviaState.selectedOption !== null;
                    return (
                      <button key={option} type="button" className={`option-btn ${reveal && correct ? 'ok' : reveal && selected ? 'wrong' : ''}`} onClick={() => answerTrivia(index)} disabled={reveal}>{option}</button>
                    );
                  })}
                </div>
                <div className="action-inline">
                  <span>Score: {triviaState.roundScore}/5</span>
                  <button type="button" onClick={advanceTrivia} disabled={triviaState.selectedOption === null}>{triviaState.questionIndex >= 4 ? 'Finalizar ronda' : 'Siguiente'}</button>
                </div>
              </>
            )}
          </article>
        ) : null}
      </div>
    );
  }

  function renderRankingScreen() {
    const podium = ranking.slice(0, 3);
    const rest = ranking.slice(3);
    return (
      <div className="screen-content screen-enter">
        <div className="section-title-row">
          <h2>Ranking</h2>
          <span>Esta semana</span>
        </div>
        <article className="glass-card floating-card">
          <div className="podium-grid">
            {podium.map((entry, index) => (
              <div key={entry.id} className={`podium-item p-${index + 1}`}>
                <div className="podium-rank">#{index + 1}</div>
                <strong>{entry.name}</strong>
                <span>{entry.points} pts</span>
              </div>
            ))}
          </div>
          <div className="rank-list">
            {rest.map((entry) => (
              <div key={entry.id} className={`rank-row ${entry.isMe ? 'me' : ''}`}>
                <span>#{entry.rank}</span>
                <strong>{entry.name}</strong>
                <span>{entry.points}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    );
  }

  function renderWalletScreen() {
    return (
      <div className="screen-content screen-enter">
        <div className="section-title-row">
          <h2>Wallet</h2>
          <span>{pendingTokadropUser ? `Tokadrop a ${pendingTokadropUser.name}` : 'Pagos'}</span>
        </div>
        <article className="glass-card floating-card">
          <div className="form-grid">
            <label>
              Merchant ID
              <input value={backendConfig?.merchantCode || 'Cargando merchant...'} readOnly />
            </label>
            <label>
              Merchant prefix
              <input value={backendConfig?.merchantCodePrefix || paymentForm.merchantCode} readOnly />
            </label>
            <label>
              Titulo
              <input value={paymentForm.orderTitle} onChange={(event) => setPaymentForm((current) => ({ ...current, orderTitle: event.target.value }))} />
            </label>
            <label>
              Monto
              <input value={paymentForm.orderAmount} onChange={(event) => setPaymentForm((current) => ({ ...current, orderAmount: event.target.value }))} />
            </label>
          </div>
          <div className="wallet-actions">
            <button type="button" onClick={createWalletPayment} disabled={loadingAction === 'authorize-pay'}>{pendingTokadropUser ? loadingAction === 'authorize-pay' ? 'Enviando Tokadrop...' : 'Enviar Tokadrop' : loadingAction === 'authorize-pay' ? 'Autorizando pago...' : 'Autorizar y pagar'}</button>
            <button type="button" className="soft-btn" onClick={handleInquiryPayment} disabled={loadingAction === 'inquiry-payment' || !paymentForm.paymentId}>Consultar pago</button>
            <button type="button" className="soft-btn" onClick={handleClosePayment} disabled={loadingAction === 'close-payment' || !paymentForm.paymentId}>Cerrar pago</button>
            <button type="button" className="soft-btn" onClick={handleAuthorizeAccess} disabled={loadingAction === 'authorize'}>Sincronizar perfil</button>
          </div>
        </article>

        <article className="glass-card floating-card">
          <div className="card-kicker">Regalos</div>
          <p className="wallet-intro">Convierte puntos en valor real: suscripciones, tarjetas digitales y apoyos de wallet para mover saldo con mÃ¡s sentido.</p>
          <div className="gifts-list">
            {GIFTS_CATALOG.map((gift) => (
              <div key={gift.id} className="gift-row">
                <div>
                  <strong>{gift.title}</strong>
                  <p>{gift.detail}</p>
                  <span>{gift.cost} puntos - stock {giftStock[gift.id] ?? 0}</span>
                </div>
                <button type="button" onClick={() => redeemGift(gift)}><Gift size={15} /> Canjear</button>
              </div>
            ))}
          </div>
        </article>
      </div>
    );
  }

  function renderPerfilScreen() {
    return (
      <div className="screen-content screen-enter">
        <div className="section-title-row">
          <h2>Perfil</h2>
          <span>Ajustes</span>
        </div>
        <article className="glass-card floating-card">
          <div className="profile-head">
            <div className="avatar">TR</div>
            <div>
              <strong>{profileDisplay.name}</strong>
              <p>{profileDisplay.email !== 'Agregar email' ? profileDisplay.email : profileDisplay.phone}</p>
            </div>
          </div>
          <div className="profile-grid">
            <div><span>ID</span><strong>{profileDisplay.id}</strong></div>
            <div><span>Email</span><strong>{profileDisplay.email}</strong></div>
            <div><span>Telefono</span><strong>{profileDisplay.phone}</strong></div>
            <div><span>Token</span><strong>{profileDisplay.token}</strong></div>
          </div>
        </article>

        <article className="glass-card floating-card">
          <div className="card-kicker">Ajustes</div>
          <div className="settings-grid">
            <label><span>Notificaciones</span><input type="checkbox" checked={settingsState.notificationsEnabled} onChange={(event) => setSettingsState((current) => ({ ...current, notificationsEnabled: event.target.checked }))} /></label>
            <label><span>Perfil privado</span><input type="checkbox" checked={settingsState.privateProfile} onChange={(event) => setSettingsState((current) => ({ ...current, privateProfile: event.target.checked }))} /></label>
            <label><span>Modo compacto</span><input type="checkbox" checked={settingsState.compactMode} onChange={(event) => setSettingsState((current) => ({ ...current, compactMode: event.target.checked }))} /></label>
          </div>
          <div className="form-grid">
            <label>Nombre<input value={settingsState.profileName} placeholder="Agregar nombre" onChange={(event) => setSettingsState((current) => ({ ...current, profileName: event.target.value }))} /></label>
            <label>Email<input value={settingsState.profileEmail} placeholder="Agregar email" onChange={(event) => setSettingsState((current) => ({ ...current, profileEmail: event.target.value }))} /></label>
            <label>Telefono<input value={settingsState.profilePhone} placeholder="Agregar telefono" onChange={(event) => setSettingsState((current) => ({ ...current, profilePhone: event.target.value }))} /></label>
          </div>
          <button type="button" onClick={() => pushActivity('Ajustes guardados', 'Configuracion actualizada.')}>Guardar ajustes</button>
        </article>
      </div>
    );
  }

  if (!permissionsGatePassed) {
    return (
      <main className="app-gate">
        <article className="gate-card">
          <div className="card-kicker">Permisos iniciales</div>
          <h1>Activa tu acceso para entrar a Toka Ripple</h1>
          <div className="permission-box">
            <div>
              <strong>DigitalIdentity</strong>
              <p>Permisos: USER_ID, USER_AVATAR, USER_NICKNAME.</p>
            </div>
            <button type="button" onClick={handleAuthorizeAccess} disabled={loadingAction === 'authorize'}>
              <ShieldCheck size={16} />
              {loadingAction === 'authorize' ? 'Autorizando...' : 'Autorizar'}
            </button>
          </div>
          <label className="terms-check">
            <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
            Acepto terminos y condiciones
          </label>
          {permissionsError ? <p className="error-box">{permissionsError}</p> : null}
          <button type="button" onClick={continueFromPermissions}>
            <LockKeyhole size={16} />
            {digitalIdentityAuthorized && termsAccepted ? 'Continuar' : 'Continuar bloqueado'}
          </button>
        </article>
      </main>
    );
  }

  return (
    <main className={`app-shell ${settingsState.compactMode ? 'compact' : ''}`}>
      {confettiBurst ? (
        <div className="confetti-layer" aria-hidden="true">
          <div className="confetti-banner">
            <strong>{confettiBurst.label}</strong>
            <span>Reto cumplido con celebracion animada.</span>
          </div>
          {confettiBurst.pieces.map((piece) => (
            <i key={piece.id} className="confetti-piece" style={{ left: `${piece.left}%`, width: `${piece.size}px`, height: `${piece.size * 1.8}px`, background: piece.color, animationDuration: `${piece.duration}s`, animationDelay: `${piece.delay}s`, '--drift': `${piece.drift}px`, '--rotation': `${piece.rotation}deg` }} />
          ))}
        </div>
      ) : null}

      <div className="status-bar">
        <span>9:41</span>
        <div>
          <span>{userId ? 'Conectado' : 'Sin sesion'}</span>
          <span>{isAlipayWebView() ? 'SuperApp' : 'H5'}</span>
        </div>
      </div>

      <header className="header">
        <div className="logo-chip">TR</div>
        <div>
          <h1>Toka Ripple</h1>
          <p>Wallet social sin friccion</p>
        </div>
      </header>

      <section className="screen-wrap">
        {screen === 'home' ? renderHomeScreen() : null}
        {screen === 'feed' ? renderFeedScreen() : null}
        {screen === 'reto' ? renderRetoScreen() : null}
        {screen === 'ranking' ? renderRankingScreen() : null}
        {screen === 'wallet' ? renderWalletScreen() : null}
        {screen === 'perfil' ? renderPerfilScreen() : null}
      </section>

      <section className="diagnostic-grid">
        <article className="glass-card floating-card">
          <div className="card-kicker">Centro de notificaciones</div>
          <h3>{message.title}</h3>
          <p>{message.detail}</p>
          <div className="diagnostic-actions">
            <button type="button" className="soft-btn" onClick={() => setShowNotifications(true)}>Abrir buzÃ³n</button>
            <button type="button" className="soft-btn" onClick={() => setMessage({ title: 'Resumen tecnico', detail: 'El resumen actual se movio al buzÃ³n de notificaciones.' })}>Refrescar resumen</button>
          </div>
          {bridgeDiagnostics ? <pre>{bridgeDiagnostics}</pre> : null}
        </article>
      </section>

      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" className={screen === item.id ? 'active' : ''} onClick={() => setScreen(item.id)}>
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {showNotifications ? (
        <div className="overlay" role="presentation">
          <section className="overlay-card" role="dialog" aria-modal="true" aria-label="Notificaciones">
            <div className="overlay-head">
              <div>
                <h3>Notificaciones</h3>
                <span>{notifications.length ? `${notifications.length} en el buzÃ³n` : 'BuzÃ³n vacÃ­o'}</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowNotifications(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="overlay-actions">
              <button type="button" className="soft-btn" onClick={markAllNotificationsRead}>Marcar todas</button>
              <button type="button" className="soft-btn danger-soft" onClick={clearNotificationInbox}>Vaciar buzÃ³n</button>
            </div>

            <div className="stack-list notification-list">
              {notifications.length === 0 ? (
                <article className="empty-state">
                  <strong>No hay notificaciones</strong>
                  <p>Las actividades, el resumen tecnico y los eventos apareceran aqui.</p>
                </article>
              ) : (
                notifications.map((notif) => (
                  <article key={notif.id} className={`glass-card notification-card ${notif.read ? 'read' : 'unread'} ${notif.kind || ''}`} onClick={() => setNotifications((current) => current.map((item) => (item.id === notif.id ? { ...item, read: true } : item)))} role="button" tabIndex={0} onKeyDown={() => {}}>
                    <div className="notification-head">
                      <h4>{notif.title}</h4>
                      <span className="notification-kind">{notif.kind === 'system' ? 'Resumen' : 'Evento'}</span>
                    </div>
                    <p>{notif.detail}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
