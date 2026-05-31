/** Детальные промпты для Figma Make — FIRURU Studio design system */
window.MAKE_STARTER_PROMPTS = {
  onboard: `Создай mobile onboarding flow для приложения FIRURU. Фрейм iPhone 390×844, 4 отдельных экрана в едином стиле Studio. Каждый экран — отдельный frame с именем «01 Welcome», «02 Permissions», «03 Profile», «04 Success».

=== Дизайн-система FIRURU Studio (строго соблюдать) ===
Фон экранов: #FAFAF8. Основной текст: #1C1C1E. Muted текст: rgba(28,28,30,0.55). Акцент primary: #F97316 (pill-кнопки, active dots). Secondary ghost: border 1px rgba(28,28,30,0.12), фон transparent. Шрифт Inter. H1: 28–32px bold, line-height 1.15. Body: 15–16px regular. Caption/hint: 13px muted. Padding контента: 24px horizontal, safe area top 56px, bottom 34px. Gap между блоками: 16px. Radius карточек: 16px. Radius кнопок: 999px (full pill). Radius inputs: 12px. Высота primary CTA: 52px.

=== Экран 1 — Welcome ===
Status bar placeholder сверху. Центр: круг 120px с gradient fill #F97316 → #FDBA74 (не stock illustration). Под ним H1 «Добро пожаловать в FIRURU». Subtitle 2 строки, max-width 300px, centered, muted. Step indicator: row из 4 dots 8px, gap 8px, первый filled #F97316, остальные #E5E5EA. Sticky bottom bar с padding 24px: full-width pill button «Начать» orange #F97316, white text 16px semibold.

=== Экран 2 — Permissions ===
Icon bell 24px в soft circle 56px bg rgba(249,115,22,0.12). Title «Разрешите уведомления». 2 benefit rows: каждая row = icon 20px + title 15px semibold + subtitle 13px muted, gap 12px, padding 16px, white card radius 12px. Bottom row: text link «Пропустить» слева muted + primary «Продолжить» справа (или stacked на узком).

=== Экран 3 — Profile ===
Avatar placeholder 72px circle с dashed border 2px rgba(28,28,30,0.2), label «Добавить фото» 12px внутри. 2 поля формы: Label 13px semibold + Input white height 48px border rgba(28,28,30,0.1) — «Имя», «Email». Hint под email 13px muted. Primary «Завершить» внизу disabled state показать серым #D1D5DB.

=== Экран 4 — Success ===
Checkmark icon в circle 64px bg #DCFCE7, icon #16A34A 28px. Title «Готово!» 28px. Subtext 15px muted 2 строки. Primary «Перейти в приложение» orange pill.

=== Запрещено ===
Generic purple/blue AI gradient hero. Material Design default cards. Emoji как иконки. Roboto/system default без Inter. Один экран вместо четырёх. Cartoon mascots. Auto layout на всех контейнерах, hug contents где нужно.`,

  dash: `Создай analytics dashboard для FIRURU Studio. Desktop frame 1440×900, production UI — не wireframe, не placeholder lorem ipsum blocks.

=== Layout ===
Fixed sidebar слева 248px, фон #1C1C1E. Main area справа фон #F5F4F0, padding 32px, vertical scroll. Sidebar и main — separate auto-layout frames.

=== Sidebar (dark) ===
Top: logo mark 32px + wordmark «FIRURU» white 16px semibold, padding 24px. Nav list gap 4px: Dashboard (active — bg rgba(255,255,255,0.08), orange left bar 3px #F97316, icon+label white), Analytics, Projects, Team, Settings — inactive rgba(255,255,255,0.65). Item height 44px, radius 10px, icon 20px outline style, label 14px medium. Bottom: user row avatar 32px + name + chevron.

=== Topbar main ===
Row space-between: breadcrumb «Overview / Analytics» 14px, second part muted. Right cluster: search input 280×40 white radius 12px placeholder «Search…», date chip «Last 30 days» border subtle, bell icon 20px, avatar 36px circle.

=== KPI row — 4 cards ===
White cards radius 16px, padding 20px, shadow 0 1px 3px rgba(28,28,30,0.06), equal width, gap 16px. Каждая: label 13px muted uppercase tracking, value 28px bold #1C1C1E, delta chip pill — (1) Revenue $128.4k +12.3% bg #DCFCE7 text #16A34A (2) Active users 8,942 +4.1% green (3) Conversion 3.8% -0.4% bg #FEE2E2 text #DC2626 (4) Churn 1.2% neutral. Mini sparkline 48px height внизу каждой карточки — orange/gray stroke 2px, не random bars.

=== Chart card ===
White card full width, padding 24px. Header row: «Revenue trend» 18px semibold + legend dots New #F97316 / Returning #94A3B8. Chart area 320px height: area chart с grid lines rgba(28,28,30,0.06), Y-axis labels 12px muted, X-axis Jan–Dec. Tooltip style hint optional.

=== Table card ===
Header «Recent customers» + link «View all» orange 14px. Table: columns Customer (avatar 28px + name), Plan, Status badge pill, MRR right-aligned, Updated muted. 5 data rows, header row 12px semibold uppercase muted, row height 52px, zebra alternate #FAFAF8. Status badges: Active mint #D1FAE5/#065F46, Trial sky #E0F2FE/#0369A1, Churned slate #F1F5F9/#64748B.

=== Запрещено ===
Generic admin template с синим sidebar. Neon colors. 3D charts. Empty gray rectangles без данных. Comic icons. Default Bootstrap table.`,

  land: `Создай marketing landing page SaaS «FIRURU Studio». Desktop 1440px width, premium minimal B2B — как Linear/Notion tier, не generic startup.

=== Navbar sticky 72px ===
Background white 80% + backdrop blur. Logo FIRURU слева. Nav links center: Product, Features, Pricing, Docs — 14px medium #1C1C1E, gap 32px. Right: ghost «Sign in» + primary pill «Start free» #F97316. Border bottom 1px rgba(28,28,30,0.06).

=== Hero 120px vertical padding ===
2-column grid. Left: eyebrow pill «Design ops for teams» orange tint bg. H1 56px bold tracking -0.02em «Ship interfaces 10× faster». Sub 20px muted max-width 480px line-height 1.5. Button row: primary orange 48px + secondary outline 48px. Trust line 14px muted «Used by 2,000+ product teams» + 4 small avatar circles overlap.

Right: browser chrome mockup frame radius 12px shadow-lg — внутри abstract dashboard UI preview (sidebar dark + cards), НЕ stock photo people, НЕ purple gradient blob.

=== Logos strip ===
Caption «Trusted by product teams» 13px muted centered. Row 5 grayscale logo placeholders 100×32 muted #CBD5E1 rectangles с company names as text.

=== Features 3 columns gap 32px ===
Section title «Everything you need» 36px centered. Cards: icon 40px in soft orange circle bg rgba(249,115,22,0.12), title 18px semibold, desc 15px muted 3 lines — Speed / Design system / Figma sync. White cards padding 24px radius 16px border subtle.

=== Pricing bg #F0EFEB ===
3 cards Starter $0 / Pro $29 (highlighted — border 2px #F97316, scale visual, badge «Popular» orange pill top) / Team $79. Each: plan name, price 48px bold, period /month muted, 5 checkmark bullets 14px, CTA full-width — outline on side cards, orange fill on Pro.

=== FAQ ===
Single column max-width 720px, 6 accordion items — question 16px semibold, chevron right, answer 15px muted hidden state shown on one open item.

=== Footer #1C1C1E ===
4 columns links Product/Company/Resources/Legal, bottom bar copyright + social icons outline.

=== Палитра ===
Shell #E8E6E1, panels #FFFFFF, ink #1C1C1E, accent #F97316 only. Много whitespace 80–120px section gaps.

=== Запрещено ===
Purple-pink gradient hero. «Get started for free» only CTA. Stock photos. Illustration of rocket. Intercom-style chat bubble.`,

  modal: `Создай destructive confirmation modal — компонент FIRURU Studio. Canvas 800×600: dimmed app shell на фоне + centered dialog по центру.

=== Фон приложения (context) ===
Упрощённый app preview: topbar + sidebar hint + content area серый #F5F4F0 — чтобы modal был in-context, не на пустом canvas.

=== Overlay ===
Full canvas overlay rgba(28,28,30,0.48), optional backdrop blur 8px. Кликабельная область вокруг modal (не показывать second modal).

=== Dialog card ===
White, width 420px, radius 20px, padding 24px, shadow 0 24px 64px rgba(28,28,30,0.18). Auto layout vertical gap 16px.

Header: warning icon 48px — circle fill #FEE2E2, icon #DC2626 24px (SVG-style triangle exclamation, НЕ emoji ⚠️).

Title 20px semibold #1C1C1E «Удалить проект «Marketing Q4»?» — project name in quotes semibold.

Body 15px muted line-height 1.5, 2–3 строки: необратимость, потеря файлов и комментариев, невозможность восстановления.

Checkbox row: square 18px border + label 14px «Я понимаю, что восстановить проект будет нельзя» — unchecked state.

Footer buttons gap 12px horizontal (desktop): Secondary «Отмена» — ghost height 44px padding 16px 20px border rgba(28,28,30,0.12). Destructive «Удалить проект» — bg #DC2626 white text 44px, НЕ синий primary.

Показать focus ring 2px #F97316 offset 2px на destructive button (accessibility state).

=== Mobile variant (optional second frame 390px) ===
Stack buttons vertical full-width, dialog width 340px margin 24px.

=== Запрещено ===
Browser native alert(). Material blue primary button. Generic «Are you sure?» без контекста. Purple modal. System font. Emoji warning. Single OK button without cancel.`,
};

window.MAKE_SUGGESTION_KEYS = ['onboard', 'dash', 'land', 'modal'];
