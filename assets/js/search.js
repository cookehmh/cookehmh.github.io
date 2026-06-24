/*
	Site search for Greg Cooke homepage
*/

(function () {
	var SITE_SEARCH_INDEX = [
		{
			title: "Home",
			url: "index.html",
			keywords: "greg cooke homepage exoplanets cambridge postdoctoral",
			description: "Overview of research on exoplanets, Hycean worlds, Earth's oxygen history, ozone, and code developments."
		},
		{
			title: "About me",
			url: "about_me.html",
			keywords: "about biography cambridge leeds manchester phd waccm",
			description: "Background, education, and research interests at Cambridge and Leeds."
		},
		{
			title: "Research",
			url: "Work.html",
			keywords: "research hycean k2-18 earth ozone waccm trappist proxima spectra swim",
			description: "Hycean atmospheres, Early Earth oxygen, observational predictions, tidally locked planets, and code."
		},
		{
			title: "Education  IncludeHer UK",
			url: "Education.html",
			keywords: "education includeher women science curriculum gcse a-level syllabus interactive dashboard explorer",
			description: "Study of named scientists in UK science syllabi, with an interactive data explorer."
		},
		{
			title: "Publications",
			url: "Publications.html",
			keywords: "publications papers journal mnras apj hycean ozone trappist",
			description: "Full list of journal articles and co-authored papers."
		},
		{
			title: "CV",
			url: "CV.html",
			keywords: "cv curriculum vitae employment talks posters software",
			description: "Curriculum vitae, talks, posters, and software experience."
		},
		{
			title: "Posters",
			url: "Posters.html",
			keywords: "posters conference exoplanets exoclimes rocky worlds ozone ecology",
			description: "Conference posters on exoplanets, ozone, Hycean worlds, and ecology."
		},
		{
			title: "Contact",
			url: "Contact.html",
			keywords: "contact email cambridge",
			description: "Get in touch with Greg Cooke."
		},
		{
			title: "Hobbies",
			url: "Hobbies.html",
			keywords: "hobbies running travel guinness",
			description: "Personal interests and activities outside research."
		},
		{
			title: "Modelling sub-Neptunes and Hyceans",
			url: "index.html",
			keywords: "hycean k2-18 jwst methane photochemical mini-neptune",
			description: "JWST observations of K2-18 b and photochemical modelling of Hycean worlds."
		},
		{
			title: "Earth's oxygenated history",
			url: "index.html",
			keywords: "earth oxygen proterozoic ozone pal waccm",
			description: "Simulations of Earth's oxygen concentrations and ozone columns through time."
		},
		{
			title: "Toxic ozone on habitable exoplanets",
			url: "index.html",
			keywords: "ozone trappist proxima habitability surface lethal",
			description: "Lethal surface ozone concentrations on TRAPPIST-1e and Proxima Centauri b."
		},
		{
			title: "TRAPPIST-1e case study",
			url: "index.html",
			keywords: "trappist tidally locked uv transmission spectra ozone",
			description: "Degenerate ozone interpretations due to stellar UV uncertainties."
		},
		{
			title: "SWIM code",
			url: "Work.html",
			keywords: "swim code github python stellar spectra jupyter",
			description: "Stellar Wind and Irradiance Module for scaling stellar spectra to exoplanets."
		},
		{
			title: "Ecological modelling of habitable ocean worlds",
			url: "Posters.html",
			keywords: "ecology lotka volterra hycean microbial rocky worlds",
			description: "Lotka-Volterra ecological modelling on habitable hycean exoplanets."
		},
		{
			title: "The evolving ozone layer on Earth and exoplanets",
			url: "Posters.html",
			keywords: "ozone akhil kumar proxima exoplanets 6",
			description: "Comparison of 1D and 3D atmospheric models for ozone on Earth and exoplanets."
		}
	];

	function normalise(text) {
		return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
	}

	function getSearchQuery() {
		var params = new URLSearchParams(window.location.search);
		return (params.get("q") || params.get("query") || "").trim();
	}

	function searchSite(query) {
		var terms = normalise(query).split(" ").filter(Boolean);

		if (!terms.length) {
			return [];
		}

		return SITE_SEARCH_INDEX.map(function (entry) {
			var haystack = normalise(entry.title + " " + entry.keywords + " " + entry.description);
			var score = 0;

			terms.forEach(function (term) {
				if (haystack.indexOf(term) !== -1) {
					score += 1;
				}
				if (normalise(entry.title).indexOf(term) !== -1) {
					score += 2;
				}
			});

			return { entry: entry, score: score };
		}).filter(function (result) {
			return result.score > 0;
		}).sort(function (a, b) {
			return b.score - a.score;
		});
	}

	function bindSearchForms() {
		var forms = document.querySelectorAll("form.search, form#search");

		forms.forEach(function (form) {
			form.addEventListener("submit", function (event) {
				event.preventDefault();

				var input = form.querySelector('input[name="query"]');
				var query = input ? input.value.trim() : "";

				if (query) {
					window.location.href = "search.html?q=" + encodeURIComponent(query);
				}
			});
		});
	}

	function renderSearchResults() {
		var container = document.getElementById("search-results");

		if (!container) {
			return;
		}

		var query = getSearchQuery();
		var input = document.getElementById("search-results-input");

		if (input) {
			input.value = query;
		}

		if (!query) {
			container.innerHTML = "<p>Enter a search term above to find pages and topics across this site.</p>";
			return;
		}

		var results = searchSite(query);

		if (!results.length) {
			container.innerHTML = "<p>No results found for <strong>" + escapeHtml(query) + "</strong>. Try words like <em>hycean</em>, <em>ozone</em>, <em>TRAPPIST</em>, or <em>education</em>.</p>";
			return;
		}

		var html = "<p>" + results.length + " result" + (results.length === 1 ? "" : "s") + " for <strong>" + escapeHtml(query) + "</strong></p><div class=\"publication-list\">";

		results.forEach(function (result) {
			html += "<article class=\"publication-entry\">";
			html += "<h3><a href=\"" + result.entry.url + "\">" + escapeHtml(result.entry.title) + "</a></h3>";
			html += "<p class=\"publication-authors\">" + escapeHtml(result.entry.description) + "</p>";
			html += "</article>";
		});

		html += "</div>";
		container.innerHTML = html;
	}

	function escapeHtml(text) {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	window.siteSearch = {
		search: searchSite,
		index: SITE_SEARCH_INDEX
	};

	document.addEventListener("DOMContentLoaded", function () {
		bindSearchForms();
		renderSearchResults();
	});
})();
