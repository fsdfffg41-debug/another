/* ==========================================================================
   data.js
   --------------------------------------------------------------------------
   This file produces the DEMO dataset that ships with LeadFinder so the
   whole app works out of the box.

   IMPORTANT — read this before you rely on the numbers:
   This is SAMPLE / GENERATED data, not real businesses pulled from Google
   Maps. Live scraping of Google Maps is against Google's Terms of Service
   and isn't something this app does. To populate LeadFinder with REAL
   businesses, use the "Import CSV" button in the app and load data from a
   legitimate source such as:
     - The Google Places API (Text Search / Nearby Search + Place Details).
       The Place Details response includes a "website" field — if it's
       empty, that business has no website. This is the correct, ToS-safe
       way to find the exact leads you're after.
     - A licensed business-data provider (Data Axle, Yelp Fusion, etc).
     - Your own manually collected list.

   The CSV template (downloadable from the app) shows exactly which columns
   to fill in. Once imported, every filter, search, and pagination feature
   in this app works identically on your real data.
   ========================================================================== */

(function (global) {
  "use strict";

  // ---- seeded RNG so the demo dataset is stable across reloads ----------
  function makeRng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  const rng = makeRng(20260101);
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function rangeInt(min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
  function rangeFloat(min, max, decimals) {
    const v = rng() * (max - min) + min;
    return parseFloat(v.toFixed(decimals));
  }

  // ---- reference data ------------------------------------------------------
  const COUNTRIES = {
    europe: {
      label: "Europe (mixed)",
      cities: ["Brussels", "Vienna", "Madrid", "Lisbon", "Warsaw", "Prague", "Stockholm", "Zurich", "Dublin", "Athens"],
      phonePrefix: "+3"
    },
    germany: {
      label: "Germany",
      cities: ["Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt", "Stuttgart"],
      phonePrefix: "+49"
    },
    paris: {
      label: "Paris",
      cities: ["Le Marais", "Montmartre", "Saint-Germain", "Bastille", "Belleville", "Latin Quarter"],
      phonePrefix: "+33"
    },
    netherlands: {
      label: "Netherlands",
      cities: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"],
      phonePrefix: "+31"
    },
    usa: {
      label: "United States",
      cities: ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "Austin", "Seattle"],
      phonePrefix: "+1"
    },
    uk: {
      label: "United Kingdom",
      cities: ["London", "Manchester", "Birmingham", "Leeds", "Glasgow", "Bristol"],
      phonePrefix: "+44"
    },
    italy: {
      label: "Italy",
      cities: ["Rome", "Milan", "Naples", "Turin", "Florence", "Bologna"],
      phonePrefix: "+39"
    },
    france: {
      label: "France",
      cities: ["Paris", "Lyon", "Marseille", "Nice", "Toulouse", "Bordeaux"],
      phonePrefix: "+33"
    }
  };

  const CATEGORIES = {
    hotel: { label: "Hotels", nameParts: ["Grand", "Royal", "Central", "Garden", "Riverside", "Plaza", "Boutique", "Heritage"], suffix: "Hotel" },
    restaurant: { label: "Restaurants", nameParts: ["Olive", "Saffron", "Cedar", "Copper", "Harvest", "Lantern", "Rustic", "Velvet"], suffix: "Restaurant" },
    cafe: { label: "Cafes", nameParts: ["Morning", "Corner", "Brick", "Daily", "Sunny", "Quiet", "Roasted", "Sidewalk"], suffix: "Cafe" },
    spa: { label: "Spas", nameParts: ["Serenity", "Lotus", "Tranquil", "Pure", "Bloom", "Calm", "Aura", "Zen"], suffix: "Spa" },
    boutique: { label: "Boutiques", nameParts: ["Maison", "Atelier", "Linen", "Vogue", "Thread", "Velvet", "Ivory", "Studio"], suffix: "Boutique" },
    salon: { label: "Hair & Beauty Salons", nameParts: ["Glow", "Mirror", "Studio", "Luxe", "Style", "Edge", "Shine", "Muse"], suffix: "Salon" },
    gym: { label: "Gyms & Fitness", nameParts: ["Iron", "Pulse", "Forge", "Summit", "Core", "Momentum", "Strive", "Apex"], suffix: "Fitness" },
    bakery: { label: "Bakeries", nameParts: ["Golden", "Wheat", "Rise", "Crust", "Sweet", "Hearth", "Flour", "Sunrise"], suffix: "Bakery" },
    library: { label: "Libraries & Bookshops", nameParts: ["Pageturner", "Ink", "Chapter", "Quill", "Bound", "Reading Room", "Folio", "Archive"], suffix: "Books" },
    dentist: { label: "Dentists", nameParts: ["Bright", "Pearl", "Smile", "Clear", "Gentle", "Family", "Modern", "Care"], suffix: "Dental" },
    lawyer: { label: "Law Firms", nameParts: ["Sterling", "Hale", "Whitfield", "Marsh", "Cross", "Lawson", "Pierce", "Wren"], suffix: "Law" },
    realestate: { label: "Real Estate Agencies", nameParts: ["Keystone", "Horizon", "Maple", "Anchor", "Summit", "Beacon", "Harbor", "Crown"], suffix: "Realty" }
  };

  const STREETS = ["Main St", "Market St", "Church Rd", "High St", "Station Rd", "Mill Lane", "King St", "Queen St", "Park Ave", "Oak St"];

  function randomPhone(prefix) {
    return prefix + " " + rangeInt(20, 99) + " " + rangeInt(100, 999) + " " + rangeInt(1000, 9999);
  }

  function buildName(catKey) {
    const cat = CATEGORIES[catKey];
    return pick(cat.nameParts) + " " + cat.suffix;
  }

  function buildBusiness(id, countryKey) {
    const country = COUNTRIES[countryKey];
    const catKey = pick(Object.keys(CATEGORIES));
    const city = pick(country.cities);
    const name = buildName(catKey);
    const hasWebsite = rng() < 0.38; // ~38% already have a site, ~62% are open leads
    const streetNum = rangeInt(2, 240);
    const street = pick(STREETS);
    const rating = rangeFloat(3.2, 5.0, 1);
    const reviews = rangeInt(3, 480);

    const mapsQuery = encodeURIComponent(name + " " + city);

    return {
      id: id,
      name: name,
      category: catKey,
      categoryLabel: CATEGORIES[catKey].label,
      country: countryKey,
      countryLabel: country.label,
      city: city,
      address: streetNum + " " + street + ", " + city,
      phone: randomPhone(country.phonePrefix),
      rating: rating,
      reviews: reviews,
      hasWebsite: hasWebsite,
      website: hasWebsite ? ("www." + name.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".com") : "",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + mapsQuery
    };
  }

  function generateDataset() {
    const out = [];
    let id = 1;
    const countryKeys = Object.keys(COUNTRIES);
    // roughly 550-650 businesses per country/region => realistic multi-page demo
    countryKeys.forEach(function (ck) {
      const count = rangeInt(550, 650);
      for (let i = 0; i < count; i++) {
        out.push(buildBusiness(id, ck));
        id++;
      }
    });
    return out;
  }

  global.LEADFINDER_DATA = {
    COUNTRIES: COUNTRIES,
    CATEGORIES: CATEGORIES,
    generateDataset: generateDataset
  };
})(window);
