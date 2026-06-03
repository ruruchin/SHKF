import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const navItems = ['Platform', 'Company', 'Newsroom'];

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
    title: 'FIRURU 1.2.13: SSE transport headers for Magnific MCP',
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
    tag: 'Release',
    version: '1.2.12',
    slug: 'v1.2.12',
    date: 'June 3, 2026',
    title: 'FIRURU 1.2.12: Magnific SSE URL and button polish',
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
    title: 'FIRURU 1.2.11: Magnific tab appears in role navigation',
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
    title: 'FIRURU 1.2.10: EventSource import fix for Magnific MCP',
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
    title: 'FIRURU 1.2.9: Magnific MCP integration arrives',
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
    if (activeNews || !hash || hash === '#top' || hash.startsWith('#news/')) return;

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
                start: 'top 78%',
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

          revealScene('.company-section', ['.company-media', '.company-copy h2', '.company-copy .company-body p', '.company-copy .dark-cta'], { start: 'top 72%', y: 64, stagger: 0.09 });
          revealScene('.news-section', ['.news-head h2', '.news-filters a', '.news-card', '.load-more'], { start: 'top 76%', y: 82, stagger: 0.055 });
          revealScene('.publications-section', ['.publications-head h2', '.outline-cta', '.publication-row'], { start: 'top 76%', y: 64, stagger: 0.06 });
          revealScene('.contact-section', ['.contact-copy h2', '.contact-copy p', '.contact-mail', '.contact-field', '.contact-submit'], { start: 'top 72%', y: 68, stagger: 0.055 });
          revealScene('.news-article-page', ['.article-kicker', '.article-title', '.article-summary', '.article-meta-card', '.article-body-card', '.article-related-card'], { start: 'top 86%', y: 72, stagger: 0.07 });

          gsap.to('.company-media', {
            y: desktop ? -84 : -28,
            scale: desktop ? 1.04 : 1.01,
            ease: 'none',
            scrollTrigger: {
              trigger: '.company-section',
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.2,
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

          gsap.fromTo('.footer-frame', {
            yPercent: 18,
          }, {
            yPercent: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: '.footer-frame',
              start: 'top bottom',
              end: 'top 38%',
              scrub: 0.8,
              invalidateOnRefresh: true,
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
    { scope: rootRef, dependencies: [activeNews?.slug || 'home'], revertOnUpdate: true },
  );

  return (
    <main ref={rootRef} className="integrated-site">
      <SiteNav />
      <div className="scroll-rail" aria-hidden="true"><span className="scroll-progress" /></div>

      {activeNews ? (
        <NewsArticlePage article={activeNews} />
      ) : (
        <>
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
          <a className="hero-cta" href="#platform">Discover our platform <span>→</span></a>
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
        <div className="section-kicker dark"><span /> Our company</div>
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
            <a className="active" href="#newsroom">All</a>
            <a href="#newsroom">News</a>
            <a href="https://github.com/ruruchin/SHKF/releases" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
        <div className="news-grid" id="news-list">
          {releaseNews.map((item, index) => (
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
            <a className="publication-row" href="#contact" key={title}>
              <h3>{title}</h3>
              <time>{date}</time>
              <span>→</span>
            </a>
          ))}
        </div>
      </section>

      <section className="contact-section" id="contact">
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

      <footer className="footer-frame" id="footer">
        <div className="footer-bg" aria-hidden="true">
          <span className="ribbon ribbon-a" />
          <span className="ribbon ribbon-b" />
        </div>
        <div className="footer-top">
          <h2>We are advancing creative workflows for Figma teams.</h2>
          <a className="hero-cta" href="#contact">Work with us <span>→</span></a>
        </div>
        <div className="footer-links">
          <div>
            <strong>Navigate</strong>
            <a href="#platform">Platform</a>
            <a href="#company">Company</a>
            <a href="#newsroom">Newsroom</a>
            <a href="#contact">Work with us</a>
          </div>
          <div>
            <strong>Connect</strong>
            <a href="https://github.com/ruruchin/SHKF" target="_blank" rel="noreferrer">GitHub</a>
            <a href="#platform">Figma</a>
          </div>
        </div>
        <div className="footer-word">SHKFOLDER</div>
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
        </aside>

        <div className="article-body-card article-reveal">
          <div className="section-kicker dark"><span /> What changed</div>
          <h2>{article.commit}</h2>
          <p>
            This news page is generated from the public GitHub release and compare data for SHKF.
            The release notes on GitHub do not include a long body yet, so the site presents the version,
            commit message and changed areas in a clean product-news format.
          </p>
          <ul>
            {article.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
          </ul>
          <div className="article-actions">
            <a className="dark-cta" href={article.releaseUrl} target="_blank" rel="noreferrer">Open release <span>→</span></a>
            <a className="outline-cta" href={article.compareUrl} target="_blank" rel="noreferrer">View code changes +</a>
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
  return (
    <nav className={`site-nav${compact ? ' compact' : ''}${light ? ' light' : ''}`}>
      <div className="site-nav-inner">
        <a className="logo-pill" href="#top"><span /> SHKFOLDER</a>
        <div className="nav-pill">
          {navItems.map((item) => (
            <a href={`#${item.toLowerCase()}`} key={item}>{item}</a>
          ))}
          <a className="work-link" href="#contact">Work with us</a>
        </div>
      </div>
    </nav>
  );
}

export default App;
