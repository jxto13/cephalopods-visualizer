import "./style.css";

const map = L.map("map", {
  worldCopyJump: true,
  zoomControl: true,
}).setView([20, 0], 2);

// Resize handling
function resizeMap() {
  map.invalidateSize();
}

window.addEventListener("resize", resizeMap);

// Detect container changes
const mapContainer = document.getElementById("map");

const resizeObserver = new ResizeObserver(() => {
  resizeMap();
});

resizeObserver.observe(mapContainer);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  noWrap: false,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

setTimeout(() => {
  resizeMap();
}, 300);

map.setMinZoom(1);

let geojsonData = null;
let geojsonLayer = null;
let speciesColors = {};

const fileInput = document.getElementById("geojsonInput");

const searchInput = document.getElementById("searchInput");

const speciesFilter = document.getElementById("speciesFilter");

const entries = document.getElementById("entries");

function getSpecies(feature) {
  return (
    feature.properties.scientificName || feature.properties.species || "Unknown"
  );
}

function getCatalog(feature) {
  return feature.properties.catalogNumber || "";
}

function getLabel(feature) {
  const species = getSpecies(feature);

  const catalog = getCatalog(feature);

  return catalog ? `${species} (${catalog})` : species;
}

function randomColor() {
  return `
    hsl(
      ${Math.random() * 360},
      70%,
      55%
    )
  `;
}

function generateSpeciesColors(features) {
  speciesColors = {};

  const species = [...new Set(features.map(getSpecies))];

  species.forEach((name) => {
    speciesColors[name] = randomColor();
  });
}

function renderList() {
  if (!geojsonData) return;

  const search = searchInput.value.toLowerCase();

  const selectedSpecies = speciesFilter.value;

  entries.innerHTML = "";

  geojsonData.features
    .filter((feature) => {
      const species = getSpecies(feature);

      return (
        species.toLowerCase().includes(search) &&
        (!selectedSpecies || species === selectedSpecies)
      );
    })

    .forEach((feature) => {
      const item = document.createElement("button");

      item.className = `
  w-full
  text-left
  bg-slate-900
  border
  border-slate-800
  hover:border-blue-500
  hover:bg-slate-800
  transition
  p-3
  rounded-xl
  flex
  items-center
  gap-3
  text-sm
`;

      const color = speciesColors[getSpecies(feature)];

      item.innerHTML = `

        <span
          style="
            width:12px;
            height:12px;
            border-radius:50%;
            background:${color};
            display:inline-block;
          "
        ></span>


        <span>
          ${getLabel(feature)}
        </span>

      `;

      item.onclick = () => {
        const geometry = feature.geometry;

        if (geometry.type === "Point") {
          const [lng, lat] = geometry.coordinates;

          map.flyTo([lat, lng], 8, {
            duration: 1,
          });
        }
      };

      entries.appendChild(item);
    });
}

function loadGeoJSON(data) {
  geojsonData = data;

  generateSpeciesColors(geojsonData.features);

  speciesFilter.innerHTML = `

    <option value="">
      All species
    </option>

  `;

  const species = [...new Set(geojsonData.features.map(getSpecies))];

  species.forEach((name) => {
    const option = document.createElement("option");

    option.value = name;

    option.textContent = name;

    speciesFilter.appendChild(option);
  });

  if (geojsonLayer) {
    map.removeLayer(geojsonLayer);
  }

  geojsonLayer = L.geoJSON(geojsonData, {
    pointToLayer(feature, latlng) {
      const species = getSpecies(feature);

      return L.circleMarker(latlng, {
        radius: 6,

        color: "#ffffff",

        weight: 1,

        fillColor: speciesColors[species],

        fillOpacity: 0.85,
      });
    },

    onEachFeature(feature, layer) {
      layer.bindPopup(`

            <strong>
              ${getLabel(feature)}
            </strong>

            <br><br>

            ${Object.entries(feature.properties)
              .map(
                ([key, value]) =>
                  `
                <b>${key}</b>: ${value}
                `,
              )
              .join("<br>")}

          `);
    },
  }).addTo(map);

  const bounds = geojsonLayer.getBounds();

  if (bounds.isValid()) {
    map.fitBounds(bounds, {
      padding: [50, 50],

      maxZoom: 6,
    });
  }

  renderList();
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      loadGeoJSON(data);
    } catch (error) {
      console.error(error);

      alert("Invalid GeoJSON file");
    }
  };

  reader.readAsText(file);
});

searchInput.addEventListener("input", renderList);

speciesFilter.addEventListener("change", renderList);
