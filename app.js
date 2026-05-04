import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, TwitterAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
const twitterProvider = new TwitterAuthProvider();

let currentUser = null;
let pokemonData = [];
let myRegisteredPokemons = [];
let currentCheckMine = null;
let currentCheckOpp = null;
let baseMine = null;
let baseOpponent = null;
let editingIndex = -1;

onAuthStateChanged(auth, async (user) => {
  const statusSpan = document.getElementById('user-status');
  const loginMsg = document.getElementById('login-message');
  const loginBtn = document.getElementById('login-x-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (user) {
    currentUser = user;
    const displayName = user.displayName || "Xユーザー";
    
    const photoURL = user.photoURL;
    const iconHtml = photoURL ? `<img src="${photoURL}" class="user-icon" alt="icon">` : `✅`;
    
    loginMsg.style.display = "none";
    statusSpan.innerHTML = `${iconHtml} ${displayName} としてログイン中`;
    statusSpan.style.display = "inline";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";

    await loadMyPokemons();
  } else {
    currentUser = null;
    loginMsg.style.display = "inline";
    statusSpan.style.display = "none";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    
    myRegisteredPokemons = [];
    updateRegisteredList();
  }
});

window.loginWithX = async function() {
  try {
    await signInWithPopup(auth, twitterProvider);
  } catch (error) {
    console.error("Xログインエラー:", error);
    alert("Xログインに失敗しました。時間をおいて再度お試しください。");
  }
}

window.logout = async function() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("ログアウトエラー:", error);
  }
}

window.onload = async () => {
  try {
    const res = await fetch('pokemon_data.json');
    pokemonData = await res.json();
    setupSearchListeners();
  } catch (error) {
    console.error('データの読み込みに失敗しました', error);
  }
};

async function loadMyPokemons() {
  if (!currentUser) return;
  try {
    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      myRegisteredPokemons = docSnap.data().pokemons || [];
    } else {
      myRegisteredPokemons = [];
    }
    updateRegisteredList();
  } catch (error) {
    console.error("データ読み込みエラー:", error);
  }
}

window.saveMyPokemons = async function() {
  if (!currentUser) return;
  try {
    const docRef = doc(db, "users", currentUser.uid);
    await setDoc(docRef, { pokemons: myRegisteredPokemons });
  } catch (error) {
    alert("保存エラーが発生しました: " + error.message);
    console.error("エラー詳細:", error);
  }
}

window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.getElementById(`${tabId}-tab`).classList.add('active');
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

let tempRegisterTarget = null;

function selectForRegister(pokemon) {
  editingIndex = -1;
  document.getElementById('reg-save-btn').textContent = "登録する";
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

  const newData = { ...tempRegisterTarget, points, isNatureUp, hasScarf, actualSpeed, memo: "" };
  
  if (editingIndex >= 0) {
    // 編集時は既存のメモを引き継ぐ
    newData.memo = myRegisteredPokemons[editingIndex].memo || "";
    myRegisteredPokemons[editingIndex] = newData;
    editingIndex = -1;
    document.getElementById('reg-save-btn').textContent = "登録する";
  } else {
    myRegisteredPokemons.push(newData);
  }
  
  updateRegisteredList();
  await window.saveMyPokemons();
  
  document.getElementById('reg-stats').style.display = 'none';
  tempRegisterTarget = null;
}

window.editPokemon = function(index) {
  editingIndex = index;
  const p = myRegisteredPokemons[index];
  tempRegisterTarget = p;
  
  document.getElementById('reg-selected-name').textContent = p.name + " (編集中)";
  document.getElementById('reg-points').value = p.points;
  document.getElementById('reg-nature').checked = p.isNatureUp;
  document.getElementById('reg-scarf').checked = p.hasScarf;
  document.getElementById('reg-save-btn').textContent = "更新する";
  document.getElementById('reg-stats').style.display = 'block';
  
  window.switchTab('register');
}

window.deletePokemon = async function(index) {
  const confirmDelete = confirm(`${myRegisteredPokemons[index].name} を削除してもよろしいですか？`);
  if (confirmDelete) {
    myRegisteredPokemons.splice(index, 1);
    updateRegisteredList();
    await window.saveMyPokemons();
    
    if (currentCheckMine && !myRegisteredPokemons.includes(currentCheckMine)) {
      currentCheckMine = null;
      document.getElementById('my-stats-check').style.display = 'none';
      document.getElementById('battle-results').innerHTML = '';
    }
  }
}

function updateRegisteredList() {
  const ul = document.getElementById('registered-list');
  ul.innerHTML = '';
  myRegisteredPokemons.forEach((p, index) => {
    const li = document.createElement('li');
    li.className = 'registered-item';
    
    // ★変更：テキストボックス（メモ欄）を生成して配置
    li.innerHTML = `
      <div class="list-info">
        <span style="white-space: nowrap;">${p.name} (実数値: ${p.actualSpeed}) ${p.hasScarf ? '🧣' : ''}</span>
        <input type="text" class="memo-input" placeholder="メモ追加" value="${p.memo || ''}">
      </div>
      <div class="list-actions">
        <button class="edit-btn" onclick="editPokemon(${index})">編集</button>
        <button class="delete-btn" onclick="deletePokemon(${index})">削除</button>
      </div>
    `;
    
    // ★追加：メモ欄への入力・変更があった時に自動保存する処理
    const memoInput = li.querySelector('.memo-input');
    memoInput.addEventListener('change', async (e) => {
      myRegisteredPokemons[index].memo = e.target.value;
      await window.saveMyPokemons();
      updateSelectDropdown(); // プルダウンの表示だけ更新
    });
    
    ul.appendChild(li);
  });

  updateSelectDropdown();
}

// プルダウンだけを更新する独立した関数（入力中にフォーカスが外れないようにするため）
function updateSelectDropdown() {
  const select = document.getElementById('my-registered-select');
  select.innerHTML = '<option value="">登録済みから選ぶ...</option>';
  myRegisteredPokemons.forEach((p, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    // メモがあればプルダウンにも表示
    const memoText = p.memo ? ` [${p.memo}]` : '';
    opt.textContent = `${p.name} (実数値: ${p.actualSpeed})${memoText}`;
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
    // ★変更：登録済みから選んだ場合はメモも表示に含める
    if(currentCheckMine.memo) myLabel += ` [${currentCheckMine.memo}]`;
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
