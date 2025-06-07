class ResControl {
	constructor(viewers) {
		this.viewers = viewers;
		this.prefix = "res"; // prefix used in the button container id: "res-toggle"
	}

	setResolution(resolution) {
		console.log(`Setting resolution to: ${resolution}`);

		// Update asset path for all viewers
		const path = resolution === "half" ? "ds_assets" : "assets";
		for (const viewer of this.viewers) {
			viewer.setResolution(resolution);
		}

		// Toggle button styling
		const name = resolution === "half" ? "halfres" : "fullres";
		document.querySelectorAll(`#${this.prefix}-toggle button`).forEach(btn => {
			btn.classList.toggle("is-info", btn.dataset.method === name);
			btn.classList.toggle("is-light", btn.dataset.method !== name);
		});
	}
}
