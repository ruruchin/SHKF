function initOnboarding(config) {
  if (config?.onboardingCompleted) return;

  const overlay = document.getElementById('onboarding');
  if (!overlay) return;

  const slides = [...overlay.querySelectorAll('.ob-slide')];
  const progressFill = document.getElementById('ob-progress-fill');
  const stepCounter = document.getElementById('ob-step-counter');
  const nextBtn = document.getElementById('ob-next');
  const backBtn = document.getElementById('ob-back');
  const skipBtn = document.getElementById('onboarding-skip');
  let step = 0;
  let animating = false;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function updateChrome() {
    const total = slides.length;
    const pct = ((step + 1) / total) * 100;
    if (progressFill) progressFill.style.width = pct + '%';
    if (stepCounter) {
      stepCounter.innerHTML = `<span>${pad(step + 1)}</span> / ${pad(total)}`;
    }
    backBtn?.classList.toggle('hidden', step === 0);
    if (nextBtn) {
      nextBtn.textContent = step === total - 1 ? 'Начать работу' : 'Далее';
    }
  }

  function goTo(n, direction = 1) {
    if (animating || n === step || n < 0 || n >= slides.length) return;
    animating = true;

    const prev = slides[step];
    const next = slides[n];

    prev.classList.remove('active', 'entering');
    prev.classList.add('exiting');

    setTimeout(() => {
      prev.classList.remove('exiting');
      slides.forEach((s) => s.classList.remove('active', 'entering'));

      step = n;
      next.classList.add('active', 'entering');
      updateChrome();

      setTimeout(() => {
        next.classList.remove('entering');
        animating = false;
      }, 550);
    }, direction > 0 ? 280 : 200);
  }

  async function finish() {
    overlay.style.animation = 'obShellIn 0.4s ease reverse forwards';
    setTimeout(() => overlay.classList.add('hidden'), 350);
    try {
      await window.api.completeOnboarding();
    } catch {
      /* ignore */
    }
  }

  nextBtn?.addEventListener('click', () => {
    if (step < slides.length - 1) goTo(step + 1, 1);
    else finish();
  });

  backBtn?.addEventListener('click', () => {
    if (step > 0) goTo(step - 1, -1);
  });

  skipBtn?.addEventListener('click', finish);

  document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      if (step < slides.length - 1) goTo(step + 1, 1);
      else finish();
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (step > 0) goTo(step - 1, -1);
    }
    if (e.key === 'Escape') finish();
  });

  overlay.classList.remove('hidden');
  slides.forEach((s, i) => s.classList.toggle('active', i === 0));
  updateChrome();
}

window.initOnboarding = initOnboarding;
