const regionMap = {
  "北海道": "北海道",
  "青森県": "東北", "岩手県": "東北", "宮城県": "東北", "秋田県": "東北", "山形県": "東北", "福島県": "東北",
  "茨城県": "関東", "栃木県": "関東", "群馬県": "関東", "埼玉県": "関東", "千葉県": "関東", "東京都": "関東", "神奈川県": "関東",
  "新潟県": "中部", "富山県": "中部", "石川県": "中部", "福井県": "中部", "山梨県": "中部", "長野県": "中部",
  "岐阜県": "中部", "静岡県": "中部", "愛知県": "中部",
  "三重県": "近畿", "滋賀県": "近畿", "京都府": "近畿", "大阪府": "近畿", "兵庫県": "近畿", "奈良県": "近畿", "和歌山県": "近畿",
  "鳥取県": "中国", "島根県": "中国", "岡山県": "中国", "広島県": "中国", "山口県": "中国",
  "徳島県": "四国", "香川県": "四国", "愛媛県": "四国", "高知県": "四国",
  "福岡県": "九州・沖縄", "佐賀県": "九州・沖縄", "長崎県": "九州・沖縄", "熊本県": "九州・沖縄", "大分県": "九州・沖縄",
  "宮崎県": "九州・沖縄", "鹿児島県": "九州・沖縄", "沖縄県": "九州・沖縄"
};

const typeColors = {
  "停電": "#e11d48",
  "断水": "#0ea5e9",
  "通信障害": "#f59e0b",
  "避難指示": "#10b981"
};

const regionPrefMap = {};
for (const [pref, region] of Object.entries(regionMap)) {
  if (!regionPrefMap[region]) regionPrefMap[region] = [];
  regionPrefMap[region].push(pref);
}

const map = L.map("map").setView([35.6895, 139.6917], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let markers = [];
let originalData = [];
let municipalityMaster = {};

fetch("municipalities.json")
  .then(res => res.json())
  .then(master => {
    municipalityMaster = master;
    return fetch("impact.json");
  })
  .then(res => res.json())
  .then(data => {
    originalData = data.map(d => {
      const meta = municipalityMaster[d.code] || {};
      return {
        ...d,
        pref: meta.pref || "不明",
        region: meta.region || "不明"
      };
    });

    const totalPopulation = originalData.reduce((sum, c) => sum + (c.population || 0), 0);
    document.getElementById("city-count").textContent = `${originalData.length} 市区町村`;
    document.getElementById("total-population").textContent = `${totalPopulation.toLocaleString()} 人`;

    renderMarkers(originalData);
    renderLegend();
    renderRegionCards(originalData);
    updateTimestamp();

    fetch("japan.geojson")
      .then(res => res.json())
      .then(geojson => {
        L.geoJSON(geojson, {
          style: {
            color: "#888",
            weight: 1,
            fillOpacity: 0.1
          }
        }).addTo(map);
      })
      .catch(err => {
        console.error("GeoJSON読み込みエラー:", err);
      });
  })
  .catch(err => {
    console.error("データ取得エラー:", err);
    alert("データの取得に失敗しました。impact.json を確認してください。");
  });

function renderMarkers(data) {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  data.forEach(city => {
    if (city.lat && city.lng) {
      const marker = L.circleMarker([city.lat, city.lng], {
        radius: Math.max(4, Math.sqrt(city.population || 1) / 100),
        fillColor: typeColors[city.type] || "#6b7280",
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      })
        .addTo(map)
        .bindPopup(`
          <strong>${city.name}</strong><br>
          👥 ${city.population.toLocaleString()}人<br>
          📛 ${city.type || "不明な影響"}
        `);
      markers.push(marker);
    }
  });
}

function renderLegend() {
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'bg-white p-3 text-sm rounded shadow border');
    div.innerHTML = `<strong class="block mb-2 text-slate-700">📛 災害種類</strong>` +
      Object.entries(typeColors).map(([type, color]) =>
        `<div class="flex items-center space-x-2 mb-1">
           <span style="background:${color};width:12px;height:12px;display:inline-block;border-radius:9999px;"></span>
           <span class="text-slate-700">${type}</span>
         </div>`
      ).join("");
    return div;
  };
  legend.addTo(map);
}

function renderRegionCards(data) {
  const grouped = {};
  for (const [region, prefs] of Object.entries(regionPrefMap)) {
    grouped[region] = {};
    for (const pref of prefs) {
      grouped[region][pref] = [];
    }
  }

  data.forEach(city => {
    if (city.region && city.pref) {
      grouped[city.region][city.pref].push(city);
    }
  });

  const regionCards = document.getElementById("region-cards");
  regionCards.innerHTML = "";

  Object.entries(grouped).forEach(([regionName, prefs], index) => {
    const regionId = `region-${regionName.replace(/\s/g, '')}`;
    const isOpen = index === 0;
    const flatCities = Object.values(prefs).flat();
    const regionPop = flatCities.reduce((sum, c) => sum + (c.population || 0), 0);
    const regionCityCount = flatCities.length;

    const card = document.createElement("div");
    card.className = "bg-slate-50 border border-slate-200 rounded-xl shadow-sm";
    card.innerHTML = `
      <button class="accordion-trigger w-full px-4 py-3 text-left text-base font-semibold bg-slate-100 rounded-t-xl border-b border-slate-200 flex justify-between items-center hover:bg-slate-200 transition ${isOpen ? 'accordion-open' : ''}" data-target="${regionId}">
        ${regionName}（${regionCityCount}市区町村・${regionPop.toLocaleString()}人）
        <span class="accordion-icon">▾</span>
      </button>
      <div id="${regionId}" class="region-content ${isOpen ? '' : 'hidden'} px-4 pb-4">
        ${Object.entries(prefs).map(([pref, cities]) => {
          const pop = cities.reduce((s, c) => s + (c.population || 0), 0);
          return `<div class="py-2 border-b text-sm text-slate-600">${pref}：${cities.length}市区町村・${pop.toLocaleString()}人</div>`;
        }).join("")}
      </div>
    `;
    regionCards.appendChild(card);
  });

  document.querySelectorAll('.accordion-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const content = document.getElementById(targetId);
      content.classList.toggle('hidden');
      btn.classList.toggle('accordion-open');
    });
  });
}

function updateTimestamp() {
  const now = new Date().toLocaleString();
  document.getElementById("last-updated").textContent = now;
}

document.getElementById("search-box").addEventListener("input", (e) => {
  const fuse = new Fuse(originalData, {
    keys: ["name"],
    threshold: 0.3, // ゆるめに探す
    ignoreLocation: true,
    minMatchCharLength: 2
  });
  
  document.getElementById("search-box").addEventListener("input", (e) => {
    const keyword = e.target.value.trim();
    const results = keyword ? fuse.search(keyword).map(r => r.item) : originalData;
  
    renderMarkers(results);
  
    // region-cardsのフィルタ（内容一致のみ表示）
    document.querySelectorAll(".region-content > div").forEach(el => {
      const content = el.textContent || "";
      el.style.display = keyword === "" || content.includes(keyword) ? "block" : "none";
    });
  });
});

document.getElementById("filter-type").addEventListener("change", (e) => {
  const selected = e.target.value;
  const filtered = selected === "" ? originalData : originalData.filter(c => c.type === selected);
  renderMarkers(filtered);
});
