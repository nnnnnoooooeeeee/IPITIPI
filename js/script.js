const grid = document.getElementById("grid");
const addBtn = document.getElementById("addBtn");
const removeBtn = document.getElementById("removeBtn");

// Modal Elements
const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const countrySelect = document.getElementById("countrySelect");
const searchChannel = document.getElementById("searchChannel");
const channelGrid = document.getElementById("channelGrid");
const statusText = document.getElementById("statusText");

let tileCount = 0;
let activeTile = null; 
let hlsPlayers = new Map(); 
let currentChannelList = []; 

/* ===== API & Data Handling ===== */

// 1. Fetch Countries on load
async function initData() {
    try {
        statusText.textContent = "Loading countries...";
        
        const resCountries = await fetch("https://iptv-org.github.io/api/countries.json");
        const countries = await resCountries.json();
        
        // Sort alphabetically
        countries.sort((a, b) => a.name.localeCompare(b.name));
        
        // Reset options
        countrySelect.innerHTML = '<option value="">-- Select Country --</option>';
        
        // Pure alphabetical list (No recommendations)
        countries.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.code.toLowerCase(); 
        opt.textContent = c.name; 
        countrySelect.appendChild(opt);
        });
        
        statusText.textContent = "Ready. Please select a country.";
        
    } catch (err) {
        console.error(err);
        statusText.textContent = "Failed to load country list.";
    }
}

// 2. Fetch Playlist M3U & Parse
async function fetchAndRenderChannels(countryCode) {
    if (!countryCode) {
        channelGrid.innerHTML = "";
        searchChannel.classList.add("hidden");
        statusText.textContent = "Please select a country.";
        return;
    }

    channelGrid.innerHTML = "";
    statusText.textContent = `Fetching channels for: ${countryCode.toUpperCase()}...`;
    searchChannel.value = ""; 
    searchChannel.classList.add("hidden"); 

    try {
        const url = `https://iptv-org.github.io/iptv/countries/${countryCode}.m3u`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error("Playlist not found");

        const text = await response.text();
        currentChannelList = parseM3U(text);

        statusText.textContent = `${currentChannelList.length} channels found.`;
        
        if (currentChannelList.length > 0) {
        searchChannel.classList.remove("hidden");
        }

        renderGridItems(currentChannelList);

    } catch (err) {
        console.error(err);
        statusText.textContent = "Failed to load channels. Try another country.";
        channelGrid.innerHTML = `<p style="padding:10px; color:#ff4444">Error loading data.</p>`;
    }
}

function parseM3U(m3uData) {
    const lines = m3uData.split('\n');
    const result = [];
    let currentItem = {};

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
        currentItem = {};
        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        if (logoMatch) currentItem.logo = logoMatch[1];
        const nameParts = line.split(',');
        currentItem.name = nameParts[nameParts.length - 1].trim();
        } else if (!line.startsWith('#')) {
        if (currentItem.name) {
            currentItem.url = line;
            if (currentItem.logo && currentItem.url) {
                result.push(currentItem);
            }
        }
        }
    }
    return result;
}

function renderGridItems(channels) {
    channelGrid.innerHTML = ""; 

    if (channels.length === 0) {
        channelGrid.innerHTML = "<p style='padding:20px; color:#777'>No channels available.</p>";
        return;
    }

    channels.forEach(ch => {
        const div = document.createElement("div");
        div.className = "channel-item";
        
        const img = document.createElement("img");
        img.src = ch.logo;
        img.loading = "lazy";
        img.onerror = () => { 
            img.src = "https://via.placeholder.com/100?text=No+Logo"; 
            img.style.opacity = "0.5";
        };
        
        const span = document.createElement("span");
        span.textContent = ch.name;

        div.appendChild(img);
        div.appendChild(span);

        div.addEventListener("click", () => {
        playStreamInTile(activeTile, ch.url);
        modal.classList.add("hidden");
        });

        channelGrid.appendChild(div);
    });
}

searchChannel.addEventListener("input", (e) => {
const keyword = e.target.value.toLowerCase();
if (!currentChannelList.length) return;
const filtered = currentChannelList.filter(ch => 
    ch.name.toLowerCase().includes(keyword)
);
renderGridItems(filtered);
});

countrySelect.addEventListener("change", (e) => {
fetchAndRenderChannels(e.target.value);
});

/* ===== GRID & PLAYER LOGIC ===== */

function updateColumns() {
    grid.classList.remove("cols-1", "cols-2", "cols-3");
    if (tileCount <= 1) grid.classList.add("cols-1");
    else if (tileCount === 2) grid.classList.add("cols-2");
    else grid.classList.add("cols-3");
}

function createTile() {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.textContent = "+";
    tile.dataset.id = Date.now() + Math.random();

    tile.addEventListener("click", (e) => {
        if (!tile.classList.contains("has-video")) {
        activeTile = tile;
        modal.classList.remove("hidden");
        }
    });

    grid.appendChild(tile);
    tileCount++;
    updateColumns();
}

function removeTile() {
    if (tileCount === 0) return;
    const lastTile = grid.lastChild;
    stopStreamInTile(lastTile);
    grid.removeChild(lastTile);
    tileCount--;
    updateColumns();
}

function playStreamInTile(tile, url) {
    tile.innerHTML = ""; // Clear the "+"
    tile.classList.add("has-video");

    const video = document.createElement("video");
    video.controls = true; 
    video.autoplay = true;
    video.playsinline = true;
    tile.appendChild(video);

    if (Hls.isSupported()) {
        if (hlsPlayers.has(tile.dataset.id)) {
        hlsPlayers.get(tile.dataset.id).destroy();
        }
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
        video.play().catch(e => console.log("Autoplay prevented, user must click play."));
        });
        hls.on(Hls.Events.ERROR, function(event, data) {
            if(data.fatal) {
            hls.recoverMediaError();
            }
        });
        hlsPlayers.set(tile.dataset.id, hls);
    } 
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', function() {
        video.play();
        });
    }

    addTileControls(tile);
}

function addTileControls(tile) {
    const oldControls = tile.querySelector('.tile-controls');
    if (oldControls) oldControls.remove();

    const controlDiv = document.createElement("div");
    controlDiv.className = "tile-controls";

    const changeBtn = document.createElement("button");
    changeBtn.className = "control-btn btn-change";
    changeBtn.innerHTML = "↳↰";
    changeBtn.title = "Change Channel";
    changeBtn.onclick = (e) => {
        e.stopPropagation();
        activeTile = tile;
        modal.classList.remove("hidden");
    };

    const closeBtn = document.createElement("button");
    closeBtn.className = "control-btn btn-close";
    closeBtn.textContent = "✕";
    closeBtn.title = "Close Stream";
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        stopStreamInTile(tile);
    };

    controlDiv.appendChild(changeBtn);
    controlDiv.appendChild(closeBtn);
    tile.appendChild(controlDiv);
}

function stopStreamInTile(tile) {
    const id = tile.dataset.id;
    if (hlsPlayers.has(id)) {
        hlsPlayers.get(id).destroy();
        hlsPlayers.delete(id);
    }
    tile.innerHTML = "+";
    tile.classList.remove("has-video");

    const controls = tile.querySelector('.tile-controls');
    if (controls) controls.remove();
}

/* ===== Init ===== */
addBtn.addEventListener("click", createTile);
removeBtn.addEventListener("click", removeTile);

closeModal.addEventListener("click", () => {
modal.classList.add("hidden");
});

modal.addEventListener("click", (e) => {
if (e.target === modal) {
    modal.classList.add("hidden");
}
});

initData();
createTile();
