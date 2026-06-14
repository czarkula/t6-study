$("#checkButton").click(function() {
	check(true);
});

$("#checkS2Button").click(function() {
	check(false);
});
	
function check(all) {
	$("#boldfaceTable").find('.question').each(
		function(index) {
			if(all || $(this).hasClass("s2-required")) {
				var attempts = [];
				var answer = "";
				$(this).find('.checkarea').each(function(index) {attempts.push($(this).val())});
				$(this).find('.answer').each(function(index) {answer = $(this).html()});
				
				var attempt = normalizeStrict(attempts.join("\n"));
				answer = normalizeStrict(answer.replace(/<br\s*\/?>/gi, "\n").replace(/&amp;/g, "&"));
				
				if(attempt == answer) {
					$(this).css("background-color", "#c9f5d5");
				} else {
					$(this).css("background-color", "#f5c9c9");
				}
			}
		}
	);
}

$("#revealButton").click(function() {
	$("#boldfaceTable").find('.question').each(
		function(index) { 
			var answer = "";
			
			$(this).find('.answer').each(function(index) {answer = $(this).html()});
			
			answer = answer.replace(/<br\s*\/?>/gi, "\n").replace(/&amp;/g, "&");
			var answers = answer.split("\n");
			var fields = $(this).find('.checkarea');
			fields.each(function(index) {$(this).val(fields.length == 1 ? answer : answers[index] || "")});
		}
	);
});

function normalizeStrict(value) {
	return value
		.replace(/&amp;/g, "&")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split("\n")
		.map(function(line) { return line.trimEnd(); })
		.join("\n")
		.trim();
}
