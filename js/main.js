const methods = ['present', 'pastfuture'];


// Global initialization
let wild_viewer = null;
let simulated_viewer = null;
let res_control = null;
let multimodal_viewer = null;
let embedding_viewer = null;
let exposure_control_viewer = null;

console.log("Initializing viewers...");
document.addEventListener("DOMContentLoaded", () => {
	try { simulated_viewer = new SimulatedViewer(); } 
	catch (e) { console.error("SimulatedViewer failed:", e); }

	try { wild_viewer = new InTheWildViewer(); } 
	catch (e) { console.error("InTheWildViewer failed:", e); }

	try { historical_viewer = new HistoricalViewer(); } 
	catch (e) { console.error("HistoricalViewer failed:", e); }

	try { gopro_viewer = new GoProViewer(); } 
	catch (e) { console.error("GoProViewer failed:", e); }

	try { baist_viewer = new BaistViewer(); } 
	catch (e) { console.error("BaistViewer failed:", e); }

	try { limitations_viewer = new LimitationsViewer(); } 
	catch (e) { console.error("LimitationsViewer failed:", e); }

	try { pose_viewer = new PoseViewer(); } 
	catch (e) { console.error("PoseViewer failed:", e); }

	try { multimodal_viewer = new MultimodalViewer(); } 
	catch (e) { console.error("MultimodalViewer failed:", e); }

	try { embedding_viewer = new EmbeddingViewer(); } 
	catch (e) { console.error("EmbeddingViewer failed:", e); }

	try { exposure_control_viewer = new ExposureControlViewer(); } 
	catch (e) { console.error("ExposureControlViewer failed:", e); }

	try {res_control = new ResControl([wild_viewer, historical_viewer, limitations_viewer, simulated_viewer, multimodal_viewer, embedding_viewer, exposure_control_viewer]); } // Pass all viewers we want to control resolution for
	catch (e) { console.error("ResControl failed:", e); }
	//res_control.setResolution("full"); // If I want Default resolution to be full
});