class ExposureControlViewer {
    constructor() {
        this.prefix = 'expcontrol';
        this.n_scenes = 2;

        // Total time (seconds) to go from frame 0 → last frame (one-way sweep)
        this.seconds_per_interval = 0.1; // 200 ms per interval (base speed)

        this.cur_frame = 0;
        this.base_im = '0000';
        this.method = '2frame';
        this.interval_id = null;
        this.anim_dir = 1;
        this.max_idx = 16; // will be overridden by updateSliderForMethod()

        this.assets_path = `ds_assets`;
        this.ds = true; // optional flag if you toggle resolution elsewhere

        // Cache DOM elements
        this.input_img = document.getElementById(`${this.prefix}-blurry`);
        this.gt_vid = document.getElementById(`${this.prefix}-gt`); 
        this.vid = document.getElementById(`${this.prefix}-vid`);
        this.video_elements = [this.gt_vid, this.vid];
        // Build scene selector, slider sync
        this.initSceneSelector();
        this.initSliderSync();

        // Prepare slider/ticks for current method
        this.updateSliderForMethod();
        this.updateDeadtimeStyle();
        this.updateDeadtimeLegend(); 

        // Start paused; call toggle_play_pause() if you want autoplay
        this.isPlaying = false;

        // Load initial scene
        this.change_scene(this.base_im);
    }

    /* ---------------- Helpers for frames & timing ---------------- */

    getFramesForMethod(method) {
        switch (method) {
        case '2frame':    return 2+1;
        case '4frame':    return 4+1;
        case '8frame':    return 8+1;
        case '16frame':   return 16+1;
        case '1deadtime': return 32+1; // special case: still show 16 ticks
        default:          return 16+1;
        }
    }

    // Per-frame delay so that 0 → last frame always takes total_duration_s
    getSecondsPerInterval() {
        const base = this.seconds_per_interval; // 0.1s
        switch (this.method) {
            case '2frame':  return base * 4.0; // 25% faster -> 0.15s
            case '4frame':  return base * 3.0; // 15% faster -> 0.17s
            case '8frame':  return base * 2.0; // 0.2s for others
            case '16frame': return base * 1.0; // 0.1s
            case '1deadtime': return base * 2.0; // 0.05s
        }
    }

    getFrameDelayMs() {
    return this.getSecondsPerInterval() * 1000; // exact per-interval delay
    }

    getStepSize() {
        return this.method === '1deadtime' ? 2 : 1;
    }

    updateDeadtimeStyle() {
        const slider = document.getElementById(`${this.prefix}_frame_control`);
        const container = slider?.closest('.slider-container');
        if (!container) return;
        container.classList.toggle('deadtime-mode', this.method === '1deadtime');
    }

    updateDeadtimeLegend() {
        const el = document.getElementById(`${this.prefix}-legend-deadtime`);
        if (!el) return;
        const show = (this.method === '1deadtime');
        el.classList.toggle('is-hidden', !show);
    }

    /* ---------------- UI builders ---------------- */

    initSceneSelector() {
        const selector = document.getElementById(`${this.prefix}-scene-selector`);
        if (!selector) return;

        selector.innerHTML = "";
        for (let i = 0; i < this.n_scenes; i++) {
            const padded = i.toString().padStart(4, '0');

            const div = document.createElement("div");
            div.style.margin = "0.5em";

            const img = document.createElement("img");
            img.src = `${this.assets_path}/${this.prefix}/icons/${padded}.png`;
            img.style.borderRadius = "1em";
            img.style.maxWidth = "7em";
            img.style.cursor = "pointer";

            img.onclick = () => this.change_scene(padded);

            div.appendChild(img);
            selector.appendChild(div);
        }
    }

    initSliderThumbBar() {
        const slider = document.getElementById(`${this.prefix}_frame_control`);
        if (!slider) return;

        // 16 intervals → 16 positions → 0..15
        slider.min = 0;
        slider.max = this.max_idx - 1;   // was: this.max_idx
        slider.step = 1;

        // for CSS that sizes the bar/segment width (16 intervals)
        slider.style.setProperty('--intervals', this.max_idx); // stays 16

        // keep current value in range if something set it earlier
        if (parseInt(slider.value, 10) > this.max_idx - 1) slider.value = this.max_idx - 1;
    }

    initSliderSync() {
        if (!this.vid) return;
        const slider = document.getElementById(`${this.prefix}_frame_control`);
        if (!slider) return;

        this.initSliderThumbBar();

        this.vid.addEventListener('loadedmetadata', () => {
            this.vid.addEventListener('timeupdate', () => {
            if (!this.vid.duration) return;

            const progress  = this.vid.currentTime / this.vid.duration;
            const intervals = this.max_idx;
            let k = Math.min(Math.max(Math.floor(progress * intervals), 0), intervals - 1);

            if (this.method === '1deadtime') k = k - (k % 2); // force even

            if (parseInt(slider.value, 10) !== k) {
                slider.value = String(k);
                this.cur_frame = k;
            }
            });
        });
    }


    updateSliderForMethod() {
        const slider = document.getElementById(`${this.prefix}_frame_control`);
        if (!slider) return;

        const frames = this.getFramesForMethod(this.method);
        this.max_idx = frames - 1;

        // Rebuild tick marks
        const ticks = slider.closest('.slider-container')?.querySelector('.slider-ticks');
        if (ticks) {
        ticks.innerHTML = "";
        for (let i = 0; i < frames; i++) {
            const span = document.createElement('span');
            ticks.appendChild(span);
        }
        }
    }

    /* ---------------- Scene & media control ---------------- */
    change_frame(idx) {
        let k = Math.max(0, Math.min(this.max_idx - 1, parseInt(idx, 10)));
        if (this.method === '1deadtime') k = k - (k % 2); // force even: 0,2,4,...,30

        this.cur_frame = k;

        // Seek to center of interval
        const norm = (k + 0.5) / this.max_idx;
        this.video_elements.forEach(video => {
            if (video && video.duration) video.currentTime = norm * video.duration;
        });

        // keep the slider in sync
        const slider = document.getElementById(`${this.prefix}_frame_control`);
        if (slider && parseInt(slider.value, 10) !== k) slider.value = k;
    }

    change_scene(scene_id) {
        this.base_im = scene_id;
        this.cur_frame = 0;

        if (this.input_img) {
        this.input_img.src = `${this.assets_path}/${this.prefix}/blurry/${scene_id}_${this.method}.png`;
        }

        this.loadVideos();
        this.initSliderThumbBar();
        this.change_frame(0);
    }

    setResolution(resolution) {
        console.log(`Setting resolution to: ${resolution}`);
        this.ds = resolution === "half";
        this.assets_path = this.ds ? `ds_assets` : `assets`;
        this.change_scene(this.base_im);
    }

    loadVideos() {
        const scene  = this.base_im;
        const method = this.method;
        const gt_path = `${this.assets_path}/${this.prefix}/videos/${scene}/${method}_GT.mp4`;
        const vid_path = `${this.assets_path}/${this.prefix}/videos/${scene}/${method}.mp4`;

        this.gt_vid.src = gt_path;
        this.gt_vid.load();
        this.gt_vid.currentTime = 0;

        this.vid.src = vid_path;
        this.vid.load();
        this.vid.currentTime = 0;
    }

    /* ---------------- Playback controls ---------------- */
    toggle_play_pause() {
        this.isPlaying = !this.isPlaying;

        if (!this.isPlaying) {
        this.stop_anim();
        } else {
        this.stop_anim(); // reset any old timer
        this.cycle_frames(this.getFrameDelayMs());
        }

        this.updatePlayButton();
    }

    updatePlayButton() {
        const btn   = document.getElementById(`${this.prefix}-play-pause-btn`);
        const icon  = document.getElementById(`${this.prefix}-play-pause-icon`);
        if (!btn || !icon) return;

        const label = btn.querySelector("span:last-child");
        if (this.isPlaying) {
        icon.className = "fas fa-pause";
        if (label) label.textContent = "Pause";
        } else {
        icon.className = "fas fa-play";
        if (label) label.textContent = "Play";
        }
    }

    next_frame() {
        const step = this.getStepSize();
        // last even interval index (e.g., 30 when max_idx=32)
        const maxEven = (this.max_idx - 1) - ((this.max_idx - 1) % 2);

        if (this.method === '1deadtime') {
            if (this.cur_frame >= maxEven) this.anim_dir = -1;
            if (this.cur_frame <= 0)       this.anim_dir = 1;
        } else {
            const max = this.max_idx - 1;
            if (this.cur_frame >= max) this.anim_dir = -1;
            if (this.cur_frame <= 0)   this.anim_dir = 1;
        }

        this.change_frame(this.cur_frame + this.anim_dir * step);
    }


    cycle_frames(delayMs) {
        this.interval_id = setInterval(() => this.next_frame(), delayMs);
    }

    stop_anim() {
        if (this.interval_id) clearInterval(this.interval_id);
        this.interval_id = null;
    }

    /* ---------------- Method switcher ---------------- */
    set_method(name) {
        if (this.method === name) return;
        this.method = name;

        // Highlight the active button
        document.querySelectorAll(`#${this.prefix}-method-toggle button`).forEach(btn => {
        btn.classList.toggle("is-info",  btn.dataset.method === name);
        btn.classList.toggle("is-light", btn.dataset.method !== name);
        });

        // Update slider/ticks for new method
        this.updateSliderForMethod();
        this.updateDeadtimeStyle();
        this.updateDeadtimeLegend();
        
        // Update blurry image (per-method)
        if (this.input_img) {
        this.input_img.src = `${this.assets_path}/${this.prefix}/blurry/${this.base_im}_${this.method}.png`;
        }

        // Reload video + reset frame
        this.loadVideos();
        this.initSliderThumbBar();
        this.change_frame(0);

        // If currently playing, restart with the new per-frame delay
        if (this.isPlaying) {
        this.stop_anim();
        this.cycle_frames(this.getFrameDelayMs());
        }
    }
}
