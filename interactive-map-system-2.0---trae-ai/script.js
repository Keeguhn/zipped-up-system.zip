// === COORDINATE TRANSFORMATION ===
// Convert node coordinates to canvas coordinates
function toCanvasCoords(coord, canvas) {
    // Scale coordinates to match the pathways editor
    const nodeScaleX = 1.25;   // >1 stretches wider, <1 shrinks horizontally
    const nodeScaleY = 1.25;   // >1 stretches taller, <1 shrinks vertically
    const nodeOffsetX = -5.5;   // horizontal shift (in % of container width)
    const nodeOffsetY = -5.5;   // vertical shift (in % of container height)

    return {
        x: ((coord.x + nodeOffsetX) / 100) * canvas.width * nodeScaleX,
        y: ((coord.y + nodeOffsetY) / 100) * canvas.height * nodeScaleY
    };
}

// === MAIN ===
window.onload = () => {
    console.log("Campus map loaded.");
    const mapContainer = document.getElementById("map-container");

    // Place icons
    iconData.forEach(icon => {
        const el = document.createElement("img");
        el.src = icon.img;
        el.className = "map-icon";
        el.style.left = `${icon.x}%`;
        el.style.top = `${icon.y}%`;
        el.onclick = () => window.open(icon.link, "_self");
        mapContainer.appendChild(el);
    });

    initPathFinder();
};

function initPathFinder() {
    const pathFinder = new PathFinder();
    const canvas = document.getElementById('path-canvas');
    const mapContainer = document.getElementById('map-container');
    const campusMap = document.getElementById('campus-map');

    // Resize canvas to match PNG scaling
    function resizeCanvas() {
    const rect = campusMap.getBoundingClientRect();
    canvas.width = rect.width;   // drawing space = visible size
    canvas.height = rect.height;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // UI elements
    const toggleBtn = document.getElementById('toggle-pathfinder');
    const pathfinderPanel = document.getElementById('pathfinder-panel');
    const startPointDropdown = document.getElementById('start-point-dropdown');
    const endPointDropdown = document.getElementById('end-point-dropdown');
    const findPathBtn = document.getElementById('find-path');
    const clearPathBtn = document.getElementById('clear-path');
    const pathInfo = document.getElementById('path-info');
    const pathDistance = document.getElementById('path-distance');
    const pathTime = document.getElementById('path-time');

    let startPoint = null;
    let endPoint = null;
    let startMarker = null;
    let endMarker = null;
    let currentPath = null;

    // Load data
    pathFinder.loadData().then(success => {
        if (!success) {
            console.error("Failed to load pathfinder data");
            return;
        }

        const ctx = canvas.getContext('2d');

        // Draw paths
        pathFinder.paths.forEach(path => {
            const startNode = pathFinder.nodes.find(n => n.id === path.start);
            const endNode = pathFinder.nodes.find(n => n.id === path.end);

            if (startNode && endNode && path.walkable) {
                const startPx = toCanvasCoords(startNode, canvas);
                const endPx = toCanvasCoords(endNode, canvas);

                ctx.beginPath();
                ctx.moveTo(startPx.x, startPx.y);
                ctx.lineTo(endPx.x, endPx.y);
                ctx.strokeStyle = '#0066cc44';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        // Draw nodes
        pathFinder.nodes.forEach(node => {
            const px = toCanvasCoords(node, canvas);

            ctx.beginPath();
            ctx.arc(px.x, px.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = node.type === 'building' ? '#ff0000' : '#0066cc';
            ctx.fill();

            if (node.type === 'building' || node.type === 'gate') {
                ctx.fillStyle = '#000000';
                ctx.font = '10px Arial';
                ctx.fillText(node.name, px.x + 5, px.y - 5);
            }
        });

        populateLocationDropdowns();
    });

    function populateLocationDropdowns() {
        const keyLocations = pathFinder.getNodesByType("building").concat(
            pathFinder.getNodesByType("gate")
        );
        keyLocations.sort((a, b) => a.name.localeCompare(b.name));

        keyLocations.forEach(location => {
            const startOption = document.createElement('option');
            startOption.value = location.id;
            startOption.textContent = location.name;
            startPointDropdown.appendChild(startOption);

            const endOption = document.createElement('option');
            endOption.value = location.id;
            endOption.textContent = location.name;
            endPointDropdown.appendChild(endOption);
        });
    }

    toggleBtn.addEventListener('click', () => {
        if (pathfinderPanel.classList.contains('hidden')) {
            pathfinderPanel.classList.remove('hidden');
            toggleBtn.textContent = 'Hide';
        } else {
            pathfinderPanel.classList.add('hidden');
            toggleBtn.textContent = 'Show';
        }
    });

    startPointDropdown.addEventListener('change', function() {
        const nodeId = this.value;
        if (nodeId) {
            const node = pathFinder.getNode(nodeId);
            if (node) {
                startPoint = { x: node.x, y: node.y, id: nodeId, name: node.name };

                if (startMarker) {
                    startMarker.style.left = `${node.x}%`;
                    startMarker.style.top = `${node.y}%`;
                } else {
                    startMarker = createMarker(node.x, node.y, 'start-point');
                    mapContainer.appendChild(startMarker);
                }

                if (endPoint) findPathBtn.disabled = false;
            }
        }
    });

    endPointDropdown.addEventListener('change', function() {
        const nodeId = this.value;
        if (nodeId) {
            const node = pathFinder.getNode(nodeId);
            if (node) {
                endPoint = { x: node.x, y: node.y, id: nodeId, name: node.name };

                if (endMarker) {
                    endMarker.style.left = `${node.x}%`;
                    endMarker.style.top = `${node.y}%`;
                } else {
                    endMarker = createMarker(node.x, node.y, 'end-point');
                    mapContainer.appendChild(endMarker);
                }

                if (startPoint) findPathBtn.disabled = false;
            }
        }
    });

    function createMarker(x, y, className) {
        const marker = document.createElement('div');
        marker.className = `point-marker ${className}`;
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        return marker;
    }

    findPathBtn.addEventListener('click', () => {
        if (!startPoint || !endPoint) return;

        const startNodeId = startPoint.id;
        const endNodeId = endPoint.id;

        currentPath = pathFinder.findShortestPath(startNodeId, endNodeId);
        renderPath(currentPath.coordinates);

        pathInfo.classList.remove('hidden');
        pathDistance.textContent = currentPath.distance.toFixed(0);

        const minutes = Math.floor(currentPath.estimatedTime);
        const seconds = Math.round((currentPath.estimatedTime - minutes) * 60);

        let timeDisplay;
        if (minutes === 0) timeDisplay = `${seconds} seconds`;
        else if (seconds === 0) timeDisplay = `${minutes} minute${minutes > 1 ? 's' : ''}`;
        else timeDisplay = `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds > 1 ? 's' : ''}`;

        pathTime.textContent = timeDisplay;
        clearPathBtn.disabled = false;
    });

    clearPathBtn.addEventListener('click', () => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (startMarker) { mapContainer.removeChild(startMarker); startMarker = null; }
        if (endMarker) { mapContainer.removeChild(endMarker); endMarker = null; }

        startPoint = null;
        endPoint = null;
        currentPath = null;

        startPointDropdown.value = '';
        endPointDropdown.value = '';

        pathInfo.classList.add('hidden');
        findPathBtn.disabled = true;
        clearPathBtn.disabled = true;
    });

    function renderPath(coordinates) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!coordinates || coordinates.length < 2) return;

        const pixelCoords = coordinates.map(coord => toCanvasCoords(coord, canvas));

        ctx.beginPath();
        ctx.moveTo(pixelCoords[0].x, pixelCoords[0].y);
        for (let i = 1; i < pixelCoords.length; i++) {
            ctx.lineTo(pixelCoords[i].x, pixelCoords[i].y);
        }

        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = '#0066cc';
        pixelCoords.forEach(coord => {
            ctx.beginPath();
            ctx.arc(coord.x, coord.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

// === ICON DATA (unchanged) ===
const iconData = [
    { name: "St. Albertus Magnus Building", x: 22, y: 43, link:"pages/st.-albertus-magnus.html", img: "assets/icons/albertus.png" },
    { name: "St. Jacques Building", x: 51, y: 19, link: "pages/st.-jacques.html", img: "assets/icons/jacques.png" },
    { name: "St. Thomas Aquinas Building", x: 44, y: 43, link:"pages/st.-thomas-aquinas.html", img: "assets/icons/aquinas.png" },
    { name: "St. Catherine Building", x: 40, y: 54, link:"pages/st.-catherine.html", img: "assets/icons/catherine.png" },
    { name: "St. Dominic Building", x: 45, y: 65, link:"pages/st.-dominic.html", img: "assets/icons/dominic.png" },
    { name: "Gymnasium", x: 23, y: 74, link:"360-viewer.html?room=Gym" },
    { name: "Auditorium", x: 25, y: 66, link:"360-viewer.html?room=Auditorium", img: "assets/icons/auditorium.png" },
    { name:"St. Martin Complex", x: 9, y: 54, link:"360-viewer.html?room=St. Martin Sports Complex", img: "assets/icons/martin.png" },
    { name:"St. Rose", x:60, y:57, link:"pages/st.-rose.html", img: "assets/icons/rose.png" },
    { name:"Mother Francisca Outreach Center", x:73, y:86, link:"pages/mother-natividad.html" },
    { name:"Gate 1", x:78, y:82, link:"360-viewer.html?room=Gate 1", img: "assets/icons/gate 1.png" },
    { name:"Gate 2", x:70, y:66, link:"360-viewer.html?room=Gate 2", img: "assets/icons/gate 2.png" },
    { name:"Gate 3", x:84, y:35, link:"360-viewer.html?room=Gate 3", img: "assets/icons/gate 3.png" },
    { name:"Gate 4", x:20, y:13, link:"360-viewer.html?room=Gate 4", img: "assets/icons/gate 4.png" }
];

let rooms = [];

fetch('data/rooms.json')
  .then(res => {
    if (!res.ok) throw new Error("Failed to load JSON");
    return res.json();
  })
  .then(data => {
    console.log("ROOMS LOADED:", data);
    rooms = data;
  })
  .catch(err => {
    console.error("Could not load rooms.json:", err);
  });

const searchInput = document.getElementById("search");
const resultsList = document.getElementById("search-results");
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && resultsList.firstChild) {
    resultsList.firstChild.click();
  }
});
searchInput.addEventListener("input", () => {
  const val = searchInput.value.toLowerCase().trim();
  resultsList.innerHTML = "";

  if (val.length < 2) return;

  const matches = rooms.filter(r =>
    r.code.toLowerCase().includes(val) ||
    r.name.toLowerCase().includes(val) ||
    r.building.toLowerCase().includes(val)
  );
  
  console.log("Search input:", val);
  console.log("Matches found:", matches);

  matches.forEach(match => {
  const li = document.createElement("li");
  li.innerHTML = `<strong>•${match.code || ""}</strong> ${match.name || ""}<br />
                  <span style="font-size: 0.8em; opacity: 0.8;">${match.building}</span>`;
  li.style.cursor = "pointer";

  // 🔑 Attach click event instead of auto-redirect
  li.onclick = () => {
    if (match.code && match.code.trim() !== "") {
      // Room has a code → go to 360 viewer directly
      const viewerPage = `../360-viewer.html?room=${match.code}`;
      window.location.href = viewerPage;
    } else {
      // No code → just go to building main page
      const buildingPage = `pages/${match.building.toLowerCase().replace(/\s+/g, "-")}.html`;
      window.location.href = buildingPage;
    }
  };
  resultsList.appendChild(li);
});
});

let scale = 1;
const zoomStep = 0.1;
const minZoom = 0.6;
const maxZoom = 1.5;

const zoomTarget = document.getElementById("map-container");

window.addEventListener("wheel", function (e) {
  if (!e.ctrlKey) return; // hold Ctrl to zoom, prevents accidental zoom

  e.preventDefault();
  const delta = e.deltaY;

  if (delta > 0 && scale > minZoom) {
    scale -= zoomStep;
  } else if (delta < 0 && scale < maxZoom) {
    scale += zoomStep;
  }

  zoomTarget.style.transform = `scale(${scale})`;
}, { passive: false });

function zoomIn() {
  if (scale < maxZoom) {
    scale += zoomStep;
    zoomTarget.style.transform = `scale(${scale})`;
  }
}

function zoomOut() {
  if (scale > minZoom) {
    scale -= zoomStep;
    zoomTarget.style.transform = `scale(${scale})`;
  }
}
