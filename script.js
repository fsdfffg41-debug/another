/* ==========================================================================
   LeadFinder — script.js (v2)

   NOTE on the password gate: runs client-side, visible in source — a
   front-door deterrent, not real security.

   NOTE on Live Google Search: this uses the official Google Maps
   JavaScript API (Places library) loaded with a key YOU provide and are
   billed for directly by Google. It is the legitimate, ToS-compliant way
   to query real business data — including whether a business has a
   website on file. Google caps Text Search at 60 results (3 pages of 20)
   per query, with a short mandatory delay between pages — that's a
   Google-side limit, not something this app can lift. For larger
   coverage, run separate searches per city/category combination.
   ========================================================================== */

(function () {
  "use strict";

  const ACCESS_CODE = "2026JOHN";
  const BATCH_SIZE = 100;

  let DATA = [];          // current working set (demo, imported, or live)
  let filtered = [];      // after filters/search/sort
  let visibleCount = BATCH_SIZE;
  let mode = "demo";       // "demo" | "imported" | "live"
  let leadStates = {};     // { [id]: { saved: bool, status: 'new'|'contacted'|'converted' } }

  // ------------------------------------------------------------------ gate
  const gate = document.getElementById("gate");
  const app = document.getElementById("app");
  const gateForm = document.getElementById("gateForm");
  const gatePassword = document.getElementById("gatePassword");
  const gateError = document.getElementById("gateError");

  function unlock() {
    gate.classList.add("hidden");
    app.classList.remove("hidden");
  }
  if (sessionStorage.getItem("lf_unlocked") === "1") unlock();

  gateForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (gatePassword.value === ACCESS_CODE) {
      sessionStorage.setItem("lf_unlocked", "1");
      gateError.textContent = "";
      unlock();
    } else {
      gateError.textContent = "Incorrect access code. Please try again.";
      gatePassword.value = "";
      gatePassword.focus();
    }
  });

  document.getElementById("lockBtn").addEventListener("click", function () {
    sessionStorage.removeItem("lf_unlocked");
    app.classList.add("hidden");
    gate.classList.remove("hidden");
    gatePassword.value = "";
    gatePassword.focus();
  });

  // ------------------------------------------------------------ dark mode
  const themeToggle = document.getElementById("themeToggle");
  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem("lf_theme", theme);
  }
  applyTheme(localStorage.getItem("lf_theme") === "dark" ? "dark" : "light");
  themeToggle.addEventListener("click", function () {
    const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });

  // ------------------------------------------------------------ mobile drawer
  const sidebar = document.getElementById("sidebar");
  const drawerScrim = document.getElementById("drawerScrim");
  function openDrawer() { sidebar.classList.add("open"); drawerScrim.classList.add("open"); }
  function closeDrawer() { sidebar.classList.remove("open"); drawerScrim.classList.remove("open"); }
  document.getElementById("drawerToggle").addEventListener("click", openDrawer);
  document.getElementById("drawerClose").addEventListener("click", closeDrawer);
  drawerScrim.addEventListener("click", closeDrawer);

  // ------------------------------------------------------------ lead state (save/status)
  function loadLeadStates() {
    try {
      leadStates = JSON.parse(localStorage.getItem("lf_lead_states") || "{}");
    } catch (e) { leadStates = {}; }
  }
  function saveLeadStates() {
    localStorage.setItem("lf_lead_states", JSON.stringify(leadStates));
  }
  function getLeadState(id) {
    return leadStates[id] || { saved: false, status: "new" };
  }
  function setLeadState(id, patch) {
    leadStates[id] = Object.assign({}, getLeadState(id), patch);
    saveLeadStates();
  }
  loadLeadStates();

  // ------------------------------------------------------------ elements
  const countrySelect = document.getElementById("countrySelect");
  const citySelect = document.getElementById("citySelect");
  const categorySelect = document.getElementById("categorySelect");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const savedOnlyCheck = document.getElementById("savedOnlyCheck");
  const resetBtn = document.getElementById("resetBtn");
  const emptyResetBtn = document.getElementById("emptyResetBtn");
  const resultsGrid = document.getElementById("resultsGrid");
  const resultsCount = document.getElementById("resultsCount");
  const emptyState = document.getElementById("emptyState");
  const sidebarStats = document.getElementById("sidebarStats");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const loadMoreNote = document.getElementById("loadMoreNote");
  const pageSizeNote = document.getElementById("pageSizeNote");
  const demoBanner = document.getElementById("demoBanner");

  // ------------------------------------------------------------- populate selects
  function populateSelects() {
    const countries = window.LEADFINDER_DATA.COUNTRIES;
    const categories = window.LEADFINDER_DATA.CATEGORIES;

    countrySelect.innerHTML = '<option value="">All countries / regions</option>';
    Object.keys(countries).forEach(function (key) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = countries[key].label;
      countrySelect.appendChild(opt);
    });

    categorySelect.innerHTML = '<option value="">All types</option>';
    Object.keys(categories).forEach(function (key) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = categories[key].label;
      categorySelect.appendChild(opt);
    });

    refreshCityOptions();
  }

  function refreshCityOptions() {
    const countries = window.LEADFINDER_DATA.COUNTRIES;
    const countryKey = countrySelect.value;
    citySelect.innerHTML = '<option value="">All cities</option>';

    let cities;
    if (countryKey && countries[countryKey]) {
      cities = countries[countryKey].cities.slice();
    } else {
      const set = new Set();
      Object.keys(countries).forEach(function (k) {
        countries[k].cities.forEach(function (c) { set.add(c); });
      });
      cities = Array.from(set);
    }
    cities.sort();
    cities.forEach(function (c) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      citySelect.appendChild(opt);
    });
  }

  // -------------------------------------------------------------- filtering
  function getWebsiteStatusValue() {
    const checked = document.querySelector('input[name="websiteStatus"]:checked');
    return checked ? checked.value : "all";
  }

  function computeFiltered() {
    const countryKey = countrySelect.value;
    const cityVal = citySelect.value;
    const catKey = categorySelect.value;
    const statusVal = getWebsiteStatusValue();
    const q = searchInput.value.trim().toLowerCase();
    const sortVal = sortSelect.value;
    const savedOnly = savedOnlyCheck.checked;

    filtered = DATA.filter(function (b) {
      if (countryKey && b.country !== countryKey) return false;
      if (cityVal && b.city !== cityVal) return false;
      if (catKey && b.category !== catKey) return false;
      if (statusVal === "no" && b.hasWebsite) return false;
      if (statusVal === "yes" && !b.hasWebsite) return false;
      if (q && b.name.toLowerCase().indexOf(q) === -1) return false;
      if (savedOnly && !getLeadState(b.id).saved) return false;
      return true;
    });

    filtered.sort(function (a, b) {
      if (sortVal === "rating") return b.rating - a.rating;
      if (sortVal === "reviews") return b.reviews - a.reviews;
      return a.name.localeCompare(b.name);
    });
  }

  function applyFiltersAndReset() {
    visibleCount = BATCH_SIZE;
    computeFiltered();
    renderAll();
  }

  // -------------------------------------------------------------- rendering
  function starString(rating) {
    const full = Math.round(rating);
    return "★".repeat(Math.max(0, full)) + "☆".repeat(Math.max(0, 5 - full));
  }
  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderCards() {
    resultsGrid.innerHTML = "";
    const visibleItems = filtered.slice(0, visibleCount);

    if (visibleItems.length === 0) {
      emptyState.classList.remove("hidden");
      resultsGrid.classList.add("hidden");
      return;
    }
    emptyState.classList.add("hidden");
    resultsGrid.classList.remove("hidden");

    const frag = document.createDocumentFragment();
    visibleItems.forEach(function (b) {
      const state = getLeadState(b.id);
      const card = document.createElement("article");
      card.className = "card";
      card.setAttribute("data-status", state.status);

      const badge = b.hasWebsite
        ? '<span class="badge has-site">Has website</span>'
        : '<span class="badge opportunity">No website</span>';

      const siteAction = b.hasWebsite
        ? '<a class="site-link" href="https://' + escapeHtml(b.website) + '" target="_blank" rel="noopener">Visit website</a>'
        : '';

      card.innerHTML =
        '<div class="card-top">' +
          '<div class="card-name-row">' +
            '<button class="save-btn' + (state.saved ? ' saved' : '') + '" data-id="' + b.id + '" title="Save lead">' + (state.saved ? "★" : "☆") + '</button>' +
            '<div class="card-name">' + escapeHtml(b.name) + '</div>' +
          '</div>' +
          badge +
        '</div>' +
        '<div class="card-meta">' +
          '<span class="cat-tag">' + escapeHtml(b.categoryLabel) + '</span>' +
          '<span>' + escapeHtml(b.address) + '</span>' +
          '<span>' + escapeHtml(b.countryLabel) + ' · ' + escapeHtml(b.city) + '</span>' +
          '<span class="phone-row">' + escapeHtml(b.phone) +
            (b.phone ? ' <button class="copy-btn" data-phone="' + escapeHtml(b.phone) + '">copy</button>' : '') +
          '</span>' +
        '</div>' +
        '<div class="card-rating">' +
          '<span class="stars">' + starString(b.rating) + '</span>' +
          '<span>' + (b.rating ? b.rating.toFixed(1) : "—") + ' (' + b.reviews + ' reviews)</span>' +
        '</div>' +
        '<div class="card-actions">' +
          '<a href="' + b.mapsUrl + '" target="_blank" rel="noopener">View on Maps</a>' +
          siteAction +
        '</div>' +
        '<select class="status-select" data-id="' + b.id + '">' +
          '<option value="new"' + (state.status === "new" ? " selected" : "") + '>New lead</option>' +
          '<option value="contacted"' + (state.status === "contacted" ? " selected" : "") + '>Contacted</option>' +
          '<option value="converted"' + (state.status === "converted" ? " selected" : "") + '>Converted</option>' +
        '</select>';

      frag.appendChild(card);
    });
    resultsGrid.appendChild(frag);

    // wire up per-card controls
    resultsGrid.querySelectorAll(".save-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-id");
        const cur = getLeadState(id);
        setLeadState(id, { saved: !cur.saved });
        renderCards();
        renderStats();
      });
    });
    resultsGrid.querySelectorAll(".status-select").forEach(function (sel) {
      sel.addEventListener("change", function () {
        const id = sel.getAttribute("data-id");
        setLeadState(id, { status: sel.value });
        const card = sel.closest(".card");
        if (card) card.setAttribute("data-status", sel.value);
      });
    });
    resultsGrid.querySelectorAll(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const phone = btn.getAttribute("data-phone");
        navigator.clipboard && navigator.clipboard.writeText(phone).then(function () {
          const original = btn.textContent;
          btn.textContent = "copied!";
          setTimeout(function () { btn.textContent = original; }, 1200);
        });
      });
    });
  }

  function renderStats() {
    const total = filtered.length;
    const noSite = filtered.filter(function (b) { return !b.hasWebsite; }).length;
    const savedCount = Object.keys(leadStates).filter(function (id) { return leadStates[id].saved; }).length;

    resultsCount.textContent = total === 0
      ? "0 results"
      : "Showing " + Math.min(visibleCount, total).toLocaleString() + " of " + total.toLocaleString() + " results";

    sidebarStats.innerHTML =
      "<div><b>" + total.toLocaleString() + "</b> businesses match</div>" +
      "<div><b>" + noSite.toLocaleString() + "</b> have no website (opportunities)</div>" +
      "<div><b>" + savedCount.toLocaleString() + "</b> saved leads</div>" +
      "<div><b>" + DATA.length.toLocaleString() + "</b> total in current dataset</div>";

    pageSizeNote.textContent = mode === "live" ? "live Google results" : "100 per batch";
  }

  function updateLoadMoreUI() {
    if (mode === "live") {
      const hasMore = !!(liveState.pagination && liveState.pagination.hasNextPage && liveState.page < liveState.maxPages);
      loadMoreBtn.classList.toggle("hidden", filtered.length === 0);
      loadMoreBtn.disabled = !hasMore || liveState.loading;
      loadMoreBtn.textContent = liveState.loading ? "Loading…" : (hasMore ? "Load more from Google" : "All available results loaded");
      loadMoreNote.textContent = hasMore
        ? "Google allows up to 60 results per search (3 pages of 20)."
        : (liveState.page > 0 ? "Google limits Text Search to 60 results per query. Try a different city or category for more." : "");
    } else {
      const hasMore = visibleCount < filtered.length;
      loadMoreBtn.classList.toggle("hidden", filtered.length === 0);
      loadMoreBtn.disabled = !hasMore;
      loadMoreBtn.textContent = hasMore ? "Load more (" + BATCH_SIZE + ")" : "All results loaded";
      loadMoreNote.textContent = "";
    }
  }

  function renderAll() {
    renderCards();
    renderStats();
    updateLoadMoreUI();
  }

  loadMoreBtn.addEventListener("click", function () {
    if (mode === "live") {
      attemptLoadMoreLive();
    } else {
      visibleCount = Math.min(visibleCount + BATCH_SIZE, filtered.length);
      renderAll();
    }
  });

  // -------------------------------------------------------------- events
  countrySelect.addEventListener("change", function () { refreshCityOptions(); applyFiltersAndReset(); });
  citySelect.addEventListener("change", applyFiltersAndReset);
  categorySelect.addEventListener("change", applyFiltersAndReset);
  searchInput.addEventListener("input", debounce(applyFiltersAndReset, 200));
  sortSelect.addEventListener("change", applyFiltersAndReset);
  savedOnlyCheck.addEventListener("change", applyFiltersAndReset);
  document.querySelectorAll('input[name="websiteStatus"]').forEach(function (r) {
    r.addEventListener("change", applyFiltersAndReset);
  });

  function resetFilters() {
    countrySelect.value = "";
    refreshCityOptions();
    citySelect.value = "";
    categorySelect.value = "";
    searchInput.value = "";
    sortSelect.value = "name";
    savedOnlyCheck.checked = false;
    document.querySelector('input[name="websiteStatus"][value="all"]').checked = true;
    applyFiltersAndReset();
  }
  resetBtn.addEventListener("click", resetFilters);
  emptyResetBtn.addEventListener("click", resetFilters);

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      const args = arguments;
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  // -------------------------------------------------------------- banners / modals
  document.getElementById("bannerClose").addEventListener("click", function () { demoBanner.classList.add("hidden"); });
  document.getElementById("bannerHowTo").addEventListener("click", function () {
    document.getElementById("howtoScrim").classList.remove("hidden");
  });
  document.getElementById("howtoClose").addEventListener("click", function () {
    document.getElementById("howtoScrim").classList.add("hidden");
  });
  document.getElementById("howtoScrim").addEventListener("click", function (e) {
    if (e.target.id === "howtoScrim") e.currentTarget.classList.add("hidden");
  });
  document.getElementById("liveHowToBtn").addEventListener("click", function () {
    document.getElementById("apiKeyHowtoScrim").classList.remove("hidden");
  });
  document.getElementById("apiKeyHowtoClose").addEventListener("click", function () {
    document.getElementById("apiKeyHowtoScrim").classList.add("hidden");
  });
  document.getElementById("apiKeyHowtoScrim").addEventListener("click", function (e) {
    if (e.target.id === "apiKeyHowtoScrim") e.currentTarget.classList.add("hidden");
  });

  // -------------------------------------------------------------- CSV export
  const CSV_COLUMNS = ["name", "category", "country", "city", "address", "phone", "rating", "reviews", "hasWebsite", "website", "mapsUrl"];

  function toCsv(rows) {
    const header = CSV_COLUMNS.join(",");
    const lines = rows.map(function (r) {
      return CSV_COLUMNS.map(function (col) {
        let val = r[col];
        if (val === undefined || val === null) val = "";
        val = String(val).replace(/"/g, '""');
        if (/[",\n]/.test(val)) val = '"' + val + '"';
        return val;
      }).join(",");
    });
    return header + "\n" + lines.join("\n");
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  document.getElementById("exportBtn").addEventListener("click", function () {
    if (filtered.length === 0) return;
    downloadFile("leadfinder-export.csv", toCsv(filtered), "text/csv");
  });

  document.getElementById("exportOppBtn").addEventListener("click", function () {
    const opp = filtered.filter(function (b) { return !b.hasWebsite; });
    if (opp.length === 0) { alert("No no-website businesses in the current results."); return; }
    downloadFile("leadfinder-opportunities.csv", toCsv(opp), "text/csv");
  });

  document.getElementById("templateBtn").addEventListener("click", function () {
    const sample = [{
      name: "Example Hotel", category: "hotel", country: "usa", city: "New York",
      address: "12 Main St, New York", phone: "+1 212 555 1234", rating: 4.5, reviews: 120,
      hasWebsite: false, website: "",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Example%20Hotel%20New%20York"
    }];
    downloadFile("leadfinder-template.csv", toCsv(sample), "text/csv");
  });

  // -------------------------------------------------------------- CSV import
  function parseCsv(text) {
    const rows = [];
    const lines = text.replace(/\r\n/g, "\n").split("\n").filter(function (l) { return l.trim() !== ""; });
    if (lines.length === 0) return rows;

    function parseLine(line) {
      const out = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') { inQuotes = false; }
          else { cur += ch; }
        } else {
          if (ch === '"') inQuotes = true;
          else if (ch === ",") { out.push(cur); cur = ""; }
          else cur += ch;
        }
      }
      out.push(cur);
      return out;
    }

    const headers = parseLine(lines[0]).map(function (h) { return h.trim(); });
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      const obj = {};
      headers.forEach(function (h, idx) { obj[h] = cols[idx] !== undefined ? cols[idx].trim() : ""; });
      rows.push(obj);
    }
    return rows;
  }

  function normalizeImportedRow(raw, idx) {
    const countries = window.LEADFINDER_DATA.COUNTRIES;
    const categories = window.LEADFINDER_DATA.CATEGORIES;
    const countryKey = raw.country || "";
    const catKey = raw.category || "";

    return {
      id: "import-" + idx,
      name: raw.name || "Unnamed business",
      category: catKey,
      categoryLabel: (categories[catKey] && categories[catKey].label) || (raw.category || "Other"),
      country: countryKey,
      countryLabel: (countries[countryKey] && countries[countryKey].label) || (raw.country || "Unknown"),
      city: raw.city || "",
      address: raw.address || "",
      phone: raw.phone || "",
      rating: parseFloat(raw.rating) || 0,
      reviews: parseInt(raw.reviews, 10) || 0,
      hasWebsite: String(raw.hasWebsite).toLowerCase() === "true",
      website: raw.website || "",
      mapsUrl: raw.mapsUrl || ("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent((raw.name || "") + " " + (raw.city || "")))
    };
  }

  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");
  importBtn.addEventListener("click", function () { importFile.click(); });
  importFile.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const rows = parseCsv(evt.target.result);
        if (rows.length === 0) {
          alert("That CSV looks empty. Check it has a header row plus at least one data row.");
          return;
        }
        DATA = rows.map(normalizeImportedRow);
        mode = "imported";
        demoBanner.classList.add("hidden");
        populateSelects();
        applyFiltersAndReset();
        alert("Imported " + DATA.length.toLocaleString() + " businesses.");
      } catch (err) {
        alert("Could not read that file. Make sure it's a CSV that matches the template format.");
      }
    };
    reader.readAsText(file);
    importFile.value = "";
  });

  // ============================================================
  // LIVE GOOGLE PLACES SEARCH
  // ============================================================
  let placesService = null;
  let liveState = { pagination: null, page: 0, maxPages: 3, loading: false, catKey: "", cityVal: "", countryVal: "" };

  const liveDot = document.getElementById("liveDot");
  const liveStatusEl = document.getElementById("liveStatus");
  const liveKeyRow = document.getElementById("liveKeyRow");
  const liveSearchRow = document.getElementById("liveSearchRow");
  const googleApiKeyInput = document.getElementById("googleApiKey");
  const connectGoogleBtn = document.getElementById("connectGoogleBtn");
  const disconnectGoogleBtn = document.getElementById("disconnectGoogleBtn");
  const liveSearchBtn = document.getElementById("liveSearchBtn");

  function setLiveStatus(text, state) {
    liveStatusEl.textContent = text;
    liveDot.classList.remove("connected", "error");
    if (state === "connected") liveDot.classList.add("connected");
    if (state === "error") liveDot.classList.add("error");
  }

  function loadGoogleMapsScript(apiKey) {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.maps && window.google.maps.places) { resolve(); return; }
      const script = document.createElement("script");
      script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(apiKey) + "&libraries=places";
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("Couldn't load Google Maps. Check the API key and your network connection.")); };
      document.head.appendChild(script);
    });
  }

  connectGoogleBtn.addEventListener("click", function () {
    const key = googleApiKeyInput.value.trim();
    if (!key) { setLiveStatus("Enter an API key first.", "error"); return; }
    setLiveStatus("Connecting…");
    loadGoogleMapsScript(key).then(function () {
      placesService = new google.maps.places.PlacesService(document.getElementById("placesAttrContainer"));
      setLiveStatus("Connected. Pick filters on the left, then search.", "connected");
      liveKeyRow.classList.add("hidden");
      liveSearchRow.classList.remove("hidden");
    }).catch(function (err) {
      setLiveStatus(err.message || "Connection failed.", "error");
    });
  });

  disconnectGoogleBtn.addEventListener("click", function () {
    placesService = null;
    liveKeyRow.classList.remove("hidden");
    liveSearchRow.classList.add("hidden");
    setLiveStatus("Not connected — using sample data.");
    googleApiKeyInput.value = "";
  });

  function placeToBusiness(place, meta, idx) {
    return {
      id: "live-" + (place.place_id || (meta.queryKey + "-" + idx)),
      name: place.name || "Unnamed business",
      category: meta.catKey,
      categoryLabel: meta.catLabel,
      country: meta.countryVal,
      countryLabel: meta.countryLabel,
      city: meta.cityVal || (place.formatted_address || "").split(",")[0],
      address: place.formatted_address || "",
      phone: place.formatted_phone_number || place.international_phone_number || "",
      rating: place.rating || 0,
      reviews: place.user_ratings_total || 0,
      hasWebsite: !!place.website,
      website: place.website ? place.website.replace(/^https?:\/\//, "") : "",
      mapsUrl: place.url || ("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent((place.name || "") + " " + (place.formatted_address || "")))
    };
  }

  function getDetailsPromise(placeId) {
    return new Promise(function (resolve) {
      placesService.getDetails(
        { placeId: placeId, fields: ["name", "formatted_address", "formatted_phone_number", "international_phone_number", "rating", "user_ratings_total", "website", "url"] },
        function (place, status) {
          if (status === google.maps.places.PlacesServiceStatus.OK) resolve(place);
          else resolve(null);
        }
      );
    });
  }

  function handleSearchPage(results, status, pagination) {
    liveState.loading = false;
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      liveState.pagination = pagination;
      liveState.page++;
      setLiveStatus("Found " + results.length + " results on this page — fetching details…", "connected");

      Promise.all(results.map(function (r) { return getDetailsPromise(r.place_id); })).then(function (detailsList) {
        const meta = {
          catKey: liveState.catKey,
          catLabel: (window.LEADFINDER_DATA.CATEGORIES[liveState.catKey] || {}).label || liveState.catKey,
          countryVal: liveState.countryVal,
          countryLabel: (window.LEADFINDER_DATA.COUNTRIES[liveState.countryVal] || {}).label || liveState.countryVal,
          cityVal: liveState.cityVal,
          queryKey: liveState.queryText
        };
        const newBusinesses = detailsList.map(function (place, idx) {
          return placeToBusiness(place || results[idx], meta, DATA.length + idx);
        });
        DATA = DATA.concat(newBusinesses);
        computeFiltered();
        visibleCount = filtered.length;
        renderAll();
        setLiveStatus("Connected. " + DATA.length + " live results loaded so far.", "connected");
      });
    } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
      liveState.pagination = null;
      if (liveState.page === 0) {
        setLiveStatus("No results found for that search. Try a different city or category.", "error");
        DATA = [];
        computeFiltered();
        visibleCount = 0;
        renderAll();
      }
    } else {
      const friendly = {
        REQUEST_DENIED: "Request denied — check that the Places API is enabled and billing is set up for this key.",
        OVER_QUERY_LIMIT: "You've hit your Google API quota or billing limit for now.",
        INVALID_REQUEST: "Invalid search — try picking a city or category."
      };
      setLiveStatus(friendly[status] || ("Google Places error: " + status), "error");
    }
    updateLoadMoreUI();
  }

  liveSearchBtn.addEventListener("click", function () {
    if (!placesService) { setLiveStatus("Connect your API key first.", "error"); return; }
    const catKey = categorySelect.value;
    const cityVal = citySelect.value;
    const countryVal = countrySelect.value;
    const categories = window.LEADFINDER_DATA.CATEGORIES;
    const countries = window.LEADFINDER_DATA.COUNTRIES;

    if (!catKey) { setLiveStatus("Pick a business type in the filters above first.", "error"); return; }
    if (!cityVal && !countryVal) { setLiveStatus("Pick a country or city in the filters above first.", "error"); return; }

    const place = cityVal || (countries[countryVal] && countries[countryVal].label) || "";
    const queryText = (categories[catKey] ? categories[catKey].label : catKey) + " in " + place;

    mode = "live";
    DATA = [];
    liveState = { pagination: null, page: 0, maxPages: 3, loading: true, catKey: catKey, cityVal: cityVal, countryVal: countryVal, queryText: queryText };
    demoBanner.classList.add("hidden");
    setLiveStatus('Searching Google for "' + queryText + '"…', "connected");
    placesService.textSearch({ query: queryText }, handleSearchPage);
  });

  function attemptLoadMoreLive() {
    if (!liveState.pagination || !liveState.pagination.hasNextPage || liveState.page >= liveState.maxPages) {
      updateLoadMoreUI();
      return;
    }
    liveState.loading = true;
    updateLoadMoreUI();
    setLiveStatus("Loading more results from Google…", "connected");
    setTimeout(function () {
      liveState.pagination.nextPage();
    }, 2000);
  }

  // -------------------------------------------------------------- init
  function init() {
    DATA = window.LEADFINDER_DATA.generateDataset();
    mode = "demo";
    populateSelects();
    applyFiltersAndReset();
  }

  init();
})();
