const socket = io();
let myHand = [];
let selectedIndices = [];
let currentRank = 'A';
let isMyTurn = false;

function join() {
    const nameInput = document.getElementById('username');
    if(nameInput.value) { socket.emit('joinGame', nameInput.value); nameInput.disabled = true; }
}

function start() { socket.emit('requestStart'); }

socket.on('playerUpdate', (names) => {
    document.getElementById('waiting-list').innerHTML = `<p>Players: ${names.join(', ')}</p>`;
    if(names.length >= 2) document.getElementById('start-btn').style.display = 'block';
});

socket.on('dealCards', (hand) => {
    myHand = hand;
    selectedIndices = [];
    document.getElementById('login-screen').style.display = 'none';
    renderHand();
});

socket.on('gameUpdate', (data) => {
    currentRank = data.rank;
    document.getElementById('target-rank').innerText = currentRank;
    document.getElementById('pile-count').innerText = data.pileSize;
    isMyTurn = (socket.id === data.activePlayerId);
    
    const passBtn = document.getElementById('pass-btn');
    passBtn.disabled = false;
    passBtn.innerText = "Pass Rank";

    const turnText = document.getElementById('turn-indicator');
    turnText.innerText = isMyTurn ? "YOUR TURN!" : "Waiting...";
    document.getElementById('player-area').style.opacity = isMyTurn ? "1" : "0.6";
});

socket.on('bluffResult', (data) => {
    const box = document.getElementById('game-alert');
    document.getElementById('alert-badge').innerText = data.title;
    document.getElementById('alert-badge').className = data.type === 'success' ? 'alert-success' : 'alert-fail';
    document.getElementById('alert-msg').innerText = data.msg;
    box.className = 'game-alert-visible';
    setTimeout(() => { box.className = 'game-alert-hidden'; }, 2500);
});

function renderHand() {
    const container = document.getElementById('cards-container');
    container.innerHTML = '';
    myHand.forEach((card, i) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerText = card;
        div.onclick = () => {
            if(!isMyTurn) return;
            div.classList.toggle('selected');
            const p = selectedIndices.indexOf(i);
            if(p > -1) selectedIndices.splice(p,1); else selectedIndices.push(i);
        };
        container.appendChild(div);
    });
}

function submitMove() {
    if(!isMyTurn || selectedIndices.length === 0) return;
    socket.emit('playMove', { indices: selectedIndices, claim: currentRank });
    selectedIndices = [];
}

function callBluff() { socket.emit('callBluff'); }

function votePass() {
    socket.emit('votePass');
    const btn = document.getElementById('pass-btn');
    btn.disabled = true;
    btn.innerText = "Waiting...";
}

function sendChat() {
    const el = document.getElementById('chat-input');
    if(el.value) { socket.emit('sendChatMessage', el.value); el.value = ''; }
}

socket.on('receiveChatMessage', (d) => {
    const m = document.getElementById('chat-messages');
    m.innerHTML += `<div><b style="color:#d4af37">${d.name}:</b> ${d.text}</div>`;
    m.scrollTop = m.scrollHeight;
});

socket.on('victory', (w) => {
    document.getElementById('winner-text').innerText = `${w} WINS!`;
    document.getElementById('victory-screen').style.display = 'flex';
});