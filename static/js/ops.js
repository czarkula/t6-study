$("#checkButton").click(function() {
	var allCorrect = check(true);
	T6Practice.recordIfComplete("ops", allCorrect);
});

$("#checkS2Button").click(function() {
	check(false);
});

$(function() {
	setOpsTabOrder();
});

function setOpsTabOrder() {
	var leftColumnQuestions = [];
	var rightColumnQuestions = [];

	$("#boldfaceTable tr").each(function() {
		var cells = $(this).children("td");
		leftColumnQuestions = leftColumnQuestions.concat(cells.eq(0).find(".question").toArray());
		rightColumnQuestions = rightColumnQuestions.concat(cells.eq(1).find(".question").toArray());
	});

	$(leftColumnQuestions.concat(rightColumnQuestions, $("#checkButton")[0], $("#revealButton")[0]))
		.filter(function() { return this; })
		.each(function(index) {
			$(this).attr("tabindex", index + 1);
		});
}
	
function check(all) {
	var pageCorrect = true;

	$("#boldfaceTable").find('.question-group').each(
		function(index) { 
			if(all || $(this).hasClass("s2-required")) {
				var allCorrect = true;
				
				$(this).find('.question').each( function(index) {
					var attempt = $(this).val();
					var answer = $(this).attr("answer");
					
					attempt = normalizeStrict(attempt);
					answer = normalizeStrict(answer.replace(/<br\s*\/?>/gi, "\n"));
					
					if(attempt == answer) {
						$(this).css("background-color", "#c9f5d5");
					} else {
						$(this).css("background-color", "#f5c9c9");
						allCorrect = false;
					}
				});
				
				if(allCorrect) {
					$(this).css("background-color", "#c9f5d5");
				} else {
					$(this).css("background-color", "#f5c9c9");
					pageCorrect = false;
				}
			}
		}
	);

	return pageCorrect;
}

$("#revealButton").click(function() {
	T6Practice.markAnswersShown();
	$("#boldfaceTable").find('.question').each(
		function(index) { 
			var answer = $(this).attr("answer");
			
			answer = answer.replace(/<br\s*\/?>/gi, "\n");
			
			$(this).val(answer);
		}
	);
});

function normalizeStrict(value) {
	return value
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split("\n")
		.map(function(line) { return line.trimEnd(); })
		.join("\n")
		.trim();
}
