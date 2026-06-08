import React, { useState, useEffect, useRef } from 'react';
import { authService } from './services/auth';
import { agentService } from './services/agent';
import { speechService } from './services/speech';

// Quick Actions presets
const PRESETS = [
  { id: 'analyze', name: 'Оценить задачу', prompt: 'Прочитай описание задачи целиком. Оцени её объём, риски и распиши, с чего начать.' },
  { id: 'split', name: 'Разбить на шаги', prompt: 'Разбей работу по задаче на подзадачи с логическим порядком.' },
  { id: 'banner', name: 'Промпт: баннер', prompt: 'Предложи 3 разных промпта для генерации баннера (размер, стиль, CTA).' },
  { id: 'make', name: 'Figma Make', prompt: 'Сформируй детальный промпт для Figma Make: экраны, компоненты, состояния.' },
  { id: 'labor', name: 'Трудозатраты', prompt: 'Покажи все трудозатраты по этой задаче: кто сколько часов списал и кратко что делал.' },
  { id: 'learnedLessons', name: 'Похожие задачи и уроки', prompt: 'По выученному опыту и прошлым задачам: какие похожие задачи мы закрывали и какие уроки извлекли?' },
];

export default function App() {
  // Authentication states
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // Password change state
  const [changePwForm, setChangePwForm] = useState({ password: '', passwordConfirm: '' });
  const [mustChangePw, setMustChangePw] = useState(false);

  // Chat states
  const [chatHistory, setChatHistory] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTooltip, setVoiceTooltip] = useState('');

  // UI Panels states
  const [showSettings, setShowSettings] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  // Settings Configuration states (Default to Yandex Cloud)
  const [config, setConfig] = useState({
    provider: 'yandex',
    konstanciaUrl: 'http://localhost:8080',
    konstanciaApiKey: '',
    yandexApiKey: '',
    yandexFolderId: '',
    roleOverride: 'designer',
  });

  const chatScrollerRef = useRef(null);
  const textareaRef = useRef(null);
  const progressTimerRef = useRef(null);

  // --- 1. INITIALIZATION & SESSION CHECK ---
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await authService.getSession();
        if (res.ok && res.session) {
          setUser(res.user);
          setProfile(res.profile);
          
          if (res.profile?.must_change_password) {
            setMustChangePw(true);
          } else {
            // Load settings
            const settingsData = await authService.fetchUserSettings(res.user.id);
            const userSettings = settingsData?.settings || {};
            const agentSettings = userSettings.agent || {};

            const localConfig = JSON.parse(localStorage.getItem('shkf_mobile_config') || '{}');
            const mergedConfig = {
              provider: agentSettings.provider || localConfig.provider || 'yandex',
              konstanciaUrl: agentSettings.konstanciaCloudUrl || localConfig.konstanciaUrl || 'http://192.168.1.50:8080',
              konstanciaApiKey: agentSettings.konstanciaApiKey || localConfig.konstanciaApiKey || '',
              yandexApiKey: agentSettings.yandexApiKey || localConfig.yandexApiKey || '',
              yandexFolderId: agentSettings.yandexFolderId || localConfig.yandexFolderId || '',
              roleOverride: res.profile?.role || localConfig.roleOverride || 'designer',
            };
            
            setConfig(mergedConfig);
            agentService.configure(mergedConfig);
          }
        }
      } catch (err) {
        console.error('Session init error:', err);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  // Sync settings configuration
  const handleConfigChange = (key, val) => {
    const nextConfig = { ...config, [key]: val };
    setConfig(nextConfig);
    agentService.configure(nextConfig);
    localStorage.setItem('shkf_mobile_config', JSON.stringify(nextConfig));
  };

  // Scroll to bottom helper
  useEffect(() => {
    if (chatScrollerRef.current) {
      chatScrollerRef.current.scrollTop = chatScrollerRef.current.scrollHeight;
    }
  }, [chatHistory, sendingChat]);

  // Auto-resize input textarea
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    autoResizeTextarea();
  };

  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // --- 2. AUTHENTICATION HANDLERS ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!loginForm.username || !loginForm.password) {
      setError('Введите логин и пароль.');
      return;
    }

    setBusy(true);
    try {
      const res = await authService.login(loginForm);
      if (res.ok) {
        setUser(res.user);
        setProfile(res.profile);
        
        if (res.profile?.must_change_password) {
          setMustChangePw(true);
        } else {
          // Sync settings
          const settingsData = await authService.fetchUserSettings(res.user.id);
          const userSettings = settingsData?.settings || {};
          const agentSettings = userSettings.agent || {};

          const nextConfig = {
            provider: agentSettings.provider || config.provider,
            konstanciaUrl: agentSettings.konstanciaCloudUrl || config.konstanciaUrl,
            konstanciaApiKey: agentSettings.konstanciaApiKey || config.konstanciaApiKey,
            yandexApiKey: agentSettings.yandexApiKey || config.yandexApiKey,
            yandexFolderId: agentSettings.yandexFolderId || config.yandexFolderId,
            roleOverride: res.profile?.role || config.roleOverride,
          };
          setConfig(nextConfig);
          agentService.configure(nextConfig);
          localStorage.setItem('shkf_mobile_config', JSON.stringify(nextConfig));
        }
      } else {
        setError(res.message || 'Ошибка входа.');
      }
    } catch (err) {
      setError('Не удалось подключиться к серверу авторизации.');
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (changePwForm.password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.');
      return;
    }
    if (changePwForm.password !== changePwForm.passwordConfirm) {
      setError('Пароли не совпадают.');
      return;
    }

    setBusy(true);
    try {
      const res = await authService.changePassword(changePwForm.password);
      if (res.ok) {
        setMustChangePw(false);
        const sess = await authService.getSession();
        setProfile(sess.profile);
      } else {
        setError(res.message || 'Не удалось обновить пароль.');
      }
    } catch (err) {
      setError('Сбой смены пароля.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
    setUser(null);
    setProfile(null);
    setLoginForm({ username: '', password: '' });
    setChatHistory([]);
    setShowSettings(false);
  };

  // --- 3. SPEECH DICTATION HANDLERS ---
  const toggleVoiceInput = () => {
    if (isRecording) {
      speechService.stop();
      setIsRecording(false);
      setVoiceTooltip('');
    } else {
      if (!speechService.isSupported()) {
        alert('Распознавание речи не поддерживается на этом устройстве.');
        return;
      }
      setIsRecording(true);
      setVoiceTooltip('Идёт запись голоса...');
      
      speechService.start({
        onInterim: (text) => {
          setInputText(text);
          autoResizeTextarea();
        },
        onError: (errText) => {
          setVoiceTooltip(errText);
          setIsRecording(false);
          setTimeout(() => setVoiceTooltip(''), 3000);
        },
        onEnd: (finalText) => {
          setIsRecording(false);
          setVoiceTooltip('');
          if (finalText) {
            setInputText(finalText);
            autoResizeTextarea();
          }
        }
      });
    }
  };

  // --- 4. CHAT ACTIONS ---
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || sendingChat) return;

    if (isRecording) {
      speechService.stop();
      setIsRecording(false);
      setVoiceTooltip('');
    }

    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Append user message
    const userMsg = { role: 'user', content: text };
    setChatHistory(prev => [...prev, userMsg]);
    
    // Trigger loading states
    setSendingChat(true);
    setProgressPercent(15);

    // Setup smooth progress bar animation
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 95) return 95;
        const increment = Math.floor(Math.random() * 6) + 2; // add 2-7%
        return Math.min(prev + increment, 95);
      });
    }, 350);

    try {
      const res = await agentService.chat({
        message: text,
        history: [...chatHistory, userMsg],
        role: config.roleOverride,
      });

      // Complete progress animation
      clearInterval(progressTimerRef.current);
      setProgressPercent(100);
      
      setTimeout(() => {
        if (res.ok) {
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: res.content,
            followups: res.followups || [],
            model: res.model
          }]);
        } else {
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: res.message || 'Ошибка получения ответа.',
            isError: true
          }]);
        }
        setSendingChat(false);
        setProgressPercent(0);
      }, 500); // Small delay so the user sees 100% complete

    } catch (err) {
      clearInterval(progressTimerRef.current);
      setProgressPercent(100);
      setTimeout(() => {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: 'Сбой подключения. Проверьте интернет или настройки сервера.',
          isError: true
        }]);
        setSendingChat(false);
        setProgressPercent(0);
      }, 500);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Текст скопирован в буфер обмена');
  };

  const handlePresetSelect = (prompt) => {
    setInputText(prompt);
    setShowPresets(false);
    setTimeout(() => {
      autoResizeTextarea();
      textareaRef.current?.focus();
    }, 100);
  };

  const getRoleLabel = (role) => {
    const roles = {
      designer: 'Дизайнер',
      frontend: 'Front-end',
      backend: 'Back-end',
      pm: 'Project Manager',
      full: 'Все разделы',
    };
    return roles[role] || role || 'Ваш Агент';
  };

  // --- 5. RENDER LOGIC ---
  if (loading) {
    return (
      <div className="auth-container">
        <div style={{ color: '#6b7280', fontSize: '15px', fontWeight: '500' }}>Инициализация...</div>
      </div>
    );
  }

  // Auth Gate
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <img src="/logo.png" className="auth-logo" alt="SHKF" />
            <h1 className="auth-title">Войти в SHKF</h1>
            <p className="auth-subtitle">Введите ваши учётные данные для доступа к Konstancia</p>
          </div>
          
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="auth-input-group">
              <label className="auth-label">Логин / Email</label>
              <div className="auth-input-wrapper">
                <input
                  type="text"
                  placeholder="Имя пользователя или email"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Пароль</label>
              <div className="auth-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Пароль"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  disabled={busy}
                />
                <button
                  type="button"
                  className={`auth-password-toggle ${showPassword ? 'is-on' : ''}`}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPassword ? (
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-button" disabled={busy}>
              {busy ? 'Входим...' : 'Войти'}
            </button>
            
            <button
              type="button"
              className="auth-forgot"
              onClick={() => alert('Пароль выдаёт администратор — обратитесь к нему для сброса.')}
            >
              Не помню пароль
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Change Password Gate
  if (mustChangePw) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Смена пароля</h1>
            <p className="auth-subtitle">Администратор требует сменить пароль при первом входе.</p>
          </div>
          
          <form className="auth-form" onSubmit={handlePasswordChangeSubmit}>
            <div className="auth-input-group">
              <label className="auth-label">Новый пароль</label>
              <div className="auth-input-wrapper">
                <input
                  type="password"
                  placeholder="Минимум 6 символов"
                  value={changePwForm.password}
                  onChange={(e) => setChangePwForm({ ...changePwForm, password: e.target.value })}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Повторите пароль</label>
              <div className="auth-input-wrapper">
                <input
                  type="password"
                  placeholder="Ещё раз"
                  value={changePwForm.passwordConfirm}
                  onChange={(e) => setChangePwForm({ ...changePwForm, passwordConfirm: e.target.value })}
                  disabled={busy}
                />
              </div>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-button" disabled={busy}>
              {busy ? 'Сохраняем...' : 'Сохранить и войти'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const hasMessages = chatHistory.length > 0;

  // Chat Screen
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar matching mockup design */}
      <header className="app-header">
        <div className="app-header-profile">
          <img src="/agent-avatar.png" className="app-header-avatar" alt="Avatar" />
          <div className="app-header-info">
            <span className="app-header-name">Konstancia</span>
            <span className="app-header-status">{getRoleLabel(config.roleOverride)}</span>
          </div>
        </div>
        <button className="app-header-menu" aria-label="Settings Menu" onClick={() => setShowSettings(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </header>

      {/* Main chat container */}
      <div className="chat-container">
        <div className="chat-scroller" ref={chatScrollerRef}>
          {/* Welcome Screen (only if no messages exist yet) */}
          {!hasMessages && (
            <div className="welcome-container">
              <img src="/agent-avatar.png" className="welcome-art" alt="Konstancia Character Art" />
              <h2 className="welcome-title">Привет, я Konstancia</h2>
              <p className="welcome-desc">Задачи Kanban, промпты, Figma, оценка и разбор кода. Ответы со ссылками — в карточках источников внизу.</p>
            </div>
          )}

          {/* Active Chat message feed */}
          {hasMessages && chatHistory.map((msg, index) => (
            <div key={index} className={`message-row ${msg.role}`}>
              {msg.role === 'assistant' && (
                <img src="/agent-avatar.png" className="message-avatar" alt="Agent" />
              )}
              
              <div className="message-bubble-wrapper">
                <div className={`message-bubble ${msg.isError ? 'auth-error' : ''}`}>
                  {msg.content.split('\n').map((line, lIdx) => {
                    if (line.startsWith('- ') || line.startsWith('• ')) {
                      return <li key={lIdx} style={{ marginLeft: '12px' }}>{line.substring(2)}</li>;
                    }
                    if (line.match(/^\d+\.\s/)) {
                      return <li key={lIdx} style={{ marginLeft: '12px', listStyleType: 'decimal' }}>{line.replace(/^\d+\.\s/, '')}</li>;
                    }
                    return <p key={lIdx}>{line}</p>;
                  })}

                  {/* Suggestion Followups */}
                  {msg.followups && msg.followups.length > 0 && (
                    <div className="followups-container">
                      {msg.followups.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          type="button"
                          className="followup-btn"
                          onClick={() => handleSendMessage(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Meta details & action controls */}
                <div className="message-meta">
                  {msg.role === 'assistant' ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span>{msg.model || 'Агент'}</span>
                      <div className="message-actions">
                        <button
                          className="message-action-btn"
                          title="Скопировать"
                          onClick={() => copyToClipboard(msg.content)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                        <button
                          className="message-action-btn"
                          title="Отправить в чат"
                          onClick={() => setInputText(msg.content)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                            <polyline points="16 6 12 2 8 6"></polyline>
                            <line x1="12" y1="2" x2="12" y2="15"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span>Вы</span>
                  )}
                </div>
              </div>

              {msg.role === 'user' && profile && (
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: '#e5e7eb',
                    color: '#4b5563',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '600',
                    marginLeft: '10px',
                    flexShrink: 0,
                    textTransform: 'uppercase',
                    backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : 'none',
                    backgroundSize: 'cover'
                  }}
                >
                  {!profile.avatar_url && (profile.full_name?.[0] || profile.username?.[0] || 'U')}
                </div>
              )}
            </div>
          ))}

          {/* Screen 2 "Preparing reply" state */}
          {sendingChat && (
            <div className="message-row agent">
              <img src="/agent-avatar.png" className="message-avatar" alt="Agent" />
              <div className="message-bubble-wrapper">
                <div className="message-bubble agent-loading-bubble">
                  <span>Готовлю ответ на вопрос ...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic V-Tuber peeking effect from mockup */}
        {hasMessages && (
          <div className="character-peeking-container">
            <img
              src="/agent-avatar.png"
              className={`character-peeking-img ${sendingChat ? 'talking' : ''}`}
              style={{ transform: sendingChat ? 'translateY(16px)' : 'translateY(24px)' }}
              alt="Peeking Agent"
            />
          </div>
        )}

        {/* Animated Progress Bar (exactly matching Screen 2) */}
        {sendingChat && progressPercent > 0 && (
          <div className="progress-bar-container">
            <span className="progress-label-current">{progressPercent}%</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <span className="progress-label-target">100%</span>
          </div>
        )}

        {/* Bottom chat input panel */}
        <div className="bottom-input-container">
          <div className="input-box">
            {/* Real-time Voice typing toast overlay */}
            {voiceTooltip && (
              <div className="voice-toast">
                <span className="voice-pulse-dot"></span>
                <span>{voiceTooltip}</span>
              </div>
            )}

            <div className="input-textarea-wrapper">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Спросите Konstancia |"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            
            <div className="input-controls-row">
              <div className="input-actions-left">
                {/* Media upload mock button */}
                <button
                  type="button"
                  className="input-circle-btn"
                  onClick={() => alert('Прикрепление файлов будет добавлено в следующей версии.')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>

                {/* Voice Input Concentrate Circles button */}
                <button
                  type="button"
                  className={`input-circle-btn voice-btn ${isRecording ? 'recording' : ''}`}
                  onClick={toggleVoiceInput}
                  title="Голосовой ввод"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M12 2a10 10 0 0 0-10 10c0 2 .5 3.9 1.5 5.5l-1.5 4.5 4.5-1.5c1.6 1 3.5 1.5 5.5 1.5 5.5 0 10-4.5 10-10S17.5 2 12 2z"></path>
                  </svg>
                </button>

                {/* Quick prompts capsule */}
                <button
                  type="button"
                  className="input-capsule-btn"
                  onClick={() => setShowPresets(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="12 2 2 22 22 22"></polygon>
                  </svg>
                  <span>Подсказки</span>
                </button>
              </div>

              {/* Purple send arrow button */}
              <button
                type="button"
                className="input-send-btn"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || sendingChat}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Prompts dialog panel */}
      {showPresets && (
        <div className="presets-overlay" onClick={() => setShowPresets(false)}>
          <div className="presets-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="presets-header">
              <h3 className="presets-title">Выберите подсказку</h3>
              <button className="presets-close" onClick={() => setShowPresets(false)}>Закрыть</button>
            </div>
            <div className="presets-list">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="preset-item"
                  onClick={() => handlePresetSelect(preset.prompt)}
                >
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-prompt">{preset.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings slide-out drawer */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
            <h3 className="settings-title">Настройки ассистента</h3>
            
            <div className="settings-group">
              <span className="settings-section-title">Подключение к AI</span>
              
              <div className="settings-control">
                <label>Провайдер</label>
                <select
                  value={config.provider}
                  onChange={(e) => handleConfigChange('provider', e.target.value)}
                >
                  <option value="yandex">Yandex Cloud (YandexGPT)</option>
                  <option value="konstancia">Konstancia (Локальный FastAPI)</option>
                </select>
              </div>

              {config.provider === 'konstancia' ? (
                <>
                  <div className="settings-control">
                    <label>Адрес сервера Konstancia</label>
                    <input
                      type="text"
                      placeholder="http://192.168.1.50:8080"
                      value={config.konstanciaUrl}
                      onChange={(e) => handleConfigChange('konstanciaUrl', e.target.value)}
                    />
                  </div>
                  <div className="settings-control">
                    <label>API Ключ (необязательно)</label>
                    <input
                      type="password"
                      placeholder="Секретный токен"
                      value={config.konstanciaApiKey}
                      onChange={(e) => handleConfigChange('konstanciaApiKey', e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="settings-control">
                    <label>Yandex Cloud API Key</label>
                    <input
                      type="password"
                      placeholder="Api-Key ..."
                      value={config.yandexApiKey}
                      onChange={(e) => handleConfigChange('yandexApiKey', e.target.value)}
                    />
                  </div>
                  <div className="settings-control">
                    <label>Yandex Folder ID (необязательно)</label>
                    <input
                      type="text"
                      placeholder="Автоопределение, если пусто"
                      value={config.yandexFolderId}
                      onChange={(e) => handleConfigChange('yandexFolderId', e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="settings-group">
              <span className="settings-section-title">Профиль</span>
              
              <div className="settings-control">
                <label>Роль в чате</label>
                <select
                  value={config.roleOverride}
                  onChange={(e) => handleConfigChange('roleOverride', e.target.value)}
                >
                  <option value="designer">Дизайнер</option>
                  <option value="frontend">Front-end</option>
                  <option value="backend">Back-end</option>
                  <option value="pm">Project Manager</option>
                  <option value="full">Все разделы</option>
                </select>
              </div>

              {profile && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>Пользователь: <strong>{profile.full_name || profile.username}</strong></div>
                  <div>Должность: {profile.position || '—'}</div>
                </div>
              )}
            </div>

            <div className="settings-footer">
              <button className="settings-logout-btn" onClick={handleLogout}>Выйти из аккаунта</button>
              <button className="settings-close-btn" onClick={() => setShowSettings(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
