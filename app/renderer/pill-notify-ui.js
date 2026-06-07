/**
 * Shared notification UI — compact pills in-app, glass cards on desktop overlay.
 */
(function (root) {
  const ICONS = {
    spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z"/><path d="M5 3v3M19 18v3M3 19h3M18 5h3"/></svg>`,
    kanban: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9h2M14 9h2M8 13h2M14 13h2"/></svg>`,
    agent: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/></svg>`,
    redmine: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h14"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`,
    ok: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`,
  };

  const BADGE_BY_ICON = {
    kanban: 'Канбан',
    agent: 'Konstancia',
    redmine: 'Redmine',
    spark: 'SHKF',
    ok: 'SHKF',
    error: 'SHKF',
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }

  function normalizeTags(payload = {}, icon = 'spark') {
    if (Array.isArray(payload.tags) && payload.tags.length) {
      return payload.tags.map((tag) => {
        if (typeof tag === 'string') return { label: tag, variant: 'outline' };
        return {
          label: String(tag.label || '').trim(),
          variant: tag.variant === 'solid' ? 'solid' : 'outline',
        };
      }).filter((tag) => tag.label);
    }
    const tags = [];
    const primary = String(payload.badge || BADGE_BY_ICON[icon] || '').trim();
    const secondary = String(payload.tag || '').trim();
    if (primary) tags.push({ label: primary, variant: 'solid' });
    if (secondary) tags.push({ label: secondary, variant: 'outline' });
    return tags;
  }

  function renderTags(tags) {
    if (!tags.length) return '';
    return `<span class="pill-notify__tags">${tags.map((tag) => (
      `<span class="pill-notify__tag pill-notify__tag--${tag.variant === 'solid' ? 'solid' : 'outline'}">${escapeHtml(tag.label)}</span>`
    )).join('')}</span>`;
  }

  function renderThumb({ imageUrl, iconSvg }) {
    if (imageUrl) {
      return `<span class="pill-notify__thumb"><img src="${escapeAttr(imageUrl)}" alt="" decoding="async" /></span>`;
    }
    return `<span class="pill-notify__thumb pill-notify__thumb--icon" aria-hidden="true">${iconSvg}</span>`;
  }

  function isOverlayStack(stack) {
    return stack?.classList.contains('pill-notify-stack--overlay');
  }

  function removePill(pill) {
    if (!pill || pill.dataset.leaving === '1') return;
    pill.dataset.leaving = '1';
    pill.classList.remove('is-visible');
    pill.classList.add('is-leaving');
    const timer = pill.dataset.timer;
    if (timer) clearTimeout(Number(timer));
    const stack = pill.parentElement;
    setTimeout(() => {
      pill.remove();
      resizeOverlayIfNeeded(stack);
      if (isOverlayStack(stack) && stack && !stack.children.length) {
        root.pillNotifyOverlayHide?.();
      }
    }, 280);
  }

  function resizeOverlayIfNeeded(stack) {
    if (!isOverlayStack(stack)) return;
    const h = Math.max(88, stack.scrollHeight + 4);
    root.pillNotifyOverlayResize?.(h);
  }

  function buildCardHtml({
    title,
    subtitle,
    meta,
    body,
    tags,
    imageUrl,
    iconSvg,
    durationMs,
  }) {
    const text = body || subtitle;
    return `
      <span class="pill-notify__main">
        ${renderTags(tags)}
        <span class="pill-notify__title">${escapeHtml(title)}</span>
        ${meta ? `<span class="pill-notify__meta">${escapeHtml(meta)}</span>` : ''}
        ${text ? `<span class="pill-notify__body">${escapeHtml(text)}</span>` : ''}
      </span>
      ${renderThumb({ imageUrl, iconSvg })}
      ${durationMs > 0 ? `<span class="pill-notify__progress" aria-hidden="true"><i style="animation-duration:${durationMs}ms"></i></span>` : ''}`;
  }

  function buildPillHtml({ title, subtitle, iconSvg, durationMs }) {
    return `
      <span class="pill-notify__icon">${iconSvg}</span>
      <span class="pill-notify__text">
        <span class="pill-notify__title">${escapeHtml(title)}</span>
        ${subtitle ? `<span class="pill-notify__subtitle">${escapeHtml(subtitle)}</span>` : ''}
      </span>
      ${durationMs > 0 ? `<span class="pill-notify__progress" aria-hidden="true"><i style="animation-duration:${durationMs}ms"></i></span>` : ''}`;
  }

  function showPill(stack, {
    id = '',
    title = '',
    subtitle = '',
    body = '',
    meta = '',
    badge = '',
    tag = '',
    tags = null,
    imageUrl = '',
    thumbUrl = '',
    icon = 'spark',
    durationMs = 12000,
    action = null,
    onClick = null,
  } = {}) {
    if (!stack) return null;

    const overlay = isOverlayStack(stack);
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pill-notify';
    if (overlay) pill.classList.add('pill-notify--card');
    if (durationMs > 0) pill.classList.add('pill-notify--timed');
    if (id) pill.dataset.pillId = id;
    if (action) pill.dataset.pillAction = JSON.stringify(action);

    const iconSvg = ICONS[icon] || ICONS.spark;
    const normalizedTags = normalizeTags({ badge, tag, tags }, icon);
    const image = String(thumbUrl || imageUrl || '').trim();

    pill.innerHTML = overlay
      ? buildCardHtml({
        title,
        subtitle,
        meta,
        body,
        tags: normalizedTags,
        imageUrl: image,
        iconSvg,
        durationMs,
      })
      : buildPillHtml({ title, subtitle, iconSvg, durationMs });

    pill.addEventListener('click', () => {
      if (typeof onClick === 'function') onClick(pill);
      else removePill(pill);
    });

    stack.prepend(pill);
    while (stack.children.length > 4) {
      removePill(stack.lastElementChild);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => pill.classList.add('is-visible'));
    });

    if (durationMs > 0) {
      pill.dataset.timer = String(setTimeout(() => removePill(pill), durationMs));
    }

    resizeOverlayIfNeeded(stack);
    pill.addEventListener('transitionend', () => resizeOverlayIfNeeded(stack));
    return pill;
  }

  root.PillNotifyUI = {
    ICONS,
    showPill,
    removePill,
    escapeHtml,
  };
})(typeof window !== 'undefined' ? window : globalThis);
