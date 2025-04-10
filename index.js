const ws = new WebSocket('ws://localhost:8080');

function sendNewStats() {
    ws.send(JSON.stringify({
        type: 'updateEnemyStats',
        health: health,
        block: block,
    }));
}

let isPlayerTurn = false; // Track if it's the player's turn

ws.onmessage = async (event) => {
    let data = event.data;

    if (data instanceof Blob) {
        data = await data.text();
    }

    console.log(data);
    const message = JSON.parse(data);

    if (message.type === 'updateEnemyStats') {
        enemyHealth = message.health;
        enemyBlock = message.block;
        updateHtml();
    } else if (message.type === 'takeDamage') {
        health -= message.damage;
        sendNewStats();
    } else if (message.type === 'loseBlock') {
        block -= message.loss;
        sendNewStats();
    } else if (message.type === 'turnUpdate') {
        console.log(message.isPlayerTurn);
        isPlayerTurn = message.isPlayerTurn;
        if (isPlayerTurn) {
            turnStart();
        }
        updateHtml();
    } else if (message.type === 'startGame') {
        startGame();
    } else if (message.type === 'resetState') {
        window.location.reload();
    }
};



let deck = [];
let hand = [];
let drawPile = [];
let discardPile = [];
let health = 100;
let maxHealth = 100;
let block = 0;
let energy = 3;

let enemyHealth = 100;
let enemyMaxHealth = 100;
let enemyBlock = 0;
const CARD_TYPES = {
    ATTACK: 0,
    SKILL: 1,
    POWER: 2,
}

function findOrCreateElement(id, tagName, parent) { 
    let element = document.getElementById(id);
    if (!element) {
        element = document.createElement(tagName);
        element.id = id;
        if (parent) parent.appendChild(element);
    }
    return element;
}


function updateHtml() {
    const handDiv = document.getElementById('hand');
    const energyDiv = document.getElementById('energy');
    const playerStatsDiv = document.getElementById('player-stats');
    const enemyStatsDiv = document.getElementById('enemy-stats');
    const endTurnButton = document.getElementById('end-turn-button');
    const turnIndicatorDiv = document.getElementById('turn-indicator'); // Turn indicator

    if (handDiv) {
        // Remove elements that are no longer in hand
        Array.from(handDiv.children).forEach(child => {
            if (!hand.some(card => card.id === child.id)) {
                child.remove();
            }
        });

        hand.forEach((card, i) => {
            const cardDiv = findOrCreateElement(`${card.id}`, 'button', handDiv);
            cardDiv.className = 'card';
            cardDiv.innerHTML = `
              <h3>${card.name}</h3>
              <p>${card.description}</p>
              <p>Cost: ${card.cost} energy</p>
            `;
            cardDiv.onclick = () => {
                card.play();
                cardDiv.remove();
            };
        });
    }

    if (energyDiv) {
        energyDiv.innerHTML = `Energy: ${energy}`;
    }

    if (playerStatsDiv) { // Update player stats
        playerStatsDiv.innerHTML = `
            <h3>Player Stats</h3>
            <p>Health: ${health}/${maxHealth}</p>
            <p>Block: ${block}</p>
        `;
    }

    if (enemyStatsDiv) { // Update enemy stats
        enemyStatsDiv.innerHTML = `
            <h3>Enemy Stats</h3>
            <p>Health: ${enemyHealth}/${enemyMaxHealth}</p>
            <p>Block: ${enemyBlock}</p>
        `;
    }

    if (endTurnButton) {
        endTurnButton.style.display = isPlayerTurn ? 'block' : 'none'; // Show or hide the button based on turn
    }

    if (turnIndicatorDiv) { // Update turn indicator
        turnIndicatorDiv.textContent = isPlayerTurn ? "Your Turn" : "Enemy's Turn";
        turnIndicatorDiv.style.color = isPlayerTurn ? "lime" : "red";
    }
}

function doDamage(damage) {
    if (!isPlayerTurn) return; // Prevent action if not player's turn
    let damageDealt = damage - enemyBlock;
    if (damageDealt > 0) {
        ws.send(JSON.stringify({
            type: 'takeDamage',
            damage: damageDealt
        }));
        ws.send(JSON.stringify({
            type: 'loseBlock',
            loss: enemyBlock
        }));
        enemyHealth -= damageDealt;
        enemyBlock = 0;
    } else {
        enemyBlock -= damage;
        ws.send(JSON.stringify({
            type: 'loseBlock',
            loss: damage
        }));
    }
    return damageDealt;
}

function gainBlock(blockGain) {
    if (!isPlayerTurn) return; // Prevent action if not player's turn
    block += blockGain;
    sendNewStats();
    return blockGain;
}

class Card {
    constructor(config) {
        this._config = config;
        this.id = `${Math.floor(Math.random() * 1000)}`;
    }

    get config() {
        return this._config;
    }

    get name() {
        return this.config.name;
    }

    get baseDescription() {
        return this.config.description;
    }

    get description() {
        return this.baseDescription.replace(/\{(\w+)\}/g, (_, key) => this.statNumbers[key] ?? `{${key}}`);
    }

    get bindedElement() {
        return document.getElementById(this.id);
    }

    get type() {
        return this.config.type;
    }

    get cost() {
        return this.config.cost;
    }

    get statNumbers() {
        return this.config.statNumbers;
    }

    changeStat(stat, value) { 
        if (this.statNumbers.hasOwnProperty(stat)) {
            this.statNumbers[stat] += value;
            return true;
        } else {
            return false;
        }
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return; // Prevent play if not player's turn
        this.discardFromHand();
        updateHtml();
        energy -= this.cost;
    }

    canPlay() {
        return this.cost <= energy;
    }

    clone() {
        return new Card(this.config);
    }

    discardFromHand() {
        hand.splice(hand.indexOf(this), 1);
        this.addToDiscardPile();
        if (this.bindedElement) this.bindedElement.remove();
        updateHtml();
    }

    addToHand() {
        hand.push(this.clone());
    }

    addToDiscardPile() {
        discardPile.push(this.clone());
    }

    addToDrawPile() {
        drawPile.push(this.clone());
    }
}

class Strike extends Card {
    constructor() {
        super({
            name: "Strike",
            description: "Deal {d} damage.",
            type: CARD_TYPES.ATTACK,
            cost: 1,
            statNumbers: {
                d: 6
            }
        });
    }

    clone() {
        return new Strike();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return; // Prevent play if not player's turn
        doDamage(this.statNumbers.d);
        super.play();
    }
}

class Defend extends Card {
    constructor() {
        super({
            name: "Defend",
            description: "Gain {b} block.",
            type: CARD_TYPES.SKILL,
            cost: 1,
            statNumbers: {
                b: 5
            }
        });
    }

    clone() {
        return new Defend();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return; // Prevent play if not player's turn
        gainBlock(this.statNumbers.b);
        super.play();
    }
}

deck = [new Strike(), new Strike(), new Strike(), new Strike(), new Strike(),  new Defend(), new Defend(), new Defend(), new Defend(), new Defend()];

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function drawCards(num) {
    for (let i = 0; i < num; i++) {
        if (drawPile.length === 0) {
            drawPile = discardPile;
            discardPile = [];
        }
        if (drawPile.length > 0) {
            hand.push(drawPile.pop());
        }
    }
}

function turnStart() {
    drawCards(5);
    block = 0;
    energy = 3;
    isPlayerTurn = true; // Ensure the turn indicator is updated
    sendNewStats();
    updateHtml();
}

function endTurn() {
    if (!isPlayerTurn) return; // Prevent ending turn if not player's turn
    ws.send(JSON.stringify({ type: 'endTurn' })); // Notify server of turn end
    isPlayerTurn = false;
    for (card of hand) {
        card.addToDiscardPile();
    }
    hand = [];
    sendNewStats();
    updateHtml();
}

// Modify startGame to add the end turn button
function startGame() {
    drawPile = deck;
    shuffleDeck();
    if (document.getElementById('end-turn-button')) {
        document.getElementById('end-turn-button').remove();
    }
    const endTurnButton = document.createElement('button');
    endTurnButton.id = 'end-turn-button';
    endTurnButton.textContent = 'End Turn';
    endTurnButton.onclick = endTurn;
    document.body.appendChild(endTurnButton);

    updateHtml();
}

ws.onopen = () => {
    setInterval(updateHtml, 1000);
    updateHtml();
}