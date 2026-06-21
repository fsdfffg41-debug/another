/* ==========================================================================
   LeadFinder — script.js
   Client-side app logic: login gate, filtering, sorting, pagination,
   CSV import/export, rendering.

   NOTE on the password gate: this check runs entirely in the browser, which
   means the password is visible to anyone who views this file's source.
   It's a simple front-door deterrent, not real security. If you need actual
   access control, that has to be enforced by a server.

   NOTE on scale: this demo holds its dataset in one JS array and paginates
   it client-side. That's fine for thousands of rows. If you eventually load
   millions of real rows, swap `getPage()` below for a real backend
   endpoint that returns one page of results at a time (e.g.
   GET /api/businesses?country=...&category=...&page=...) instead of
   loading everything into the browser at once.
   ========================================================================== */

(function () {
  "use strict";

  const ACCESS_CODE = "2026JOHN";
  const PAGE_SIZE = 100;

  let DATA = [];                 // full working dataset (demo or imported)
  let filtered = [];             // after filters/search/sort
  let currentPage = 1;

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

  if (sessionStorage.getItem("lf_unlocked") === "1") {
    unlock();
  }

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

  // ------------------------------------------------------------ elements
  const countrySelect = document.getElementById("countrySelect");
  const citySelect = document.getElementById("citySelect");
  const categorySelect = document.getElementById("categorySelect");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const resetBtn = document.getElementById("resetBtn");
  const emptyResetBtn = document.getElementById("emptyResetBtn");
  const resultsGrid = document.getElementById("resultsGrid");
  const resultsCount = document.getElementById("resultsCount");
  const emptyState = document.getElementById("emptyState");
  const pagination = document.getElementById("pagination");
  const sidebarStats = document.getElementById("sidebarStats");

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
      // union of all known cities across countries, for "All countries" view
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

  function applyFilters() {
    const countryKey = countrySelect.value;
    const cityVal = citySelect.value;
    const catKey = categorySelect.value;
    const statusVal = getWebsiteStatusValue();
    const q = searchInput.value.trim().toLowerCase();
    const sortVal = sortSelect.value;

    filtered = DATA.filter(function (b) {
      if (countryKey && b.country !== countryKey) return false;
      if (cityVal && b.city !== cityVal) return false;
      if (catKey && b.category !== catKey) return false;
      if (statusVal === "no" && b.hasWebsite) return false;
      if (statusVal === "yes" && !b.hasWebsite) return false;
      if (q && b.name.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    filtered.sort(function (a, b) {
      if (sortVal === "rating") return b.rating - a.rating;
      if (sortVal === "reviews") return b.reviews - a.reviews;
      return a.name.localeCompare(b.name);
    });

    currentPage = 1;
    renderAll();
  }

  // -------------------------------------------------------------- rendering
  function starString(rating) {
    const full = Math.round(rating);
    return "★".repeat(full) + "☆".repeat(5 - full);
  }

  function renderCards() {
    resultsGrid.innerHTML = "";
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    if (pageItems.length === 0) {
      emptyState.classList.remove("hidden");
      resultsGrid.classList.add("hidden");
      return;
    }
    emptyState.classList.add("hidden");
    resultsGrid.classList.remove("hidden");

    const frag = document.createDocumentFragment();
    pageItems.forEach(function (b) {
      const card = document.createElement("article");
      card.className = "card";

      const badge = b.hasWebsite
        ? '<span class="badge has-site">Has website</span>'
        : '<span class="badge opportunity">No website</span>';

      const siteOrMapsAction = b.hasWebsite
        ? '<a class="site-link" href="https://' + b.website + '" target="_blank" rel="noopener">Visit website</a>'
        : '<span style="opacity:0.5;">No website listed</span>';

      card.innerHTML =
        '<div class="card-top">' +
          '<div class="card-name">' + escapeHtml(b.name) + '</div>' +
          badge +
        '</div>' +
        '<div class="card-meta">' +
          '<span class="cat-tag">' + escapeHtml(b.categoryLabel) + '</span>' +
          '<span>' + escapeHtml(b.address) + '</span>' +
          '<span>' + escapeHtml(b.countryLabel) + ' · ' + escapeHtml(b.city) + '</span>' +
          '<span>' + escapeHtml(b.phone) + '</span>' +
        '</div>' +
        '<div class="card-rating">' +
          '<span class="stars">' + starString(b.rating) + '</span>' +
          '<span>' + b.rating.toFixed(1) + ' (' + b.reviews + ' reviews)</span>' +
        '</div>' +
        '<div class="card-actions">' +
          '<a href="' + b.mapsUrl + '" target="_blank" rel="noopener">View on Maps</a>' +
          siteOrMapsAction +
        '</div>';

      frag.appendChild(card);
    });
    resultsGrid.appendChild(frag);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPagination() {
    pagination.innerHTML = "";
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (totalPages <= 1) return;

    function makeBtn(label, page, opts) {
      opts = opts || {};
      const btn = document.createElement("button");
      btn.className = "page-btn" + (opts.active ? " active" : "");
      btn.textContent = label;
      btn.disabled = !!opts.disabled;
      btn.addEventListener("click", function () {
        currentPage = page;
        renderAll();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      return btn;
    }

    pagination.appendChild(makeBtn("‹ Prev", currentPage - 1, { disabled: currentPage === 1 }));

    const windowSize = 2;
    const pages = new Set([1, totalPages]);
    for (let p = currentPage - windowSize; p <= currentPage + windowSize; p++) {
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
    const sortedPages = Array.from(pages).sort(function (a, b) { return a - b; });

    let lastPage = 0;
    sortedPages.forEach(function (p) {
      if (p - lastPage > 1) {
        const span = document.createElement("span");
        span.className = "page-ellipsis";
        span.textContent = "…";
        pagination.appendChild(span);
      }
      pagination.appendChild(makeBtn(String(p), p, { active: p === currentPage }));
      lastPage = p;
    });

    pagination.appendChild(makeBtn("Next ›", currentPage + 1, { disabled: currentPage === totalPages }));
  }

  function renderStats() {
    const total = filtered.length;
    const noSite = filtered.filter(function (b) { return !b.hasWebsite; }).length;
    const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    resultsCount.textContent = total === 0
      ? "0 results"
      : "Showing " + start + "–" + end + " of " + total.toLocaleString() + " results";

    sidebarStats.innerHTML =
      "<div><b>" + total.toLocaleString() + "</b> businesses match</div>" +
      "<div><b>" + noSite.toLocaleString() + "</b> have no website (opportunities)</div>" +
      "<div><b>" + DATA.length.toLocaleString() + "</b> total in dataset</div>";
  }

  function renderAll() {
    renderCards();
    renderPagination();
    renderStats();
  }

  // -------------------------------------------------------------- events
  countrySelect.addEventListener("change", function () { refreshCityOptions(); applyFilters(); });
  citySelect.addEventListener("change", applyFilters);
  categorySelect.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", debounce(applyFilters, 200));
  sortSelect.addEventListener("change", applyFilters);
  document.querySelectorAll('input[name="websiteStatus"]').forEach(function (r) {
    r.addEventListener("change", applyFilters);
  });

  function resetFilters() {
    countrySelect.value = "";
    refreshCityOptions();
    citySelect.value = "";
    categorySelect.value = "";
    searchInput.value = "";
    sortSelect.value = "name";
    document.querySelector('input[name="websiteStatus"][value="all"]').checked = true;
    applyFilters();
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

  // -------------------------------------------------------------- banner
  const demoBanner = document.getElementById("demoBanner");
  document.getElementById("bannerClose").addEventListener("click", function () {
    demoBanner.classList.add("hidden");
  });
  document.getElementById("bannerHowTo").addEventListener("click", openHowto);

  function openHowto() {
    document.getElementById("howtoScrim").classList.remove("hidden");
  }
  document.getElementById("howtoClose").addEventListener("click", function () {
    document.getElementById("howtoScrim").classList.add("hidden");
  });
  document.getElementById("howtoScrim").addEventListener("click", function (e) {
    if (e.target.id === "howtoScrim") e.currentTarget.classList.add("hidden");
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

  document.getElementById("templateBtn").addEventListener("click", function () {
    const sample = [{
      name: "Example Hotel",
      category: "hotel",
      country: "usa",
      city: "New York",
      address: "12 Main St, New York",
      phone: "+1 212 555 1234",
      rating: 4.5,
      reviews: 120,
      hasWebsite: false,
      website: "",
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
        demoBanner.classList.add("hidden");
        populateSelects();
        applyFilters();
        alert("Imported " + DATA.length.toLocaleString() + " businesses.");
      } catch (err) {
        alert("Could not read that file. Make sure it's a CSV that matches the template format.");
      }
    };
    reader.readAsText(file);
    importFile.value = "";
  });

  // -------------------------------------------------------------- init
  function init() {
    DATA = window.LEADFINDER_DATA.generateDataset();
    populateSelects();
    applyFilters();
  }

  init();
})();
