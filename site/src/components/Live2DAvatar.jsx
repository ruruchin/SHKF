import React, { useEffect, useRef, useState } from 'react';

export default function Live2DAvatar({ expression = '' }) {
  const containerRef = useRef(null);
  const modelRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let app = null;
    let model = null;
    let canvas = null;
    let isDestroyed = false;
    let handleGlobalMouseMove = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const waitForStageSize = async (container, maxFrames = 60) => {
      for (let i = 0; i < maxFrames; i += 1) {
        if (isDestroyed) return false;
        if (container.clientWidth >= 48 && container.clientHeight >= 48) return true;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return container.clientWidth > 0 && container.clientHeight > 0;
    };

    const init = async () => {
      setError('');
      setLoading(true);
      const PIXI = window.PIXI;
      if (!PIXI) {
        setError('PIXI.js не загружен');
        setLoading(false);
        return;
      }

      const live2d = PIXI.live2d;
      const Live2DModel = live2d?.Live2DModel;
      if (!Live2DModel) {
        setError('Cubism SDK не загружен');
        setLoading(false);
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      await waitForStageSize(container);
      if (isDestroyed) return;

      try {
        live2d.startUpCubism4?.({ logFunction: () => {} });
        Live2DModel.registerTicker(PIXI.Ticker);
      } catch (err) {
        console.warn('[live2d] Init Cubism error:', err);
      }

      canvas = document.createElement('canvas');
      canvas.className = 'live2d-avatar-canvas';
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.cursor = 'grab';
      container.appendChild(canvas);

      const w = container.clientWidth || 480;
      const h = container.clientHeight || 640;

      try {
        app = new PIXI.Application({
          view: canvas,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          width: w,
          height: h,
        });

        if (app && !app.cancelResize) {
          app.cancelResize = () => {};
        }

        model = await Live2DModel.from('/live2d-model/ulvm2_0001.model3.json');
        modelRef.current = model;
        
        if (isDestroyed) {
          modelRef.current = null;
          try {
            app.destroy(true, { children: true });
          } catch {}
          canvas.remove();
          return;
        }

        app.stage.addChild(model);
        if (!isDestroyed) {
          setLoading(false);
        }

        if (expression) {
          try {
            model.expression(expression);
          } catch (err) {
            console.warn('[live2d] Init expression error:', err);
          }
        }

        // Apply T-shirt costume and manual cursor tracking in the update loop
        if (model.internalModel) {
          const im = model.internalModel;
          const originalUpdate = im.update.bind(im);
          im.update = function costumeAwareUpdate(m, now) {
            originalUpdate(m, now);
            const core = im.coreModel;
            if (core) {
              // Costume parameters
              core.setParameterValueById('v0052_Param3', 1);
              core.setParameterValueById('V0101_Param3', -1);
              core.setParameterValueById('v0000_Param8', 0);
              core.setParameterValueById('V0100Param44', 0);
              core.setParameterValueById('Param28', 0);

              // Smooth tracking transition (lerp)
              const ease = 0.08;
              currentX += (targetX - currentX) * ease;
              currentY += (targetY - currentY) * ease;

              // Apply parameters directly (overrides motion parameters)
              core.setParameterValueById('ParamAngleX', currentX * 30);
              core.setParameterValueById('ParamAngleY', currentY * 30);
              core.setParameterValueById('ParamEyeBallX', currentX);
              core.setParameterValueById('ParamEyeBallY', currentY);
              core.setParameterValueById('ParamBodyAngleX', currentX * 10);
              core.setParameterValueById('ParamBodyAngleY', currentY * 10);
            }
          };
        }

        const fit = () => {
          if (isDestroyed || !container || !model || !app) return;
          const width = container.clientWidth || 480;
          const height = container.clientHeight || 640;
          
          try {
            app.renderer.resize(width, height);
          } catch (err) {
            console.warn('[live2d] Resize error:', err);
          }

          const bounds = model.getLocalBounds();
          let bw = bounds.width || 800;
          let bh = bounds.height || 1000;
          if (bw <= 1 || bh <= 1) {
            bw = model.width || model.internalModel?.width || 800;
            bh = model.height || model.internalModel?.height || 1000;
          }

          // Use a bust-fitting algorithm to scale up, show head, and hide legs
          const scale = (width / bw) * 3.3;
          model.scale.set(scale);
          const scaledH = bh * scale;
          
          const anchorY = 0.50;
          model.anchor.set(0.5, anchorY);
          model.x = width * 0.5;
          
          let targetY = height * 0.90;
          const headTop = targetY - anchorY * scaledH;
          const headMargin = height * 0.02; // 2% margin at top
          if (headTop < headMargin) {
            targetY += headMargin - headTop;
          }
          model.y = targetY;
        };

        fit();

        const playIdle = () => {
          if (isDestroyed || !model) return;
          const motions = model.internalModel?.settings?.motions || model.internalModel?.settings?.Motions || {};
          if (motions.Idle) {
            model.motion('Idle', 0, 3);
          } else if (motions.idle) {
            model.motion('idle', 0, 3);
          } else {
            const keys = Object.keys(motions);
            if (keys.length > 0) {
              model.motion(keys[0], 0, 3);
            }
          }
        };

        playIdle();

        handleGlobalMouseMove = (e) => {
          if (isDestroyed || !canvas) return;
          const rect = canvas.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dx = e.clientX - centerX;
          const dy = e.clientY - centerY;
          
          const scaleX = window.innerWidth / 2 || 800;
          const scaleY = window.innerHeight / 2 || 600;
          
          targetX = Math.max(-1, Math.min(1, dx / scaleX));
          targetY = Math.max(-1, Math.min(1, -dy / scaleY));
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);

        const ro = new ResizeObserver(() => fit());
        ro.observe(container);
        container.__resizeObserver = ro;

      } catch (err) {
        console.error('[live2d] Load error:', err);
        if (!isDestroyed) {
          setError('Не удалось загрузить модель');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isDestroyed = true;
      modelRef.current = null;
      if (handleGlobalMouseMove) {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
      }
      if (containerRef.current?.__resizeObserver) {
        containerRef.current.__resizeObserver.disconnect();
      }
      if (model) {
        try {
          model.destroy({ children: true });
        } catch (err) {
          console.warn('[live2d] Model destroy warn:', err);
        }
      }
      if (app) {
        try {
          app.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch (err) {
          console.warn('[live2d] App destroy warn:', err);
        }
      }
      if (canvas) {
        try {
          canvas.remove();
        } catch (err) {
          console.warn('[live2d] Canvas remove warn:', err);
        }
      }
    };
  }, []);

  useEffect(() => {
    const model = modelRef.current;
    if (model) {
      try {
        if (expression) {
          model.expression(expression);
        } else {
          model.expression(null);
        }
      } catch (err) {
        console.warn('[live2d] Set expression error:', err);
      }
    }
  }, [expression]);

  return (
    <div 
      ref={containerRef} 
      className="live2d-avatar-container" 
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {loading && (
        <div className="live2d-loading" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9B8EC4' }}>
          <span>Загрузка...</span>
        </div>
      )}
      {error && (
        <div className="live2d-error" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b' }}>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
