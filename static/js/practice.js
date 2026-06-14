(function() {
	var LEADERBOARD_KEY = "t6PracticeLeaderboard";
	var NAME_KEY = "t6PracticeName";
	var THEME_KEY = "t6PracticeDarkMode";
	var COMBINED_KEY = "t6PracticeCombinedRun";

	window.T6Practice = {
		initLanding: initLanding,
		initLeaderboard: initLeaderboard,
		initPracticePage: initPracticePage,
		markAnswersShown: markAnswersShown,
		recordIfComplete: recordIfComplete
	};

	function initLanding() {
		var nameInput = document.getElementById("pilotName");
		if (!nameInput) return;

		nameInput.value = "";

		document.querySelectorAll("[data-practice-link]").forEach(function(link) {
			link.addEventListener("click", function(event) {
				var name = nameInput.value.trim();
				var baseHref = link.getAttribute("data-base-href");
				if (baseHref.indexOf("combo=1") !== -1) {
					clearCombinedState();
				}
				if (name) {
					link.href = appendQueryParam(baseHref, "name", name);
				} else {
					link.href = baseHref;
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
		initThemeToggle();
		var name = getName();
		var combined = isCombinedRun();
		var combinedState = combined ? getCombinedState(name) : null;
		var state = {
			kind: kind,
			name: name,
			combined: combined,
			startedAt: combinedState ? combinedState.startedAt : null,
			timerId: null,
			revealed: false,
			recorded: false
		};

		insertSessionBar(kind, name);
		blockPaste();
		if (state.combined && state.startedAt) {
			startTimer(state);
		}

		$(".checkarea, input.question").on("focus input", function() {
			startTimer(state);
		});

		window.T6PracticeState = state;
	}

	function recordIfComplete(kind, isComplete) {
		var state = window.T6PracticeState;
		if (!state || state.kind !== kind || !state.startedAt || state.recorded || !isComplete) return;
		if (state.revealed) {
			state.recorded = true;
			clearInterval(state.timerId);
			updateSessionMessage("Correct, but not saved because answers were shown.");
			return;
		}

		if (state.combined) {
			recordCombinedStep(state);
			return;
		}

		state.recorded = true;
		clearInterval(state.timerId);
		var elapsedMs = Date.now() - state.startedAt;
		saveResult(kind, state.name, elapsedMs);
		updateSessionMessage("Complete. Saved time: " + formatTime(elapsedMs) + ".");
	}

	function startTimer(state) {
		if (state.startedAt) {
			if (!state.timerId) {
				state.timerId = setInterval(function() {
					updateTimer(Date.now() - state.startedAt);
				}, 50);
				updateTimer(Date.now() - state.startedAt);
				updateSessionMessage(state.combined ? "Combined timer running." : "Timer running.");
			}
			return;
		}
		state.startedAt = Date.now();
		if (state.combined) {
			saveCombinedState({
				name: state.name,
				startedAt: state.startedAt,
				completed: []
			});
		}
		state.timerId = setInterval(function() {
			updateTimer(Date.now() - state.startedAt);
		}, 50);
		updateTimer(0);
		updateSessionMessage(state.combined ? "Combined timer running." : "Timer running.");
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
			'<div class="session-message" id="sessionMessage">' + (isCombinedRun() ? "Combined timer starts when you type." : "Timer starts when you type.") + '</div>';
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
			return fromUrl;
		}
		return "Anonymous";
	}

	function initThemeToggle() {
		var enabled = localStorage.getItem(THEME_KEY) === "true";
		applyPracticeTheme(enabled);

		$("[data-theme-toggle]").on("click", function(event) {
			event.preventDefault();
			enabled = !document.body.classList.contains("practice-dark");
			localStorage.setItem(THEME_KEY, enabled ? "true" : "false");
			applyPracticeTheme(enabled);
		});
	}

	function applyPracticeTheme(enabled) {
		document.body.classList.toggle("practice-dark", enabled);
		$("[data-theme-toggle]").text(enabled ? "Light" : "Dark");
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

	function markAnswersShown() {
		var state = window.T6PracticeState;
		if (!state) return;
		state.revealed = true;
		updateSessionMessage("Answers shown. This run will not save to the leaderboard.");
	}

	function recordCombinedStep(state) {
		var combinedState = getCombinedState(state.name) || {
			name: state.name,
			startedAt: state.startedAt,
			completed: []
		};

		if (combinedState.completed.indexOf(state.kind) === -1) {
			combinedState.completed.push(state.kind);
		}
		combinedState.startedAt = combinedState.startedAt || state.startedAt;
		saveCombinedState(combinedState);

		if (state.kind === "boldface") {
			state.recorded = true;
			clearInterval(state.timerId);
			updateSessionMessage("Boldface complete. Loading Ops Limits...");
			window.setTimeout(function() {
				window.location.href = buildCombinedUrl("ops.html", state.name);
			}, 650);
			return;
		}

		if (state.kind === "ops" && combinedState.completed.indexOf("boldface") !== -1) {
			state.recorded = true;
			clearInterval(state.timerId);
			var elapsedMs = Date.now() - combinedState.startedAt;
			saveResult("combined", state.name, elapsedMs);
			clearCombinedState();
			updateSessionMessage("Both complete. Saved combined time: " + formatTime(elapsedMs) + ".");
			return;
		}

		updateSessionMessage("Ops complete. Start from Both on the homepage to save a combined time.");
	}

	function isCombinedRun() {
		var params = new URLSearchParams(window.location.search);
		return params.get("combo") === "1";
	}

	function getCombinedState(name) {
		try {
			var state = JSON.parse(sessionStorage.getItem(COMBINED_KEY) || "null");
			if (!state || !state.startedAt) return null;
			state.name = state.name || name || "Anonymous";
			state.completed = Array.isArray(state.completed) ? state.completed : [];
			return state;
		} catch (error) {
			return null;
		}
	}

	function saveCombinedState(state) {
		sessionStorage.setItem(COMBINED_KEY, JSON.stringify(state));
	}

	function clearCombinedState() {
		sessionStorage.removeItem(COMBINED_KEY);
	}

	function buildCombinedUrl(path, name) {
		var url = path + "?combo=1";
		if (name && name !== "Anonymous") {
			url = appendQueryParam(url, "name", name);
		}
		return url;
	}

	function appendQueryParam(url, key, value) {
		var separator = url.indexOf("?") === -1 ? "?" : "&";
		return url + separator + encodeURIComponent(key) + "=" + encodeURIComponent(value);
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

		var results = getResults().slice(0, 20);
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
				localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(mergeResults(getResults(), results).slice(0, 20)));
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

	function mergeResults(localResults, remoteResults) {
		var seen = {};
		return localResults.concat(remoteResults)
			.filter(function(result) {
				if (!result || typeof result !== "object") return false;
				var key = [
					result.kind || "",
					result.name || "Anonymous",
					Math.round(Number(result.elapsedMs) || 0)
				].join("|");
				if (seen[key]) return false;
				seen[key] = true;
				return true;
			})
			.sort(function(a, b) { return a.elapsedMs - b.elapsedMs; });
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
		if (kind === "ops") return "Ops Limits";
		if (kind === "combined") return "Both";
		return "Boldface";
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
