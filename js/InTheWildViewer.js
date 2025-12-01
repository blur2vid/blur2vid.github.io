class InTheWildViewer {
	constructor() {
		/* ------------ Config ------------ */
		this.prefix = 'wild';
		this.n_scenes = 32;
		this.playback_speed = 0.2;      // seconds per “frame” (used via delayMs below)

		/* ------------ State ------------ */
		this.method = 'present';         // 'present' | 'pastfuture' (etc)
		this.max_idx = 16;               // visual intervals; set per mode in applyModeSliderShape()
		this.cur_frame = 0;
		this.base_im = '0000';
		this.interval_id = null;
		this.anim_dir = 1;
		this.ds = true;
		this.assets_path = `ds_assets`;

		/* ------------ Elements ------------ */
		this.ours_recon       = document.getElementById(`${this.prefix}-ours`);
		this.ours_tracks      = document.getElementById(`${this.prefix}-ours-tracks`);
		this.motionetr_recon  = document.getElementById(`${this.prefix}-motionetr`);
		this.motionetr_tracks = document.getElementById(`${this.prefix}-motionetr-tracks`);
		this.jin_recon        = document.getElementById(`${this.prefix}-jin`);
		this.jin_tracks       = document.getElementById(`${this.prefix}-jin-tracks`);
		this.input_img        = document.getElementById(`${this.prefix}-input`);
		this.mega_sam         = document.getElementById(`${this.prefix}-megasam`);
		this.mega_sam_poses   = document.getElementById(`${this.prefix}-megasam-poses`);

		this.video_elements = [
			this.ours_recon, this.ours_tracks,
			this.motionetr_recon, this.motionetr_tracks,
			this.jin_recon, this.jin_tracks
		];

		/* ------------ Init ------------ */
		this.applyModeSliderShape();   // sets max_idx & CSS classes/vars for the current method

		this.change_scene(this.base_im);
		this.initSceneSelector();
		this.initSliderSync();

		// Start playing
		this.isPlaying = false;
		this.toggle_play_pause();
	}

	/* =========================
	   Helpers
	   ========================= */
	getSlider()    { return document.getElementById(`${this.prefix}_frame_control`); }
	getContainer() { return this.getSlider()?.closest('.slider-container') || null; }

	// Present-mode green-only band (8..23 of 0..31), i.e., middle 16 intervals of 32
	isPresent()     { return this.method === 'present'; }
	presentMin()    { return 8; }
	presentMax()    { return 23; }
	clampToPresent(k) {
		return this.isPresent() ? Math.max(this.presentMin(), Math.min(this.presentMax(), k)) : k;
	}

	// Map visual interval index -> logical step index (present: 8..23 -> 0..15)
	toLogical(k) {
		return this.isPresent() ? (k - this.presentMin()) : k;
	}

	// Number of logical steps used for seeking/progress
	logicalIntervals() {
		// present uses 16 logical steps; other modes use this.max_idx (commonly 16)
		return this.isPresent() ? 16 : this.max_idx;
	}

	// Seek now or as soon as metadata is ready
	seekWhenReady(video, targetTime) {
		if (!video) return;
		const doSeek = () => { try { video.currentTime = targetTime; } catch (_) {} };
		if (Number.isFinite(video.duration) && video.duration > 0) doSeek();
		else video.addEventListener('loadedmetadata', doSeek, { once: true });
	}

	/* =========================
	   Scene selector
	   ========================= */
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

	/* =========================
	   Slider UI (thumb, ticks, snapping)
	   ========================= */
	buildTicks() {
		const slider = this.getSlider();
		const ticks = this.getContainer()?.querySelector('.slider-ticks');
		if (!slider || !ticks) return;
		const frames = this.max_idx + 1;   // intervals + 1
		ticks.innerHTML = "";
		for (let i = 0; i < frames; i++) ticks.appendChild(document.createElement('span'));
	}

	initSliderThumbBar() {
		const slider = this.getSlider();
		if (!slider) return;

		slider.min = 0;
		slider.max = this.max_idx - 1;  // present: 31; others: 15
		slider.step = 1;
		slider.style.setProperty('--intervals', this.max_idx);

		// Rebuild tick marks to match intervals
		this.buildTicks();

		// Snap user scrubbing into allowed range (bind once)
		if (!this._boundInputSnap) {
			this._boundInputSnap = (e) => {
				const raw = parseInt(e.target.value, 10) || 0;
				const k = this.clampToPresent(raw);
				if (k !== raw) e.target.value = String(k); // snap the thumb visually
				this.change_frame(k);
			};
			slider.addEventListener('input', this._boundInputSnap);
		}

		// Keep current value in range if something set it earlier
		const v = parseInt(slider.value || "0", 10);
		if (v > this.max_idx - 1) slider.value = String(this.max_idx - 1);
	}

	/* =========================
	   Slider ↔ video sync (playback progress)
	   ========================= */
	initSliderSync() {
		if (!this.ours_recon) return;
		const slider = this.getSlider();
		if (!slider) return;

		this.initSliderThumbBar();

		// Add a single timeupdate listener (no need to wrap in loadedmetadata)
		if (!this._boundTimeupdate) {
			this._boundTimeupdate = () => {
				if (!this.ours_recon.duration) return;

				const progress = this.ours_recon.currentTime / this.ours_recon.duration; // 0..1
				const denom = this.logicalIntervals();                                    // 16 in present
				let lk = Math.min(Math.floor(progress * denom), denom - 1);               // 0..(denom-1)
				let k  = this.isPresent() ? (this.presentMin() + lk) : lk;                // 8..23 or 0..15

				if (parseInt(slider.value, 10) !== k) {
					slider.value = k;
					this.cur_frame = k;
					this.applyGlowEffect();
				}
			};
			this.ours_recon.addEventListener('timeupdate', this._boundTimeupdate);
		}
	}

	/* =========================
	   Mode-specific slider shape & classes
	   ========================= */
	applyModeSliderShape() {
		// Visual intervals per mode
		this.max_idx = this.isPresent() ? 32 : 16;

		// Update slider limits/vars if it exists already
		const slider = this.getSlider();
		if (slider) {
			slider.min = 0;
			slider.max = this.max_idx - 1;
			slider.step = 1;
			slider.style.setProperty('--intervals', this.max_idx);
		}

		// Toggle container classes for CSS backgrounds
		const container = this.getContainer();
		if (container) {
			container.classList.toggle('present32', this.isPresent()); // grey|green|grey band
		}

		// Rebuild ticks to reflect new intervals
		this.buildTicks();
	}

	/* =========================
	   Frame change (from UI or autoplay)
	   ========================= */
	change_frame(idx) {
		let k = Math.max(0, Math.min(this.max_idx - 1, parseInt(idx, 10)));
		k = this.clampToPresent(k); // lock to 8..23 in present mode
		this.cur_frame = k;

		// Map visual interval → logical step (present: 8..23 → 0..15)
		const lk    = this.toLogical(k);
		const denom = this.logicalIntervals();           // present: 16
		const norm  = (lk + 0.5) / denom;                // seek to center of logical interval

		// Seek all videos
		this.video_elements.forEach(v => {
			if (!v) return;
			const target = Number.isFinite(v.duration) && v.duration > 0 ? norm * v.duration : 0;
			this.seekWhenReady(v, target);
		});

		// Keep the slider in sync
		const slider = this.getSlider();
		if (slider && parseInt(slider.value, 10) !== k) slider.value = String(k);

		this.applyGlowEffect();
	}

	/* =========================
	   Scene change
	   ========================= */
	change_scene(scene_id) {
		this.base_im = scene_id;
		this.cur_frame = this.isPresent() ? this.presentMin() : 0;

		if (this.input_img) {
			// If you only have present inputs, keep _present. Otherwise use `_${this.method}.png`.
			this.input_img.src = `${this.assets_path}/${this.prefix}/blurry/${scene_id}_present.png`;
		}

		this.loadVideos();
		this.initSliderThumbBar();
		this.change_frame(this.cur_frame);
	}

	setResolution(resolution) {
		this.ds = resolution === "half";
		this.assets_path = this.ds ? `ds_assets` : `assets`;
		this.change_scene(this.base_im);  // reload videos with new resolution
	}

	/* =========================
	   Video sources
	   ========================= */
	loadVideos() {
		const scene  = this.base_im;
		const method = this.method;

		const ours_reconPath       = `${this.assets_path}/${this.prefix}/videos/${scene}/${method}/Ours.mp4`;
		const ours_tracksPath      = `${this.assets_path}/${this.prefix}/tracks/${scene}/${method}/Ours.mp4`;
		const motionetr_reconPath  = `${this.assets_path}/${this.prefix}/videos/${scene}/${method}/MotionETR.mp4`;
		const motionetr_tracksPath = `${this.assets_path}/${this.prefix}/tracks/${scene}/${method}/MotionETR.mp4`;
		const jin_reconPath        = `${this.assets_path}/${this.prefix}/videos/${scene}/${method}/Jin.mp4`;
		const jin_tracksPath       = `${this.assets_path}/${this.prefix}/tracks/${scene}/${method}/Jin.mp4`;
		const method_not_supported = `${this.assets_path}/extra_stuff/method_not_supported.mp4`;

		const mega_sam_path        = `${this.assets_path}/${this.prefix}/megasam/${scene}/pastfuture/Ours.mp4`;       // only for pastfuture
		const mega_sam_poses_path  = `${this.assets_path}/${this.prefix}/megasam_poses/${scene}/pastfuture/Ours.mp4`; // only for pastfuture

		// Ours
		this.ours_recon.src = ours_reconPath;   this.ours_recon.load();   this.ours_recon.currentTime = 0;
		this.ours_tracks.src = ours_tracksPath; this.ours_tracks.load();  this.ours_tracks.currentTime = 0;

		// MegaSAM (pastfuture only assets; still load paths for consistency)
		this.mega_sam.src = mega_sam_path; this.mega_sam.load(); this.mega_sam.currentTime = 0;
		this.mega_sam_poses.src = mega_sam_poses_path; this.mega_sam_poses.load(); this.mega_sam_poses.currentTime = 0;

		if (this.method === 'pastfuture') {
			[this.motionetr_recon, this.motionetr_tracks, this.jin_recon, this.jin_tracks].forEach(v => {
				v.src = method_not_supported; v.load(); v.currentTime = 0;
			});
		} else {
			this.motionetr_recon.src = motionetr_reconPath;   this.motionetr_recon.load();   this.motionetr_recon.currentTime = 0;
			this.motionetr_tracks.src = motionetr_tracksPath; this.motionetr_tracks.load();  this.motionetr_tracks.currentTime = 0;
			this.jin_recon.src = jin_reconPath;               this.jin_recon.load();         this.jin_recon.currentTime = 0;
			this.jin_tracks.src = jin_tracksPath;             this.jin_tracks.load();        this.jin_tracks.currentTime = 0;
		}
	}

	/* =========================
	   Playback controls
	   ========================= */
	toggle_play_pause() {
		this.isPlaying = !this.isPlaying;
		if (!this.isPlaying) {
			this.stop_anim();
		} else {
			// interpret playback_speed as seconds per frame (here we just use a fixed delay)
			const delayMs = 100; // tweak if desired
			this.cycle_frames(delayMs);
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
		if (this.isPresent()) {
			const low = this.presentMin();   // 8
			const high = this.presentMax();  // 23
			if (this.cur_frame >= high) this.anim_dir = -1;
			if (this.cur_frame <= low)  this.anim_dir =  1;
			this.change_frame(this.cur_frame + this.anim_dir);
			return;
		}
		// other modes: bounce across full range
		if (this.cur_frame >= this.max_idx - 1) this.anim_dir = -1;
		if (this.cur_frame === 0)               this.anim_dir =  1;
		this.change_frame(this.cur_frame + this.anim_dir);
	}

	cycle_frames(delay = 200) {
		this.stop_anim();
		this.interval_id = setInterval(() => this.next_frame(), delay);
	}

	stop_anim() {
		if (this.interval_id) clearInterval(this.interval_id);
		this.interval_id = null;
	}

	/* =========================
	   Visual glow (pastfuture only)
	   ========================= */
	applyGlowEffect() {
		const classes = ['video-glow-past', 'video-glow-present', 'video-glow-future'];
		this.video_elements.forEach(video => video?.classList.remove(...classes));
		if (this.method !== 'pastfuture') return;

		const region = this.getTemporalRegion(this.cur_frame);
		this.video_elements.forEach(video => video?.classList.add(`video-glow-${region}`));
	}
	getTemporalRegion(frameIndex) {
		if (frameIndex <= 3)  return 'past';
		if (frameIndex >= 12) return 'future';
		return 'present';
	}

	/* =========================
	   Method switcher
	   ========================= */
	set_method(name) {
		this.method = name;

		// Reset to start of mode (optional but recommended)
		this.cur_frame = 0;

		this.applyModeSliderShape();
		this.loadVideos?.();

		document.querySelectorAll(`#${this.prefix}-method-toggle button`).forEach(btn => {
			btn.classList.toggle("is-info",  btn.dataset.method === name);
			btn.classList.toggle("is-light", btn.dataset.method !== name);
		});

		const slider = this.getSlider?.() || document.getElementById(`${this.prefix}_frame_control`);
		const container = slider?.closest('.slider-container');

		if (container) {
			container.classList.remove('present32', 'pastfuture-active');
			if (name === 'present')      container.classList.add('present32');
			if (name === 'pastfuture')   container.classList.add('pastfuture-active');
		}
		if (slider) slider.classList.toggle('pastfuture', name === 'pastfuture');

		// Legend visibility (let CSS handle present32 & pastfuture-active; clear inline overrides)
		['past', 'future'].forEach(region => {
			const el = document.getElementById(`${this.prefix}-legend-${region}`);
			if (!el) return;
			if (name === 'present' || name === 'pastfuture') el.style.removeProperty('display');
			else el.style.display = 'none';
		});

		this.initSliderThumbBar?.();
		this.change_frame?.(this.cur_frame);
	}
}
