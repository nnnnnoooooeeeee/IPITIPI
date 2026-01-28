const mainMenu = document.getElementById('mainMenu');
const viewContainer = document.getElementById('viewContainer');
const backBtn = document.getElementById('backBtn');
const modeTitle = document.getElementById('modeTitle');

function openMode(modeName) {
    mainMenu.style.display = 'none';
    viewContainer.style.display = 'block';
    modeTitle.innerText = "Mode: " + modeName;
    backBtn.style.display = 'block';
}

function showMain() {
    mainMenu.style.display = 'grid';
    viewContainer.style.display = 'none';
    backBtn.style.display = 'none';
}