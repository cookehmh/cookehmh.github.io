(function () {
	"use strict";

	var COLOURS = ["#1c579e", "#1c9e79", "#024963", "#3D9CB3", "#C7639D", "#FAA7CB", "#FFEDF7", "#663351"];
	var MALE_COLOUR = COLOURS[1];
	var FEMALE_COLOUR = COLOURS[0];
	var CONCEPT_COLOUR = COLOURS[3];
	var SCIENTIST_COLOUR = COLOURS[2];
	var REGION_COLOURS = ["#32a84e", "#32a8a8", "#3279a8", "#4e32a8", "#8532a8", "#a83285"];
	var PURPLE = "#5B4492";
	var PURPLE_LIGHT = "#9B7FD4";

	var KEY_STAGE_OPTIONS = {
		"KS5 - A-Level / Scottish Highers (ages 16-18)": "ks5",
		"KS4 - GCSE / NQ5 (ages 14-16)": "ks4"
	};

	var VIEW_OPTIONS = [
		"Subject breakdown (by gender)",
		"Unique scientists by gender",
		"Concept vs scientist mentions",
		"Scientists by region",
		"Scientists by nationality",
		"KS4 vs KS5 region comparison"
	];

	var DEMOGRAPHIC_OPTIONS = {
		"Gender": "gender",
		"Region": "region",
		"Nationality": "nationality"
	};

	var SUBJECT_LABELS = {
		"environmental science": "Environmental science",
		"biology": "Biology",
		"physics": "Physics",
		"chemistry": "Chemistry",
		"geology": "Geology",
		"astronomy": "Astronomy"
	};

	var DATA = null;
	var chartEl = null;
	var summaryEl = null;
	var namesEl = null;
	var stageSelect = null;
	var boardSelect = null;
	var viewSelect = null;
	var demoDimensionSelect = null;
	var demoValueSelect = null;
	var currentViewName = VIEW_OPTIONS[0];
	var chartClickBound = false;

	function prettify(text) {
		if (!text) {
			return "Unknown";
		}
		var s = String(text).trim().toLowerCase();
		if (s === "nan" || s === "none" || s === "unknown" || s === "") {
			return "Unknown";
		}
		return String(text).trim().replace(/\b\w/g, function (c) { return c.toUpperCase(); }).replace("Eruope", "Europe");
	}

	function prettifyName(name) {
		if (!name) {
			return "";
		}
		return String(name).split(",").map(function (chunk) {
			return chunk.trim().split(/\s+/).map(function (word) {
				return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
			}).join(" ");
		}).join(", ");
	}

	function stageCfg(stageKey) {
		return DATA[stageKey].cfg;
	}

	function stageDataset(stageKey) {
		return DATA[stageKey].dataset;
	}

	function boardFileKey(stageKey, boardDisplay) {
		return stageCfg(stageKey).boards_map[boardDisplay];
	}

	function boardLabels(stageKey) {
		return stageCfg(stageKey).board_labels || {};
	}

	function displayBoardName(stageKey, board) {
		return boardLabels(stageKey)[board] || board;
	}

	function subjectsForBoard(stageKey, boardDisplay) {
		var dataset = stageDataset(stageKey);
		var boardKey = boardFileKey(stageKey, boardDisplay);
		var core = { physics: true, chemistry: true, biology: true };
		var subjects = dataset[boardKey].subjects;
		return Object.keys(subjects).filter(function (sb) {
			var info = subjects[sb];
			if (core[sb]) {
				return true;
			}
			if (info.concept) {
				return (info.concept.male || 0) + (info.concept.female || 0) > 0;
			}
			return false;
		});
	}

	function mergeScientists(stageKey, boardDisplay) {
		var dataset = stageDataset(stageKey);
		var boards = stageCfg(stageKey).boards_display.slice();
		if (boardDisplay !== undefined && boardDisplay !== null) {
			boards = [boardDisplay];
		}
		var merged = {};
		boards.forEach(function (board) {
			var boardKey = boardFileKey(stageKey, board);
			var names = dataset[boardKey].names;
			Object.keys(names).forEach(function (name) {
				var info = names[name];
				var label = displayBoardName(stageKey, board);
				if (!merged[name]) {
					merged[name] = {
						gender: info.gender || "unknown",
						region: info.region || "unknown",
						nationality: info.nationality || "unknown",
						mentions: info["number of mentions"] || 0,
						boards: [label]
					};
				} else {
					if (merged[name].boards.indexOf(label) === -1) {
						merged[name].boards.push(label);
					}
					merged[name].mentions = Math.max(merged[name].mentions, info["number of mentions"] || 0);
				}
			});
		});
		return merged;
	}

	function filterScientists(scientists, filters) {
		filters = filters || {};
		var rows = [];
		Object.keys(scientists).forEach(function (name) {
			var info = scientists[name];
			var g = String(info.gender || "unknown").toLowerCase();
			var r = String(info.region || "unknown").toLowerCase();
			var n = String(info.nationality || "unknown").toLowerCase();
			if (filters.gender && g !== String(filters.gender).toLowerCase()) {
				return;
			}
			if (filters.region && r !== String(filters.region).toLowerCase()) {
				return;
			}
			if (filters.nationality && n !== String(filters.nationality).toLowerCase()) {
				return;
			}
			rows.push([name, info]);
		});
		return rows;
	}

	function countByDimension(scientists, dimension) {
		var counter = {};
		Object.keys(scientists).forEach(function (name) {
			var key = String(scientists[name][dimension] || "unknown").toLowerCase();
			counter[key] = (counter[key] || 0) + 1;
		});
		var labels = Object.keys(counter).sort(function (a, b) {
			if (counter[b] !== counter[a]) {
				return counter[b] - counter[a];
			}
			return a.localeCompare(b);
		});
		return { counter: counter, labels: labels };
	}

	function demographicValues(scientists, dimension) {
		return countByDimension(scientists, dimension).labels;
	}

	function demographicCounts(scientists, dimension) {
		var result = countByDimension(scientists, dimension);
		var labels = result.labels;
		var counter = result.counter;
		var counts = labels.map(function (k) { return counter[k]; });
		var total = counts.reduce(function (a, b) { return a + b; }, 0) || 1;
		var displayLabels = labels.map(prettify);
		var hover = labels.map(function (k) {
			return prettify(k) + "<br>Count: " + counter[k] + "<br>Share: " + (counter[k] / total * 100).toFixed(1) + "%";
		});
		return { labels: labels, counts: counts, displayLabels: displayLabels, hover: hover, total: total };
	}

	function namesHtml(rows, title) {
		if (!rows.length) {
			return "<p><em>No scientists match <strong>" + title + "</strong>.</em></p>";
		}
		var html = [
			"<div class=\"includeher-names-table-wrap\">",
			"<p class=\"includeher-names-title\"><strong>" + title + "</strong> &mdash; " + rows.length + " scientist" + (rows.length !== 1 ? "s" : "") + "</p>",
			"<table class=\"includeher-names-table\">",
			"<thead><tr><th>Name</th><th>Gender</th><th>Region</th><th>Nationality</th><th>Mentions</th></tr></thead>",
			"<tbody>"
		];
		rows.sort(function (a, b) {
			return prettifyName(a[0]).localeCompare(prettifyName(b[0]));
		}).forEach(function (row) {
			var name = row[0];
			var info = row[1];
			html.push(
				"<tr><td>" + prettifyName(name) + "</td><td>" + prettify(info.gender) +
				"</td><td>" + prettify(info.region) + "</td><td>" + prettify(info.nationality) +
				"</td><td>" + (info.mentions || 0) + "</td></tr>"
			);
		});
		html.push("</tbody></table></div>");
		return html.join("");
	}

	function axisRangeFromValues() {
		var maxVal = 0;
		for (var i = 0; i < arguments.length; i++) {
			arguments[i].forEach(function (v) {
				if (v > maxVal) {
					maxVal = v;
				}
			});
		}
		if (maxVal === 0) {
			return [0, 1];
		}
		return [0, Math.max(1, Math.ceil(maxVal * 1.1))];
	}

	function pieFigure(labels, counts, displayLabels, hover, title, colours) {
		colours = colours || REGION_COLOURS;
		var labelPad = Math.max(100, 40 + counts.length * 12);
		return {
			data: [{
				type: "pie",
				labels: displayLabels,
				values: counts,
				hole: 0.45,
				marker: { colors: counts.map(function (_, i) { return colours[i % colours.length]; }) },
				textinfo: "percent+label",
				textposition: "outside",
				outsidetextfont: { size: 12 },
				hovertext: hover,
				hoverinfo: "text",
				customdata: labels
			}],
			layout: {
				title: title,
				height: Math.max(560, 320 + counts.length * 28),
				margin: { t: 80, b: labelPad, l: labelPad, r: labelPad },
				autosize: true,
				showlegend: false
			}
		};
	}

	function subjectFigure(stageKey, boardDisplay) {
		var dataset = stageDataset(stageKey);
		var boardKey = boardFileKey(stageKey, boardDisplay);
		var subjects = subjectsForBoard(stageKey, boardDisplay);
		var yLabels = subjects.map(function (sb) { return SUBJECT_LABELS[sb] || sb.charAt(0).toUpperCase() + sb.slice(1); });
		var maleC = [], femaleC = [], maleS = [], femaleS = [], hoverC = [], hoverS = [];

		subjects.forEach(function (sb) {
			var subj = dataset[boardKey].subjects[sb];
			var catC = (subj && subj.concept) ? subj.concept : { male: 0, female: 0 };
			var catS = (subj && subj.scientist) ? subj.scientist : { male: 0, female: 0 };
			var mc = catC.male || 0;
			var fc = catC.female || 0;
			var ms = catS.male || 0;
			var fs = catS.female || 0;
			maleC.push(mc);
			femaleC.push(fc);
			maleS.push(ms);
			femaleS.push(fs);
			var totC = mc + fc || 1;
			var totS = ms + fs || 1;
			hoverC.push("Concept mentions<br>Men: " + mc + " (" + (mc / totC * 100).toFixed(1) + "%)<br>Women: " + fc + " (" + (fc / totC * 100).toFixed(1) + "%)");
			hoverS.push("Scientist mentions<br>Men: " + ms + " (" + (ms / totS * 100).toFixed(1) + "%)<br>Women: " + fs + " (" + (fs / totS * 100).toFixed(1) + "%)");
		});

		var conceptRange = axisRangeFromValues(maleC, femaleC);
		var scientistRange = axisRangeFromValues(maleS, femaleS);

		return {
			data: [
				{ type: "bar", orientation: "h", y: yLabels, x: maleC, name: "Men", marker: { color: MALE_COLOUR }, hovertext: hoverC, hoverinfo: "text", xaxis: "x", yaxis: "y" },
				{ type: "bar", orientation: "h", y: yLabels, x: femaleC, name: "Women", marker: { color: FEMALE_COLOUR }, hovertext: hoverC, hoverinfo: "text", xaxis: "x", yaxis: "y" },
				{ type: "bar", orientation: "h", y: yLabels, x: maleS, name: "Men ", marker: { color: MALE_COLOUR }, hovertext: hoverS, hoverinfo: "text", showlegend: false, xaxis: "x2", yaxis: "y2" },
				{ type: "bar", orientation: "h", y: yLabels, x: femaleS, name: "Women ", marker: { color: FEMALE_COLOUR }, hovertext: hoverS, hoverinfo: "text", showlegend: false, xaxis: "x2", yaxis: "y2" }
			],
			layout: {
				grid: { rows: 1, columns: 2, pattern: "independent" },
				barmode: "stack",
				title: "Subject breakdown - " + displayBoardName(stageKey, boardDisplay),
				height: Math.max(420, 55 * subjects.length + 160),
				margin: { t: 90, b: 70, l: 140, r: 50 },
				autosize: true,
				annotations: [
					{ text: "Concept mentions", x: 0.22, y: 1.08, xref: "paper", yref: "paper", showarrow: false, font: { size: 13 } },
					{ text: "Scientist mentions", x: 0.78, y: 1.08, xref: "paper", yref: "paper", showarrow: false, font: { size: 13 } }
				],
				xaxis: { title: { text: "Mentions", standoff: 12 }, automargin: true, range: conceptRange, rangemode: "tozero" },
				xaxis2: { title: { text: "Mentions", standoff: 12 }, automargin: true, range: scientistRange, rangemode: "tozero" },
				yaxis: { automargin: true },
				yaxis2: { automargin: true }
			}
		};
	}

	function genderFigure(stageKey, boardDisplay) {
		var dataset = stageDataset(stageKey);
		var boardKey = boardFileKey(stageKey, boardDisplay);
		var unique = dataset[boardKey].overall.unique;
		var male = unique.male || 0;
		var female = unique.female || 0;
		var total = male + female || 1;
		return pieFigure(
			["male", "female"],
			[male, female],
			["Men", "Women"],
			[
				"Men<br>Count: " + male + "<br>Share: " + (male / total * 100).toFixed(1) + "%",
				"Women<br>Count: " + female + "<br>Share: " + (female / total * 100).toFixed(1) + "%"
			],
			"Unique named scientists by gender - " + displayBoardName(stageKey, boardDisplay),
			[MALE_COLOUR, FEMALE_COLOUR]
		);
	}

	function mentionTypeFigure(stageKey, boardDisplay) {
		var dataset = stageDataset(stageKey);
		var boardKey = boardFileKey(stageKey, boardDisplay);
		var overall = dataset[boardKey].overall;
		var concept = (overall.concept.male || 0) + (overall.concept.female || 0);
		var scientist = (overall.scientist.male || 0) + (overall.scientist.female || 0);
		var total = concept + scientist || 1;
		return pieFigure(
			["concept", "scientist"],
			[concept, scientist],
			["Concept", "Scientist"],
			[
				"Concept mentions<br>Count: " + concept + "<br>Share: " + (concept / total * 100).toFixed(1) + "%",
				"Scientist mentions<br>Count: " + scientist + "<br>Share: " + (scientist / total * 100).toFixed(1) + "%"
			],
			"Mention type - " + displayBoardName(stageKey, boardDisplay),
			[CONCEPT_COLOUR, SCIENTIST_COLOUR]
		);
	}

	function regionFigure(stageKey, boardDisplay) {
		var scientists = mergeScientists(stageKey, boardDisplay);
		var counts = demographicCounts(scientists, "region");
		var scope = boardDisplay ? displayBoardName(stageKey, boardDisplay) : "all exam boards";
		return pieFigure(counts.labels, counts.counts, counts.displayLabels, counts.hover, "Scientists by region - " + scope);
	}

	function nationalityFigure(stageKey, boardDisplay) {
		var scientists = mergeScientists(stageKey, boardDisplay);
		var counts = demographicCounts(scientists, "nationality");
		var scope = boardDisplay ? displayBoardName(stageKey, boardDisplay) : "all exam boards";
		return pieFigure(counts.labels, counts.counts, counts.displayLabels, counts.hover, "Scientists by nationality - " + scope);
	}

	function regionComparisonFigure() {
		var scientistsG = mergeScientists("ks4");
		var scientistsA = mergeScientists("ks5");
		var regionsG = countByDimension(scientistsG, "region");
		var regionsA = countByDimension(scientistsA, "region");
		var allRegions = {};
		regionsG.labels.concat(regionsA.labels).forEach(function (r) { allRegions[r] = true; });
		var regionList = Object.keys(allRegions).sort(function (a, b) {
			var sumA = (regionsG.counter[a] || 0) + (regionsA.counter[a] || 0);
			var sumB = (regionsG.counter[b] || 0) + (regionsA.counter[b] || 0);
			return sumB - sumA;
		});
		var totalG = regionsG.labels.reduce(function (s, k) { return s + regionsG.counter[k]; }, 0) || 1;
		var totalA = regionsA.labels.reduce(function (s, k) { return s + regionsA.counter[k]; }, 0) || 1;
		var pctG = regionList.map(function (r) { return (regionsG.counter[r] || 0) / totalG * 100; });
		var pctA = regionList.map(function (r) { return (regionsA.counter[r] || 0) / totalA * 100; });
		var pctMax = Math.max.apply(null, pctG.concat(pctA).concat([0]));
		var pctRange = pctMax === 0 ? [0, 1] : [0, Math.ceil(pctMax * 1.1)];
		var yLabels = regionList.map(prettify);
		var hoverG = regionList.map(function (r) {
			var c = regionsG.counter[r] || 0;
			return "KS4 - " + prettify(r) + "<br>Scientists: " + c + "<br>Share: " + (c / totalG * 100).toFixed(1) + "%";
		});
		var hoverA = regionList.map(function (r) {
			var c = regionsA.counter[r] || 0;
			return "KS5 - " + prettify(r) + "<br>Scientists: " + c + "<br>Share: " + (c / totalA * 100).toFixed(1) + "%";
		});

		return {
			data: [
				{ type: "bar", orientation: "h", y: yLabels, x: pctG, name: "KS4 (GCSE / NQ5)", marker: { color: PURPLE }, hovertext: hoverG, hoverinfo: "text", customdata: regionList },
				{ type: "bar", orientation: "h", y: yLabels, x: pctA, name: "KS5 (A-Level / Highers)", marker: { color: PURPLE_LIGHT }, hovertext: hoverA, hoverinfo: "text", customdata: regionList }
			],
			layout: {
				barmode: "group",
				title: "Regional representation - KS4 vs KS5 (% of unique scientists)",
				xaxis: { title: { text: "Percentage (%)", standoff: 12 }, automargin: true, range: pctRange, rangemode: "tozero" },
				yaxis: { automargin: true },
				height: Math.max(500, 42 * regionList.length + 180),
				margin: { l: 160, t: 70, r: 50, b: 70 },
				autosize: true
			}
		};
	}

	function buildFigure(stageKey, boardDisplay, viewName) {
		switch (viewName) {
			case "Subject breakdown (by gender)":
				return subjectFigure(stageKey, boardDisplay);
			case "Unique scientists by gender":
				return genderFigure(stageKey, boardDisplay);
			case "Concept vs scientist mentions":
				return mentionTypeFigure(stageKey, boardDisplay);
			case "Scientists by region":
				return regionFigure(stageKey, boardDisplay);
			case "Scientists by nationality":
				return nationalityFigure(stageKey, boardDisplay);
			case "KS4 vs KS5 region comparison":
				return regionComparisonFigure();
			default:
				throw new Error("Unknown view: " + viewName);
		}
	}

	function summaryHtml(stageKey, boardDisplay, viewName) {
		var scientists = mergeScientists(stageKey, boardDisplay);
		var total = Object.keys(scientists).length;
		var women = 0;
		var men = 0;
		Object.keys(scientists).forEach(function (name) {
			var g = String(scientists[name].gender || "").toLowerCase();
			if (g === "female") {
				women += 1;
			} else if (g === "male") {
				men += 1;
			}
		});
		var pctWomen = total ? (women / total * 100).toFixed(1) : "0.0";
		return "<div class=\"includeher-summary\">" +
			"<strong>" + displayBoardName(stageKey, boardDisplay) + "</strong> | " +
			total + " unique scientists | " +
			women + " women (" + pctWomen + "%) | " +
			men + " men | View: " + viewName +
			"</div>";
	}

	function getStageKey() {
		return KEY_STAGE_OPTIONS[stageSelect.value];
	}

	function showNamesForSelection(dimension, rawValue, extraTitle) {
		extraTitle = extraTitle || "";
		var stageKey = getStageKey();
		var scientists = mergeScientists(stageKey, boardSelect.value);
		var filters = {};
		if (dimension && rawValue !== undefined && rawValue !== null) {
			filters[dimension] = rawValue;
		}
		var rows = filterScientists(scientists, filters);
		var title;
		if (dimension && rawValue !== undefined && rawValue !== null) {
			title = prettify(rawValue) + " (" + prettify(dimension) + ")" + extraTitle;
		} else {
			title = "All scientists - " + displayBoardName(stageKey, boardSelect.value) + extraTitle;
		}
		namesEl.innerHTML = namesHtml(rows, title);
	}

	function refreshDemoValues() {
		var stageKey = getStageKey();
		var scientists = mergeScientists(stageKey, boardSelect.value);
		var dimension = DEMOGRAPHIC_OPTIONS[demoDimensionSelect.value];
		var values = demographicValues(scientists, dimension);
		demoValueSelect.innerHTML = "";
		values.forEach(function (v) {
			var opt = document.createElement("option");
			opt.value = v;
			opt.textContent = prettify(v);
			demoValueSelect.appendChild(opt);
		});
		if (values.length) {
			demoValueSelect.value = values[0];
		}
	}

	function refreshBoardOptions() {
		var stageKey = getStageKey();
		var boards = stageCfg(stageKey).boards_display;
		var current = boardSelect.value;
		boardSelect.innerHTML = "";
		boards.forEach(function (board) {
			var opt = document.createElement("option");
			opt.value = board;
			opt.textContent = board;
			boardSelect.appendChild(opt);
		});
		if (boards.indexOf(current) === -1) {
			boardSelect.value = boards[0];
		} else {
			boardSelect.value = current;
		}
	}

	function resizeChart() {
		if (!chartEl || typeof Plotly === "undefined" || !Plotly.Plots || !Plotly.Plots.resize) {
			return;
		}
		Plotly.Plots.resize(chartEl);
	}

	function refreshChart() {
		var stageKey = getStageKey();
		var viewName = viewSelect.value;
		currentViewName = viewName;
		var comparison = viewName === "KS4 vs KS5 region comparison";
		boardSelect.disabled = comparison;

		if (comparison) {
			summaryEl.innerHTML = "<div class=\"includeher-summary\">Comparing regional representation across both key stages.</div>";
		} else {
			summaryEl.innerHTML = summaryHtml(stageKey, boardSelect.value, viewName);
		}

		var fig = buildFigure(stageKey, boardSelect.value, viewName);
		var config = { responsive: true, displayModeBar: false };
		Plotly.react(chartEl, fig.data, fig.layout, config);
		if (!chartClickBound && typeof chartEl.on === "function") {
			chartEl.on("plotly_click", onChartClick);
			chartClickBound = true;
		}
		if (typeof Plotly !== "undefined" && Plotly.Plots && Plotly.Plots.resize) {
			resizeChart();
			window.requestAnimationFrame(resizeChart);
			window.setTimeout(resizeChart, 150);
		}
		refreshDemoValues();
		showNamesForSelection();
	}

	function onChartClick(event) {
		if (!event.points || !event.points.length) {
			return;
		}
		var pt = event.points[0];
		var viewName = currentViewName;
		var idx = pt.pointNumber;
		var custom = pt.customdata;

		if (viewName === "Unique scientists by gender") {
			var rawGender = custom !== undefined ? custom : (idx === 0 ? "male" : "female");
			showNamesForSelection("gender", rawGender, " (clicked on chart)");
			demoDimensionSelect.value = "Gender";
			demoValueSelect.value = rawGender;
		} else if (viewName === "Scientists by region" || viewName === "Scientists by nationality") {
			var dim = viewName === "Scientists by region" ? "region" : "nationality";
			showNamesForSelection(dim, custom, " (clicked on chart)");
			demoDimensionSelect.value = viewName === "Scientists by region" ? "Region" : "Nationality";
			demoValueSelect.value = custom;
		} else if (viewName === "KS4 vs KS5 region comparison") {
			var label = pt.data.name.indexOf("KS4") === 0 ? "KS4" : "KS5";
			var stageForNames = label === "KS4" ? "ks4" : "ks5";
			var scientists = mergeScientists(stageForNames);
			var rows = filterScientists(scientists, { region: custom });
			var title = prettify(custom) + " (Region) - " + label + " (clicked on chart)";
			namesEl.innerHTML = namesHtml(rows, title);
		} else if (viewName === "Concept vs scientist mentions") {
			var mentionRaw = custom !== undefined ? custom : (idx === 0 ? "concept" : "scientist");
			namesEl.innerHTML = "<p class=\"includeher-note\"><em>Mention-type charts count <strong>all mentions</strong>, not unique people. Selected: <strong>" +
				prettify(mentionRaw) + "</strong>. Use the demographic explorer below to list individuals.</em></p>";
		}
	}

	function bindEvents() {
		stageSelect.addEventListener("change", function () {
			refreshBoardOptions();
			refreshChart();
		});
		boardSelect.addEventListener("change", function () {
			refreshChart();
		});
		viewSelect.addEventListener("change", refreshChart);
		demoDimensionSelect.addEventListener("change", function () {
			refreshDemoValues();
			showNamesForSelection(DEMOGRAPHIC_OPTIONS[demoDimensionSelect.value], demoValueSelect.value);
		});
		demoValueSelect.addEventListener("change", function () {
			showNamesForSelection(DEMOGRAPHIC_OPTIONS[demoDimensionSelect.value], demoValueSelect.value);
		});
	}

	function populateSelect(select, options, values) {
		select.innerHTML = "";
		options.forEach(function (label, i) {
			var opt = document.createElement("option");
			opt.value = values ? values[i] : label;
			opt.textContent = label;
			select.appendChild(opt);
		});
	}

	function showError(message) {
		var root = document.getElementById("includeher-dashboard");
		if (root) {
			root.innerHTML = "<p class=\"includeher-error\">" + message + "</p>";
		}
	}

	function dataUrl() {
		var path = window.location.pathname || "";
		var base = path.substring(0, path.lastIndexOf("/") + 1);
		if (!base || base === "/") {
			return "data/includeher-data.json";
		}
		return base + "data/includeher-data.json";
	}

	function init() {
		var root = document.getElementById("includeher-dashboard");
		if (!root) {
			return;
		}

		if (typeof Plotly === "undefined") {
			showError("The chart library could not be loaded. Check your network connection and refresh the page.");
			return;
		}

		stageSelect = document.getElementById("includeher-stage");
		boardSelect = document.getElementById("includeher-board");
		viewSelect = document.getElementById("includeher-view");
		demoDimensionSelect = document.getElementById("includeher-demo-dimension");
		demoValueSelect = document.getElementById("includeher-demo-value");
		summaryEl = document.getElementById("includeher-summary");
		chartEl = document.getElementById("includeher-chart");
		namesEl = document.getElementById("includeher-names");

		populateSelect(stageSelect, Object.keys(KEY_STAGE_OPTIONS));
		populateSelect(viewSelect, VIEW_OPTIONS);
		populateSelect(demoDimensionSelect, Object.keys(DEMOGRAPHIC_OPTIONS));

		fetch(dataUrl())
			.then(function (response) {
				if (!response.ok) {
					throw new Error("Could not load dashboard data (" + response.status + ").");
				}
				return response.json();
			})
			.then(function (json) {
				DATA = json;
				refreshBoardOptions();
				bindEvents();
				refreshChart();
				root.classList.add("is-ready");
				window.addEventListener("resize", resizeChart);
			})
			.catch(function (err) {
				showError("The interactive explorer could not be loaded. Please try again later.");
				console.error("IncludeHer dashboard error:", err);
			});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
