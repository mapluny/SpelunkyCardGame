const ws = new WebSocket('https://894c-2600-1700-b2f0-55e0-b919-66e8-4c6a-d438.ngrok-free.app');
const MAX_CARDS = 20; // Maximum number of cards in the deck
const MINIUM_CARDS = 10; // Minimum number of cards in the deck
const MAX_OF_CARDS = 3; // Maximum number of each card in the deck

function sendNewStats() {
    ws.send(JSON.stringify({
        type: 'updateEnemyStats',
        health: health,
        block: block,
    }));
}

function cardShortNames() {
    const currentLetters = [];
    for (card of Card.allCards) {
        let currentName = card.name[0];
        let currentIndex = 0
        function checkLetter() {
            for (letter of currentLetters) {
                if (letter.name === currentName) {
                    return false;
                }
            }
            return true
        }
        while (!checkLetter()) {
            currentIndex += 1
            currentName = currentName + card.name[currentIndex];
        }
        currentName = currentName.toUpperCase()
        currentLetters.push({fullCardName: card.name, name:currentName});
    }
    return currentLetters;
}

function getCardFromShortName(shortName) {
    const fullName = cardShortNames().find(c => c.name === shortName).fullCardName;
    return Card.allCards.find(c => c.name === fullName);
}

function convertDeckToCode() {
    let i = 0;
    let cardTimes = {};
    for (card of deck) {
        const name = card.name;
        const shortName = cardShortNames().find(c => c.fullCardName === name).name;
        if (cardTimes[shortName]) {
            cardTimes[shortName] += 1;
        }else {
            cardTimes[shortName] = 1;
        }
        i += 1;
    }
    cardTimes["!"] = MAX_CARDS - i;
    let str = "|"
    for (timeKey in cardTimes) {
        const time = cardTimes[timeKey]
        let newStr = `${timeKey}.${time}|`
        str = str + newStr
    }
    return str;
}

function convertCodeToDeck(code) {
    const cardTimes = {};
    const cards = code.split("|")
    for (card of cards) {
        if (card === "") continue;
        const shortName = card[0];
        const times = card.split(".")[1];
        cardTimes[shortName] = times;
    }
    const newDeck = []
    for (const card in cardTimes) {
        if (card !== "!") {
            const times = cardTimes[card]
            if (times >= 3) {
                alert("You cannot have more than 3 of a card in your deck.");
                return;
            }
            for (let i = 0; i < times; i++) {
                newDeck.push(getCardFromShortName(card).clone())
            }
        }
    }
    return newDeck
}

let isPlayerTurn = false; // Track if it's the player's turn
let playingRealGame = true; // Track if the player is in a real game
let turn = 0; // Track the turn number

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
        for (const power of activePowers) {
            for (i = 0; i < message.hits; i++) {
                message.damage = power.power.onEnemyDamage(message.damage / message.hits);
            }
        }
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
    } else if (message.type === 'error') {
        playingRealGame = false;
        updateHtml();
    }  else if (message.type === 'applyEnemyPower') {
        const power = Power.getGlobalPowerByName(message.power);
        if (power) {
            power.activate(message.amount);
        }
    }
};



let deck = [];
let hand = [];
let drawPile = [];
let discardPile = [];
let activePowers = [];
let health = 100;
let maxHealth = 100;
let block = 0;
let energy = 3;
let gameStarted = false;

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

function cardAmountInDeck(card) {
    return deck.filter(c => c.name === card.name).length;
}

function addCardToDeck(card) {
    if (deck.length < MAX_CARDS && cardAmountInDeck(card) < MAX_OF_CARDS) {
        deck.push(card.clone());
        updateHtml();
        return true;
    } else {
        return false;
    }
}

function removeCardFromDeck(card) {
    if (cardAmountInDeck(card) > 0) {
        console.log(card)
        const index = deck.findIndex(c => c.name === card.name);
        deck.splice(index, 1);
        updateHtml();
        return true;
    }
    return false
}

function readyUp() {
    if (deck.length >= MINIUM_CARDS) {
        ws.send(JSON.stringify({ type: 'ready' }));
    }else {
        alert(`You need at least ${MINIUM_CARDS} cards in your deck.`)
    }
}

function updateHtml() {
    const gameDiv = document.getElementById('game');
    const deckBuilderDiv = document.getElementById('deck-builder');
    const fullGameDiv = document.getElementById('full-game');
    if (!playingRealGame) {
        fullGameDiv.display = false;
        gameDiv.hidden = true;
        deckBuilderDiv.hidden = true;
        return;
    };
    fullGameDiv.hidden = true;
    if (gameStarted) {
        const handDiv = document.getElementById('hand');
        const energyDiv = document.getElementById('energy');
        const playerStatsDiv = document.getElementById('player-stats');
        const enemyStatsDiv = document.getElementById('enemy-stats');
        const endTurnButton = document.getElementById('end-turn-button');
        const turnIndicatorDiv = document.getElementById('turn-indicator');
        gameDiv.hidden = false
        deckBuilderDiv.hidden = true
    
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
                  <p style="font-size: 12px;">${card.description}</p>
                  <p>Cost: ${card.cost} energy</p>
                `;
                cardDiv.onclick = () => {
                    card.play();
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
    
        const activePowersDiv = findOrCreateElement('active-powers', 'div', document.body); // Active powers container
        activePowersDiv.innerHTML = `
            <h3>Active Powers</h3>
            <ul>
                ${activePowers.map(p => `<li>${p.power.name}: ${p.amount}</li>`).join('')}
            </ul>
        `;
        activePowersDiv.style.marginTop = '20px';
        activePowersDiv.style.padding = '10px';
        activePowersDiv.style.background = 'rgba(0, 0, 0, 0.5)';
        activePowersDiv.style.borderRadius = '8px';
        activePowersDiv.style.textAlign = 'center';
        activePowersDiv.style.width = '300px';
        activePowersDiv.style.color = '#fff';
        activePowersDiv.style.position = 'fixed';
        activePowersDiv.style.bottom = '10px';
        activePowersDiv.style.left = '50%';
        activePowersDiv.style.transform = 'translateX(-50%)';

        // Add draw and discard pile indicators
        const pileIndicatorDiv = findOrCreateElement('pile-indicators', 'div', document.body);
        pileIndicatorDiv.innerHTML = `
            <p>Draw Pile: ${drawPile.length}</p>
            <p>Discard Pile: ${discardPile.length}</p>
        `;
        pileIndicatorDiv.style.position = 'fixed';
        pileIndicatorDiv.style.bottom = '10px';
        pileIndicatorDiv.style.left = '10px';
        pileIndicatorDiv.style.background = 'rgba(0, 0, 0, 0.5)';
        pileIndicatorDiv.style.padding = '10px';
        pileIndicatorDiv.style.borderRadius = '8px';
        pileIndicatorDiv.style.color = '#fff';
    } else {
        gameDiv.hidden = true
        deckBuilderDiv.hidden = false
        const cardDiv = document.getElementById("cards")
        const deckSizeText = document.getElementById("deck-size-text")
        if (deck.length >= MINIUM_CARDS) { 
            deckSizeText.innerHTML = `Deck Size: ${deck.length}/${MAX_CARDS}`
        }else {
            deckSizeText.innerHTML = `Deck Size: ${deck.length}/${MAX_CARDS} (You need at least ${MINIUM_CARDS} cards)`
        }
        const allCards = Card.allDeckCards
        for (cardIndex in allCards) {
            const cardType = allCards[cardIndex]
            const cardContainer = findOrCreateElement(`${cardType.name}-container`, "div", cardDiv);
            cardContainer.style.display = "flex";
            cardContainer.style.flexDirection = "column";
            cardContainer.style.alignItems = "center";
            const card = findOrCreateElement(cardType.name, "button", cardContainer)
            const removeCardButton = findOrCreateElement(`${cardType.name}-remove`, "button", cardContainer)
            removeCardButton.innerHTML = "Remove 1"
            removeCardButton.style.marginTop = "10px";
            removeCardButton.style.padding = "5px 10px";
            removeCardButton.style.backgroundColor = "#ff5722";
            removeCardButton.style.color = "#fff";
            removeCardButton.style.border = "none";
            removeCardButton.style.borderRadius = "5px";
            removeCardButton.style.cursor = "pointer";
            removeCardButton.style.transition = "background 0.3s";

            removeCardButton.onmouseover = () => {
                removeCardButton.style.backgroundColor = "#e64a19";
            };

            removeCardButton.onmouseout = () => {
                removeCardButton.style.backgroundColor = "#ff5722";
            };
            card.className = 'deckcard';
            card.innerHTML = `
              <h3>${cardType.name}</h3>
              <p style="font-size: 12px;">${cardType.description}</p>
              <p>Cost: ${cardType.cost} energy</p>
              <p>${cardAmountInDeck(cardType)}x</p>
            `;
            card.onclick = () => {
                addCardToDeck(cardType)
            };
            removeCardButton.onclick = () => {
                removeCardFromDeck(cardType)
            }
        }
    }
}

function doDamage(damage, hits = 1) {
    if (!isPlayerTurn) return;
    for (const power of activePowers) {
        damage = power.power.onEnemyDamage(damage);
    }
    let damageDealt = damage - enemyBlock;
    if (damageDealt > 0) {
        ws.send(JSON.stringify({
            type: 'takeDamage',
            damage: damageDealt,
            hits: hits
        }));
        ws.send(JSON.stringify({
            type: 'loseBlock',
            loss: enemyBlock,
            hits: hits
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
    if (!isPlayerTurn) return;
    block += blockGain;
    sendNewStats();
    return blockGain;
}

function gainEnergy(energyGain) {
    if (!isPlayerTurn) return;
    energy += energyGain;
    return energyGain;
}

function applyEnemyPower(powerName, amount) {
    ws.send(JSON.stringify({
        type: 'applyEnemyPower',
        power: powerName,
        amount: amount
    }));
}

const POWER_DEDUCT_TYPES = {
    ON_TURN_START: 0,
    ON_TURN_END: 1,
    CUSTOM: 2,
}

const POWER_COMBINE_TYPES = {
    ADD: 0, // Add the amounts
    REPLACE: 1, // Replace the amount
    IGNORE: 2, // Ignore the new activation
};

class Power {
    static allPowers = [];
    static registerPower(powerClass) {
        const power = new powerClass();
        if (!Power.allPowers.find(p => p.name === power.name)) {
            Power.allPowers.push(power);
        }
    }

    constructor(config) {
        this._config = config;
    }

    static get deductTypes() {
        return POWER_DEDUCT_TYPES;
    }

    static get combineTypes() {
        return POWER_COMBINE_TYPES;
    }

    static get activePowers() {
        return activePowers;
    }

    static activatePower(power, amount) {
        power.activate(amount);
    }

    static getPowerAmount(power) {
        return activePowers.find(p => p.power === power)?.amount ?? null;
    }

    static getPowerByName(name) {
        return activePowers.find(p => p.power.name === name)?.power ?? null;
    }

    static getGlobalPowerByName(name) {
        return Power.allPowers.find(p => p.name === name) ?? null;
    }

    static reducePower(name, amount) {
        const power = Power.getPowerByName(name);
        if (power) {
            power.reduce(amount);   
        }
    }

    get config() {
        return this._config;
    }

    get deductType() {
        return this.config.deductType;
    }

    get name() {
        return this.config.name;
    }

    get description() {
        return this.config.description;
    }

    get amount() {
        return Power.getPowerAmount(this);
    }

    set amount(amount) {
        if (activePowers.find(p => p.power === this)) {
            activePowers.find(p => p.power === this).amount = amount;
        }
        else {
            activatePower(this, amount);
        }
    }

    get combineType() {
        return this.config.combineType ?? POWER_COMBINE_TYPES.ADD;
    }

    reduce(amount) {
        if (this.amount) {
            this.amount -= amount;
            if (this.amount <= 0) {
                activePowers.splice(activePowers.indexOf(this), 1);
            }
        }
    }

    onTurnStart() {
        if (this.deductType === Power.deductTypes.ON_TURN_START) {
            this.reduce(1);
        }
        return true;
    }

    onTurnEnd() {
        if (this.deductType === Power.deductTypes.ON_TURN_END) {
            this.reduce(1);
        }
        return true;
    }

    preCardCost(cost, card) {
        return cost;
    }

    preCardPlay(card) {
        return true;
    }

    postCardPlay(card) {
        return true;
    }

    preExhaust(card) {
        return null;
    }

    onEnemyDamage(damage) {
        return damage;
    }

    onPlayerDamage(damage) {
        return damage;
    }

    onBlockGain(block) {
        return block;
    }

    isActive() {
        return activePowers.find(p => p.power.constructor === this.constructor) !== undefined;
    }

    remove() {
        activePowers.splice(activePowers.indexOf(this), 1);
    }

    activate(amount) {
        const existingPower = activePowers.find(p => p.power.constructor === this.constructor);
        if (existingPower) {
            switch (this.combineType) {
                case POWER_COMBINE_TYPES.ADD:
                    existingPower.amount += amount;
                    break;
                case POWER_COMBINE_TYPES.REPLACE:
                    existingPower.amount = amount;
                    break;
                case POWER_COMBINE_TYPES.IGNORE:
                    return;
            }
        } else {
            activePowers.push({ power: this, amount });
        }
    }
}

class Strength extends Power {
    constructor() {
        super({
            name: "Strength",
            description: "Increase damage dealt by {a}.",
            combineType: POWER_COMBINE_TYPES.ADD, // Example combine type
        });
    }

    onEnemyDamage(damage) {
        return damage + this.amount;
    }
}

class TempStrength extends Power {
    constructor() {
        super({
            name: "TempStrength",
            description: "At the end of your turn, lose {a} strength.",
            combineType: POWER_COMBINE_TYPES.ADD, // Example combine type
        });
    }

    onTurnEnd() {
        Power.reducePower("TempStrength", this.amount);
        this.remove();
    }
}

class LoseEnergy extends Power {
    constructor() {
        super({
            name: "Lose Energy",
            description: "Lose 1 energy at the start of your turn {a}.",
            combineType: POWER_COMBINE_TYPES.ADD, // Example combine type
        });
    }

    onTurnStart() { 
        energy -= this.amount;
        this.remove();
    }
}

class TurkeyPower extends Power {
    constructor() {
        super({
            name: "Turkey",
            description: "When you take damage add 1 Cooked Turkey to hand.",
            combineType: POWER_COMBINE_TYPES.IGNORE, // Example combine type
        });
    }

    onPlayerDamage(damage) {
        if (damage > 0) {
            const turkey = new CookedTurkey();
            turkey.addToHand();
            this.remove();
        }
        return damage;
    }
}
class Accursed extends Power {
    constructor() {
        super({
            name: "Accursed",
            description: "Lose {a} health at the start of your turn.",
            combineType: POWER_COMBINE_TYPES.ADD,
        });
    }

    onTurnStart() {
        health -= this.amount;
        Power.reducePower("Accursed", 1);
        super.onTurnStart();
    }
}
class KaliPower extends Power {
    constructor() {
        super({
            name: "Kali",
            description: "Monster cards cost 0, but exhaust when played.",
            combineType: POWER_COMBINE_TYPES.IGNORE,
        });
    }

    preCardCost(cost, card) {
        if (Card.cardIsApartOfCategory(card, "monster")) return 0;
        return cost;
    }

    preExhaust(card) {
        return Card.cardIsApartOfCategory(card, "monster");
    }
}
Power.registerPower(Strength);
Power.registerPower(TempStrength);
Power.registerPower(LoseEnergy);
Power.registerPower(TurkeyPower);
Power.registerPower(Accursed);
Power.registerPower(KaliPower);

class Card {
    static allCards = [];
    static allDeckCards = [];

    static registerCard(cardClass) {
        const card = new cardClass();
        if (!Card.allCards.find(c => c.name === card.name)) {
            if (card.config.cannotBeAddedToDeck == undefined || card.config.cannotBeAddedToDeck == false) Card.allDeckCards.push(card);
            Card.allCards.push(card);
        }
    }
    
    static cardIsApartOfCategory(card, category) {
        return card.cardCategories.includes(category);
    }

    static cardsOfCategory(category) {
        return Card.allCards.filter(card => Card.cardIsApartOfCategory(card, category));
    }

    static deckCardsOfCategory(category) {
        return Card.allDeckCards.filter(card => Card.cardIsApartOfCategory(card, category));
    }

    constructor(config) {
        this._config = config;
        this.id = `${Math.floor(Math.random() * 1000)}`;
    }

    get config() {
        return this._config;
    }

    get cardCategories() {
        return this.config.categories??[];
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
        let baseCost = this.config.cost;
        for (const power of activePowers) {
            baseCost = power.power.preCardCost(baseCost, this);
        }   
        return baseCost;
    }

    get statNumbers() {
        return this.config.statNumbers;
    }

    get exhaust() {
        let baseExhaust = this.config.exhaust ?? false;
        for (const power of activePowers) {
            if (power.power.preExhaust(this) != null) {
                baseExhaust = power.power.preExhaust(this);
            }
        }
        return baseExhaust;
    }

    addExhaust() {
        this.config.exhaust = true;
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
        for (const power of activePowers) {
            if (!power.power.preCardPlay(this)) return;
        }
        if (this.type === CARD_TYPES.POWER || this.exhaust) { 
            hand.splice(hand.indexOf(this), 1);
        }else {
            this.discardFromHand();
        }
        for (const power of activePowers) {
            power.power.postCardPlay(this);
        }
        energy -= this.cost;

        updateHtml();
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
            name: "Whip",
            description: "Deal {d} damage.",
            type: CARD_TYPES.ATTACK,
            cost: 1,
            statNumbers: {
                d: 6
            },
            categories: ["basic", "whip"]
        });
    }

    clone() {
        return new Strike();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
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
            },
            categories: ["basic"]
        });
    }

    clone() {
        return new Defend();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
        gainBlock(this.statNumbers.b);
        super.play();
    }
}

class Bomb extends Card { 
    constructor() {
        super({
            name: "Bomb",
            description: "Deal {d} damage.",
            type: CARD_TYPES.ATTACK,
            cost: 2,
            statNumbers: {
                d: 10
            },
            categories: ["bomb", "resource"]
        });
    }

    clone() {
        return new Bomb();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
        doDamage(this.statNumbers.d);
        super.play();
    }
}

class Rope extends Card { 
    constructor() {
        super({
            name: "Rope",
            description: "Opponent loses 1 energy next turn.",
            type: CARD_TYPES.SKILL,
            cost: 1,
            categories: ["rope", "resource"]
        });
    }

    clone() {
        return new Rope();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
        applyEnemyPower("Lose Energy", 1);
        super.play();
    }
}

class Shotgun extends Card { 
    constructor() {
        super({
            name: "Shotgun",
            description: "Deal {d} damage 3 times.",
            type: CARD_TYPES.ATTACK,
            cost: 2,
            statNumbers: {
                d: 3
            },
            categories: ["weapon", "gun"]
        });
    }

    clone() {
        return new Shotgun();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
        doDamage(this.statNumbers.d * 3, 3);
        super.play();
    }
}

class Snake extends Card { 
    constructor() {
        super({
            name: "Snake",
            description: "Draw 2 cards.",
            type: CARD_TYPES.SKILL,
            cost: 1,
            categories: ["monster"]
        });
    }

    clone() {
        return new Snake();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
        drawCards(2);
        super.play();
    }
}

class Turkey extends Card { 
    constructor() {
        super({
            name: "Turkey",
            description: "Gain {b} block. The next time you take damage add 1 Cooked Turkey to your hand",
            type: CARD_TYPES.SKILL,
            cost: 1,
            statNumbers: {
                b: 8
            },
            categories: ["monster", "mount"]
        });
    }

    clone() {
        return new Turkey();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
        gainBlock(this.statNumbers.b);
        Power.activatePower(new TurkeyPower(), 1);
        super.play();
    }
}
class CookedTurkey extends Card { 
    constructor() {
        super({
            name: "Cooked Turkey",
            description: "Gain 1 energy.",
            type: CARD_TYPES.SKILL,
            cost: 0,
            statNumbers: {
                b: 8
            },
            cannotBeAddedToDeck: true,
            categories: ["food"],
            exhaust: true
        });
    }

    clone() {
        return new CookedTurkey();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
        gainEnergy(1);
        super.play();
    }
}
class Caveman extends Card { 
    constructor() {
        super({
            name: "Caveman",
            description: "Deal {d} damage. Draw 1 card.",
            type: CARD_TYPES.ATTACK,
            cost: 1,
            statNumbers: {
                d: 8
            },
            categories: ["monster"],
        });
    }

    clone() {
        return new Caveman();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
        doDamage(this.statNumbers.d);
        drawCards(1);
        super.play();
    }
}
class WitchDoctor extends Card { 
    constructor() {
        super({
            name: "Witch Doctor",
            description: "Deal {d} damage. Apply 1 Accursed.",
            type: CARD_TYPES.ATTACK,
            cost: 1,
            statNumbers: {
                d: 4
            },
            categories: ["monster"],
        });
    }

    clone() {
        return new WitchDoctor();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
        doDamage(this.statNumbers.d);
        applyEnemyPower("Accursed", 1);
        super.play();
    }
}
class Kali extends Card { 
    constructor() {
        super({
            name: "Kali",
            description: "All monster cards cost 0, but exhaust when played.",
            type: CARD_TYPES.POWER,
            cost: 3,
            categories: ["kali"],
            exhaust: true
        });
    }

    clone() {
        return new Kali();
    }

    play() {
        if (!isPlayerTurn || !this.canPlay()) return;
        Power.activatePower(new KaliPower(), 1);
        super.play();
    }
}
Card.registerCard(Strike);
Card.registerCard(Defend);
Card.registerCard(Bomb);
Card.registerCard(Rope);
Card.registerCard(Shotgun);
Card.registerCard(Snake);
Card.registerCard(Turkey);
Card.registerCard(CookedTurkey);
Card.registerCard(Caveman);
Card.registerCard(WitchDoctor);
Card.registerCard(Kali);

deck = [];

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
    for (const power of activePowers) {
        power.power.onTurnStart();
    }
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
    for (const power of activePowers) {
        power.power.onTurnEnd();
    }
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
    gameStarted = true;

    updateHtml();
}

ws.onopen = () => {
    setInterval(updateHtml, 1000);
    updateHtml();
}