class MultimodalViewer {
	constructor() {
		this.prefix = 'multi';
		this.n_scenes = 4;
		this.playback_speed = 0.2;

		this.method = 'present';
		this.max_idx = 16;
		this.cur_frame = 0;
		this.base_im = '0000';
		this.interval_id = null;
		this.anim_dir = 1;
		this.ds = true;
		this.assets_path = `ds_assets`;

		this.v1 = document.getElementById(`${this.prefix}-1`);
		this.v2 = document.getElementById(`${this.prefix}-2`);
		this.v3 = document.getElementById(`${this.prefix}-3`);
		this.v4 = document.getElementById(`${this.prefix}-4`);
		this.input_img = document.getElementById(`${this.prefix}-input`);

		this.video_elements = [this.v1, this.v2, this.v3, this.v4];

		this.applyModeSliderShape();
		this.change_scene(this.base_im);
		this.initSceneSelector();
		this.initSliderSync();

		['past', 'future'].forEach(region => {
			const el = document.getElementById(`${this.prefix}-legend-${region}`);
			if (el) el.style.removeProperty('display');
		});

		this.isPlaying = false;
		this.toggle_play_pause();
	}

	/* ---------- helpers ---------- */
	getSlider() { return document.getElementById(`${this.prefix}_frame_control`); }
	getContainer() { return this.getSlider()?.closest('.slider-container') || null; }

	isPresent() { return this.method === 'present'; }
	presentMin() { return 8; }   // first green interval (0..31)
	presentMax() { return 23; }  // last green interval
	clampToPresent(k) { return this.isPresent() ? Math.max(this.presentMin(), Math.min(this.presentMax(), k)) : k; }
	toLogical(k) { return this.isPresent() ? (k - this.presentMin()) : k; }
	logicalIntervals() { return this.isPresent() ? 16 : this.max_idx; }

	seekWhenReady(video, targetTime) {
		if (!video) return;
		const doSeek = () => { try { video.currentTime = targetTime; } catch (_) {} };
		if (Number.isFinite(video.duration) && video.duration > 0) doSeek();
		else video.addEventListener('loadedmetadata', doSeek, { once: true });
	}

	/* ---------- scene selector ---------- */
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

	/* ---------- slider / ticks ---------- */
	buildTicks() {
		const slider = this.getSlider();
		const ticks = this.getContainer()?.querySelector('.slider-ticks');
		if (!slider || !ticks) return;
		const count = this.max_idx + 1;
		ticks.innerHTML = "";
		for (let i = 0; i < count; i++) ticks.appendChild(document.createElement('span'));
	}

	initSliderThumbBar() {
		const slider = this.getSlider();
		if (!slider) return;

		slider.min = 0;
		slider.max = this.max_idx - 1;
		slider.step = 1;
		slider.style.setProperty('--intervals', this.max_idx);

		this.buildTicks();

		if (!this._boundInputSnap) {
			this._boundInputSnap = (e) => {
				const raw = parseInt(e.target.value, 10) || 0;
				const k = this.clampToPresent(raw);
				if (k !== raw) e.target.value = String(k);
				this.change_frame(k);
			};
			slider.addEventListener('input', this._boundInputSnap);
		}

		const v = parseInt(slider.value || "0", 10);
		if (v > this.max_idx - 1) slider.value = String(this.max_idx - 1);
	}

	initSliderSync() {
		// Use v1 as the time source
		if (!this.v1) return;
		const slider = this.getSlider();
		if (!slider) return;

		this.initSliderThumbBar();

		if (!this._boundTimeupdate) {
			this._boundTimeupdate = () => {
				if (!this.v1.duration) return;
				const p = this.v1.currentTime / this.v1.duration;
				const denom = this.logicalIntervals();
				let lk = Math.min(Math.floor(p * denom), denom - 1); // logical index
				let k  = this.isPresent() ? (this.presentMin() + lk) : lk; // visual index

				if (parseInt(slider.value, 10) !== k) {
					slider.value = k;
					this.cur_frame = k;
					this.applyGlowEffect();
				}
			};
			this.v1.addEventListener('timeupdate', this._boundTimeupdate);
		}
	}

	applyModeSliderShape() {
		this.max_idx = this.isPresent() ? 32 : 16;

		const slider = this.getSlider();
		if (slider) {
			slider.min = 0;
			slider.max = this.max_idx - 1;
			slider.step = 1;
			slider.style.setProperty('--intervals', this.max_idx);
		}

		const container = this.getContainer();
		if (container) container.classList.toggle('present32', this.isPresent());

		this.buildTicks();
	}

	/* ---------- frame / scene ---------- */
	change_frame(idx) {
		let k = Math.max(0, Math.min(this.max_idx - 1, parseInt(idx, 10)));
		k = this.clampToPresent(k);
		this.cur_frame = k;

		// map to logical and seek all videos
		const lk = this.toLogical(k);
		const denom = this.logicalIntervals();
		const norm = (lk + 0.5) / denom;

		this.video_elements.forEach(video => {
			if (!video) return;
			const target = Number.isFinite(video.duration) && video.duration > 0 ? norm * video.duration : 0;
			this.seekWhenReady(video, target);
		});

		const slider = this.getSlider();
		if (slider && parseInt(slider.value, 10) !== k) slider.value = String(k);

		this.applyGlowEffect();
	}

	change_scene(scene_id) {
		this.base_im = scene_id;
		this.cur_frame = this.isPresent() ? this.presentMin() : 0;

		if (this.input_img) {
			this.input_img.src = `${this.assets_path}/${this.prefix}/blurry/${scene_id}_present.png`;
		}
		this.loadVideos();
		this.initSliderThumbBar();
		this.change_frame(this.cur_frame);
	}

	setResolution(resolution) {
		this.ds = resolution === "half";
		this.assets_path = this.ds ? `ds_assets` : `assets`;
		this.change_scene(this.base_im);
	}

	/* ---------- media ---------- */
	loadVideos() {
		const scene = this.base_im;
		const method = this.method;
		const v1_path = `${this.assets_path}/${this.prefix}/videos/${scene}/${method}/v1.mp4`;
		const v2_path = `${this.assets_path}/${this.prefix}/videos/${scene}/${method}/v2.mp4`;
		const v3_path = `${this.assets_path}/${this.prefix}/videos/${scene}/${method}/v3.mp4`;
		const v4_path = `${this.assets_path}/${this.prefix}/videos/${scene}/${method}/v4.mp4`;

		this.v1.src = v1_path; this.v1.load(); this.v1.currentTime = 0;
		this.v2.src = v2_path; this.v2.load(); this.v2.currentTime = 0;
		this.v3.src = v3_path; this.v3.load(); this.v3.currentTime = 0;
		this.v4.src = v4_path; this.v4.load(); this.v4.currentTime = 0;
	}

	/* ---------- play/pause ---------- */
	toggle_play_pause() {
		this.isPlaying = !this.isPlaying;
		if (!this.isPlaying) {
			this.stop_anim();
		} else {
			const delayMs = 100;
			this.cycle_frames(delayMs);
		}
		this.updatePlayButton();
	}

	updatePlayButton() {
		const btn = document.getElementById(`${this.prefix}-play-pause-btn`);
		const icon = document.getElementById(`${this.prefix}-play-pause-icon`);
		const label = btn?.querySelector("span:last-child");
		if (!btn || !icon) return;
		if (this.isPlaying) {
			icon.className = "fas fa-pause";
			if (label) label.textContent = "Pause";
		} else {
			icon.className = "fas fa-play";
			if (label) label.textContent = "Play";
		}
	}

	/* ---------- animation ---------- */
	next_frame() {
		if (this.isPresent()) {
			const low = this.presentMin();
			const high = this.presentMax();
			if (this.cur_frame >= high) this.anim_dir = -1;
			if (this.cur_frame <= low)  this.anim_dir =  1;
			this.change_frame(this.cur_frame + this.anim_dir);
			return;
		}
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

	/* ---------- visuals ---------- */
	applyGlowEffect() {
		const classes = ['video-glow-past', 'video-glow-present', 'video-glow-future'];
		this.video_elements.forEach(v => v?.classList.remove(...classes));
		if (this.method !== 'pastfuture') return;
		const region = this.getTemporalRegion(this.cur_frame);
		this.video_elements.forEach(v => v?.classList.add(`video-glow-${region}`));
	}

	getTemporalRegion(frameIndex) {
		if (frameIndex <= 3)  return 'past';
		if (frameIndex >= 12) return 'future';
		return 'present';
	}

	/* ---------- method switch ---------- */
	set_method(name) {
		this.method = name;

		// restart from 0; present will clamp into center on next render
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
			if (name === 'present')    container.classList.add('present32');
			if (name === 'pastfuture') container.classList.add('pastfuture-active');
		}
		if (slider) slider.classList.toggle('pastfuture', name === 'pastfuture');

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
