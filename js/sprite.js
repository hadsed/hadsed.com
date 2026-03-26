(() => {
  const sprite = document.getElementById('sprite');
  const container = document.querySelector('.sprite-container');
  if (!sprite || !container) return;

  const speed = 4;
  const keys = {};
  let x = 0;
  let moving = false;

  // Center sprite initially
  const containerRect = () => container.getBoundingClientRect();
  const spriteW = 48;

  document.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      keys[e.key] = true;
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  function update() {
    const rect = containerRect();
    const maxX = (rect.width / 2) - spriteW;

    let dx = 0;
    if (keys['ArrowRight']) dx += speed;
    if (keys['ArrowLeft']) dx -= speed;

    if (dx !== 0) {
      x += dx;
      x = Math.max(-maxX, Math.min(x, maxX));

      if (!moving) {
        moving = true;
        sprite.classList.remove('idle');
        sprite.classList.add('walking');
      }
    } else {
      if (moving) {
        moving = false;
        sprite.classList.remove('walking');
        sprite.classList.add('idle');
      }
    }

    // Apply position — sprite is centered via CSS left:50% + translateX(-50%)
    // We offset from center
    const baseTranslate = moving ? '' : '';
    sprite.style.left = `calc(50% + ${x}px)`;

    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
})();
