(function() {
	var LEADERBOARD_KEY = "t6PracticeLeaderboard";
	var PENDING_SCORES_KEY = "t6PracticePendingScores";
	var NAME_KEY = "t6PracticeName";
	var THEME_KEY = "t6PracticeDarkMode";
	var COMBINED_KEY = "t6PracticeCombinedRun";

	window.T6Practice = {
		initLanding: initLanding,
		initLeaderboard: initLeaderboard,
		initCombinedTransition: initCombinedTransition,
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
		retryPendingScores().then(loadRemoteLeaderboard);

		var clearButton = document.getElementById("clearLeaderboard");
		if (clearButton) {
			clearButton.addEventListener("click", function() {
				localStorage.removeItem(LEADERBOARD_KEY);
				renderLeaderboard();
			});
		}
	}

	function initCombinedTransition() {
		var name = getName();
		var combinedState = getCombinedState(name);
		if (!combinedState || combinedState.completed.indexOf("boldface") === -1) {
			window.location.href = "index.html";
			return;
		}

		var nameTarget = document.getElementById("combinedName");
		var timerTarget = document.getElementById("combinedTimer");
		var continueButton = document.getElementById("continueCombined");
		if (nameTarget) nameTarget.textContent = combinedState.name || "Anonymous";

		function tick() {
			if (timerTarget) {
				timerTarget.textContent = formatTime(Date.now() - combinedState.startedAt);
			}
		}

		tick();
		setInterval(tick, 50);

		if (continueButton) {
			continueButton.href = buildCombinedUrl("ops.html", combinedState.name);
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
			revealed: combinedState ? !!combinedState.revealed : false,
			recorded: false
		};

		insertSessionBar(kind, name);
		updatePracticeLinks(name, combined);
		blockPaste();
		if (combined) {
			restoreAnswers(kind);
		}
		bindSessionName(state);
		bindHotSwap(state);
		if (state.combined && state.startedAt) {
			startTimer(state);
		}

		$(".checkarea, input.question").on("focus input", function() {
			startTimer(state);
			saveAnswers(state.kind);
		});

		window.T6PracticeState = state;
		retryPendingScores();
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
		updateSessionMessage("Complete. Saved locally. Uploading...");
		saveResult(kind, state.name, elapsedMs).then(function(uploaded) {
			updateSessionMessage(uploaded ?
				"Complete. Uploaded time: " + formatTime(elapsedMs) + "." :
				"Complete. Saved locally; upload pending and will retry."
			);
		});
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
				'<label class="session-name">Name: <input id="sessionName" type="text" value="' + escapeHtml(name === "Anonymous" ? "" : name) + '" placeholder="Anonymous" maxlength="32"></label>' +
				'<span>Page: <strong>' + escapeHtml(labelForKind(kind)) + '</strong></span>' +
				'<span>Time: <strong id="practiceTimer">00:00.000</strong></span>' +
			'</div>' +
			'<div class="session-tools">' +
				'<div class="session-message" id="sessionMessage">' + (isCombinedRun() ? "Combined timer starts when you type." : "Timer starts when you type.") + '</div>' +
				'<a class="session-swap" id="sessionSwap" href="#" style="display:none"></a>' +
			'</div>';
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
		$("[data-theme-toggle]").text(enabled ? "Light Mode" : "Dark Mode");
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
		return saveRemoteResult(score).then(function(uploaded) {
			if (!uploaded) {
				queuePendingScore(score);
			}
			return uploaded;
		});
	}

	function markAnswersShown() {
		var state = window.T6PracticeState;
		if (!state) return;
		state.revealed = true;
		if (state.combined) {
			var combinedState = getCombinedState(state.name) || {
				name: state.name,
				startedAt: state.startedAt,
				completed: []
			};
			combinedState.revealed = true;
			saveCombinedState(combinedState);
		}
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
		combinedState.name = state.name;
		combinedState.revealed = combinedState.revealed || state.revealed;
		saveCombinedState(combinedState);

		if (state.kind === "boldface") {
			state.recorded = true;
			clearInterval(state.timerId);
			updateSessionMessage("Boldface complete. Continue to Ops Limits.");
			window.location.href = buildCombinedUrl("combined-transition.html", state.name);
			return;
		}

		if (state.kind === "ops" && combinedState.completed.indexOf("boldface") !== -1) {
			state.recorded = true;
			clearInterval(state.timerId);
			var elapsedMs = Date.now() - combinedState.startedAt;
			updateSessionMessage("Both complete. Saved locally. Uploading...");
			saveResult("combined", state.name, elapsedMs).then(function(uploaded) {
				updateSessionMessage(uploaded ?
					"Both complete. Uploaded combined time: " + formatTime(elapsedMs) + "." :
					"Both complete. Saved locally; upload pending and will retry."
				);
			});
			clearCombinedState();
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
			state.answers = state.answers && typeof state.answers === "object" ? state.answers : {};
			state.revealed = !!state.revealed;
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

	function updatePracticeLinks(name, combined) {
		document.querySelectorAll('.navbar a[href*="boldface.html"], .navbar a[href*="ops.html"]').forEach(function(link) {
			var href = link.getAttribute("href").split("?")[0];
			var nextHref = combined ? appendQueryParam(href, "combo", "1") : href;
			if (name && name !== "Anonymous") {
				nextHref = appendQueryParam(nextHref, "name", name);
			}
			link.setAttribute("href", nextHref);
		});
	}

	function bindSessionName(state) {
		var input = document.getElementById("sessionName");
		if (!input) return;

		input.addEventListener("input", function() {
			var nextName = input.value.trim() || "Anonymous";
			state.name = nextName;
			updatePracticeLinks(nextName, state.combined);
			updateSwapLink(state);
			if (state.combined) {
				var combinedState = getCombinedState(nextName) || {
					name: nextName,
					startedAt: state.startedAt,
					completed: [],
					answers: {}
				};
				combinedState.name = nextName;
				if (state.startedAt) combinedState.startedAt = state.startedAt;
				saveCombinedState(combinedState);
			}
		});
	}

	function bindHotSwap(state) {
		var swap = document.getElementById("sessionSwap");
		if (!swap || !state.combined) return;

		var nextKind = state.kind === "boldface" ? "ops" : "boldface";
		var nextPath = nextKind === "ops" ? "ops.html" : "boldface.html";
		swap.textContent = nextKind === "ops" ? "Switch to Ops Limits" : "Switch to Boldface";
		swap.style.display = "inline-flex";
		updateSwapLink(state);
		swap.addEventListener("click", function() {
			saveAnswers(state.kind);
			var combinedState = getCombinedState(state.name) || {
				name: state.name,
				startedAt: state.startedAt || Date.now(),
				completed: [],
				answers: {}
			};
			combinedState.name = state.name;
			combinedState.startedAt = state.startedAt || combinedState.startedAt;
			saveCombinedState(combinedState);
		});
	}

	function updateSwapLink(state) {
		var swap = document.getElementById("sessionSwap");
		if (!swap || !state.combined) return;

		var nextPath = state.kind === "boldface" ? "ops.html" : "boldface.html";
		swap.href = buildCombinedUrl(nextPath, state.name);
	}

	function saveAnswers(kind) {
		var state = window.T6PracticeState;
		if (!state || !state.combined) return;

		var combinedState = getCombinedState(state.name) || {
			name: state.name,
			startedAt: state.startedAt,
			completed: [],
			answers: {}
		};
		combinedState.answers = combinedState.answers || {};
		combinedState.answers[kind] = {};
		document.querySelectorAll(".checkarea, input.question").forEach(function(field, index) {
			var key = field.id || "field-" + index;
			combinedState.answers[kind][key] = field.value;
		});
		combinedState.name = state.name;
		combinedState.startedAt = state.startedAt || combinedState.startedAt;
		saveCombinedState(combinedState);
	}

	function restoreAnswers(kind) {
		var combinedState = getCombinedState(getName());
		if (!combinedState || !combinedState.answers || !combinedState.answers[kind]) return;

		var answers = combinedState.answers[kind];
		document.querySelectorAll(".checkarea, input.question").forEach(function(field, index) {
			var key = field.id || "field-" + index;
			if (Object.prototype.hasOwnProperty.call(answers, key)) {
				field.value = answers[key];
			}
		});
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
				'<td><span class="leaderboard-rank">' + (index + 1) + "</span></td>" +
				'<td><span class="leaderboard-name">' + escapeHtml(result.name) + "</span></td>" +
				'<td><span class="leaderboard-kind">' + escapeHtml(labelForKind(result.kind)) + "</span></td>" +
				'<td><span class="leaderboard-time">' + formatTime(result.elapsedMs) + "</span></td>";
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
		return postRemoteScore(score);
	}

	function postRemoteScore(score) {
		var baseUrl = getBackendUrl();
		if (!baseUrl || !window.fetch) return Promise.resolve(false);

		return fetch(baseUrl + "/scores", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(score)
		}).then(function(response) {
			return response.ok;
		}).catch(function() {
			return false;
		});
	}

	function retryPendingScores() {
		var pending = getPendingScores();
		if (!pending.length) return Promise.resolve(true);

		return Promise.all(pending.map(function(score) {
			return postRemoteScore(score).then(function(uploaded) {
				return { score: score, uploaded: uploaded };
			});
		})).then(function(results) {
			var remaining = results
				.filter(function(result) { return !result.uploaded; })
				.map(function(result) { return result.score; });
			localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(remaining));
			return remaining.length === 0;
		});
	}

	function queuePendingScore(score) {
		var pending = getPendingScores();
		var key = scoreKey(score);
		var exists = pending.some(function(item) {
			return scoreKey(item) === key;
		});
		if (!exists) {
			pending.push(score);
		}
		localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(pending.slice(-20)));
	}

	function getPendingScores() {
		try {
			return JSON.parse(localStorage.getItem(PENDING_SCORES_KEY) || "[]");
		} catch (error) {
			return [];
		}
	}

	function scoreKey(score) {
		return [
			score.kind || "",
			score.name || "Anonymous",
			Math.round(Number(score.elapsedMs) || 0),
			score.date || ""
		].join("|");
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
