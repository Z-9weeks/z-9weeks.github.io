/* ============================================================
 * 首页动态封面（Route A：站点级注入，不改主题核心）
 * 文件：source/js/home-cover.js
 *
 * 常改项（改完刷新页面即可）：
 *   TITLE       封面大标题
 *   PHRASES     打字机循环的短句
 *   TYPEWRITER  是否启用打字机；false = 直接显示第一句
 *   VARIANTS    可切换的动态效果；顺序就是切换顺序
 * ============================================================ */
(function () {
  'use strict';

  var EYEBROW = 'Z-9weeks · 科幻与随想';
  var TITLE = '在恒星熄灭之前';
  var PHRASES = [
    '写下一些文字。',
    '等一本书被翻开。',
    '记住最后一束光。'
  ];
  var CTA_LABEL = '进入博客';
  var HINT = '移动鼠标拨动星辰 · 点击按钮进入';
  var TYPEWRITER = true;
  var DEFAULT_VARIANT = 'stardust';
  var VARIANTS = [
    { id: 'galaxy', name: '银河' },
    { id: 'solar', name: '太阳系' },
    { id: 'stardust', name: '星尘' }
  ];
  var STORE_KEY = 'z9weeks.homeCover.variant.v2';

  // 只出现在首页第一页；分类、标签、归档、文章页都不生成封面
  if (document.body.getAttribute('data-page-type') !== 'index') return;
  if (document.body.getAttribute('data-page-layout') !== '') return;
  if (/\/page\/\d+(\/index\.html)?\/?$/.test(location.pathname)) return;
  if (document.getElementById('home-cover')) return;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var variantIndex = readVariant();

  function readVariant() {
    try {
      var saved = window.localStorage.getItem(STORE_KEY);
      for (var i = 0; i < VARIANTS.length; i += 1) {
        if (VARIANTS[i].id === saved) return i;
      }
    } catch (error) {
      /* 隐私模式下 localStorage 可能不可用，忽略即可 */
    }
    for (var d = 0; d < VARIANTS.length; d += 1) {
      if (VARIANTS[d].id === DEFAULT_VARIANT) return d;
    }
    return 0;
  }

  function variant() {
    return VARIANTS[variantIndex];
  }

  /* ------------------------------------------------------------
   * 1. 生成封面骨架
   * ---------------------------------------------------------- */
  var cover = document.createElement('section');
  cover.id = 'home-cover';
  cover.className = 'home-cover';
  cover.setAttribute('aria-label', '网站封面');
  cover.innerHTML =
    '<canvas class="home-cover__canvas" aria-hidden="true"></canvas>' +
    '<div class="home-cover__veil" aria-hidden="true"></div>' +
    '<div class="home-cover__content">' +
      '<p class="home-cover__eyebrow">' + EYEBROW + '</p>' +
      '<h1 class="home-cover__title">' + TITLE + '</h1>' +
      '<p class="home-cover__subtitle"><span class="home-cover__typed"></span><span class="home-cover__caret" aria-hidden="true"></span></p>' +
      '<a class="home-cover__cta" href="#start">' + CTA_LABEL + ' <span aria-hidden="true">↓</span></a>' +
    '</div>' +
    '<div class="home-cover__switch" role="group" aria-label="切换封面效果">' +
      '<button type="button" data-cover-prev aria-label="上一个封面">‹</button>' +
      '<span class="home-cover__switch-label" aria-live="polite">' + variant().name + '</span>' +
      '<button type="button" data-cover-next aria-label="下一个封面">›</button>' +
    '</div>' +
    '<p class="home-cover__hint">' + HINT + '</p>';

  document.body.appendChild(cover);
  document.documentElement.classList.add('cover-lock');

  var canvas = cover.querySelector('.home-cover__canvas');
  var ctx = canvas.getContext('2d');
  var typedEl = cover.querySelector('.home-cover__typed');
  var labelEl = cover.querySelector('.home-cover__switch-label');
  var shell = document.getElementById('start');

  if (shell) {
    shell.setAttribute('aria-hidden', 'true');
    if ('inert' in shell) shell.inert = true;
  }

  function releaseShell() {
    if (!shell) return;
    shell.removeAttribute('aria-hidden');
    if ('inert' in shell) shell.inert = false;
  }

  /* ------------------------------------------------------------
   * 2. 画布与三种动态效果
   * ---------------------------------------------------------- */
  var width = 0;
  var height = 0;
  var dpr = 1;
  var stars = [];
  var particles = [];
  var planets = [];
  var blobs = [];
  var sunSprite = null;
  var shooting = null;
  var nextShoot = 2500;
  var pointer = { x: 0, y: 0, tx: 0, ty: 0, px: 0, py: 0, active: false };
  var raf = 0;
  var running = true;
  var startedAt = 0;
  var typeTimer = 0;
  var phraseIndex = 0;
  var charIndex = 0;
  var deleting = false;
  var resizeTimer = 0;
  var entered = false;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function makeBlob(inner, outer) {
    var size = 512;
    var sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    var g = sprite.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.45, outer);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return sprite;
  }

  function buildScene() {
    var current = variant();
    var area = width * height;
    var count = Math.round(clamp(area / 5000, 160, 420));

    stars = [];
    for (var i = 0; i < count; i += 1) {
      var colored = Math.random() < 0.14;
      stars.push({
        x: rand(0, width),
        y: rand(0, height),
        z: rand(0.35, 1),
        r: rand(0.4, 1.7),
        tw: rand(0, Math.PI * 2),
        hue: colored
          ? (Math.random() < 0.5 ? 'rgba(125, 211, 252,' : 'rgba(253, 224, 171,')
          : 'rgba(226, 232, 240,'
      });
    }

    particles = [];
    if (current.id === 'stardust') {
      var pCount = Math.round(clamp(area / 5200, 200, 420));
      for (var j = 0; j < pCount; j += 1) {
        var onBand = Math.random() < 0.5;
        var ax;
        var ay;
        if (onBand) {
          var u = Math.random();
          ax = width * (0.06 + 0.88 * u);
          ay = height * (0.78 - 0.56 * u) + rand(-1, 1) * height * 0.1;
        } else {
          ax = rand(0, width);
          ay = rand(0, height);
        }

        var colorRoll = Math.random();
        var color = colorRoll < 0.45
          ? 'rgba(255, 255, 255,'
          : colorRoll < 0.68
            ? 'rgba(219, 234, 254,'
            : colorRoll < 0.82
              ? 'rgba(186, 230, 253,'
              : colorRoll < 0.92
                ? 'rgba(253, 230, 138,'
                : colorRoll < 0.97
                  ? 'rgba(251, 207, 232,'
                  : 'rgba(165, 243, 252,';
        var bright = Math.random() < 0.05;

        particles.push({
          ax: ax,
          ay: ay,
          x: ax,
          y: ay,
          vx: 0,
          vy: 0,
          z: rand(0.5, 1),
          r: bright ? rand(1.7, 2.7) : rand(0.35, 1.4),
          alpha: bright ? rand(0.85, 1) : rand(0.25, 0.9),
          color: color,
          tw: rand(0, Math.PI * 2),
          twSpeed: rand(0.0004, 0.0018),
          wanderSpeed: rand(0.00008, 0.0002),
          wanderAmp: rand(6, 16),
          wanderPhase: rand(0, Math.PI * 2),
          flare: bright && Math.random() < 0.5
        });
      }
    }

    blobs = [];
    planets = [];
    sunSprite = null;

    if (current.id === 'stardust') {
      blobs = [
        {
          sprite: makeBlob('rgba(56, 189, 248, 0.18)', 'rgba(14, 116, 144, 0.04)'),
          x: 0.3,
          y: 0.62,
          scale: 1.25,
          phase: 0.4,
          alpha: 0.55
        },
        {
          sprite: makeBlob('rgba(168, 85, 247, 0.16)', 'rgba(88, 28, 135, 0.04)'),
          x: 0.7,
          y: 0.34,
          scale: 1.1,
          phase: 2.4,
          alpha: 0.5
        }
      ];
    }

    if (current.id === 'solar') {
      sunSprite = makeBlob('rgba(255, 226, 160, 0.95)', 'rgba(255, 140, 60, 0.22)');
      var minDim = Math.min(width, height);
      var orbitScales = [0.15, 0.21, 0.28, 0.36, 0.45];
      var planetSizes = [0.0032, 0.0042, 0.0048, 0.004, 0.006];
      var planetColors = ['#cbd5e1', '#fbbf24', '#7dd3fc', '#fb923c', '#e879f9'];
      var planetSpeeds = [0.00016, 0.00012, 0.00009, 0.00007, 0.00005];
      for (var k = 0; k < orbitScales.length; k += 1) {
        planets.push({
          rx: minDim * orbitScales[k],
          ry: minDim * orbitScales[k] * 0.55,
          angle: rand(0, Math.PI * 2),
          speed: planetSpeeds[k],
          r: Math.max(1.4, minDim * planetSizes[k]),
          color: planetColors[k],
          ring: k === 4
        });
      }
    }

    shooting = null;
    nextShoot = 2500;
  }

  function drawStars(t, parallax, limit) {
    var total = limit && limit < stars.length ? limit : stars.length;
    for (var i = 0; i < total; i += 1) {
      var s = stars[i];
      var twinkle = 0.55 + 0.45 * Math.sin(t * 0.0012 + s.tw);
      var x = s.x + Math.sin(t * 0.00006 + s.tw) * 8 * s.z + pointer.x * parallax * s.z;
      var y = s.y + Math.cos(t * 0.00005 + s.tw) * 5 * s.z + pointer.y * parallax * s.z;
      ctx.globalAlpha = twinkle * s.z;
      ctx.fillStyle = s.hue + '0.9)';
      ctx.beginPath();
      ctx.arc(x, y, s.r * s.z, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGalaxy(t) {
    ctx.clearRect(0, 0, width, height);
    drawStars(t, 26);

    if (!shooting && t > nextShoot) {
      shooting = {
        x: rand(width * 0.15, width * 0.85),
        y: rand(height * 0.08, height * 0.42),
        vx: rand(-0.22, -0.12),
        vy: rand(0.07, 0.14),
        life: 0,
        max: rand(1600, 2400),
        len: rand(380, 560)
      };
    }

    if (!shooting) return;

    shooting.life += 16;
    shooting.x += shooting.vx * 16;
    shooting.y += shooting.vy * 16;
    var fade = 1 - shooting.life / shooting.max;

    if (fade <= 0) {
      shooting = null;
      nextShoot = t + rand(5000, 10000);
      return;
    }

    var tailX = shooting.x - shooting.vx * shooting.len;
    var tailY = shooting.y - shooting.vy * shooting.len;
    var grad = ctx.createLinearGradient(shooting.x, shooting.y, tailX, tailY);
    grad.addColorStop(0, 'rgba(255, 255, 255, ' + 0.85 * fade + ')');
    grad.addColorStop(1, 'rgba(125, 211, 252, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(shooting.x, shooting.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
  }

  function drawSolar(t) {
    ctx.clearRect(0, 0, width, height);

    // 背景星空
    drawStars(t, 10, 140);

    var minDim = Math.min(width, height);
    var cx = width * 0.5 + pointer.x * 10;
    var cy = height * 0.52 + pointer.y * 6;
    var tilt = -0.32;
    var cosT = Math.cos(tilt);
    var sinT = Math.sin(tilt);

    // 细轨道；简洁版不画标签
    for (var i = 0; i < planets.length; i += 1) {
      var p = planets[i];
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, p.rx, p.ry, tilt, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 太阳光晕
    if (sunSprite) {
      var sunSize = minDim * 0.3;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9;
      ctx.drawImage(sunSprite, cx - sunSize / 2, cy - sunSize / 2, sunSize, sunSize);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // 太阳核心
    var coreSize = Math.max(7, minDim * 0.014);
    var sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize);
    sunGrad.addColorStop(0, 'rgba(255, 252, 235, 1)');
    sunGrad.addColorStop(0.55, 'rgba(255, 214, 130, 0.95)');
    sunGrad.addColorStop(1, 'rgba(255, 170, 80, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreSize, 0, Math.PI * 2);
    ctx.fill();

    // 行星：沿倾斜椭圆轨道缓慢公转
    for (var j = 0; j < planets.length; j += 1) {
      var planet = planets[j];
      var angle = planet.angle + t * planet.speed;
      var ex = Math.cos(angle) * planet.rx;
      var ey = Math.sin(angle) * planet.ry;
      var x = cx + ex * cosT - ey * sinT;
      var y = cy + ex * sinT + ey * cosT;

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = planet.color;
      ctx.beginPath();
      ctx.arc(x, y, planet.r * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, planet.r, 0, Math.PI * 2);
      ctx.fill();

      if (planet.ring) {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = planet.color;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.ellipse(x, y, planet.r * 3.2, planet.r * 1.1, -0.35, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawStardust(t) {
    ctx.clearRect(0, 0, width, height);

    // 银河薄雾：两层很淡的光晕，让星点有“深空”的层次
    ctx.globalCompositeOperation = 'lighter';
    for (var b = 0; b < blobs.length; b += 1) {
      var blob = blobs[b];
      var bx = width * blob.x + Math.sin(t * 0.00005 + blob.phase) * width * 0.08;
      var by = height * blob.y + Math.cos(t * 0.00004 + blob.phase) * height * 0.06;
      var size = Math.max(width, height) * blob.scale;
      ctx.globalAlpha = blob.alpha;
      ctx.drawImage(blob.sprite, bx - size / 2, by - size / 2, size, size);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // 每颗星：弹簧回位 + 鼠标附近的排斥力
    var radius = 170;
    var radius2 = radius * radius;
    var i;
    for (i = 0; i < particles.length; i += 1) {
      var s = particles[i];
      var wander = t * s.wanderSpeed + s.wanderPhase;
      var targetX = s.ax + Math.sin(wander) * s.wanderAmp;
      var targetY = s.ay + Math.cos(wander * 0.8) * s.wanderAmp * 0.7;
      s.vx += (targetX - s.x) * 0.0016;
      s.vy += (targetY - s.y) * 0.0016;

      if (pointer.active) {
        var dx = s.x - pointer.px;
        var dy = s.y - pointer.py;
        var distance2 = dx * dx + dy * dy;
        if (distance2 < radius2) {
          var distance = Math.sqrt(distance2) || 1;
          var force = (1 - distance / radius) * 0.22;
          s.vx += (dx / distance) * force;
          s.vy += (dy / distance) * force;
        }
      }

      s.vx *= 0.9;
      s.vy *= 0.9;
      s.x += s.vx;
      s.y += s.vy;
    }

    // 绘制：先柔光，再星核；少数亮星加十字星芒
    for (i = 0; i < particles.length; i += 1) {
      var star = particles[i];
      var twinkle = 0.7 + 0.3 * Math.sin(t * star.twSpeed + star.tw);
      var alpha = star.alpha * twinkle;
      var px = star.x + pointer.x * 6 * star.z;
      var py = star.y + pointer.y * 4 * star.z;
      var color = star.color + '1)';

      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.14;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, star.r * 4.2), 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, star.r, 0, Math.PI * 2);
      ctx.fill();

      if (star.flare) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(px - star.r * 6, py);
        ctx.lineTo(px + star.r * 6, py);
        ctx.moveTo(px, py - star.r * 6);
        ctx.lineTo(px, py + star.r * 6);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawStatic() {
    var current = variant();
    if (current.id === 'galaxy') drawGalaxy(0);
    else if (current.id === 'solar') drawSolar(0);
    else drawStardust(0);
  }

  function frame(t) {
    if (!running) return;
    if (!startedAt) startedAt = t;
    var elapsed = t - startedAt;

    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    var current = variant();
    if (current.id === 'galaxy') drawGalaxy(elapsed);
    else if (current.id === 'solar') drawSolar(elapsed);
    else drawStardust(elapsed);

    raf = window.requestAnimationFrame(frame);
  }

  function resize() {
    width = Math.max(320, window.innerWidth);
    height = Math.max(480, window.innerHeight);
    dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildScene();
  }

  /* ------------------------------------------------------------
   * 3. 打字机
   * ---------------------------------------------------------- */
  function typeStep() {
    if (!running) return;
    var phrase = PHRASES[phraseIndex];

    if (!deleting) {
      charIndex += 1;
      typedEl.textContent = phrase.slice(0, charIndex);
      if (charIndex >= phrase.length) {
        deleting = true;
        typeTimer = window.setTimeout(typeStep, 2200);
        return;
      }
      typeTimer = window.setTimeout(typeStep, 95 + Math.random() * 55);
      return;
    }

    charIndex -= 1;
    typedEl.textContent = phrase.slice(0, charIndex);
    if (charIndex <= 0) {
      deleting = false;
      phraseIndex = (phraseIndex + 1) % PHRASES.length;
      typeTimer = window.setTimeout(typeStep, 450);
      return;
    }
    typeTimer = window.setTimeout(typeStep, 32);
  }

  function startTypewriter() {
    if (!TYPEWRITER || reduceMotion || PHRASES.length === 0) {
      typedEl.textContent = PHRASES[0] || '';
      return;
    }
    typedEl.textContent = '';
    typeStep();
  }

  /* ------------------------------------------------------------
   * 4. 切换到上一个 / 下一个效果
   * ---------------------------------------------------------- */
  function setVariant(delta) {
    variantIndex = (variantIndex + delta + VARIANTS.length) % VARIANTS.length;
    try {
      window.localStorage.setItem(STORE_KEY, variant().id);
    } catch (error) {
      /* 忽略 */
    }
    labelEl.textContent = variant().name;
    buildScene();
    if (reduceMotion) drawStatic();
  }

  /* ------------------------------------------------------------
   * 5. 进入博客
   * ---------------------------------------------------------- */
  function enter() {
    if (entered) return;
    entered = true;
    running = false;

    if (raf) window.cancelAnimationFrame(raf);
    window.clearTimeout(typeTimer);
    window.clearTimeout(resizeTimer);

    cover.classList.add('is-leaving');
    document.documentElement.classList.remove('cover-lock');
    releaseShell();

    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);

    window.setTimeout(function () {
      if (cover.parentNode) cover.parentNode.removeChild(cover);
    }, 720);

    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------
   * 6. 事件绑定
   * ---------------------------------------------------------- */
  function onPointerMove(event) {
    var rect = cover.getBoundingClientRect();
    pointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    pointer.px = event.clientX - rect.left;
    pointer.py = event.clientY - rect.top;
    pointer.active = true;
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      enter();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setVariant(-1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setVariant(1);
    }
  }

  function onVisibility() {
    if (document.hidden) {
      window.cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    if (running && !reduceMotion && !raf) {
      raf = window.requestAnimationFrame(frame);
    }
  }

  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      resize();
      if (reduceMotion) drawStatic();
    }, 160);
  }

  cover.querySelector('[data-cover-prev]').addEventListener('click', function () {
    setVariant(-1);
  });

  cover.querySelector('[data-cover-next]').addEventListener('click', function () {
    setVariant(1);
  });

  cover.querySelector('.home-cover__cta').addEventListener('click', function (event) {
    event.preventDefault();
    enter();
  });

  cover.addEventListener('pointermove', onPointerMove);
  cover.addEventListener('pointerleave', onPointerLeave);
  cover.addEventListener('pointercancel', onPointerLeave);
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);

  /* ------------------------------------------------------------
   * 7. 启动
   * ---------------------------------------------------------- */
  function start() {
    resize();
    if (reduceMotion) {
      cover.classList.add('is-reduced');
      drawStatic();
      return;
    }
    raf = window.requestAnimationFrame(frame);
  }

  try {
    start();
    startTypewriter();
  } catch (error) {
    running = false;
    document.documentElement.classList.remove('cover-lock');
    releaseShell();
    if (cover.parentNode) cover.parentNode.removeChild(cover);
  }
})();
