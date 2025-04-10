const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

let players = [];
let turnCount = 0;
let currentPlayerIndex = 0; // Track whose turn it is

function broadcastTurnUpdate() {
    players.forEach((player, index) => {
        if (player.readyState === WebSocket.OPEN) {
            player.send(JSON.stringify({
                type: 'turnUpdate',
                isPlayerTurn: index === currentPlayerIndex
            }));
        }
    });
}

function broadcastStartGame() {
    players.forEach((player, index) => {
        if (player.readyState === WebSocket.OPEN) {
            player.send(JSON.stringify({
                type: 'startGame',
            }));
        }
    });
    broadcastTurnUpdate();
}

function resetState() {
    players.forEach((player, index) => {
        if (player.readyState === WebSocket.OPEN) {
            player.send(JSON.stringify({
                type: 'resetState',
            }));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('A player connected.');

    // Add the player to the list
    players.push(ws);

    if (players.length === 2) { // Start the game when 2 players connect
        broadcastStartGame();
    }

    // Broadcast a message to all players
    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
        players.forEach((player) => {
            if (player !== ws && player.readyState === WebSocket.OPEN) {
                player.send(message);
            }
        });

        const parsedMessage = JSON.parse(message);
        if (parsedMessage.type === 'endTurn') {
            turnCount++;
            currentPlayerIndex = (currentPlayerIndex + 1) % players.length; // Switch turn
            broadcastTurnUpdate();
        }
    });

    // Handle player disconnection
    ws.on('close', () => {
        console.log('A player disconnected.');
        players = players.filter((player) => player !== ws);
        resetState();
    });
});

console.log('WebSocket server is running on ws://localhost:8080');