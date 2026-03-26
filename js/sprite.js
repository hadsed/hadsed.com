(() => {
  const sprite = document.getElementById('sprite');
  if (!sprite) return;

  // Sprite frames
  const idleFrame = 'assets/sprites/had-idle.png';
  const walkFrames = [
    'assets/sprites/had-walk-1.png',
    'assets/sprites/had-walk-2.png',
    'assets/sprites/had-walk-3.png'
  ];
  let walkFrame = 0;
  let walkInterval = null;

  // Gather all vertical stops (intro + experience rows)
  const stops = Array.from(document.querySelectorAll('.sprite-stop'));
  let currentStop = 0;
  let xOffset = 0;
  const speed = 4;
  const keys = {};
  let moving = false;
  let facingRight = true;

  // Create roaming sprite (fixed position, follows stops)
  const roamer = document.createElement('img');
  roamer.className = 'sprite-roaming idle';
  roamer.src = idleFrame;
  roamer.alt = 'Had sprite';
  document.body.appendChild(roamer);
  roamer.style.display = 'none';

  function startWalking() {
    if (walkInterval) return;
    walkInterval = setInterval(() => {
      walkFrame = (walkFrame + 1) % walkFrames.length;
      sprite.src = walkFrames[walkFrame];
      roamer.src = walkFrames[walkFrame];
    }, 133); // ~7.5 fps for walk cycle
  }

  function stopWalking() {
    if (walkInterval) {
      clearInterval(walkInterval);
      walkInterval = null;
    }
    sprite.src = idleFrame;
    roamer.src = idleFrame;
  }

  function updateFacing(right) {
    if (facingRight !== right) {
      facingRight = right;
      const scaleX = right ? 1 : -1;
      sprite.style.transform = `translateX(-50%) scaleX(${scaleX})`;
      roamer.style.transform = `scaleX(${scaleX})`;
    }
  }

  function positionAtStop(index, animate) {
    const stop = stops[index];
    if (!stop) return;

    const rect = stop.getBoundingClientRect();

    if (index === 0) {
      // At intro: hide roamer, show container sprite
      roamer.style.display = 'none';
      sprite.classList.remove('hidden');
      xOffset = 0;
    } else {
      // At experience row: show roamer left of the icon, bottom-aligned
      sprite.classList.add('hidden');
      roamer.style.display = 'block';

      // Find the icon element within the row to align against
      const icon = stop.querySelector('.exp-icon');
      const iconRect = icon ? icon.getBoundingClientRect() : rect;

      // Position: to the left of the entire row, bottom-aligned to icon bottom
      const spriteH = 60;
      const spriteW = 60;
      const gap = 24;
      const y = iconRect.bottom + window.scrollY - spriteH;
      const x = rect.left - spriteW - gap + xOffset;

      if (animate) {
        roamer.style.transition = 'top 0.25s ease-out, left 0.15s ease-out';
      } else {
        roamer.style.transition = 'none';
      }

      roamer.style.position = 'absolute';
      roamer.style.top = y + 'px';
      roamer.style.left = x + 'px';
    }

    // Highlight current experience row
    stops.forEach((s, i) => {
      if (s.classList.contains('experience-row')) {
        s.classList.toggle('sprite-here', i === index);
      }
    });

    // Scroll into view if needed
    if (index > 0) {
      stop.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  document.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      keys[e.key] = true;

      // Down/Up: hop between stops
      if (e.key === 'ArrowDown' && !e.repeat) {
        if (currentStop < stops.length - 1) {
          currentStop++;
          xOffset = 0;
          positionAtStop(currentStop, true);
        }
      }
      if (e.key === 'ArrowUp' && !e.repeat) {
        if (currentStop > 0) {
          currentStop--;
          xOffset = 0;
          positionAtStop(currentStop, true);
        }
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  function update() {
    // Left/Right: move within current stop
    let dx = 0;
    if (keys['ArrowRight']) {
      dx += speed;
      updateFacing(true);
    }
    if (keys['ArrowLeft']) {
      dx -= speed;
      updateFacing(false);
    }

    if (dx !== 0) {
      if (currentStop === 0) {
        // Move within sprite container
        const container = document.querySelector('.sprite-container');
        const maxX = (container.offsetWidth / 2) - 24;
        xOffset += dx;
        xOffset = Math.max(-maxX, Math.min(xOffset, maxX));
        sprite.style.left = `calc(50% + ${xOffset}px)`;
      } else {
        // Move roamer horizontally along the row
        const stop = stops[currentStop];
        const rect = stop.getBoundingClientRect();
        const maxX = rect.width - 60;
        xOffset += dx;
        xOffset = Math.max(0, Math.min(xOffset, maxX));
        roamer.style.left = (rect.left + 12 + xOffset) + 'px';
      }

      if (!moving) {
        moving = true;
        sprite.classList.remove('idle');
        sprite.classList.add('walking');
        roamer.classList.remove('idle');
        startWalking();
      }
    } else {
      if (moving) {
        moving = false;
        sprite.classList.remove('walking');
        sprite.classList.add('idle');
        roamer.classList.add('idle');
        stopWalking();
      }
    }

    requestAnimationFrame(update);
  }

  // Reposition on scroll/resize
  window.addEventListener('scroll', () => {
    if (currentStop > 0) positionAtStop(currentStop, false);
  });
  window.addEventListener('resize', () => positionAtStop(currentStop, false));

  // Initialize
  positionAtStop(0, false);
  requestAnimationFrame(update);
})();
