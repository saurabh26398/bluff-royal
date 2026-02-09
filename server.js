const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.resolve(__dirname)));

let players = []; 
let discardPile = [];
let currentRank = 'A'; 
let activePlayerIndex = 0;
let passVotes = new Set();
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function pickRandomRank() {
    currentRank = ranks[Math.floor(Math.random() * ranks.length)];
}

io.on('connection', (socket) => {
    socket.on('joinGame', (username) => {
        if (players.length < 4) {
            players.push({ id: socket.id, name: username, hand: [] });
            io.emit('playerUpdate', players.map(p => p.name));
        }
    });

    socket.on('requestStart', () => {
        if (players.length < 2) return;
        let deck = [];
        ranks.forEach(r => { for(let i=0; i<4; i++) deck.push(r); });
        deck.sort(() => Math.random() - 0.5);

        discardPile = [];
        pickRandomRank();
        activePlayerIndex = 0;
        passVotes.clear();

        const cardsPerPlayer = Math.floor(deck.length / players.length);
        players.forEach((p, i) => {
            p.hand = deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
            io.to(p.id).emit('dealCards', p.hand);
        });
        broadcastUpdate();
    });

    socket.on('playMove', (data) => {
        const player = players[activePlayerIndex];
        if (socket.id !== player.id) return;

        const playedCards = data.indices.map(idx => player.hand[idx]);
        player.hand = player.hand.filter((_, i) => !data.indices.includes(i));
        
        discardPile.push({ cards: playedCards, claim: data.claim, playerId: socket.id, playerName: player.name });
        
        activePlayerIndex = (activePlayerIndex + 1) % players.length;
        passVotes.clear(); // Reset pass votes on move
        socket.emit('dealCards', player.hand);
        
        if (player.hand.length === 0) io.emit('victory', player.name);
        else broadcastUpdate();
    });

    socket.on('callBluff', () => {
        if (discardPile.length === 0) return;
        const lastMove = discardPile[discardPile.length - 1];
        const isBluff = lastMove.cards.some(c => c !== lastMove.claim);
        const caller = players.find(p => p.id === socket.id);
        const liar = players.find(p => p.id === lastMove.playerId);

        let loser = isBluff ? liar : caller;
        discardPile.forEach(move => loser.hand.push(...move.cards));
        discardPile = [];
        passVotes.clear();
        pickRandomRank();

        io.to(liar.id).emit('dealCards', liar.hand);
        io.to(caller.id).emit('dealCards', caller.hand);
        io.emit('bluffResult', { 
            title: isBluff ? "CAUGHT!" : "SAFE!", 
            msg: isBluff ? `${liar.name} was lying!` : `${caller.name} was wrong!`, 
            type: isBluff ? 'fail' : 'success' 
        });
        broadcastUpdate();
    });

    socket.on('votePass', () => {
        passVotes.add(socket.id);
        const voter = players.find(p => p.id === socket.id);
        
        if (passVotes.size >= players.length) {
            discardPile = [];
            passVotes.clear();
            pickRandomRank();
            io.emit('bluffResult', { title: "PASSED!", msg: "Everyone skipped! New random rank.", type: "success" });
            broadcastUpdate();
        } else {
            io.emit('receiveChatMessage', { name: "SYSTEM", text: `${voter.name} wants to Pass (${passVotes.size}/${players.length})` });
        }
    });

    socket.on('sendChatMessage', (message) => {
        const player = players.find(p => p.id === socket.id);
        if (player) io.emit('receiveChatMessage', { name: player.name, text: message });
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('playerUpdate', players.map(p => p.name));
    });
});

function broadcastUpdate() {
    io.emit('gameUpdate', {
        rank: currentRank,
        pileSize: discardPile.length,
        activePlayerId: players[activePlayerIndex] ? players[activePlayerIndex].id : null
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));