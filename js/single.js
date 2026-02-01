const $ = s => document.querySelector(s);
const countrySelect = $("#countrySelect");
const tvlistDiv = $(".tvlist");
const video = $("#videoPlayer");
const searchInput = $("#searchChannel");
const nowPlaying = $("#nowPlaying");

let logosMap = {}, channelsData = [], streamsMap = {}, currentChannels = [], hls;
const getJSON = u => fetch(u).then(r => r.json());

searchInput.style.display = "none"; // 🔒 hide search saat awal

/* ===== LOAD DATA ===== */
(async () => {
  try {
    const [countries, logos, channels, streams] = await Promise.all([
      getJSON("https://iptv-org.github.io/api/countries.json"),
      getJSON("https://iptv-org.github.io/api/logos.json"),
      getJSON("https://iptv-org.github.io/api/channels.json"),
      getJSON("https://iptv-org.github.io/api/streams.json")
    ]);

    countries.sort((a,b)=>a.name.localeCompare(b.name))
      .forEach(c => countrySelect.add(new Option(c.name, c.code)));

    logosMap = Object.fromEntries(logos.map(l => [l.channel, l.url]));
    channelsData = channels;
    streams.forEach(s => streamsMap[s.channel] ??= s.url);

  } catch (e) { 
    console.error("IPTV load error", e);
    showToast("Failed to load IPTV data");
  }
})();

/* ===== COUNTRY FILTER ===== */
countrySelect.onchange = () => {
  const code = countrySelect.value;

  if (!code) {
    tvlistDiv.innerHTML = "<p>Select a country first...</p>";
    searchInput.style.display = "none";
    searchInput.value = "";
    return;
  }

  searchInput.style.display = "block";
  currentChannels = channelsData.filter(c => c.country === code);
  renderChannels(currentChannels);
};

/* ===== RENDER CHANNELS ===== */
function renderChannels(list) {
  tvlistDiv.innerHTML = list.length ? "" : "<p>No channels found.</p>";
  const frag = document.createDocumentFragment();

  list.forEach(ch => {
    const card = document.createElement("div");
    card.className = "channel-card";
    const logo = logosMap[ch.id];

    card.innerHTML = `
      ${logo ? `<img src="${logo}" class="logo">` : `<div class="no-logo">${ch.name}</div>`}
      <div class="channel-name">${ch.name}</div>
    `;

    card.onclick = () => {
      $(".channel-card.active")?.classList.remove("active");
      card.classList.add("active");

      const url = streamsMap[ch.id];
      if (!url) return showToast("Stream not available.");

      nowPlaying.textContent = ch.name;
      playStream(url);
    };

    frag.appendChild(card);
  });

  tvlistDiv.appendChild(frag);
}

/* ===== SEARCH ===== */
searchInput.oninput = () => {
  const k = searchInput.value.toLowerCase();
  renderChannels(currentChannels.filter(c => c.name.toLowerCase().includes(k)));
};

/* ===== PLAYER ===== */
function playStream(url) {
  hls?.destroy();

  if (Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
  } 
  else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    video.play();
  } 
  else showToast("Browser doesn't support HLS.");
}

/* ===== TOAST ===== */
function showToast(msg, time = 2500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t.hideTimeout);
  t.hideTimeout = setTimeout(() => t.classList.remove("show"), time);
}
