import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Live2DAvatar from './components/Live2DAvatar.jsx';

gsap.registerPlugin(ScrollTrigger);

const navItems = [
  { id: 'platform', en: 'Platform', ru: 'Платформа' },
  { id: 'company', en: 'Company', ru: 'Компания' },
  { id: 'newsroom', en: 'Newsroom', ru: 'Новости' },
  { id: 'message-us', en: 'Message us', ru: 'Связь с нами' }
];

const whatWeDo = [
  {
    number: '01',
    title: { en: 'Figma intelligence', ru: 'Интеллект Figma' },
    text: {
      en: 'SHKFOLDER turns hotkeys, templates and team habits into a fast design operating layer for every role.',
      ru: 'SHKFOLDER превращает хоткеи, шаблоны и привычки в быстрый дизайн-слой для любой роли.'
    },
  },
  {
    number: '02',
    title: { en: 'Creative automation', ru: 'Креативная автоматизация' },
    text: {
      en: 'By combining AI agents, image generation, task context and reusable templates, teams move from idea to shipped interface with less friction.',
      ru: 'ИИ-агенты, генерация графики и шаблоны ускоряют перенос идей в готовый интерфейс.'
    },
  },
  {
    number: '03',
    title: { en: 'Team memory', ru: 'Командная память' },
    text: {
      en: 'Profiles, roles, design memory and connected workspaces keep the product system understandable as the team grows.',
      ru: 'Профили, роли и память дизайна сохраняют структуру продукта понятной при росте команды.'
    },
  },
];

const platformCards = [
  {
    title: { en: 'Figma', ru: 'Figma' },
    text: {
      en: 'Hotkeys, command search and learning flows for designers.',
      ru: 'Горячие клавиши, поиск команд и обучающие сценарии для дизайнеров.'
    }
  },
  {
    title: { en: 'AI Agent', ru: 'ИИ-Агент' },
    text: {
      en: 'Design memory, task links and product guidance in one conversation.',
      ru: 'Память дизайна, связи задач и продуктовое руководство в одном диалоге.'
    }
  },
  {
    title: { en: 'Generation', ru: 'Генерация' },
    text: {
      en: 'Magnific, NanoBanana, references, upscale and creative experiments.',
      ru: 'Magnific, NanoBanana, референсы, апскейл и творческие эксперименты.'
    }
  }
];

const releaseNews = [
  {
    tag: { en: 'Release', ru: 'Релиз' },
    version: '1.2.13',
    slug: 'v1.2.13',
    date: { en: 'June 3, 2026', ru: '3 июня 2026 г.' },
    title: { en: 'SHKF 1.2.13: SSE transport headers for Magnific MCP', ru: 'SHKF 1.2.13: транспортные заголовки SSE для Magnific MCP' },
    summary: {
      en: 'GitHub release v1.2.13 ships a focused transport fix so Magnific MCP sends authorization headers through both EventSource and request layers.',
      ru: 'Релиз GitHub v1.2.13 содержит целенаправленное исправление транспорта, чтобы Magnific MCP отправлял заголовки авторизации как через EventSource, так и через уровни запросов.'
    },
    commit: { en: 'Fix SSE transport headers configuration, release 1.2.13.', ru: 'Исправление конфигурации транспортных заголовков SSE, релиз 1.2.13.' },
    compareUrl: 'https://github.com/ruruchin/SHKF/compare/v1.2.12...v1.2.13',
    releaseUrl: 'https://github.com/ruruchin/SHKF/releases/tag/v1.2.13',
    highlights: {
      en: [
        'Moved authorization headers into EventSource initialization for the MCP SSE connection.',
        'Mirrored authorization headers in request initialization for more reliable server communication.',
        'Published the Windows installer and update metadata for automatic delivery.',
      ],
      ru: [
        'Перенесены заголовки авторизации в инициализацию EventSource для подключения MCP SSE.',
        'Продублированы заголовки авторизации при инициализации запроса для более надежной связи с сервером.',
        'Опубликован установщик для Windows и метаданные обновления для автоматической доставки.',
      ]
    },
  },
  {
    tag: { en: 'News', ru: 'Новость' },
    version: '1.2.12',
    slug: 'v1.2.12',
    date: { en: 'June 3, 2026', ru: '3 июня 2026 г.' },
    title: { en: 'SHKF 1.2.12: Magnific SSE URL and button polish', ru: 'SHKF 1.2.12: URL-адрес Magnific SSE и доработка кнопки' },
    summary: {
      en: 'GitHub release v1.2.12 fixes the Magnific SSE endpoint and improves the visual behavior of the Magnific submit button.',
      ru: 'Релиз GitHub v1.2.12 исправляет конечную точку Magnific SSE и улучшает визуальное поведение кнопки отправки Magnific.'
    },
    commit: { en: 'Fix Magnific SSE URL and button styling, release 1.2.12.', ru: 'Исправление URL-адреса Magnific SSE и стилизации кнопки, релиз 1.2.12.' },
    compareUrl: 'https://github.com/ruruchin/SHKF/compare/v1.2.11...v1.2.12',
    releaseUrl: 'https://github.com/ruruchin/SHKF/releases/tag/v1.2.12',
    highlights: {
      en: [
        'Changed the Magnific transport endpoint to use the `/sse` route.',
        'Added stable sizing rules for Magnific layout blocks.',
        'Styled submit, hover and disabled states for the Magnific action button.',
      ],
      ru: [
        'Изменена конечная точка транспорта Magnific для использования маршрута `/sse`.',
        'Добавлены стабильные правила размеров для блоков разметки Magnific.',
        'Стилизованы состояния кнопки действия Magnific (отправка, наведение и отключено).',
      ]
    },
  },
  {
    tag: { en: 'Release', ru: 'Релиз' },
    version: '1.2.11',
    slug: 'v1.2.11',
    date: { en: 'June 3, 2026', ru: '3 июня 2026 г.' },
    title: { en: 'SHKF 1.2.11: Magnific tab appears in role navigation', ru: 'SHKF 1.2.11: Вкладка Magnific появилась в навигации ролей' },
    summary: {
      en: 'GitHub release v1.2.11 connects the Magnific page to role-based navigation so designers and full-access users can open it directly.',
      ru: 'Релиз GitHub v1.2.11 подключает страницу Magnific к навигации на основе ролей, чтобы дизайнеры и пользователи с полным доступом могли открывать ее напрямую.'
    },
    commit: { en: 'Fix Magnific tab visibility in role nav, release 1.2.11.', ru: 'Исправление видимости вкладки Magnific в навигации ролей, релиз 1.2.11.' },
    compareUrl: 'https://github.com/ruruchin/SHKF/compare/v1.2.10...v1.2.11',
    releaseUrl: 'https://github.com/ruruchin/SHKF/releases/tag/v1.2.11',
    highlights: {
      en: [
        'Added Magnific to designer and full role page sets.',
        'Connected role navigation activation to `activateMagnificPage`.',
        'Kept the release aligned with app version metadata.',
      ],
      ru: [
        'Добавлен Magnific в наборы страниц для дизайнеров и полных ролей.',
        'Подключена активация навигации ролей к `activateMagnificPage`.',
        'Выпуск синхронизирован с метаданными версии приложения.',
      ]
    },
  },
  {
    tag: { en: 'Release', ru: 'Релиз' },
    version: '1.2.10',
    slug: 'v1.2.10',
    date: { en: 'June 3, 2026', ru: '3 июня 2026 г.' },
    title: { en: 'SHKF 1.2.10: EventSource import fix for Magnific MCP', ru: 'SHKF 1.2.10: Исправление импорта EventSource для Magnific MCP' },
    summary: {
      en: 'GitHub release v1.2.10 fixes the EventSource import used by the Magnific MCP service.',
      ru: 'Релиз GitHub v1.2.10 исправляет импорт EventSource, используемый сервисом Magnific MCP.'
    },
    commit: { en: 'Fix eventsource import in magnific-mcp-service, release 1.2.10.', ru: 'Исправление импорта EventSource в сервисе magnific-mcp-service, релиз 1.2.10.' },
    compareUrl: 'https://github.com/ruruchin/SHKF/compare/v1.2.9...v1.2.10',
    releaseUrl: 'https://github.com/ruruchin/SHKF/releases/tag/v1.2.10',
    highlights: {
      en: [
        'Switched the EventSource import to the named export expected by the package.',
        'Restored the global EventSource wiring used by the MCP SSE client.',
        'Published updated package metadata for version 1.2.10.',
      ],
      ru: [
        'Импорт EventSource переключен на именованный экспорт, ожидаемый пакетом.',
        'Восстановлено глобальное подключение EventSource, используемое клиентом MCP SSE.',
        'Опубликованы обновленные метаданные пакета для версии 1.2.10.',
      ]
    },
  },
  {
    tag: { en: 'Release', ru: 'Релиз' },
    version: '1.2.9',
    slug: 'v1.2.9',
    date: { en: 'June 3, 2026', ru: '3 июня 2026 г.' },
    title: { en: 'SHKF 1.2.9: Magnific MCP integration arrives', ru: 'SHKF 1.2.9: Интеграция с Magnific MCP запущена' },
    summary: {
      en: 'GitHub release v1.2.9 introduced the Magnific MCP integration and dedicated product tab.',
      ru: 'Релиз GitHub v1.2.9 представляет интеграцию с Magnific MCP и выделенную вкладку продукта.'
    },
    commit: { en: 'Add Magnific MCP integration with dedicated tab, release 1.2.9.', ru: 'Добавление интеграции Magnific MCP с выделенной вкладкой, релиз 1.2.9.' },
    compareUrl: 'https://github.com/ruruchin/SHKF/compare/v1.2.8...v1.2.9',
    releaseUrl: 'https://github.com/ruruchin/SHKF/releases/tag/v1.2.9',
    highlights: {
      en: [
        'Added a dedicated Magnific experience inside the desktop app.',
        'Connected the MCP service layer for generation workflows.',
        'Prepared release artifacts for the new creative automation module.',
      ],
      ru: [
        'Добавлен выделенный раздел Magnific внутри десктопного приложения.',
        'Подключен сервисный слой MCP для рабочих процессов генерации.',
        'Подготовлены артефакты релиза для нового модуля автоматизации творчества.',
      ]
    },
  },
];

const publications = [
  {
    title: { en: 'Design memory for practical AI agents', ru: 'Память дизайна для практических ИИ-агентов' },
    date: { en: 'September 4, 2026', ru: '4 сентября 2026 г.' }
  },
  {
    title: { en: 'A unified command layer for Figma teams', ru: 'Единый командный слой для команд Figma' },
    date: { en: 'August 14, 2026', ru: '14 августа 2026 г.' }
  },
  {
    title: { en: 'Explainable workflows for product operations', ru: 'Объяснимые рабочие процессы для продуктовых операций' },
    date: { en: 'December 9, 2025', ru: '9 декабря 2025 г.' }
  },
  {
    title: { en: 'Template systems as team acceleration', ru: 'Системы шаблонов как средство ускорения работы команды' },
    date: { en: 'November 21, 2025', ru: '21 ноября 2025 г.' }
  },
  {
    title: { en: 'Creative generation with reference-aware tooling', ru: 'Креативная генерация с использованием инструментов с поддержкой референсов' },
    date: { en: 'November 6, 2025', ru: '6 ноября 2025 г.' }
  },
];

const TRANSLATIONS = {
  en: {
    heroTitle1: 'Engineering the future',
    heroTitle2: 'of creative workflows.',
    heroFoot: 'We connect Figma, AI, task memory and generation tools for teams building products faster.',
    downloadApp: 'Download App +',
    discoverPlatform: 'Discover our platform',
    whatWeDoKicker: 'What we do',
    marquee: 'Designing product teams — Rewriting creative operations — ',
    companyHeader: 'Bold tooling to unlock creative speed for product teams.',
    
    plate1Kicker: 'Figma Sync',
    plate1Title: 'Plugin Bridge',
    plate1Desc: 'Direct integration with Figma Desktop. Instantly export layouts, sync assets, and run design checks.',
    
    plate2Kicker: 'Workspace',
    plate2Desc: 'We are building a focused workspace for designers, managers and engineers who need context, assets and AI in one place.',
    plate2Cta: 'Learn more about us',
    
    plate3Kicker: 'Connected',
    plate3Title: 'Design Memory',
    plate3Desc: 'From Figma hotkeys to design memory, SHKFOLDER keeps everyday product work connected and easier to understand.',
    
    plate4Kicker: 'Speed',
    plate4Title: 'Hotkey Engine',
    plate4Desc: 'Launch tasks, sync assets, and search memory with custom global hotkeys.',
    
    newsTitle: 'News',
    newsFilterAll: 'All',
    newsFilterNews: 'News',
    newsReadArticle: 'Read article',
    newsLoadMore: 'Open all GitHub releases +',
    
    pubTitle: 'Publications',
    pubViewAll: 'View all publications +',
    
    footColDownload: 'Download',
    footLinkProduct: 'Product',
    footLinkDocs: 'Docs',
    footLinkChangelog: 'Changelog',
    footLinkPress: 'Press',
    footLinkReleases: 'Releases',
    footColBlog: 'Blog',
    footLinkPricing: 'Pricing',
    footLinkUseCases: 'Use Cases',
    footLinkAbout: 'About SHKF',
    footLinkProducts: 'Products',
    footLinkPrivacy: 'Privacy',
    footLinkTerms: 'Terms',
    
    contactTitle: 'Message us',
    contactSub: 'We would love to hear from you — send us a message and we’ll be in touch soon.',
    contactColGeneral: 'General contact',
    contactColPartner: 'Partnerships',
    contactFieldFirst: 'First name*',
    contactFieldLast: 'Last name*',
    contactFieldEmail: 'Email*',
    contactFieldPhone: 'Phone*',
    contactFieldSubject: 'Subject*',
    contactSubjectPlaceholder: 'Select Subject',
    contactSubjectDemo: 'Product demo',
    contactSubjectPartner: 'Partnership',
    contactSubjectPress: 'Press',
    contactFieldMessage: 'Message*',
    contactSubmit: 'Submit message',
    
    downloadTitle: 'Download SHKFOLDER',
    downloadSub: 'Get the desktop app for your operating system and start engineering your creative workflow.',
    downloadWinTitle: 'Windows',
    downloadWinDesc: 'Windows 10 and 11',
    downloadWinBtn: 'Download .exe',
    downloadMacTitle: 'macOS',
    downloadMacDesc: 'macOS 12.0 or later',
    downloadMacBtnSilicon: 'Download Apple Silicon',
    downloadMacBtnIntel: 'Download Intel',
    downloadLinuxTitle: 'Linux',
    downloadLinuxDesc: 'Ubuntu, Debian, Fedora',
    downloadLinuxBtnImage: 'Download .AppImage',
    downloadLinuxBtnDeb: 'Download .deb',
    
    articleBack: '← Back to newsroom',
    articleKicker: 'GitHub release',
    articlePublished: 'Published',
    articleSource: 'Source',
    articleGithubRelease: 'GitHub release',
    articleDiff: 'Diff',
    articleCompareTags: 'Compare tags',
    articleChanges: 'Changes',
    articleCommit: 'Commit',
    articleWhatChanged: 'What changed',
    articleTechTitle: 'Technical overview',
    articleTechComp: 'Component',
    articleTechType: 'Type',
    articleTechSeverity: 'Severity',
    articleTechVersion: 'Version',
    articleOpenRelease: 'Open release',
    articleViewChanges: 'View code changes +',
    articleChangelog: 'Changelog',
    articleReadyTitle: 'Ready to try v',
    articleReadyDesc: 'Download the latest release from GitHub or update your existing installation automatically.',
    articleReadyDownload: 'Download release',
    articleReadyRepo: 'View repository +',
    articleRelatedTitle: 'More versions',
    articleRelatedAll: 'All news +',
    articleDesc: 'This news page is generated from the public GitHub release and compare data for SHKF. The release notes on GitHub do not include a long body yet, so the site presents the version, commit message and changed areas in a clean product-news format.',
  },
  ru: {
    heroTitle1: 'Проектируем будущее',
    heroTitle2: 'творческих процессов.',
    heroFoot: 'Мы связываем Figma, ИИ, память задач и генерацию для быстрого создания продуктов.',
    downloadApp: 'Скачать приложение +',
    discoverPlatform: 'Узнать о платформе',
    whatWeDoKicker: 'Что мы делаем',
    marquee: 'Проектирование продуктовых команд — Переосмысление креативных процессов — ',
    companyHeader: 'Дерзкие инструменты для раскрытия творческой скорости продуктовых команд.',
    
    plate1Kicker: 'Синхронизация Figma',
    plate1Title: 'Мост плагина',
    plate1Desc: 'Прямая интеграция с Figma Desktop. Мгновенный экспорт макетов, синхронизация ресурсов и проверки дизайна.',
    
    plate2Kicker: 'Рабочее пространство',
    plate2Desc: 'Мы создаем сфокусированное рабочее пространство для дизайнеров, менеджеров и инженеров, которым нужны контекст, ресурсы и ИИ в одном месте.',
    plate2Cta: 'Узнать больше о нас',
    
    plate3Kicker: 'Связанность',
    plate3Title: 'Память дизайна',
    plate3Desc: 'От горячих клавиш Figma до памяти дизайна, SHKFOLDER сохраняет повседневную работу над продуктом связанной и понятной.',
    
    plate4Kicker: 'Скорость',
    plate4Title: 'Движок хоткеев',
    plate4Desc: 'Запуск задач, синхронизация ресурсов и поиск в памяти с помощью кастомных глобальных хоткеев.',
    
    newsTitle: 'Новости',
    newsFilterAll: 'Все',
    newsFilterNews: 'Статьи',
    newsReadArticle: 'Читать статью',
    newsLoadMore: 'Открыть все релизы на GitHub +',
    
    pubTitle: 'Публикации',
    pubViewAll: 'Все публикации +',
    
    footColDownload: 'Скачать',
    footLinkProduct: 'Продукт',
    footLinkDocs: 'Документы',
    footLinkChangelog: 'Список изменений',
    footLinkPress: 'Пресса',
    footLinkReleases: 'Релизы',
    footColBlog: 'Блог',
    footLinkPricing: 'Цены',
    footLinkUseCases: 'Сценарии',
    footLinkAbout: 'О SHKF',
    footLinkProducts: 'Продукты',
    footLinkPrivacy: 'Приватность',
    footLinkTerms: 'Условия',
    
    contactTitle: 'Напишите нам',
    contactSub: 'Мы будем рады пообщаться с вами — отправьте нам сообщение, и мы скоро свяжемся.',
    contactColGeneral: 'Контакты',
    contactColPartner: 'Партнерство',
    contactFieldFirst: 'Имя*',
    contactFieldLast: 'Фамилия*',
    contactFieldEmail: 'Email*',
    contactFieldPhone: 'Телефон*',
    contactFieldSubject: 'Тема*',
    contactSubjectPlaceholder: 'Выберите тему',
    contactSubjectDemo: 'Демо продукта',
    contactSubjectPartner: 'Партнерство',
    contactSubjectPress: 'Пресса',
    contactFieldMessage: 'Сообщение*',
    contactSubmit: 'Отправить сообщение',
    
    downloadTitle: 'Скачать SHKFOLDER',
    downloadSub: 'Загрузите десктопное приложение для вашей ОС и начните проектировать свой творческий рабочий процесс.',
    downloadWinTitle: 'Windows',
    downloadWinDesc: 'Windows 10 и 11',
    downloadWinBtn: 'Скачать .exe',
    downloadMacTitle: 'macOS',
    downloadMacDesc: 'macOS 12.0 или новее',
    downloadMacBtnSilicon: 'Скачать Apple Silicon',
    downloadMacBtnIntel: 'Скачать Intel',
    downloadLinuxTitle: 'Linux',
    downloadLinuxDesc: 'Ubuntu, Debian, Fedora',
    downloadLinuxBtnImage: 'Скачать .AppImage',
    downloadLinuxBtnDeb: 'Скачать .deb',
    
    articleBack: '← Назад в новостную ленту',
    articleKicker: 'Релиз на GitHub',
    articlePublished: 'Опубликовано',
    articleSource: 'Источник',
    articleGithubRelease: 'Релиз на GitHub',
    articleDiff: 'Разница',
    articleCompareTags: 'Сравнить теги',
    articleChanges: 'Изменения',
    articleCommit: 'Коммит',
    articleWhatChanged: 'Что изменилось',
    articleTechTitle: 'Технический обзор',
    articleTechComp: 'Компонент',
    articleTechType: 'Тип',
    articleTechSeverity: 'Критичность',
    articleTechVersion: 'Версия',
    articleOpenRelease: 'Открыть релиз',
    articleViewChanges: 'Посмотреть изменения в коде +',
    articleChangelog: 'Список изменений',
    articleReadyTitle: 'Готовы попробовать v',
    articleReadyDesc: 'Скачайте последний релиз на GitHub или обновите существующее приложение автоматически.',
    articleReadyDownload: 'Скачать релиз',
    articleReadyRepo: 'Перейти в репозиторий +',
    articleRelatedTitle: 'Другие версии',
    articleRelatedAll: 'Все новости +',
    articleDesc: 'Эта страница новостей создана на основе публичного релиза GitHub и данных сравнения для SHKF. Заметки к релизу на GitHub еще не содержат подробного описания, поэтому сайт представляет версию, сообщение коммита и измененные области в чистом формате продуктовых новостей.',
  }
};

function App() {
  const rootRef = useRef(null);
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '#top' : window.location.hash || '#top'));
  const activeNews = useMemo(() => releaseNews.find((item) => `#news/${item.slug}` === hash), [hash]);
  const activeContact = hash === '#message-us';
  const activeDownload = hash === '#download';
  const [newsFilter, setNewsFilter] = useState('All');
  const [avatarExpression, setAvatarExpression] = useState('');

  const [lang, setLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shkf_lang') || 'en';
    }
    return 'en';
  });

  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem('shkf_lang', l);
  };





  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash || '#top');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (activeNews) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeNews]);

  useEffect(() => {
    if (activeNews || activeContact || !hash || hash === '#top' || hash.startsWith('#news/')) return;

    requestAnimationFrame(() => {
      let target = null;
      try {
        target = document.querySelector(hash);
      } catch {
        target = null;
      }
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [activeNews, hash]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          desktop: '(min-width: 900px)',
          pinnedWhat: '(min-width: 1100px) and (min-height: 700px)',
        },
        ({ conditions }) => {
          const { reduceMotion, desktop, pinnedWhat } = conditions;

          if (reduceMotion) {
            gsap.set('.reveal, .split-word, .section-card, .hero-title .line, .hero-foot, .hero-cta, .article-reveal, .cap-card, .cap-card .cap-icon, .cap-card h3, .cap-card p', { autoAlpha: 1, y: 0, scale: 1, rotationX: 0, rotationY: 0, filter: 'blur(0px)' });
            gsap.set('.company-copy h2, .company-copy .company-body p, .news-head h2, .news-card h3, .news-card p, .publications-head h2, .publication-row h3, .contact-copy h2, .contact-copy p, .article-title, .article-summary, .article-body-card h2, .article-body-card p', { autoAlpha: 1, y: 0, filter: 'blur(0px)', clipPath: 'inset(0 0 0% 0)' });
            return undefined;
          }

          gsap.timeline({ defaults: { ease: 'expo.out' } })
            .from('.abstract-bg, .article-bg', { scale: 1.12, filter: 'blur(18px)', duration: 1.4 })
            .from('.site-nav', { autoAlpha: 0, y: -18, duration: 0.7 }, '-=1.05')
            .from('.hero-title .line', { autoAlpha: 0, yPercent: 115, skewY: 4, duration: 1.1, stagger: 0.12 }, '-=0.72')
            .from('.hero-foot', { autoAlpha: 0, y: 34, filter: 'blur(10px)', duration: 0.82 }, '-=0.55')
            .from('.hero-cta', { autoAlpha: 0, y: 24, scale: 0.94, duration: 0.65 }, '-=0.48');

          gsap.to('.ribbon-a', {
            xPercent: 8,
            yPercent: -10,
            rotation: -12,
            duration: 8,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });

          gsap.to('.ribbon-b', {
            xPercent: -9,
            yPercent: 12,
            rotation: 24,
            duration: 9,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });

          gsap.to('.orb', {
            x: (index) => (index % 2 ? -28 : 32),
            y: (index) => (index % 2 ? 24 : -30),
            scale: 1.12,
            duration: 7,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            stagger: 0.8,
          });

          gsap.to('.abstract-bg', {
            yPercent: desktop ? -10 : -4,
            scale: desktop ? 1.08 : 1.03,
            ease: 'none',
            scrollTrigger: {
              trigger: '.hero-section',
              start: 'top top',
              end: 'bottom top',
              scrub: 1,
            },
          });

          gsap.to('.scroll-progress', {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: document.documentElement,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 0.25,
            },
          });

          const revealScene = (trigger, targets, options = {}) => {
            const elements = gsap.utils.toArray(targets).filter(Boolean);
            if (!elements.length) return;

            gsap.timeline({
              scrollTrigger: {
                trigger,
                start: options.start || 'top 72%',
                toggleActions: 'play none none reverse',
              },
              defaults: { ease: options.ease || 'expo.out' },
            }).fromTo(elements, {
              autoAlpha: 0,
              y: options.y ?? 76,
              scale: options.scale ?? 0.965,
              rotationX: options.rotationX ?? -8,
              transformPerspective: 900,
              transformOrigin: '50% 100%',
              filter: 'blur(12px)',
            }, {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              rotationX: 0,
              filter: 'blur(0px)',
              duration: options.duration || 1.05,
              stagger: options.stagger || 0.08,
              overwrite: true,
            });
          };

          const capCards = gsap.utils.toArray('.cap-card');
          if (capCards.length) {
            gsap.set(capCards, { transformPerspective: 1200, transformOrigin: '50% 100%' });

            gsap.timeline({
              scrollTrigger: {
                trigger: '.capability-grid',
                start: 'top 85%',
                toggleActions: 'play none none reverse',
              },
              defaults: { ease: 'expo.out' },
            }).fromTo(capCards, {
              autoAlpha: 0,
              y: 160,
              scale: 0.86,
              rotationX: -22,
              rotationY: (index) => (index - 1) * 14,
              filter: 'blur(18px)',
            }, {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              rotationX: 0,
              rotationY: 0,
              filter: 'blur(0px)',
              duration: 1.18,
              stagger: { amount: 0.48, from: 'start' },
            }).from('.cap-card .cap-icon', {
              scale: 0.4,
              rotation: -24,
              autoAlpha: 0,
              duration: 0.72,
              stagger: 0.12,
            }, '-=0.72').from('.cap-card h3, .cap-card p', {
              autoAlpha: 0,
              y: 28,
              filter: 'blur(8px)',
              duration: 0.68,
              stagger: 0.06,
            }, '-=0.58');
          }

          revealScene('.news-section', ['.news-filters a', '.news-card', '.load-more'], { start: 'top 76%', y: 82, stagger: 0.055 });
          revealScene('.publications-section', ['.outline-cta'], { start: 'top 76%', y: 64, stagger: 0.06 });
          revealScene('.contact-section', ['.contact-mail', '.contact-field', '.contact-submit'], { start: 'top 72%', y: 68, stagger: 0.055 });
          revealScene('.news-article-page', ['.article-kicker', '.article-meta-card', '.article-related-card'], { start: 'top 86%', y: 72, stagger: 0.07 });

          // Text appearance animations for sections after the first 3 blocks
          const textReveal = (trigger, selectors, options = {}) => {
            const els = gsap.utils.toArray(selectors).filter(Boolean);
            if (!els.length) return;
            gsap.timeline({
              scrollTrigger: {
                trigger,
                start: options.start || 'top 74%',
                toggleActions: 'play none none reverse',
              },
              defaults: { ease: 'power3.out' },
            }).fromTo(els, {
              autoAlpha: 0,
              y: 44,
              filter: 'blur(14px)',
              clipPath: 'inset(0 0 100% 0)',
            }, {
              autoAlpha: 1,
              y: 0,
              filter: 'blur(0px)',
              clipPath: 'inset(0 0 0% 0)',
              duration: options.duration || 1.1,
              stagger: options.stagger || 0.12,
            });
          };

          textReveal('.news-section', '.news-head h2', { start: 'top 72%', duration: 1.2, stagger: 0 });
          textReveal('.news-section', '.news-card h3, .news-card p', { start: 'top 66%', stagger: 0.06 });
          textReveal('.publications-section', '.publications-head h2', { start: 'top 72%', duration: 1.2, stagger: 0 });
          textReveal('.publications-section', '.publication-row h3', { start: 'top 68%', stagger: 0.08 });
          textReveal('.contact-section', '.contact-copy h2', { start: 'top 70%', duration: 1.2, stagger: 0 });
          textReveal('.contact-section', '.contact-copy p', { start: 'top 66%', stagger: 0.1 });
          textReveal('.news-article-page', '.article-title', { start: 'top 82%', duration: 1.3, stagger: 0 });
          textReveal('.news-article-page', '.article-summary, .article-body-card h2, .article-body-card p', { start: 'top 78%', stagger: 0.08 });

          // Plates scatter animation
          gsap.timeline({
            scrollTrigger: {
              trigger: '.company-section',
              start: 'top 55%',
              toggleActions: 'play none none reverse',
            }
          })
          .from('.company-plate', {
            x: (index) => [300, 300, -300, -300][index] ?? 0,
            y: (index) => [150, -150, -150, 150][index] ?? 0,
            scale: 0.2,
            autoAlpha: 0,
            duration: 1.2,
            stagger: 0.12,
            ease: 'back.out(1.2)',
            clearProps: 'transform'
          })
          .from('.company-center-model', { 
            scale: 0, 
            autoAlpha: 0, 
            duration: 1.4, 
            ease: 'elastic.out(1, 0.8)' 
          }, '-=1.0');

          gsap.to('.marquee span', {
            xPercent: -18,
            ease: 'none',
            scrollTrigger: {
              trigger: '.capability-section',
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1,
            },
          });


          const panels = gsap.utils.toArray('.what-panel');
          if (pinnedWhat) {
            gsap.set(panels, { autoAlpha: 0, y: 52, scale: 0.985 });
            gsap.set(panels[0], { autoAlpha: 1, y: 0, scale: 1 });
            gsap.set('.what-progress span', { scaleX: 0, transformOrigin: 'left center' });

            const whatTimeline = gsap.timeline({
              defaults: { ease: 'expo.out' },
              scrollTrigger: {
                trigger: '.what-section',
                start: 'top top',
                end: () => `+=${Math.max(window.innerHeight * 1.55, window.innerHeight * panels.length * 0.52)}`,
                pin: true,
                scrub: 0.62,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              },
            });

            panels.forEach((panel, index) => {
              const words = panel.querySelectorAll('.split-word');
              const nextPanel = panels[index + 1];

              whatTimeline.to('.what-progress span', {
                scaleX: (index + 1) / panels.length,
                duration: 0.48,
                ease: 'none',
              }, index === 0 ? 0 : '>');

              whatTimeline.fromTo(words, {
                autoAlpha: 0,
                y: 42,
                skewY: 3,
                filter: 'blur(10px)',
              }, {
                autoAlpha: 1,
                y: 0,
                skewY: 0,
                filter: 'blur(0px)',
                duration: 0.76,
                stagger: 0.022,
              }, '<0.03');

              whatTimeline.to(panel, { duration: nextPanel ? 0.12 : 0.04 });

              if (nextPanel) {
                whatTimeline.to(panel, {
                  autoAlpha: 0,
                  y: -38,
                  scale: 0.988,
                  duration: 0.34,
                });
                whatTimeline.to(nextPanel, {
                  autoAlpha: 1,
                  y: 0,
                  scale: 1,
                  duration: 0.34,
                }, '<0.08');
              }
            });
          } else {
            gsap.set(panels, { autoAlpha: 1, y: 0, scale: 1 });
            gsap.set('.split-word', { autoAlpha: 1, y: 0 });
            gsap.set('.what-progress span', { scaleX: 1, transformOrigin: 'left center' });
          }

          const anchorLinks = gsap.utils.toArray('a[href^="#"]');
          const handleAnchorClick = (event) => {
            const hash = event.currentTarget.getAttribute('href');
            if (hash?.startsWith('#news/')) return;

            let target = null;
            if (hash && hash.length > 1) {
              try {
                target = document.querySelector(hash);
              } catch {
                target = null;
              }
            }
            if (!target) return;

            event.preventDefault();
            ScrollTrigger.refresh();
            const targetY = target.getBoundingClientRect().top + window.scrollY;
            window.history.pushState(null, '', hash);
            window.scrollTo({ top: targetY, behavior: 'smooth' });
          };

          anchorLinks.forEach((link) => link.addEventListener('click', handleAnchorClick));

          ScrollTrigger.refresh();

          return () => {
            anchorLinks.forEach((link) => link.removeEventListener('click', handleAnchorClick));
          };
        },
      );

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [activeNews?.slug || 'home', activeContact, activeDownload, lang], revertOnUpdate: true },
  );

  return (
    <main ref={rootRef} className={`integrated-site lang-${lang}`}>
      <SiteNav lang={lang} setLang={changeLang} />
      <div className="scroll-rail" aria-hidden="true"><span className="scroll-progress" /></div>

      {activeDownload ? (
        <DownloadPage lang={lang} />
      ) : activeContact ? (
        <ContactPage lang={lang} />
      ) : activeNews ? (
        <NewsArticlePage article={activeNews} lang={lang} />
      ) : (
        <>
      <div className="main-content-wrapper">
      <section className="hero-section" id="top">
        <div className="abstract-bg" aria-hidden="true">
          <span className="ribbon ribbon-a" />
          <span className="ribbon ribbon-b" />
          <span className="orb orb-a" />
          <span className="orb orb-b" />
        </div>
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="line">{TRANSLATIONS[lang].heroTitle1}</span>
            <span className="line">{TRANSLATIONS[lang].heroTitle2}</span>
          </h1>
          <p className="hero-foot">{TRANSLATIONS[lang].heroFoot}</p>
          <div className="hero-actions">
            <a className="hero-cta outline-cta-hero" href="#download">{TRANSLATIONS[lang].downloadApp}</a>
            <a className="hero-cta" href="#platform">{TRANSLATIONS[lang].discoverPlatform} <span>→</span></a>
          </div>
        </div>
      </section>

      <section className="what-section" id="platform">
        <div className="section-kicker"><span /> {TRANSLATIONS[lang].whatWeDoKicker}</div>
        <div className="what-progress" aria-hidden="true"><span /></div>
        {whatWeDo.map((item, index) => (
          <article className="what-panel" key={item.number}>
            <div className="panel-count">{item.number} / 03</div>
            <h2>{item.text[lang].split(' ').map((word, wordIndex) => <span className="split-word" key={`${item.number}-${word}-${wordIndex}`}>{word}</span>)}</h2>
          </article>
        ))}
      </section>

      <section className="capability-section" id="modules">
        <div className="capability-grid">
          {platformCards.map((card, index) => (
            <article className={`cap-card card-${index + 1} section-card`} key={card.title[lang]}>
              <div className="cap-icon" />
              <span>{String(index + 1).padStart(2, '0')}.</span>
              <h3>{card.title[lang]}</h3>
              <p>{card.text[lang]}</p>
            </article>
          ))}
        </div>
        <div className="marquee" aria-hidden="true">
          <span>{TRANSLATIONS[lang].marquee}{TRANSLATIONS[lang].marquee}</span>
        </div>
      </section>

      <section className="company-section" id="company">
        <h2>{TRANSLATIONS[lang].companyHeader}</h2>
        <div className="company-inner">
          <div className="company-center-model">
            <Live2DAvatar expression={avatarExpression} />
          </div>

          <div 
            className="company-plate plate-top-left"
            onMouseEnter={() => setAvatarExpression('star')}
            onMouseLeave={() => setAvatarExpression('')}
          >
            <span className="section-kicker"><span /> {TRANSLATIONS[lang].plate1Kicker}</span>
            <h3>{TRANSLATIONS[lang].plate1Title}</h3>
            <p className="plate-desc">
              {TRANSLATIONS[lang].plate1Desc}
            </p>
          </div>

          <div 
            className="company-plate plate-bottom-left company-copy reveal"
            onMouseEnter={() => setAvatarExpression('note')}
            onMouseLeave={() => setAvatarExpression('')}
          >
            <span className="section-kicker"><span /> {TRANSLATIONS[lang].plate2Kicker}</span>
            <p className="plate-desc">
              {TRANSLATIONS[lang].plate2Desc}
            </p>
            <a className="dark-cta" href="#newsroom">{TRANSLATIONS[lang].plate2Cta} <span>→</span></a>
          </div>

          <div 
            className="company-plate plate-bottom-right"
            onMouseEnter={() => setAvatarExpression('heart')}
            onMouseLeave={() => setAvatarExpression('')}
          >
            <span className="section-kicker"><span /> {TRANSLATIONS[lang].plate3Kicker}</span>
            <h3>{TRANSLATIONS[lang].plate3Title}</h3>
            <p className="plate-desc">
              {TRANSLATIONS[lang].plate3Desc}
            </p>
          </div>

          <div 
            className="company-plate plate-right-outer"
            onMouseEnter={() => setAvatarExpression('XD')}
            onMouseLeave={() => setAvatarExpression('')}
          >
            <span className="section-kicker"><span /> {TRANSLATIONS[lang].plate4Kicker}</span>
            <h3>{TRANSLATIONS[lang].plate4Title}</h3>
            <p className="plate-desc">
              {TRANSLATIONS[lang].plate4Desc}
            </p>
          </div>
        </div>
      </section>

      <section className="news-section" id="newsroom">
        <div className="news-head reveal">
          <h2>{TRANSLATIONS[lang].newsTitle}</h2>
          <div className="news-filters" aria-label="News filters">
            <a className={newsFilter === 'All' ? 'active' : ''} href="#newsroom" onClick={(e) => { e.preventDefault(); setNewsFilter('All'); }}>{TRANSLATIONS[lang].newsFilterAll}</a>
            <a className={newsFilter === 'News' ? 'active' : ''} href="#newsroom" onClick={(e) => { e.preventDefault(); setNewsFilter('News'); }}>{TRANSLATIONS[lang].newsFilterNews}</a>
            <a href="#download">{lang === 'en' ? 'Download' : 'Скачать'}</a>
          </div>
        </div>
        <div className="news-grid" id="news-list">
          {releaseNews.filter(item => newsFilter === 'All' || item.tag.en === newsFilter).map((item, index) => (
            <article className={`news-card ${index === 1 || index === 3 ? 'dark' : ''}`} key={item.slug}>
              <div className="section-kicker dark"><span /> {item.tag[lang]}</div>
              <time>{item.date[lang]}</time>
              <strong>v{item.version}</strong>
              <h3>{item.title[lang]}</h3>
              <p>{item.summary[lang]}</p>
              <a href={`#news/${item.slug}`}>{TRANSLATIONS[lang].newsReadArticle} <span>→</span></a>
            </article>
          ))}
        </div>
      </section>

      <section className="publications-section" id="publications">
        <div className="publications-head reveal">
          <h2>{TRANSLATIONS[lang].pubTitle}</h2>
          <a className="outline-cta" href="#newsroom">{TRANSLATIONS[lang].pubViewAll}</a>
        </div>
        <div className="publication-list">
          {publications.map((pub) => (
            <a className="publication-row" href="#message-us" key={pub.title[lang]}>
              <h3>{pub.title[lang]}</h3>
              <time>{pub.date[lang]}</time>
              <span>→</span>
            </a>
          ))}
        </div>
      </section>
      </div>

      <footer className="footer-frame" id="footer">
        <div className="footer-bg" aria-hidden="true">
          <span className="ribbon ribbon-a" />
          <span className="ribbon ribbon-b" />
          <span className="orb orb-a" />
          <span className="orb orb-b" />
        </div>
        <div className="footer-top">
          <div className="footer-links-group">
            <strong>{TRANSLATIONS[lang].footColDownload}</strong>
            <a href="#download">{TRANSLATIONS[lang].footLinkProduct}</a>
            <a href="#docs">{TRANSLATIONS[lang].footLinkDocs}</a>
            <a href="#changelog">{TRANSLATIONS[lang].footLinkChangelog}</a>
            <a href="#press">{TRANSLATIONS[lang].footLinkPress}</a>
            <a href="#releases">{TRANSLATIONS[lang].footLinkReleases}</a>
          </div>
          <div className="footer-links-group">
            <strong>{TRANSLATIONS[lang].footColBlog}</strong>
            <a href="#pricing">{TRANSLATIONS[lang].footLinkPricing}</a>
            <a href="#use-cases">{TRANSLATIONS[lang].footLinkUseCases}</a>
          </div>
        </div>
        
        <div className="footer-word">SHKFOLDER</div>

        <div className="footer-bottom">
          <a className="footer-brand" href="#top">SHKF / 新鸿基</a>
          <div className="footer-legal">
            <a href="#about">{TRANSLATIONS[lang].footLinkAbout}</a>
            <a href="#products">{TRANSLATIONS[lang].footLinkProducts}</a>
            <a href="#privacy">{TRANSLATIONS[lang].footLinkPrivacy}</a>
            <a href="#terms">{TRANSLATIONS[lang].footLinkTerms}</a>
          </div>
        </div>
      </footer>
        </>
      )}
    </main>
  );
}

function NewsArticlePage({ article, lang = 'en' }) {
  const titleEn = article.title.en;

  const isTransport = titleEn.includes('SSE') || titleEn.includes('transport');
  const isMagnific = titleEn.includes('Magnific');
  const componentName = isTransport
    ? (lang === 'en' ? 'MCP Transport Layer' : 'Транспортный уровень MCP')
    : isMagnific
    ? (lang === 'en' ? 'Magnific Module' : 'Модуль Magnific')
    : (lang === 'en' ? 'Core System' : 'Ядро системы');

  const isFix = titleEn.includes('Fix') || titleEn.includes('fix');
  const typeName = isFix
    ? (lang === 'en' ? 'Bug Fix' : 'Исправление ошибок')
    : (lang === 'en' ? 'Feature' : 'Новая функция');

  const isCritical = titleEn.includes('SSE') || titleEn.includes('import');
  const severityName = isCritical
    ? (lang === 'en' ? 'Critical' : 'Критическая')
    : (lang === 'en' ? 'Normal' : 'Обычная');

  return (
    <article className="news-article-page" id="top">
      <div className="article-bg" aria-hidden="true">
        <span className="ribbon ribbon-a" />
        <span className="ribbon ribbon-b" />
        <span className="orb orb-a" />
      </div>
      <section className="article-hero">
        <a className="article-back article-reveal" href="#newsroom">{TRANSLATIONS[lang].articleBack}</a>
        <div className="article-kicker article-reveal"><span /> {TRANSLATIONS[lang].articleKicker} · v{article.version}</div>
        <h1 className="article-title article-reveal">{article.title[lang]}</h1>
        <p className="article-summary article-reveal">{article.summary[lang]}</p>
      </section>

      <section className="article-content">
        <aside className="article-meta-card article-reveal">
          <span>{TRANSLATIONS[lang].articlePublished}</span>
          <strong>{article.date[lang]}</strong>
          <span>{lang === 'en' ? 'App' : 'Приложение'}</span>
          <a href="#download">{lang === 'en' ? 'Download SHKF' : 'Скачать SHKF'}</a>
          <div className="article-stats">
            <div className="stat-item">
              <span className="stat-number">{article.highlights[lang].length}</span>
              <span className="stat-label">{TRANSLATIONS[lang].articleChanges}</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">1</span>
              <span className="stat-label">{TRANSLATIONS[lang].articleCommit}</span>
            </div>
          </div>
        </aside>

        <div className="article-body-card article-reveal">
          <div className="section-kicker dark"><span /> {TRANSLATIONS[lang].articleWhatChanged}</div>
          <h2>{article.commit[lang]}</h2>
          <p>
            {TRANSLATIONS[lang].articleDesc}
          </p>
          <div className="article-tech-overview">
            <h3>{TRANSLATIONS[lang].articleTechTitle}</h3>
            <div className="tech-grid">
              <div className="tech-item">
                <span>{TRANSLATIONS[lang].articleTechComp}</span>
                <strong>{componentName}</strong>
              </div>
              <div className="tech-item">
                <span>{TRANSLATIONS[lang].articleTechType}</span>
                <strong>{typeName}</strong>
              </div>
              <div className="tech-item">
                <span>{TRANSLATIONS[lang].articleTechSeverity}</span>
                <strong>{severityName}</strong>
              </div>
              <div className="tech-item">
                <span>{TRANSLATIONS[lang].articleTechVersion}</span>
                <strong>v{article.version}</strong>
              </div>
            </div>
          </div>
          <div className="article-actions">
            <a className="dark-cta" href="#download">{lang === 'en' ? 'Download App' : 'Скачать приложение'} <span>→</span></a>
          </div>
        </div>
      </section>

      <section className="article-changelog">
        <div className="changelog-inner">
          <div className="section-kicker dark"><span /> {TRANSLATIONS[lang].articleChangelog}</div>
          <div className="changelog-timeline">
            {article.highlights[lang].map((highlight, index) => (
              <div className="changelog-entry article-reveal" key={index}>
                <div className="changelog-dot" />
                <div className="changelog-content">
                  <span className="changelog-step">{lang === 'en' ? 'Step' : 'Шаг'} {index + 1}</span>
                  <p>{highlight}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="article-cta-banner">
        <div className="cta-banner-inner">
          <h2>{TRANSLATIONS[lang].articleReadyTitle}{article.version}?</h2>
          <p>{TRANSLATIONS[lang].articleReadyDesc}</p>
          <div className="cta-banner-actions">
            <a className="dark-cta" href="#download">{TRANSLATIONS[lang].articleReadyDownload} <span>→</span></a>
          </div>
        </div>
      </section>

      <section className="article-related">
        <div className="publications-head article-reveal">
          <h2>{TRANSLATIONS[lang].articleRelatedTitle}</h2>
          <a className="outline-cta" href="#newsroom">{TRANSLATIONS[lang].articleRelatedAll}</a>
        </div>
        <div className="article-related-grid">
          {releaseNews.filter((item) => item.slug !== article.slug).slice(0, 3).map((item) => (
            <a className="article-related-card article-reveal" href={`#news/${item.slug}`} key={item.slug}>
              <span>v{item.version}</span>
              <h3>{item.title[lang]}</h3>
              <time>{item.date[lang]}</time>
            </a>
          ))}
        </div>
      </section>
    </article>
  );
}

function SiteNav({ compact = false, light = false, lang = 'en', setLang } = {}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > window.innerHeight * 0.75);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const collapsed = isScrolled && !isHovered;

  return (
    <nav 
      className={`site-nav${compact ? ' compact' : ''}${light ? ' light' : ''}${collapsed ? ' collapsed' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="site-nav-inner">
        <a 
          className="logo-pill" 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            window.location.hash = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span /> SHKF / 新鸿基
        </a>
        <div className="nav-pill">
          {navItems.map((item) => (
            <a href={`#${item.id}`} key={item.id}>{item[lang]}</a>
          ))}
          <div className="lang-switcher">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'ru' ? 'active' : ''} onClick={() => setLang('ru')}>RU</button>
          </div>
          <a className="work-link" href="#download">{lang === 'en' ? 'Download App' : 'Скачать приложение'}</a>
        </div>
      </div>
    </nav>
  );
}

function ContactPage({ lang = 'en' }) {
  return (
    <div className="contact-page-wrapper">
      <section className="contact-section" id="message-us">
        <div className="contact-copy reveal">
          <h2>{TRANSLATIONS[lang].contactTitle}</h2>
          <p>{TRANSLATIONS[lang].contactSub}</p>
          <div className="contact-mail">
            <span>{TRANSLATIONS[lang].contactColGeneral}</span>
            <a href="mailto:hello@shkfolder.app">hello@shkfolder.app</a>
          </div>
          <div className="contact-mail">
            <span>{TRANSLATIONS[lang].contactColPartner}</span>
            <a href="mailto:partnering@shkfolder.app">partnering@shkfolder.app</a>
          </div>
        </div>
        <form className="contact-form reveal" onSubmit={(event) => event.preventDefault()}>
          <label className="contact-field">{TRANSLATIONS[lang].contactFieldFirst}<input type="text" name="firstName" /></label>
          <label className="contact-field">{TRANSLATIONS[lang].contactFieldLast}<input type="text" name="lastName" /></label>
          <label className="contact-field">{TRANSLATIONS[lang].contactFieldEmail}<input type="email" name="email" /></label>
          <label className="contact-field">{TRANSLATIONS[lang].contactFieldPhone}<input type="tel" name="phone" /></label>
          <label className="contact-field wide">
            {TRANSLATIONS[lang].contactFieldSubject}
            <select name="subject">
              <option>{TRANSLATIONS[lang].contactSubjectPlaceholder}</option>
              <option>{TRANSLATIONS[lang].contactSubjectDemo}</option>
              <option>{TRANSLATIONS[lang].contactSubjectPartner}</option>
              <option>{TRANSLATIONS[lang].contactSubjectPress}</option>
            </select>
          </label>
          <label className="contact-field wide">{TRANSLATIONS[lang].contactFieldMessage}<textarea name="message" /></label>
          <button className="contact-submit" type="submit">{TRANSLATIONS[lang].contactSubmit} <span>→</span></button>
        </form>
      </section>
    </div>
  );
}

function DownloadPage({ lang = 'en' }) {
  return (
    <div className="download-page-wrapper">
      <section className="download-hero" id="download">
        <video 
          className="download-video" 
          autoPlay 
          loop 
          muted 
          playsInline
          poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
        >
          <source src="https://cdn.coverr.co/videos/coverr-abstract-neon-lines-5321/1080p.mp4" type="video/mp4" />
        </video>
        <div className="download-overlay" aria-hidden="true" />
        
        <div className="download-content reveal">
          <div className="download-header">
            <h2>{TRANSLATIONS[lang].downloadTitle}</h2>
            <p>{TRANSLATIONS[lang].downloadSub}</p>
          </div>
          
          <div className="os-grid">
            <div className="os-card">
              <div className="os-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
              </div>
              <h3>{TRANSLATIONS[lang].downloadWinTitle}</h3>
              <p>{TRANSLATIONS[lang].downloadWinDesc}</p>
              <div className="os-downloads">
                <a href="#" className="download-btn">{TRANSLATIONS[lang].downloadWinBtn}</a>
                <span className="download-meta">{lang === 'en' ? 'Version 1.2.13 · 64-bit' : 'Версия 1.2.13 · 64-бит'}</span>
              </div>
            </div>

            <div className="os-card">
              <div className="os-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.142 2.685C17.07 1.572 17.652 0 17.487-1.5 16.19-1.442 14.545-.64 13.593.473c-.854.981-1.554 2.607-1.354 4.07 1.455.106 2.973-.755 3.903-1.858zM17.43 5.485c-1.921-.06-3.693 1.135-4.667 1.135-.975 0-2.457-1.076-4.048-1.045-2.073.031-3.987 1.2-5.045 3.03-2.148 3.705-.547 9.195 1.545 12.195 1.017 1.455 2.228 3.09 3.818 3.03 1.528-.06 2.115-.98 3.96-.98 1.844 0 2.37.98 3.988.95 1.648-.03 2.684-1.485 3.688-2.94 1.164-1.68 1.644-3.3 1.674-3.39-.03-.015-3.18-1.215-3.21-4.86-.03-3.06 2.505-4.53 2.624-4.62-1.44-2.115-3.66-2.4-4.327-2.49z" transform="translate(1 2)" />
                </svg>
              </div>
              <h3>{TRANSLATIONS[lang].downloadMacTitle}</h3>
              <p>{TRANSLATIONS[lang].downloadMacDesc}</p>
              <div className="os-downloads">
                <a href="#" className="download-btn">{TRANSLATIONS[lang].downloadMacBtnSilicon}</a>
                <a href="#" className="download-btn secondary">{TRANSLATIONS[lang].downloadMacBtnIntel}</a>
                <span className="download-meta">{lang === 'en' ? 'Version 1.2.13 · .dmg' : 'Версия 1.2.13 · .dmg'}</span>
              </div>
            </div>

            <div className="os-card">
              <div className="os-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.062 1.352c-2.316 0-4.041 2.226-4.041 4.973 0 .445.051.879.146 1.3-1.67.921-2.793 2.658-2.793 4.636 0 2.141 1.303 4.01 3.213 4.876-.118.847-.367 1.841-1.037 2.441-.75.674-2.227.674-2.227 2.317 0 .524.425.952.951.952h11.45c.527 0 .952-.428.952-.952 0-1.643-1.477-1.643-2.226-2.317-.67-.6-1.02-1.594-1.139-2.441 1.91-.866 3.213-2.735 3.213-4.876 0-1.978-1.123-3.715-2.793-4.636.096-.421.146-.855.146-1.3 0-2.747-1.725-4.973-4.041-4.973h.226zm-1.884 3.013c.477 0 .864.444.864.992s-.387.993-.864.993c-.478 0-.865-.445-.865-.993s.387-.992.865-.992zm4 0c.477 0 .863.444.863.992s-.386.993-.863.993c-.478 0-.865-.445-.865-.993s.387-.992.865-.992zm-2.116 11.233c1.745 0 3.16 1.341 3.16 2.996s-1.415 2.996-3.16 2.996c-1.744 0-3.16-1.341-3.16-2.996s1.416-2.996 3.16-2.996z" />
                </svg>
              </div>
              <h3>{TRANSLATIONS[lang].downloadLinuxTitle}</h3>
              <p>{TRANSLATIONS[lang].downloadLinuxDesc}</p>
              <div className="os-downloads">
                <a href="#" className="download-btn">{TRANSLATIONS[lang].downloadLinuxBtnImage}</a>
                <a href="#" className="download-btn secondary">{TRANSLATIONS[lang].downloadLinuxBtnDeb}</a>
                <span className="download-meta">{lang === 'en' ? 'Version 1.2.13 · x86_64' : 'Версия 1.2.13 · x86_64'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
