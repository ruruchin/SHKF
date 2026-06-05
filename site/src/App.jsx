import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const navItems = ['Platform', 'Company', 'Newsroom', 'Message us'];

const whatWeDo = [
  {
    number: '01',
    title: 'Figma intelligence',
    text: 'SHKFOLDER turns hotkeys, templates and team habits into a fast design operating layer for every role.',
  },
  {
    number: '02',
    title: 'Creative automation',
    text: 'By combining AI agents, image generation, task context and reusable templates, teams move from idea to shipped interface with less friction.',
  },
  {
    number: '03',
    title: 'Team memory',
    text: 'Profiles, roles, design memory and connected workspaces keep the product system understandable as the team grows.',
  },
];

const platformCards = [
  ['Figma', 'Hotkeys, command search and learning flows for designers.'],
  ['AI Agent', 'Design memory, task links and product guidance in one conversation.'],
  ['Generation', 'Magnific, NanoBanana, references, upscale and creative experiments.'],
];

const releaseNews = [
  {
    tag: 'Release',
    version: '1.2.13',
    slug: 'v1.2.13',
    date: 'June 3, 2026',
    title: 'SHKF 1.2.13: SSE transport headers for Magnific MCP',
    summary: 'GitHub release v1.2.13 ships a focused transport fix so Magnific MCP sends authorization headers through both EventSource and request layers.',
    commit: 'Fix SSE transport headers configuration, release 1.2.13.',
    compareUrl: 'https://github.com/ruruchin/SHKF/compare/v1.2.12...v1.2.13',
    releaseUrl: 'https://github.com/ruruchin/SHKF/releases/tag/v1.2.13',
    highlights: [
      'Moved authorization headers into EventSource initialization for the MCP SSE connection.',
      'Mirrored authorization headers in request initialization for more reliable server communication.',
      'Published the Windows installer and update metadata for automatic delivery.',
    ],
  },
  {
    tag: 'News',
    version: '1.2.12',
    slug: 'v1.2.12',
    date: 'June 3, 2026',
    title: 'SHKF 1.2.12: Magnific SSE URL and button polish',
    summary: 'GitHub release v1.2.12 fixes the Magnific SSE endpoint and improves the visual behavior of the Magnific submit button.',
    commit: 'Fix Magnific SSE URL and button styling, release 1.2.12.',
    compareUrl: 'https://github.com/ruruchin/SHKF/compare/v1.2.11...v1.2.12',
    releaseUrl: 'https://github.com/ruruchin/SHKF/releases/tag/v1.2.12',
    highlights: [
      'Changed the Magnific transport endpoint to use the `/sse` route.',
      'Added stable sizing rules for Magnific layout blocks.',
      'Styled submit, hover and disabled states for the Magnific action button.',
    ],
  },
  {
    tag: 'Release',
    version: '1.2.11',
    slug: 'v1.2.11',
    date: 'June 3, 2026',
    title: 'SHKF 1.2.11: Magnific tab appears in role navigation',
    summary: 'GitHub release v1.2.11 connects the Magnific page to role-based navigation so designers and full-access users can open it directly.',
    commit: 'Fix Magnific tab visibility in role nav, release 1.2.11.',
    compareUrl: 'https://github.com/ruruchin/SHKF/compare/v1.2.10...v1.2.11',
    releaseUrl: 'https://github.com/ruruchin/SHKF/releases/tag/v1.2.11',
    highlights: [
      'Added Magnific to designer and full role page sets.',
      'Connected role navigation activation to `activateMagnificPage`.',
      'Kept the release aligned with app version metadata.',
    ],
  },
  {
    tag: 'Release',
    version: '1.2.10',
    slug: 'v1.2.10',
    date: 'June 3, 2026',
    title: 'SHKF 1.2.10: EventSource import fix for Magnific MCP',
    summary: 'GitHub release v1.2.10 fixes the EventSource import used by the Magnific MCP service.',
    commit: 'Fix eventsource import in magnific-mcp-service, release 1.2.10.',
    compareUrl: 'https://github.com/ruruchin/SHKF/compare/v1.2.9...v1.2.10',
    releaseUrl: 'https://github.com/ruruchin/SHKF/releases/tag/v1.2.10',
    highlights: [
      'Switched the EventSource import to the named export expected by the package.',
      'Restored the global EventSource wiring used by the MCP SSE client.',
      'Published updated package metadata for version 1.2.10.',
    ],
  },
  {
    tag: 'Release',
    version: '1.2.9',
    slug: 'v1.2.9',
    date: 'June 3, 2026',
    title: 'SHKF 1.2.9: Magnific MCP integration arrives',
    summary: 'GitHub release v1.2.9 introduced the Magnific MCP integration and dedicated product tab.',
    commit: 'Add Magnific MCP integration with dedicated tab, release 1.2.9.',
    compareUrl: 'https://github.com/ruruchin/SHKF/compare/v1.2.8...v1.2.9',
    releaseUrl: 'https://github.com/ruruchin/SHKF/releases/tag/v1.2.9',
    highlights: [
      'Added a dedicated Magnific experience inside the desktop app.',
      'Connected the MCP service layer for generation workflows.',
      'Prepared release artifacts for the new creative automation module.',
    ],
  },
];

const publications = [
  ['Design memory for practical AI agents', 'September 4, 2026'],
  ['A unified command layer for Figma teams', 'August 14, 2026'],
  ['Explainable workflows for product operations', 'December 9, 2025'],
  ['Template systems as team acceleration', 'November 21, 2025'],
  ['Creative generation with reference-aware tooling', 'November 6, 2025'],
];

function App() {
  const rootRef = useRef(null);
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '#top' : window.location.hash || '#top'));
  const activeNews = useMemo(() => releaseNews.find((item) => `#news/${item.slug}` === hash), [hash]);
  const activeContact = hash === '#message-us';
  const activeDownload = hash === '#download';
  const [newsFilter, setNewsFilter] = useState('All');





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

          revealScene('.company-section', ['.company-media', '.company-copy .dark-cta'], { start: 'top 72%', y: 64, stagger: 0.09 });
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

          textReveal('.company-section', '.company-copy h2', { start: 'top 68%', duration: 1.2, stagger: 0 });
          textReveal('.company-section', '.company-copy .company-body p', { start: 'top 64%', stagger: 0.15 });
          textReveal('.news-section', '.news-head h2', { start: 'top 72%', duration: 1.2, stagger: 0 });
          textReveal('.news-section', '.news-card h3, .news-card p', { start: 'top 66%', stagger: 0.06 });
          textReveal('.publications-section', '.publications-head h2', { start: 'top 72%', duration: 1.2, stagger: 0 });
          textReveal('.publications-section', '.publication-row h3', { start: 'top 68%', stagger: 0.08 });
          textReveal('.contact-section', '.contact-copy h2', { start: 'top 70%', duration: 1.2, stagger: 0 });
          textReveal('.contact-section', '.contact-copy p', { start: 'top 66%', stagger: 0.1 });
          textReveal('.news-article-page', '.article-title', { start: 'top 82%', duration: 1.3, stagger: 0 });
          textReveal('.news-article-page', '.article-summary, .article-body-card h2, .article-body-card p', { start: 'top 78%', stagger: 0.08 });

          gsap.fromTo('.company-media', {
            rotationX: 45,
            rotationY: -15,
            scale: 0.8,
            z: -300,
            transformPerspective: 1000
          }, {
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            z: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: '.company-section',
              start: 'top bottom',
              end: 'center center',
              scrub: 1,
            },
          });

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
    { scope: rootRef, dependencies: [activeNews?.slug || 'home', activeContact, activeDownload], revertOnUpdate: true },
  );

  return (
    <main ref={rootRef} className="integrated-site">
      <SiteNav />
      <div className="scroll-rail" aria-hidden="true"><span className="scroll-progress" /></div>

      {activeDownload ? (
        <DownloadPage />
      ) : activeContact ? (
        <ContactPage />
      ) : activeNews ? (
        <NewsArticlePage article={activeNews} />
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
            <span className="line">Engineering the future</span>
            <span className="line">of creative workflows.</span>
          </h1>
          <p className="hero-foot">We connect Figma, AI, task memory and generation tools for teams building products faster.</p>
          <div className="hero-actions">
            <a className="hero-cta outline-cta-hero" href="#download">Download App +</a>
            <a className="hero-cta" href="#platform">Discover our platform <span>→</span></a>
          </div>
        </div>
      </section>

      <section className="what-section" id="platform">
        <div className="section-kicker"><span /> What we do</div>
        <div className="what-progress" aria-hidden="true"><span /></div>
        {whatWeDo.map((item, index) => (
          <article className="what-panel" key={item.number}>
            <div className="panel-count">{item.number} / 03</div>
            <h2>{item.text.split(' ').map((word, wordIndex) => <span className="split-word" key={`${item.number}-${word}-${wordIndex}`}>{word}</span>)}</h2>
          </article>
        ))}
      </section>

      <section className="capability-section" id="modules">
        <div className="capability-grid">
          {platformCards.map(([title, text], index) => (
            <article className={`cap-card card-${index + 1} section-card`} key={title}>
              <div className="cap-icon" />
              <span>{String(index + 1).padStart(2, '0')}.</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="marquee" aria-hidden="true">
          <span>Designing product teams — Rewriting creative operations — </span>
        </div>
      </section>

      <section className="company-section" id="company">
        <div className="company-media section-card">
          <div className="mock-window">
            <div />
            <div />
            <div />
          </div>
        </div>
        <div className="company-copy reveal">
          <h2>Bold tooling to unlock creative speed for product teams.</h2>
          <div className="company-body">
            <p>We are building a focused workspace for designers, managers and engineers who need context, assets and AI in one place.</p>
            <p>From Figma hotkeys to design memory, SHKFOLDER keeps everyday product work connected and easier to understand.</p>
          </div>
          <a className="dark-cta" href="#newsroom">Learn more about us <span>→</span></a>
        </div>
      </section>

      <section className="news-section" id="newsroom">
        <div className="news-head reveal">
          <h2>News<sup>{releaseNews.length}</sup></h2>
          <div className="news-filters" aria-label="News filters">
            <a className={newsFilter === 'All' ? 'active' : ''} href="#newsroom" onClick={(e) => { e.preventDefault(); setNewsFilter('All'); }}>All</a>
            <a className={newsFilter === 'News' ? 'active' : ''} href="#newsroom" onClick={(e) => { e.preventDefault(); setNewsFilter('News'); }}>News</a>
            <a href="https://github.com/ruruchin/SHKF/releases" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
        <div className="news-grid" id="news-list">
          {releaseNews.filter(item => newsFilter === 'All' || item.tag === newsFilter).map((item, index) => (
            <article className={`news-card ${index === 1 || index === 3 ? 'dark' : ''}`} key={item.slug}>
              <div className="section-kicker dark"><span /> {item.tag}</div>
              <time>{item.date}</time>
              <strong>v{item.version}</strong>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <a href={`#news/${item.slug}`}>Read article <span>→</span></a>
            </article>
          ))}
        </div>
        <a className="load-more" href="https://github.com/ruruchin/SHKF/releases" target="_blank" rel="noreferrer">Open all GitHub releases +</a>
      </section>

      <section className="publications-section" id="publications">
        <div className="publications-head reveal">
          <h2>Publications<sup>8</sup></h2>
          <a className="outline-cta" href="#newsroom">View all publications +</a>
        </div>
        <div className="publication-list">
          {publications.map(([title, date]) => (
            <a className="publication-row" href="#message-us" key={title}>
              <h3>{title}</h3>
              <time>{date}</time>
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
            <strong>Download</strong>
            <a href="#download">Product</a>
            <a href="#docs">Docs</a>
            <a href="#changelog">Changelog</a>
            <a href="#press">Press</a>
            <a href="#releases">Releases</a>
          </div>
          <div className="footer-links-group">
            <strong>Blog</strong>
            <a href="#pricing">Pricing</a>
            <a href="#use-cases">Use Cases</a>
          </div>
        </div>
        
        <div className="footer-word">SHKFOLDER</div>

        <div className="footer-bottom">
          <a className="footer-brand" href="#top">SHKF / 新鸿基</a>
          <div className="footer-legal">
            <a href="#about">About SHKF</a>
            <a href="#products">Products</a>
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
          </div>
        </div>
      </footer>
        </>
      )}
    </main>
  );
}

function NewsArticlePage({ article }) {
  return (
    <article className="news-article-page" id="top">
      <div className="article-bg" aria-hidden="true">
        <span className="ribbon ribbon-a" />
        <span className="ribbon ribbon-b" />
        <span className="orb orb-a" />
      </div>
      <section className="article-hero">
        <a className="article-back article-reveal" href="#newsroom">← Back to newsroom</a>
        <div className="article-kicker article-reveal"><span /> GitHub release · v{article.version}</div>
        <h1 className="article-title article-reveal">{article.title}</h1>
        <p className="article-summary article-reveal">{article.summary}</p>
      </section>

      <section className="article-content">
        <aside className="article-meta-card article-reveal">
          <span>Published</span>
          <strong>{article.date}</strong>
          <span>Source</span>
          <a href={article.releaseUrl} target="_blank" rel="noreferrer">GitHub release</a>
          <span>Diff</span>
          <a href={article.compareUrl} target="_blank" rel="noreferrer">Compare tags</a>
          <div className="article-stats">
            <div className="stat-item">
              <span className="stat-number">{article.highlights.length}</span>
              <span className="stat-label">Changes</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">1</span>
              <span className="stat-label">Commit</span>
            </div>
          </div>
        </aside>

        <div className="article-body-card article-reveal">
          <div className="section-kicker dark"><span /> What changed</div>
          <h2>{article.commit}</h2>
          <p>
            This news page is generated from the public GitHub release and compare data for SHKF.
            The release notes on GitHub do not include a long body yet, so the site presents the version,
            commit message and changed areas in a clean product-news format.
          </p>
          <div className="article-tech-overview">
            <h3>Technical overview</h3>
            <div className="tech-grid">
              <div className="tech-item">
                <span>Component</span>
                <strong>{article.title.includes('SSE') || article.title.includes('transport') ? 'MCP Transport Layer' : article.title.includes('Magnific') ? 'Magnific Module' : 'Core System'}</strong>
              </div>
              <div className="tech-item">
                <span>Type</span>
                <strong>{article.title.includes('Fix') || article.title.includes('fix') ? 'Bug Fix' : 'Feature'}</strong>
              </div>
              <div className="tech-item">
                <span>Severity</span>
                <strong>{article.title.includes('SSE') || article.title.includes('import') ? 'Critical' : 'Normal'}</strong>
              </div>
              <div className="tech-item">
                <span>Version</span>
                <strong>v{article.version}</strong>
              </div>
            </div>
          </div>
          <div className="article-actions">
            <a className="dark-cta" href={article.releaseUrl} target="_blank" rel="noreferrer">Open release <span>→</span></a>
            <a className="outline-cta" href={article.compareUrl} target="_blank" rel="noreferrer">View code changes +</a>
          </div>
        </div>
      </section>

      <section className="article-changelog">
        <div className="changelog-inner">
          <div className="section-kicker dark"><span /> Changelog</div>
          <div className="changelog-timeline">
            {article.highlights.map((highlight, index) => (
              <div className="changelog-entry article-reveal" key={index}>
                <div className="changelog-dot" />
                <div className="changelog-content">
                  <span className="changelog-step">Step {index + 1}</span>
                  <p>{highlight}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="article-cta-banner">
        <div className="cta-banner-inner">
          <h2>Ready to try v{article.version}?</h2>
          <p>Download the latest release from GitHub or update your existing installation automatically.</p>
          <div className="cta-banner-actions">
            <a className="dark-cta" href={article.releaseUrl} target="_blank" rel="noreferrer">Download release <span>→</span></a>
            <a className="outline-cta" href="https://github.com/ruruchin/SHKF" target="_blank" rel="noreferrer">View repository +</a>
          </div>
        </div>
      </section>

      <section className="article-related">
        <div className="publications-head article-reveal">
          <h2>More versions<sup>{releaseNews.length}</sup></h2>
          <a className="outline-cta" href="#newsroom">All news +</a>
        </div>
        <div className="article-related-grid">
          {releaseNews.filter((item) => item.slug !== article.slug).slice(0, 3).map((item) => (
            <a className="article-related-card article-reveal" href={`#news/${item.slug}`} key={item.slug}>
              <span>v{item.version}</span>
              <h3>{item.title}</h3>
              <time>{item.date}</time>
            </a>
          ))}
        </div>
      </section>
    </article>
  );
}

function SiteNav({ compact = false, light = false } = {}) {
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
            <a href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} key={item}>{item}</a>
          ))}
          <a className="work-link" href="#download">Download App</a>
        </div>
      </div>
    </nav>
  );
}

function ContactPage() {
  return (
    <div className="contact-page-wrapper">
      <section className="contact-section" id="message-us">
        <div className="contact-copy reveal">
          <h2>Message us</h2>
          <p>We would love to hear from you — send us a message and we’ll be in touch soon.</p>
          <div className="contact-mail">
            <span>General contact</span>
            <a href="mailto:hello@shkfolder.app">hello@shkfolder.app</a>
          </div>
          <div className="contact-mail">
            <span>Partnerships</span>
            <a href="mailto:partnering@shkfolder.app">partnering@shkfolder.app</a>
          </div>
        </div>
        <form className="contact-form reveal" onSubmit={(event) => event.preventDefault()}>
          <label className="contact-field">First name*<input type="text" name="firstName" /></label>
          <label className="contact-field">Last name*<input type="text" name="lastName" /></label>
          <label className="contact-field">Email*<input type="email" name="email" /></label>
          <label className="contact-field">Phone*<input type="tel" name="phone" /></label>
          <label className="contact-field wide">Subject*<select name="subject"><option>Select Subject</option><option>Product demo</option><option>Partnership</option><option>Press</option></select></label>
          <label className="contact-field wide">Message*<textarea name="message" /></label>
          <button className="contact-submit" type="submit">Submit message <span>→</span></button>
        </form>
      </section>
    </div>
  );
}

function DownloadPage() {
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
            <h2>Download SHKFOLDER</h2>
            <p>Get the desktop app for your operating system and start engineering your creative workflow.</p>
          </div>
          
          <div className="os-grid">
            <div className="os-card">
              <div className="os-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
              </div>
              <h3>Windows</h3>
              <p>Windows 10 and 11</p>
              <div className="os-downloads">
                <a href="#" className="download-btn">Download .exe</a>
                <span className="download-meta">Version 1.2.13 · 64-bit</span>
              </div>
            </div>

            <div className="os-card">
              <div className="os-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.142 2.685C17.07 1.572 17.652 0 17.487-1.5 16.19-1.442 14.545-.64 13.593.473c-.854.981-1.554 2.607-1.354 4.07 1.455.106 2.973-.755 3.903-1.858zM17.43 5.485c-1.921-.06-3.693 1.135-4.667 1.135-.975 0-2.457-1.076-4.048-1.045-2.073.031-3.987 1.2-5.045 3.03-2.148 3.705-.547 9.195 1.545 12.195 1.017 1.455 2.228 3.09 3.818 3.03 1.528-.06 2.115-.98 3.96-.98 1.844 0 2.37.98 3.988.95 1.648-.03 2.684-1.485 3.688-2.94 1.164-1.68 1.644-3.3 1.674-3.39-.03-.015-3.18-1.215-3.21-4.86-.03-3.06 2.505-4.53 2.624-4.62-1.44-2.115-3.66-2.4-4.327-2.49z" transform="translate(1 2)" />
                </svg>
              </div>
              <h3>macOS</h3>
              <p>macOS 12.0 or later</p>
              <div className="os-downloads">
                <a href="#" className="download-btn">Download Apple Silicon</a>
                <a href="#" className="download-btn secondary">Download Intel</a>
                <span className="download-meta">Version 1.2.13 · .dmg</span>
              </div>
            </div>

            <div className="os-card">
              <div className="os-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.062 1.352c-2.316 0-4.041 2.226-4.041 4.973 0 .445.051.879.146 1.3-1.67.921-2.793 2.658-2.793 4.636 0 2.141 1.303 4.01 3.213 4.876-.118.847-.367 1.841-1.037 2.441-.75.674-2.227.674-2.227 2.317 0 .524.425.952.951.952h11.45c.527 0 .952-.428.952-.952 0-1.643-1.477-1.643-2.226-2.317-.67-.6-1.02-1.594-1.139-2.441 1.91-.866 3.213-2.735 3.213-4.876 0-1.978-1.123-3.715-2.793-4.636.096-.421.146-.855.146-1.3 0-2.747-1.725-4.973-4.041-4.973h.226zm-1.884 3.013c.477 0 .864.444.864.992s-.387.993-.864.993c-.478 0-.865-.445-.865-.993s.387-.992.865-.992zm4 0c.477 0 .863.444.863.992s-.386.993-.863.993c-.478 0-.865-.445-.865-.993s.387-.992.865-.992zm-2.116 11.233c1.745 0 3.16 1.341 3.16 2.996s-1.415 2.996-3.16 2.996c-1.744 0-3.16-1.341-3.16-2.996s1.416-2.996 3.16-2.996z" />
                </svg>
              </div>
              <h3>Linux</h3>
              <p>Ubuntu, Debian, Fedora</p>
              <div className="os-downloads">
                <a href="#" className="download-btn">Download .AppImage</a>
                <a href="#" className="download-btn secondary">Download .deb</a>
                <span className="download-meta">Version 1.2.13 · x86_64</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
