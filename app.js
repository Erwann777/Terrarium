document.addEventListener('DOMContentLoaded', () => {

  // ── Element references ────────────────────────────────────────
  const terrarium    = document.getElementById('terrarium');
  const sidebarLeft  = document.getElementById('sidebar-left');
  const sidebarRight = document.getElementById('sidebar-right');
  const resetBtn   = document.getElementById('reset-btn');
  const saveBtn    = document.getElementById('save-btn');
  const plants     = Array.from(document.querySelectorAll('.plant'));

  // ── Audio Context (Part 2f) ───────────────────────────────────
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playPickup() {
    try {
      const ctx  = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) { /* silent fail */ }
  }

  function playPlace() {
    try {
      const ctx  = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) { /* silent fail */ }
  }

  // ── Store original sidebar positions (Part 2a) ────────────────
  // We record each plant's bounding rect relative to the viewport
  // BEFORE any dragging. These are used for the reset animation.
  const originalPositions = {};

  function captureOriginalPositions() {
    plants.forEach(plant => {
      const rect = plant.getBoundingClientRect();
      originalPositions[plant.id] = { top: rect.top, left: rect.left };
    });
  }

  // Wait one frame to ensure layout is painted
  requestAnimationFrame(() => {
    requestAnimationFrame(captureOriginalPositions);
  });

  // Track home sidebar for each plant
  const plantHomeSidebar = {};
  plants.forEach(plant => {
    plantHomeSidebar[plant.id] = plant.closest('.sidebar');
  });
  // Track which plants are placed inside the terrarium and where
  const placedPlants = {}; // { plantId: { x, y } } in px from terrarium top-left

  // ── Drag variables ────────────────────────────────────────────
  let draggedPlant   = null;
  let dragOffsetX    = 0;
  let dragOffsetY    = 0;
  let isDragging     = false;

  // ── Utility: toast notification ───────────────────────────────
  function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // ── Load saved positions from localStorage (Part 2e) ──────────
  function loadSavedLayout() {
    try {
      const saved = localStorage.getItem('terrarium-layout');
      if (!saved) return;
      const layout = JSON.parse(saved);
      Object.entries(layout).forEach(([id, pos]) => {
        const plant = document.getElementById(id);
        if (!plant) return;
        placePlantInTerrarium(plant, pos.x, pos.y, false);
      });
    } catch (e) {
      console.warn('Could not load saved layout:', e);
    }
  }

  // ── Place a plant inside the terrarium ────────────────────────
  function placePlantInTerrarium(plant, x, y, withSound = true) {
    const terRect = terrarium.getBoundingClientRect();

    // Clamp so plant stays inside terrarium boundaries (Part 2d)
    const maxX = terRect.width  - plant.offsetWidth  - 4;
    const maxY = terRect.height - plant.offsetHeight - 4;
    x = Math.max(4, Math.min(x, maxX));
    y = Math.max(4, Math.min(y, maxY));

    // Move DOM node into terrarium
    if (plant.parentElement !== terrarium) {
      terrarium.appendChild(plant);
    }

    plant.classList.add('placed');
    plant.classList.remove('resetting');
    plant.style.left = x + 'px';
    plant.style.top  = y + 'px';

    placedPlants[plant.id] = { x, y };

    if (withSound) playPlace();
  }

  // ── Return plant to sidebar ───────────────────────────────────
  function returnPlantToSidebar(plant) {
    const home = plantHomeSidebar[plant.id] || sidebarLeft;
    if (plant.parentElement !== home) {
      home.appendChild(plant);
    }
    plant.classList.remove('placed', 'front', 'resetting');
    plant.style.left = '';
    plant.style.top  = '';
    plant.style.zIndex = '';
    delete placedPlants[plant.id];
  }

  // ── DRAG implementation (mousedown → mousemove → mouseup) ──────
  plants.forEach(plant => {
    plant.addEventListener('mousedown', onPlantMouseDown);
  });

  function onPlantMouseDown(e) {
    if (e.button !== 0) return; // left click only
    e.preventDefault();

    draggedPlant = e.currentTarget;
    isDragging   = true;

    playPickup(); // Part 2f

    const rect = draggedPlant.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // Lift the plant as a fixed ghost while dragging
    const size = draggedPlant.offsetWidth;
    draggedPlant.style.position = 'fixed';
    draggedPlant.style.left     = (e.clientX - dragOffsetX) + 'px';
    draggedPlant.style.top      = (e.clientY - dragOffsetY) + 'px';
    draggedPlant.style.zIndex   = 9999;
    draggedPlant.style.width    = size + 'px';
    draggedPlant.style.pointerEvents = 'none';
    draggedPlant.classList.remove('placed', 'resetting');
    draggedPlant.style.animation = 'none'; // pause sway while dragging

    document.body.appendChild(draggedPlant);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  }

  function onMouseMove(e) {
    if (!isDragging || !draggedPlant) return;
    draggedPlant.style.left = (e.clientX - dragOffsetX) + 'px';
    draggedPlant.style.top  = (e.clientY - dragOffsetY) + 'px';

    // Highlight terrarium on drag-over
    const terRect = terrarium.getBoundingClientRect();
    const inside  = e.clientX >= terRect.left && e.clientX <= terRect.right
                 && e.clientY >= terRect.top  && e.clientY <= terRect.bottom;
    terrarium.classList.toggle('drag-over', inside);
  }

  function onMouseUp(e) {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
    terrarium.classList.remove('drag-over');
    if (!isDragging || !draggedPlant) return;
    isDragging = false;

    const terRect = terrarium.getBoundingClientRect();

    // Restore pointer events
    draggedPlant.style.pointerEvents = '';
    draggedPlant.style.animation     = '';

    // Check if dropped inside terrarium
    if (
      e.clientX >= terRect.left && e.clientX <= terRect.right &&
      e.clientY >= terRect.top  && e.clientY <= terRect.bottom
    ) {
      // Part 2d: calculate position relative to terrarium, clamped
      const x = e.clientX - terRect.left - dragOffsetX;
      const y = e.clientY - terRect.top  - dragOffsetY;

      // Reset fixed positioning before appending
      draggedPlant.style.position = '';
      draggedPlant.style.left     = '';
      draggedPlant.style.top      = '';
      draggedPlant.style.zIndex   = '';
      draggedPlant.style.width    = '';

      placePlantInTerrarium(draggedPlant, x, y, true);

      // Re-register double-click
      draggedPlant.addEventListener('dblclick', onPlantDblClick);
      draggedPlant.addEventListener('mousedown', onPlantMouseDown);

    } else {
      // Dropped outside — send back to sidebar
      draggedPlant.style.position = '';
      draggedPlant.style.left     = '';
      draggedPlant.style.top      = '';
      draggedPlant.style.zIndex   = '';
      draggedPlant.style.width    = '';
      returnPlantToSidebar(draggedPlant);
    }

    draggedPlant = null;
  }

  // ── Part 2b: Double-click to bring to front ───────────────────
  function onPlantDblClick(e) {
    const plant = e.currentTarget;
    // Toggle: if already front, deselect
    const wasFront = plant.classList.contains('front');
    // Remove front from all
    terrarium.querySelectorAll('.plant.front').forEach(p => p.classList.remove('front'));
    if (!wasFront) {
      plant.classList.add('front');
    }
  }

  // ── Part 2a: Reset button ─────────────────────────────────────
  resetBtn.addEventListener('click', () => {
    // Get all placed plants and animate them back to sidebar
    const placedList = Array.from(terrarium.querySelectorAll('.plant'));
    if (placedList.length === 0) {
      showToast('No plants to reset!');
      return;
    }

    placedList.forEach(plant => {
      const orig    = originalPositions[plant.id];
      const terRect = terrarium.getBoundingClientRect();

      if (orig) {
        // Animate to original viewport position via fixed position,
        // then transition back to sidebar
        plant.classList.add('resetting');

        // Convert current terrarium-relative position to viewport
        const curLeft = terRect.left + parseFloat(plant.style.left || 0);
        const curTop  = terRect.top  + parseFloat(plant.style.top  || 0);

        // Fix to viewport
        plant.style.position = 'fixed';
        plant.style.left     = curLeft + 'px';
        plant.style.top      = curTop  + 'px';
        plant.style.zIndex   = 5000;
        plant.style.width    = plant.offsetWidth + 'px';
        plant.style.transition = 'left 1s ease, top 1s ease';
        document.body.appendChild(plant);

        // Force reflow then animate to original
        void plant.offsetWidth;
        plant.style.left = orig.left + 'px';
        plant.style.top  = orig.top  + 'px';

        setTimeout(() => {
          plant.style.position   = '';
          plant.style.left       = '';
          plant.style.top        = '';
          plant.style.zIndex     = '';
          plant.style.width      = '';
          plant.style.transition = '';
          plant.classList.remove('placed', 'front', 'resetting');
          const home = plantHomeSidebar[plant.id] || sidebarLeft;
          home.appendChild(plant);
          delete placedPlants[plant.id];
        }, 1050);
      } else {
        returnPlantToSidebar(plant);
      }
    });

    // Clear saved layout
    localStorage.removeItem('terrarium-layout');
    showToast('Plants reset! 🌿');
  });

  // ── Part 2e: Save button ──────────────────────────────────────
  saveBtn.addEventListener('click', () => {
    try {
      localStorage.setItem('terrarium-layout', JSON.stringify(placedPlants));
      showToast('Layout saved! 💾');
    } catch (e) {
      showToast('Save failed (storage full?)');
    }
  });

  // ── Load on startup ───────────────────────────────────────────
  loadSavedLayout();

  // After loading, re-attach dblclick listeners to placed plants
  setTimeout(() => {
    terrarium.querySelectorAll('.plant').forEach(plant => {
      plant.addEventListener('dblclick', onPlantDblClick);
      plant.addEventListener('mousedown', onPlantMouseDown);
    });
  }, 100);

});
