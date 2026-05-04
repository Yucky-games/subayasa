// --- 1. Firebaseの読み込みと初期化 ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 先ほどいただいたFirebaseの接続キー
const firebaseConfig = {
  apiKey: "AIzaSyAprIcaJ4VhhXjE6XKJ8DjxOVkpSs-vH98",
  authDomain: "pokemon-subayasa-checker.firebaseapp.com",
  projectId: "pokemon-subayasa-checker",
  storageBucket: "pokemon-subayasa-checker.firebasestorage.app",
  messagingSenderId: "138616858977",
  appId: "1:138616858977:web:956162e162c7a2b9dfbd20"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// --- 2. 既存の変数 ---
let pokemonData = [];
let myRegisteredPokemons = [];
let currentCheckMine = null;
let currentCheckOpp = null;
let baseMine = null;
let baseOpponent = null;

// --- 3. アプリ起動時の処理（ログインとデータ読み込み） ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    console.log("ログイン成功 UID:", user.uid);
    await loadMyPokemons(); // クラウドからデータを読み込む
  } else {
    signInAnonymously(auth).catch(error => console.error("ログインエラー:", error));
  }
});

window.onload = async () => {
  try {
    const res = await fetch('pokemon_data.json');
    pokemonData = await res.json();
    setupSearchListeners();
  } catch (error) {
    console.error('データの読み込みに失敗しました', error);
  }
};

// --- 4. Firestore (データベース) との通信処理 ---
async function loadMyPokemons() {
  if (!currentUser) return;
  const docRef = doc(db, "users", currentUser.uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    myRegisteredPokemons = docSnap.data().pokemons || [];
    updateRegisteredList();
  }
}

async function saveMyPokemons() {
  if (!currentUser) return;
  const docRef = doc(db, "users", currentUser.uid);
  await setDoc(docRef, { pokemons: myRegisteredPokemons });
}

// --- 5. UIロジック（HTMLから呼び出せるように window に登録） ---
window.switchTab = function(tabId) {
  // すべてのタブの中身とボタンの青い線をリセット
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // 選ばれたタブの中身を表示
  document.getElementById(`${tabId}-tab`).classList.add('active');

  // 選ばれたボタンに青い線を付ける
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick').includes(tabId)) {
      btn.classList.add('active');
    }
  });
}

function hiraToKata(str) {
  return str.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}

function setupSearchListeners() {
  setupSearch('reg-search', 'reg-search-results', selectForRegister);
  setupSearch('my-search-check', 'my-search-results-check', selectForMyCheck);
  setupSearch('opp-search', 'opp-search-results', selectForOppCheck);

  ['my-points-check', 'my-nature-check', 'my-scarf-check'].forEach(id => {
    document.getElementById(id).addEventListener('input', window.updateBattle);
  });
}

function setupSearch(inputId, resultsId, onSelectCallback) {
  const input = document.getElementById(inputId);
  const resultsDiv = document.getElementById(resultsId);

  input.addEventListener('input', (e) => {
    const query = hiraToKata(e.target.value.trim());
    resultsDiv.innerHTML = '';
    if (query.length === 0) {
      resultsDiv.style.display = 'none';
      return;
    }
    const filtered = pokemonData.filter(p => p.name.includes(query)).slice(0, 10);
    if (filtered.length > 0) {
      resultsDiv.style.display = 'block';
      filtered.forEach(p => {
        const div = document.createElement('div');
        div.textContent = p.name;
        div.onclick = () => {
          onSelectCallback(p);
          input.value = '';
          resultsDiv.style.display = 'none';
        };
        resultsDiv.appendChild(div);
      });
    } else {
      resultsDiv.style.display = 'none';
    }
  });
}

function calcActualSpeed(baseSpeed, points, isNatureUp, hasScarf) {
  let stat = baseSpeed + 20 + Number(points);
  if (isNatureUp) stat = Math.floor(stat * 1.1);
  if (hasScarf) stat = Math.floor(stat * 1.5);
  return stat;
}

// --- 自分のポケモン登録 ---
let tempRegisterTarget = null;
function selectForRegister(pokemon) {
  tempRegisterTarget = pokemon;
  document.getElementById('reg-selected-name').textContent = pokemon.name;
  document.getElementById('reg-stats').style.display = 'block';
}

window.registerMyPokemon = async function() {
  if (!tempRegisterTarget) return;
  const points = document.getElementById('reg-points').value;
  const isNatureUp = document.getElementById('reg-nature').checked;
  const hasScarf = document.getElementById('reg-scarf').checked;
  const actualSpeed = calcActualSpeed(tempRegisterTarget.baseSpeed, points, isNatureUp, hasScarf);

  const newData = { ...tempRegisterTarget, points, isNatureUp, hasScarf, actualSpeed };
  myRegisteredPokemons.push(newData);
  updateRegisteredList();
  
  // ★ Firebaseに保存する処理を呼び出し ★
  await saveMyPokemons();
  
  document.getElementById('reg-stats').style.display = 'none';
  tempRegisterTarget = null;
}

function updateRegisteredList() {
  const ul = document.getElementById('registered-list');
  ul.innerHTML = '';
  myRegisteredPokemons.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (実数値: ${p.actualSpeed}) ${p.hasScarf ? '🧣スカーフ' : ''}`;
    ul.appendChild(li);
  });

  const select = document.getElementById('my-registered-select');
  select.innerHTML = '<option value="">登録済みから選ぶ...</option>';
  myRegisteredPokemons.forEach((p, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = `${p.name} (実数値: ${p.actualSpeed})`;
    select.appendChild(opt);
  });
  
  select.onchange = (e) => {
    if (e.target.value !== "") {
      const p = myRegisteredPokemons[e.target.value];
      currentCheckMine = p;
      document.getElementById('my-stats-check').style.display = 'none';
      window.updateBattle();
    }
  };
}

// --- 素早さチェックタブの処理 ---
function selectForMyCheck(pokemon) {
  baseMine = pokemon;
  document.getElementById('my-registered-select').value = ""; 
  setMineCheck(pokemon);
  generateMegaButtons(pokemon, true);
}

function setMineCheck(pokemon) {
  currentCheckMine = pokemon;
  document.getElementById('my-selected-name-check').textContent = pokemon.name;
  document.getElementById('my-stats-check').style.display = 'block';
  window.updateBattle();
}

function selectForOppCheck(pokemon) {
  baseOpponent = pokemon;
  setOpponent(pokemon);
  generateMegaButtons(pokemon, false);
}

function setOpponent(pokemon) {
  currentCheckOpp = pokemon;
  document.getElementById('opp-selected-area').style.display = 'block';
  document.getElementById('opp-selected-name').textContent = pokemon.name;
  window.updateBattle();
}

function generateMegaButtons(basePokemon, isMine) {
  const containerId = isMine ? 'my-mega-buttons-area' : 'opp-mega-buttons-area';
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  if (basePokemon.name.includes('メガ')) return;

  const megas = pokemonData.filter(p => p.name.includes('メガ' + basePokemon.name));
  
  if (megas.length > 0) {
    const baseBtn = document.createElement('button');
    baseBtn.textContent = '通常';
    baseBtn.classList.add('active');
    baseBtn.onclick = () => {
      if (isMine) setMineCheck(basePokemon);
      else setOpponent(basePokemon);
      Array.from(container.children).forEach(b => b.classList.remove('active'));
      baseBtn.classList.add('active');
    };
    container.appendChild(baseBtn);

    megas.forEach(mega => {
      const megaBtn = document.createElement('button');
      megaBtn.textContent = mega.name;
      megaBtn.onclick = () => {
        if (isMine) setMineCheck(mega);
        else setOpponent(mega);
        Array.from(container.children).forEach(b => b.classList.remove('active'));
        megaBtn.classList.add('active');
      };
      container.appendChild(megaBtn);
    });
  }
}

window.updateBattle = function() {
  if (!currentCheckMine || !currentCheckOpp) return;

  let mySpeed;
  let myLabel = currentCheckMine.name;
  
  if (document.getElementById('my-stats-check').style.display === 'block') {
    const pts = document.getElementById('my-points-check').value;
    const nat = document.getElementById('my-nature-check').checked;
    const scf = document.getElementById('my-scarf-check').checked;
    mySpeed = calcActualSpeed(currentCheckMine.baseSpeed, pts, nat, scf);
    if(scf) myLabel += " (スカーフ)";
  } else {
    mySpeed = currentCheckMine.actualSpeed;
    if(currentCheckMine.hasScarf) myLabel += " (スカーフ)";
  }

  const oppBase = currentCheckOpp.baseSpeed;
  const oppPatterns = [
    { label: `${currentCheckOpp.name} (最速スカーフ)`, speed: calcActualSpeed(oppBase, 32, true, true), isMine: false },
    { label: `${currentCheckOpp.name} (最速)`, speed: calcActualSpeed(oppBase, 32, true, false), isMine: false },
    { label: `${currentCheckOpp.name} (準速スカーフ)`, speed: calcActualSpeed(oppBase, 32, false, true), isMine: false },
    { label: `${currentCheckOpp.name} (準速)`, speed: calcActualSpeed(oppBase, 32, false, false), isMine: false },
    { label: `${currentCheckOpp.name} (無振りスカーフ)`, speed: calcActualSpeed(oppBase, 0, false, true), isMine: false },
    { label: `${currentCheckOpp.name} (無振り)`, speed: calcActualSpeed(oppBase, 0, false, false), isMine: false },
  ];

  const allResults = [...oppPatterns, { label: myLabel, speed: mySpeed, isMine: true }];
  allResults.sort((a, b) => b.speed - a.speed);

  const resultDiv = document.getElementById('battle-results');
  resultDiv.innerHTML = '<h3>素早さ関係（上が先制）</h3>';
  
  allResults.forEach(res => {
    const row = document.createElement('div');
    row.className = `result-row ${res.isMine ? 'result-mine' : 'result-opp'}`;
    row.innerHTML = `<span>${res.label}</span><span class="speed-val">${res.speed}</span>`;
    resultDiv.appendChild(row);
  });
}
