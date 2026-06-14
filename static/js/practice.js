(function() {
	var LEADERBOARD_KEY = "t6PracticeLeaderboard";
	var NAME_KEY = "t6PracticeName";

	window.T6Practice = {
		initLanding: initLanding,
		initLeaderboard: initLeaderboard,
		initPracticePage: initPracticePage,
		recordIfComplete: recordIfComplete
	};

	function initLanding() {
		var nameInput = document.getElementById("pilotName");
		if (!nameInput) return;

		nameInput.value = localStorage.getItem(NAME_KEY) || "";

		document.querySelectorAll("[data-practice-link]").forEach(function(link) {
			link.addEventListener("click", function(event) {
				var name = nameInput.value.trim();
				if (name) {
					localStorage.setItem(NAME_KEY, name);
					link.href = link.getAttribute("data-base-href") + "?name=" + encodeURIComponent(name);
				} else {
					localStorage.removeItem(NAME_KEY);
					link.href = link.getAttribute("data-base-href");
				}
			});
		});
	}

	function initLeaderboard() {
		renderLeaderboard();
		loadRemoteLeaderboard();

		var clearButton = document.getElementById("clearLeaderboard");
		if (clearButton) {
			clearButton.addEventListener("click", function() {
				localStorage.removeItem(LEADERBOARD_KEY);
				renderLeaderboard();
			});
		}
	}

	function initPracticePage(kind) {
		var name = getName();
		var state = {
			kind: kind,
			name: name,
			startedAt: null,
			timerId: null,
			recorded: false
		};

		insertSessionBar(kind, name);
		blockPaste();

		$(".checkarea, input.question").on("focus input", function() {
			startTimer(state);
		});

		window.T6PracticeState = state;
	}

	function recordIfComplete(kind, isComplete) {
		var state = window.T6PracticeState;
		if (!state || state.kind !== kind || !state.startedAt || state.recorded || !isComplete) return;

		state.recorded = true;
		clearInterval(state.timerId);
		var elapsedMs = Date.now() - state.startedAt;
		saveResult(kind, state.name, elapsedMs);
		updateSessionMessage("Complete. Saved time: " + formatTime(elapsedMs) + ".");
	}

	function startTimer(state) {
		if (state.startedAt) return;
		state.startedAt = Date.now();
		state.timerId = setInterval(function() {
			updateTimer(Date.now() - state.startedAt);
		}, 50);
		updateTimer(0);
		updateSessionMessage("Timer running.");
	}

	function insertSessionBar(kind, name) {
		var main = document.querySelector("main");
		if (!main) return;

		var bar = document.createElement("div");
		bar.className = "session-bar";
		bar.innerHTML =
			'<div class="session-meta">' +
				'<span>Name: <strong>' + escapeHtml(name) + '</strong></span>' +
				'<span>Page: <strong>' + escapeHtml(labelForKind(kind)) + '</strong></span>' +
				'<span>Time: <strong id="practiceTimer">00:00.000</strong></span>' +
			'</div>' +
			'<div class="session-message" id="sessionMessage">Timer starts when you type.</div>';
		main.insertBefore(bar, main.firstChild);
	}

	function blockPaste() {
		$(document).on("paste drop contextmenu", ".checkarea, input.question", function(event) {
			event.preventDefault();
		});

		$(document).on("keydown", ".checkarea, input.question", function(event) {
			var key = String(event.key || "").toLowerCase();
			if ((event.ctrlKey || event.metaKey) && key === "v") {
				event.preventDefault();
			}
		});
	}

	function getName() {
		var params = new URLSearchParams(window.location.search);
		var fromUrl = (params.get("name") || "").trim();
		if (fromUrl) {
			localStorage.setItem(NAME_KEY, fromUrl);
			return fromUrl;
		}
		return localStorage.getItem(NAME_KEY) || "Anonymous";
	}

	function saveResult(kind, name, elapsedMs) {
		var score = {
			kind: kind,
			name: name || "Anonymous",
			elapsedMs: elapsedMs,
			date: new Date().toISOString()
		};
		var results = getResults();
		results.push(score);
		results.sort(function(a, b) { return a.elapsedMs - b.elapsedMs; });
		localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(results.slice(0, 20)));
		saveRemoteResult(score);
	}

	function getResults() {
		try {
			return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
		} catch (error) {
			return [];
		}
	}

	function renderLeaderboard() {
		var target = document.getElementById("leaderboardBody");
		var empty = document.getElementById("leaderboardEmpty");
		if (!target || !empty) return;

		var results = getResults().slice(0, 10);
		target.innerHTML = "";
		empty.style.display = results.length ? "none" : "block";

		results.forEach(function(result, index) {
			var row = document.createElement("tr");
			row.innerHTML =
				"<td>" + (index + 1) + "</td>" +
				"<td>" + escapeHtml(result.name) + "</td>" +
				"<td>" + escapeHtml(labelForKind(result.kind)) + "</td>" +
				"<td>" + formatTime(result.elapsedMs) + "</td>";
			target.appendChild(row);
		});
	}

	function loadRemoteLeaderboard() {
		var baseUrl = getBackendUrl();
		if (!baseUrl || !window.fetch) return;

		fetch(baseUrl + "/scores", { cache: "no-store" })
			.then(function(response) {
				if (!response.ok) throw new Error("Leaderboard request failed");
				return response.json();
			})
			.then(function(results) {
				if (!Array.isArray(results)) return;
				localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(results.slice(0, 20)));
				renderLeaderboard();
			})
			.catch(function() {
				renderLeaderboard();
			});
	}

	function saveRemoteResult(score) {
		var baseUrl = getBackendUrl();
		if (!baseUrl || !window.fetch) return;

		fetch(baseUrl + "/scores", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(score)
		}).catch(function() {});
	}

	function getBackendUrl() {
		return String(window.T6_BACKEND_URL || "").replace(/\/+$/, "");
	}

	function updateTimer(elapsedMs) {
		var timer = document.getElementById("practiceTimer");
		if (timer) timer.textContent = formatTime(elapsedMs);
	}

	function updateSessionMessage(message) {
		var target = document.getElementById("sessionMessage");
		if (target) target.textContent = message;
	}

	function formatTime(ms) {
		var totalMs = Math.max(0, Math.floor(ms));
		var milliseconds = totalMs % 1000;
		var totalSeconds = Math.floor(totalMs / 1000);
		var seconds = totalSeconds % 60;
		var minutes = Math.floor(totalSeconds / 60);
		return pad(minutes) + ":" + pad(seconds) + "." + String(milliseconds).padStart(3, "0");
	}

	function pad(value) {
		return String(value).padStart(2, "0");
	}

	function labelForKind(kind) {
		return kind === "ops" ? "Ops Limits" : "Boldface";
	}

	function escapeHtml(value) {
		return String(value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
})();
