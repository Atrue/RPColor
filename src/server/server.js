/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
//noinspection JSUnresolvedFunction
var http = require('http').Server(app);
var io = require('socket.io')(http);
var SAT = require('sat');

// Import game settings.
var c = require('../../config.json');

// Import utilities.
var util = require('./lib/util');

// Import classes.
var player = require('./logic/player.js');
var fire = require('./logic/fire.js');
var food = require('./logic/food.js');
var virus = require('./logic/virus.js');
var boss = require('./logic/boss.js');

// Import quadtree.
var quadtree= require('../../quadtree');

var args = {x : 0, y : 0, h : c.gameHeight, w : c.gameWidth, maxChildren : 1, maxDepth : 5};
_debug(args);

var tree = quadtree.QUAD.init(args);

var players = [];
var fires = [];
var foods = [];
var viruses = [];
var boses = [];
var sockets = {};

var leaderboard = [];
var leaderboardChanged = false;

var V = SAT.Vector;
var C = SAT.Circle;

var initMassLog = util.log(c.defaultPlayerMass, c.slowBase);
var TickRateN = 1 / c.networkUpdateFactor;
var TickRateM = 1 / 60;
var TickRateL = 1;
var debugging = false;
var bossLastTime = Date.now();
var isSafeTime = false;
var COLORS = ['R', 'G', 'B'];

app.use(express.static(__dirname + '/../client'));

function addFood(toAdd) {
    var radius = util.massToRadius(c.foodMass);
    while (toAdd--) {
        var position = c.foodUniformDisposition ? util.uniformPosition(foods, radius) : util.randomPosition(radius);
        foods.push(new food.Food(((new Date()).getTime() + '' + foods.length) >>> 0, 0, position));
    }
}

// function addVirus(toAdd) {
//     while (toAdd--) {
//         var mass = util.randomInRange(c.virus.defaultMass.from, c.virus.defaultMass.to, true);
//         var radius = util.massToRadius(mass);
//         var position = c.virusUniformDisposition ? util.uniformPosition(viruses, radius) : util.randomPosition(radius);
//         viruses.push(new virus.Virus(position, mass));
//     }
// }

function removeFood(toRem) {
    while (toRem--) {
        foods.pop();
    }
}

function movePlayer(player) {
    var x =0,y =0;
    var mainCell = player.getMainCell();
    player.cells.forEach(function(item, i, object){
        if (!item.isMain){
            var mes = item.mass * 0.05 >=1 ? item.mass * 0.05: 1;
            if (mes >= item.mass){
                mes = item.mass;
                mainCell += mes;
                object.splice(i, 1);
                return;
            }
            item.mass -= mes;
            item.radius = util.massToRadius(item.mass);
            mainCell.mass += mes;
            mainCell.radius = util.massToRadius(mainCell.mass);
        }
        var target = {
            x: player.x - item.x + player.target.x,
            y: player.y - item.y + player.target.y
        };
        var dist = Math.sqrt(Math.pow(target.y, 2) + Math.pow(target.x, 2));
        var deg = Math.atan2(target.y, target.x);
        var slowDown = 1;
        if(item.speed <= player.maxSpeed) {
            slowDown = util.log(item.mass, c.slowBase) - initMassLog + 1;
            item.speed = item.speed*1.1 > player.maxSpeed? player.maxSpeed: item.speed*1.1;
        }
        slowDown = !item.isMain ? slowDown*3: slowDown;
        var deltaY = item.speed * Math.sin(deg)/ slowDown;
        var deltaX = item.speed * Math.cos(deg)/ slowDown;

        if(item.speed > player.maxSpeed) {
            item.speed -= 0.5;
        }
        if (dist < (50 + item.radius)) {
            deltaY *= dist / (50 + item.radius);
            deltaX *= dist / (50 + item.radius);
        }
        if (!isNaN(deltaY)) {
            item.y += deltaY;
        }
        if (!isNaN(deltaX)) {
            item.x += deltaX;
        }
        /*// Find best solution.
        for(var j=0; j<player.cells.length; j++) {
            if(j != i && player.cells[i] !== undefined) {
                var distance = Math.sqrt(Math.pow(player.cells[j].y-player.cells[i].y,2) + Math.pow(player.cells[j].x-player.cells[i].x,2));
                var radiusTotal = (player.cells[i].radius + player.cells[j].radius);
                if(distance < radiusTotal) {
                    if(player.lastSplit > new Date().getTime() - 1000 * c.mergeTimer) {
                        if(player.cells[i].x < player.cells[j].x) {
                            player.cells[i].x--;
                        } else if(player.cells[i].x > player.cells[j].x) {
                            player.cells[i].x++;
                        }
                        if(player.cells[i].y < player.cells[j].y) {
                            player.cells[i].y--;
                        } else if((player.cells[i].y > player.cells[j].y)) {
                            player.cells[i].y++;
                        }
                    }
                    else if(distance < radiusTotal / 1.75) {
                        player.cells[i].mass += player.cells[j].mass;
                        player.cells[i].radius = util.massToRadius(player.cells[i].mass);
                        player.cells.splice(j, 1);
                    }
                }
            }
        }*/
        if(player.cells.length > i) {
            var borderCalc = item.radius / 3;
            if (item.x > c.gameWidth - borderCalc) {
                item.x = c.gameWidth - borderCalc;
            }
            if (item.y > c.gameHeight - borderCalc) {
                item.y = c.gameHeight - borderCalc;
            }
            if (item.x < borderCalc) {
                item.x = borderCalc;
            }
            if (item.y < borderCalc) {
                item.y = borderCalc;
            }
            x += item.x;
            y += item.y;
        }
    });
    player.x = x/player.cells.length;
    player.y = y/player.cells.length;

    for(var name in player.skills){
        if(player.skills.hasOwnProperty(name)) {
            var skill = player.skills[name];
            if (skill.cooldown !== 0) {
                skill.cooldown -= TickRateM;
                if (skill.cooldown < 0) {
                    skill.cooldown = 0;
                }
            }
            if (skill.duration !== 0) {
                skill.duration -= TickRateM;
                if (skill.duration <= 0) {
                    skill.duration = 0;
                    switch (skill.name) {
                        case 'b1':
                            player.maxSpeed /= 2;
                            player.buffs.boost = false;
                            break;
                        case 'g2':
                            player.buffs.invulnerable = false;
                            break;
                        case 'r3':
                            break;
                        case 'g4':
                            player.buffs.respawnable = true;
                            break;
                        case 'b4':
                            player.buffs.invisible = false;
                            break;
                    }
                }
            }
        }
    }
    //update other
    if (player.buffs.slow[1] > 0){
        player.buffs.slow[1] -= TickRateM;
        if (player.buffs.slow[1] <= 0) {
            player.buffs.slow[1] = 0;
            player.buffs.slow[0] = false;
            player.maxSpeed *= 2;
        }
    }
    if (player.buffs.targetable[1] > 0){
        player.buffs.targetable[1] -= TickRateM;
        if (player.buffs.targetable[1] <= 0) {
            player.buffs.targetable[1] = 0;
            player.buffs.targetable[0] = true;
        }
    }
}

function moveMass(mass, isFire) {
    var deg = Math.atan2(mass.target.y, mass.target.x);
    var deltaY = mass.speed * Math.sin(deg);
    var deltaX = mass.speed * Math.cos(deg);

    mass.speed -= 0.5;
    if(mass.speed < 0){
        mass.speed = 0;
    }
    if(isFire) {
        mass.masa -= 0.1;
        mass.radius = util.massToRadius( mass.masa );
        if(mass.speed <= 0 || mass.masa <= 0) {
            var ind = fires.indexOf(mass);
            fires[ind] = {};
            fires.splice(ind, 1);
        }
    }
    if (!isNaN(deltaY)) {
        mass.y += deltaY;
    }
    if (!isNaN(deltaX)) {
        mass.x += deltaX;
    }

    var borderCalc = mass.radius + 5;

    if (mass.x > c.gameWidth - borderCalc) {
        mass.x = c.gameWidth - borderCalc;
    }
    if (mass.y > c.gameHeight - borderCalc) {
        mass.y = c.gameHeight - borderCalc;
    }
    if (mass.x < borderCalc) {
        mass.x = borderCalc;
    }
    if (mass.y < borderCalc) {
        mass.y = borderCalc;
    }
}

function balanceMass() {
    var totalMass = foods.length * c.foodMass +
        players
            .map(function(u) {return u.massTotal; })
            .reduce(function(pu,cu) { return pu+cu;}, 0);

    var massDiff = c.gameMass - totalMass;
    var maxFoodDiff = c.maxFood - foods.length;
    var foodDiff = parseInt(massDiff / c.foodMass) - maxFoodDiff;
    var foodToAdd = Math.min(foodDiff, maxFoodDiff);
    var foodToRemove = -Math.max(foodDiff, maxFoodDiff);

    if (foodToAdd > 0) {
        //console.log('[DEBUG] Adding ' + foodToAdd + ' food to level!');
        addFood(foodToAdd);
        //console.log('[DEBUG] Mass rebalanced!');
    }
    else if (foodToRemove > 0) {
        //console.log('[DEBUG] Removing ' + foodToRemove + ' food from level!');
        //removeFood(foodToRemove);
        //console.log('[DEBUG] Mass rebalanced!');
    }

    /*var virusToAdd = c.maxVirus - viruses.length;

    if (virusToAdd > 0) {
        addVirus(virusToAdd);
    }*/
}
function addBoss(){
    boses.push(new boss.Boss(((new Date()).getTime() + '' + boses.length) >>> 0, {x:c.gameWidth/2, y:c.gameHeight/2}));
    io.emit('serverMSG', 'BOSS HAS RESPAWNED!');
    isSafeTime = true;
    io.emit('safeTime', true);
    
}
function killBoss(theboss, state){
    if(state){
        var position = {
            x: theboss.x,
            y: theboss.y
        };
        for(var i=0;i<1000;i++){
            var target = {
                x: c.gameWidth * Math.sin(Math.random() * 360 *Math.PI/180) ,
                y: c.gameHeight * Math.cos(Math.random() * 360 *Math.PI/180)
            };
            foods.push(new food.Food(theboss.id, c.foodMass, position, undefined, target, Math.random() * 70));
        }
        io.emit('serverMSG', 'Gracio! Boss was killed!');
    }else{
        bossLastTime = Date.now();
        io.emit('serverMSG', 'Unfortunately the Boss was not killed!');
    }
    isSafeTime = false;
    boses.splice(boses.indexOf(theboss), 1);
    io.emit('safeTime', false);
}
function updateBoss(theboss, index, object){
    if(Date.now() > theboss.spawnTime + c.boss.liveTime){
        killBoss(theboss, false);
    }
    if(theboss.hue === -1){
        if (Date.now() > theboss.changeTime + c.boss.attackTime ){
            theboss.hue = Math.floor( Math.random() * 3 ) * 120;
            theboss.changeTime = Date.now();
        }
    }else{
        if (Date.now() > theboss.changeTime + c.boss.safeTime ){
            theboss.hue = -1;
            theboss.activeSkill = Math.random() > 0.8 ? 1: 0;//Math.floor(Math.random() * 2);
            theboss.changeTime = Date.now();
        }
    }
    if(theboss.hue === -1){
        var angle = Date.now() % 365;
        switch(theboss.activeSkill){
            case -1:{
                break;
            }
            case 0:{
                theboss.target.x = c.gameWidth * Math.sin(angle * Math.PI/180);
                theboss.target.y = c.gameHeight * Math.cos(angle * Math.PI/180);
                var target = {
                    x: theboss.target.x,
                    y: theboss.target.y
                };
                fires.push(new fire.Fire(theboss.id, c.boss.fireFood, c.boss.fireFood * (Math.random() * 1.5 + 0.5), Math.floor(Math.random() * 360), target, theboss.x, theboss.y, Math.random() * 20 + 20, Math.random() >= 0.5? 'attack': 'slow'), theboss);
                break;
            }
            case 1:{
                if (theboss.cells.length == 1) {
                    theboss.target.x = c.gameWidth * Math.sin(angle * Math.PI/180);
                    theboss.target.y = c.gameHeight * Math.cos(angle * Math.PI/180);
                    
                    var mainCell = theboss.getMainCell();
                    var split_mass = mainCell.mass / 15;
                    mainCell.mass -= split_mass;
                    var other = new boss.Cell( {x: mainCell.x, y: mainCell.y}, split_mass, 35, true );
                    theboss.cells.push( other );
                    mainCell.isMain = false;
                    theboss.changeTime -= c.boss.attackTime;
                }
                break;
            }
        }
    }
    tickPlayer(theboss,false);
    //
    // boss.skills.forEach(function(skill, i){
    //     skill.cooldown -= TickRateM;
    //     if (skill.cooldown <= 0){
    //         switch(i){
    //             case 0:{
    //                 var masa = c.foodMass * 10;
    //                 var target = {
    //                     x: boss.target.x,
    //                     y: boss.target.y
    //                 };
    //
    //                 fires.push(new fire.Fire(boss.id, masa, 0, target, boss.x, boss.y, Math.random() >= 0.5, Math.random() * 20 + 20));
    //                 break;
    //             }
    //         }
    //     }
    // });
}
io.on('connection', function (socket) {
    _debug('A user connected! {}. IP: {}', [socket.handshake.query.type, socket.handshake.headers['x-forwarded-for']], '[SERVER]');

    var socketTime = Date.now();
    var type = socket.handshake.query.type;
    var radius = util.massToRadius(c.defaultPlayerMass);
    var position = c.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(players, radius) : util.randomPosition(radius);

    var currentPlayer = new player.Player(socket.id, type, position);
    currentPlayer.startTime = socketTime;

    socket.on('pings', function () {
        socket.emit('pongs');
    });
    socket.on('boss', function () {
        socket.emit('bossTime', c.boss.respawn - (Date.now() - bossLastTime));
    });

    socket.on('windowResized', function (data) {
        if (data.zoom >= 1 && data.zoom <= currentPlayer.evolution * 4 + 2){
            currentPlayer.screenWidth = data.screenWidth * data.zoom ;
            currentPlayer.screenHeight = data.screenHeight * data.zoom ;
            socket.emit('zoomSetup', data.zoom);
        }
    });

    socket.on('respawn', function (data) {
        if (!currentPlayer.buffs.respawnable){
            currentPlayer = new player.Player(socket.id, type, position);
            currentPlayer.startTime = socketTime;
        }else{
            currentPlayer.buffs.respawnable = false;
            currentPlayer.skills.s4.cooldown = currentPlayer.skills.s4.state_cooldown;
        }
        if (util.findIndex(players, currentPlayer.id) > -1)
            players.splice(util.findIndex(players, currentPlayer.id), 1);

        if (!util.validNick(data.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {
            sockets[currentPlayer.id] = socket;

            currentPlayer.name = data.name;
            currentPlayer.screenWidth = data.width;
            currentPlayer.screenHeight = data.height;
            currentPlayer.lastHeartbeat = new Date().getTime();

            players.push(currentPlayer);

            io.emit('playerJoin', { name: currentPlayer.name });
        }
        socket.emit('welcome', currentPlayer);
        socket.emit('gameSetup', {
            gameWidth: c.gameWidth,
            gameHeight: c.gameHeight
        });
        socket.emit('safeTime', isSafeTime);
        _debug('User {} spawned!. Total Players: {}', [currentPlayer.name, players.length], '[SERVER]');
    });

    socket.on('disconnect', function () {
        if (util.findIndex(players, currentPlayer.id) > -1)
            players.splice(util.findIndex(players, currentPlayer.id), 1);
        var playedTime = (Date.now() - currentPlayer.startTime)/(1000 * 60);
        _debug('User {} disconnected!. Played time: {} minutes. Lost {} players.', [currentPlayer.name, playedTime, players.length], '[SERVER]');
        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', function(data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        _debug('[{}:{}] {}: {}', [(new Date()).getHours(), (new Date()).getMinutes(), _sender, _message], '[CHAT]');
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message.substring(0,35)});
    });

    socket.on('pass', function(data) {
        if (data[0] === c.adminPass) {
            _debug('{} just logged in as an admin!', [currentPlayer.name], '[ADMIN]');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as admin!');
            currentPlayer.admin = true;
        } else {
            _debug('{} attempted to log in with incorrect password.', [currentPlayer.name], '[ADMIN]');
            socket.emit('serverMSG', 'Password incorrect, attempt logged.');
            // TODO: Actually log incorrect passwords.
        }
    });

    socket.on('kick', function(data) {
        if (currentPlayer.admin) {
            var reason = '';
            var worked = false;
            for (var e = 0; e < players.length; e++) {
                if (players[e].name === data[0] && !players[e].admin && !worked) {
                    if (data.length > 1) {
                        for (var f = 1; f < data.length; f++) {
                            if (f === data.length) {
                                reason = reason + data[f];
                            }
                            else {
                                reason = reason + data[f] + ' ';
                            }
                        }
                    }
                    if (reason !== '') {
                        _debug('User {} kicked successfully by {} for reason {}', [players[e].name, currentPlayer.name, reason], '[ADMIN]');
                    }
                    else {
                        _debug('User {} kicked successfully by {}', [players[e].name, currentPlayer.name], '[ADMIN]');
                    }
                    socket.emit('serverMSG', 'User ' + players[e].name + ' was kicked by ' + currentPlayer.name);
                    sockets[players[e].id].emit('kick', reason);
                    sockets[players[e].id].disconnect();
                    players.splice(e, 1);
                    worked = true;
                }
            }
            if (!worked) {
                socket.emit('serverMSG', 'Could not locate user or user is an admin.');
            }
        } else {
            _debug('{} is trying to use -kick but isn\'t an admin.', [currentPlayer.name], '[ADMIN]');
            socket.emit('serverMSG', 'You are not permitted to use this command.');
        }
    });

    // Heartbeat function, update everytime.
    socket.on('0', function(target) {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (currentPlayer.buffs.targetable[0]) {
            if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
                currentPlayer.target = target;
            }
        }else{
            if(currentPlayer.buffs.targetable[2]) {
                currentPlayer.target = {x: 0, y: 0};
            }
        }
    });

    /**
     * ALL USABLE SKILLS
     */
    function giveEat(typeColor){
        if (currentPlayer.colorize[COLORS[typeColor]] > 0){
            var foodMass = c.foodMass;
            if(currentPlayer.reduceColor(COLORS[typeColor], foodMass)){
                var mainCell = currentPlayer.getMainCell();
                var position = {
                    x: mainCell.x,
                    y: mainCell.y
                };
                var target = {
                    x: currentPlayer.x - mainCell.x + currentPlayer.target.x,
                    y: currentPlayer.y - mainCell.y + currentPlayer.target.y
                };
                foods.push(new food.Food(currentPlayer.id, foodMass, position, typeColor, target, 25));
            }
        }
    }
    function impulseSkill(){

        var strenght = 1;
        for(var color in currentPlayer.colorize){
            var foodMass = c.fireFood;
            if(currentPlayer.reduceColor(color, foodMass)){
                var mainCell = currentPlayer.getMainCell();
                var position = {
                    x: mainCell.x,
                    y: mainCell.y
                };
                var target = {
                    x: currentPlayer.x - mainCell.x - currentPlayer.target.x + (strenght-2)*10,
                    y: currentPlayer.y - mainCell.y - currentPlayer.target.y + (strenght-2)*10
                };
                strenght += 0.44;
                foods.push(new food.Food(currentPlayer.id, foodMass, position, COLORS.indexOf(color), target, 25));
            }
        }
        currentPlayer.getMainCell().speed *= strenght;

    }
    function fireSkill(){
        // Fire foods.
        var mainCell = currentPlayer.getMainCell();
        if (currentPlayer.buffs.invisible) {
            currentPlayer.buffs.invisible = false;
        }
        var masa = mainCell.mass * 0.1 > c.fireFood ? mainCell.mass * 0.1 : c.fireFood;
        var target = {
            x: currentPlayer.x - mainCell.x + currentPlayer.target.x,
            y: currentPlayer.y - mainCell.y + currentPlayer.target.y
        };
        fires.push(new fire.Fire(currentPlayer.id, masa, currentPlayer.colorize.R * 0.1,  0, target, mainCell.x, mainCell.y, 30, 'attack', currentPlayer));
        
    }
    function hookSkill(){
        // hook enemy.
        var mainCell = currentPlayer.getMainCell();
        if (currentPlayer.buffs.invisible) {
            currentPlayer.buffs.invisible = false;
        }
        var masa = mainCell.mass * 0.1 > c.fireFood ? mainCell.mass * 0.1 : c.fireFood;
        var target = {
            x: currentPlayer.x - mainCell.x + currentPlayer.target.x,
            y: currentPlayer.y - mainCell.y + currentPlayer.target.y
        };
        fires.push(new fire.Fire(currentPlayer.id, masa, currentPlayer.colorize.G * 0.04, 120, target, mainCell.x, mainCell.y, 25, 'hook', currentPlayer));
    }
    function tossSkill(){
        // hook enemy.
        var mainCell = currentPlayer.getMainCell();
        if (currentPlayer.buffs.invisible) {
            currentPlayer.buffs.invisible = false;
        }
        var masa = mainCell.mass * 0.1 > c.fireFood ? mainCell.mass * 0.1 : c.fireFood;
        var target = {
            x: currentPlayer.x - mainCell.x + currentPlayer.target.x,
            y: currentPlayer.y - mainCell.y + currentPlayer.target.y
        };
        fires.push(new fire.Fire(currentPlayer.id, masa, currentPlayer.colorize.B * 0.07, 240, target, mainCell.x, mainCell.y, 26, 'toss', currentPlayer));
    }
    function boostSkill(){
        currentPlayer.maxSpeed *= 2;
        currentPlayer.buffs.boost = true;
        if(currentPlayer.buffs.invisible){
            currentPlayer.buffs.invisible = false;
        }
    }
    function immuneSkill(){
        currentPlayer.buffs.invulnerable = true;
        if(currentPlayer.buffs.invisible){
            currentPlayer.buffs.invisible = false;
        }
    }
    function stunSkill(){
        if(currentPlayer.buffs.invisible){
            currentPlayer.buffs.invisible = false;
        }
        viruses.push(new virus.Virus(currentPlayer.id, {x:currentPlayer.x, y:currentPlayer.y}));
    }
    function slowSkill(){
        // Slow foods.
        if(currentPlayer.buffs.invisible){
            currentPlayer.buffs.invisible = false;
        }
        var mainCell = currentPlayer.getMainCell();
        if (mainCell.mass > c.fireFood) {
            if (currentPlayer.buffs.invisible) {
                currentPlayer.buffs.invisible = false;
            }
            var masa = mainCell.mass * 0.1 > c.fireFood ? mainCell.mass * 0.1 : c.fireFood;
            var target = {
                x: currentPlayer.x - mainCell.x + currentPlayer.target.x,
                y: currentPlayer.y - mainCell.y + currentPlayer.target.y
            };
            fires.push(new fire.Fire(currentPlayer.id, masa, currentPlayer.colorize.B * 0.02, 240, target, mainCell.x, mainCell.y, 30, 'slow'));
        }
    }
    function coloreatSkill(){
        if(currentPlayer.buffs.invisible){
            currentPlayer.buffs.invisible = false;
        }
        var mainCell = currentPlayer.getMainCell();
        var mcolor = Math.max.apply(Math, Object.keys(currentPlayer.colorize).map(function(k){return currentPlayer.colorize[k];}));
        mcolor *= 0.2; // koef
        mainCell.mass += mcolor;
        currentPlayer.massTotal += mcolor;
        if(!currentPlayer.buffs.slow[0]) {
            currentPlayer.buffs.slow[0] = true;
            currentPlayer.maxSpeed /= 2;
        }
        currentPlayer.buffs.slow[1] = currentPlayer.skills.s3.state_duration;
    }
    function splitSkill(){
        var mainCell = currentPlayer.getMainCell();
        if(currentPlayer.massTotal >= c.defaultPlayerMass*2){
            var split_mass = mainCell.mass / 4;
            mainCell.mass -= split_mass;
            var other = new player.Cell({x:mainCell.x, y:mainCell.y}, split_mass, 15, true);
            currentPlayer.cells.push(other);
            mainCell.isMain = false;
            currentPlayer.lastSplit = new Date().getTime();
        }
    }
    function inviseSkill(){
        currentPlayer.buffs.invisible = true;
    }

    /**
     * USER PRESS SKILL
     */
    // skill 1
    socket.on('skill', function(data) {
        if(data.type === 0){
            switch(data.level){
                case 1:{
                    giveEat(0);
                    break;
                }
                case 2:{
                    giveEat(1);
                    break;
                }
                case 3:{
                    giveEat(2);
                    break;
                }
            }
        }else if (data.type === 1){
            var skillType = 's'+data.level;
            if (currentPlayer.skills.hasOwnProperty(skillType)){
                var skill = currentPlayer.skills[skillType];
                if (c.evolutionMax * currentPlayer.evolution >= data.level && skill.cooldown === 0) {
                    switch (skill.name) {
                        case 'r1':
                            impulseSkill();
                            break;
                        case 'g1':
                            immuneSkill();
                            break;
                        case 'b1':
                            boostSkill();
                            break;
                        case 'r2':
                            fireSkill();
                            break;
                        case 'g2':
                            hookSkill();
                            break;
                        case 'b2':
                            tossSkill();
                            break;
                        case 'r3':
                            coloreatSkill();
                            break;
                        case 'g3':
                            stunSkill();
                            break;
                        case 'b3':
                            slowSkill();
                            break;
                        case 'r4':
                            splitSkill();
                            break;
                        case 'g4':
                            break;
                        case 'b4':
                            inviseSkill();
                            break;
                        default:
                            _debug( 'wrong skill sends' );
                            break;
                    }
                    if (!skill.passive) {
                        skill.cooldown = skill.state_cooldown * (1 - currentPlayer.buffs.withcd);
                        skill.duration = skill.state_duration;
                    }
                }else{
                    _debug('not enought evolution or cd');
                }
            }
        }else{
            _debug('wrong type sends');
        }
    });
});
function tryKillPlayer(first){
    if (first.buffs.respawnable){
        var position = c.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(players, util.massToRadius(first.massTotal)) : util.randomPosition(util.massToRadius(first.massTotal));
        first.x = position.x;
        first.y = position.y;
        var cell = first.getMainCell();
        cell.x = position.x;
        cell.y = position.y;
        first.buffs.respawnable = false;
        first.skills.s4.cooldown = first.skills.s4.state_cooldown;
    }else{
        players.splice(players.indexOf(first), 1);
        io.emit('playerDied', { name: first.name });
        sockets[first.id].emit('RIP');
    }
}
function tickPlayer(currentPlayer, isPlayer) {
    if (isPlayer) {
        if (currentPlayer.lastHeartbeat < new Date().getTime() - c.maxHeartbeatInterval) {
            sockets[currentPlayer.id].emit( 'kick', 'Last heartbeat received over ' + c.maxHeartbeatInterval + ' ago.' );
            sockets[currentPlayer.id].disconnect();
        }
    }

    movePlayer( currentPlayer );

    function canDamaged(object){
        if (!isPlayer || (!isSafeTime &&currentPlayer.evolution * c.evolutionMax >= c.attackLevel)){
            return true;
        }
        var fromBoss = false;
        boses.forEach(function(bo){
            if(bo.id === object.id)
                fromBoss = true;
        });

        return fromBoss;
    }

    function funcFood(f) {
        return SAT.pointInCircle(new V(f.x, f.y), playerCircle) &&
            (f.id !== currentPlayer.id || f.speed <= 0);
    }

    function eatFood(f) {
        var food = foods[f];
        if (food) {
            if(isPlayer) {
                currentCell.mass += food.mass * currentPlayer.buffs.eats;
                currentPlayer.massTotal += food.mass * currentPlayer.buffs.eats;
                currentPlayer.colorize[food.type]++;
            }else{
                if (currentPlayer.getActiveColor() == food.type){
                    currentCell.mass -= food.mass * currentPlayer.buffs.eats;
                    currentPlayer.massTotal -= food.mass * currentPlayer.buffs.eats;
                    if (currentPlayer.massTotal <= 0){
                        killBoss(currentPlayer, true);
                    }
                }
            }
            foods[f] = {};
            foods.splice( f, 1 );
        }
    }

    function check(user) {
        for(var i=0; i<user.cells.length; i++) {
            if(/*user.cells[i].mass > 10 && */user.id !== currentPlayer.id) {
                var response = new SAT.Response();
                var collided = SAT.testCircleCircle(playerCircle,
                    new C(new V(user.cells[i].x, user.cells[i].y), user.cells[i].radius),
                    response);
                if (collided) {
                    response.aUser = currentCell;
                    response.bUser = {
                        id: user.id,
                        name: user.name,
                        x: user.cells[i].x,
                        y: user.cells[i].y,
                        num: i,
                        type: user.type,
                        colorize: user.colorize,
                        buffs: user.buffs,
                        mass: user.cells[i].mass
                    };
                    playerCollisions.push(response);
                }
            }
        }
    }

    function collisionCheck(collision) {
        // && collision.aUser.radius > Math.sqrt(Math.pow(collision.aUser.x - collision.bUser.x, 2) + Math.pow(collision.aUser.y - collision.bUser.y, 2))*1.75
        if (!collision.bUser.buffs.invulnerable && collision.aUser.mass > collision.bUser.mass * 1.15 && canDamaged(collision.bUser) && (currentPlayer.type === 'boss' || currentPlayer.type === 'player' && collision.bUser.type === 'player' && collision.bUser.evolution * c.evolutionMax >= c.attackLevel)) {
            _debug('{} Killing {}.', [currentPlayer.name, collision.bUser.name], '[SERVER]');
            if (currentPlayer.buffs.invisible){
                currentPlayer.buffs.invisible = false;
            }

            var numUser = util.findIndex(players, collision.bUser.id);
            if (numUser > -1) {
                if(players[numUser].cells.length > 1) {
                    players[numUser].massTotal -= collision.bUser.mass;
                    players[numUser].cells.splice(collision.bUser.num, 1);
                } else {
                    tryKillPlayer(players[numUser]);
                }
            }
            currentPlayer.massTotal += collision.bUser.mass;
            collision.aUser.mass += collision.bUser.mass;
            if(isPlayer) {
                currentPlayer.colorize.R += collision.bUser.colorize.R;
                currentPlayer.colorize.G += collision.bUser.colorize.G;
                currentPlayer.colorize.B += collision.bUser.colorize.B;
            }
        }
    }
    function takeFare(mass){
        var thefire = fires[mass];
        if(thefire !== undefined && thefire.id !== currentPlayer.id && !currentPlayer.invulnerable && canDamaged(thefire)) {
            switch(thefire.effect){
                case 'attack':{
                    break;
                }
                case 'slow':{
                    if(!currentPlayer.buffs.slow[0]) {
                        currentPlayer.buffs.slow[0] = true;
                        currentPlayer.maxSpeed /= 2;
                    }
                    currentPlayer.buffs.slow[1] = Math.min(currentCell.mass, 6.5);
                    break;
                }
                case 'hook':{
                    currentPlayer.buffs.targetable[0] = false;
                    currentPlayer.buffs.targetable[2] = false;
                    currentPlayer.buffs.targetable[1] = thefire.parent.skills.s2.state_duration;
                    thefire.parent.skills.s2.duration = thefire.parent.skills.s2.state_duration;
                    currentPlayer.target.x = thefire.parent.x - currentPlayer.x;
                    currentPlayer.target.y = thefire.parent.y - currentPlayer.y;
                    currentCell.speed = currentPlayer.maxSpeed * 1.5;
                    break;
                }
                case 'toss':{
                    thefire.parent.buffs.targetable[0] = false;
                    thefire.parent.buffs.targetable[2] = false;
                    thefire.parent.buffs.targetable[1] = thefire.parent.skills.s2.state_duration;
                    thefire.parent.skills.s2.duration = thefire.parent.skills.s2.state_duration;
                    thefire.parent.target.x =  currentCell.x - thefire.parent.x;
                    thefire.parent.target.y =  currentCell.y - thefire.parent.y;
                    thefire.parent.getMainCell().speed = thefire.parent.maxSpeed * 1.5;
                    break;
                }
            }
            currentCell.mass -= thefire.damage * (1 - currentPlayer.buffs.resist);
            currentPlayer.massTotal -= thefire.damage * (1 - currentPlayer.buffs.resist);
            if (currentPlayer.massTotal <= 1) {
                tryKillPlayer(currentPlayer);
            }
            fires[mass] = {};
            fires.splice(mass, 1);
        }
    }
    function takeVirus(virus) {
        if (viruses[virus].id != currentPlayer.id && !currentPlayer.invulnerable && canDamaged(viruses[virus])) {
            currentPlayer.buffs.targetable[0] = false;
            currentPlayer.buffs.targetable[2] = true;
            currentPlayer.buffs.targetable[1] = 3;
            viruses[virus] = {};
            viruses.splice(virus, 1);
        }
    }

    for(var z=0; z<currentPlayer.cells.length; z++) {
        var currentCell = currentPlayer.cells[z];
        var playerCircle = new C(
            new V(currentCell.x, currentCell.y),
            currentCell.radius
        );

        var foodEaten = foods.map(funcFood)
            .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);
        
        foodEaten.forEach(eatFood);

        var fireTaken = fires.map( funcFood ) // if circle
            .reduce( function (a, b, c) {
                return b ? a.concat( c ) : a;
            }, [] );

        fireTaken.forEach( takeFare );

        var virusCollision = viruses.map( funcFood )
            .reduce( function (a, b, c) {
                return b ? a.concat( c ) : a;
            }, [] );

        virusCollision.forEach( takeVirus );

        if (typeof(currentCell.speed) == "undefined")
            currentCell.speed = currentPlayer.maxSpeed;


        currentCell.radius = util.massToRadius( currentCell.mass );
        playerCircle.r = currentCell.radius;

        tree.clear();
        tree.insert( players );
        var playerCollisions = [];

        tree.retrieve( currentPlayer, check );

        playerCollisions.forEach( collisionCheck );


    }
}

function moveloop() {
    for (var i = 0; i < players.length; i++) {
        tickPlayer(players[i], true);
    }
    fires.forEach(function(fire){
       moveMass(fire, true);
    });
    foods.forEach(function(food){
        if(food.speed > 0){
            moveMass(food, false);
        }
    });
    viruses.forEach(function(virus, ind, object){
        virus.live -= TickRateM;
        if (virus.live <= 0){
            object.splice(ind, 1);
        }
    });
    boses.forEach(updateBoss);
}

function gameloop() {
    if (boses.length === 0 && Date.now() > bossLastTime + c.boss.respawn){
        addBoss();
    }
    if (players.length > 0) {
        players.sort( function(a, b) { return b.massTotal - a.massTotal; });

        var topUsers = [];

        for (var i = 0; i < Math.min(10, players.length); i++) {
            if(players[i].type == 'player') {
                topUsers.push({
                    id: players[i].id,
                    name: players[i].name
                });
            }
        }
        if (isNaN(leaderboard) || leaderboard.length !== topUsers.length) {
            leaderboard = topUsers;
            leaderboardChanged = true;
        }
        else {
            for (i = 0; i < leaderboard.length; i++) {
                if (leaderboard[i].id !== topUsers[i].id) {
                    leaderboard = topUsers;
                    leaderboardChanged = true;
                    break;
                }
            }
        }
        for (i = 0; i < players.length; i++) {
            var massLossRate = players[i].buffs.reducible? (1 - (c.massLossRate / 1000)): 1;
            for(var z=0; z < players[i].cells.length; z++) {
                if (players[i].cells[z].mass * (1 - (c.massLossRate / 1000)) > c.defaultPlayerMass) {
                    var massLoss = players[i].cells[z].mass * massLossRate;
                    players[i].massTotal -= players[i].cells[z].mass - massLoss;
                    players[i].cells[z].mass = massLoss;
                    players[i].evolution = Math.max(players[i].evolution, util.massToEvolution(players[i].massTotal));
                    if(parseInt(players[i].evolution*4) > players[i].maxLevel){
                        players[i].maxLevel++;
                        var gotColor = players[i].getMaxColor();
                        players[i].addSkill(players[i].maxLevel, gotColor.toLowerCase());
                        sockets[players[i].id].emit('levelUp', players[i].maxLevel, gotColor);
                    }
                }
            }
        }
    }
    balanceMass();
}

function sendUpdates() {
    players.forEach( function(u) {
        // center the view if x/y is undefined, this will happen for spectators
        u.x = u.x || c.gameWidth / 2;
        u.y = u.y || c.gameHeight / 2;

        var visibleFood  = foods
            .map(function(f) {
                if ( f.x > u.x - u.screenWidth/2 - 20 &&
                    f.x < u.x + u.screenWidth/2 + 20 &&
                    f.y > u.y - u.screenHeight/2 - 20 &&
                    f.y < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleVirus  = viruses
            .map(function(f) {
                if ( f.x > u.x - u.screenWidth/2 - f.radius &&
                    f.x < u.x + u.screenWidth/2 + f.radius &&
                    f.y > u.y - u.screenHeight/2 - f.radius &&
                    f.y < u.y + u.screenHeight/2 + f.radius) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleMass = fires
            .map(function(f) {
                if ( f.x+f.radius > u.x - u.screenWidth/2 - 20 &&
                    f.x-f.radius < u.x + u.screenWidth/2 + 20 &&
                    f.y+f.radius > u.y - u.screenHeight/2 - 20 &&
                    f.y-f.radius < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleBoses = boses
            .map(function(f) {
                for(var z=0; z<f.cells.length; z++) {
                    if (f.cells[z].x + f.cells[z].radius > u.x - u.screenWidth / 2 - 20 &&
                        f.cells[z].x - f.cells[z].radius < u.x + u.screenWidth / 2 + 20 &&
                        f.cells[z].y + f.cells[z].radius > u.y - u.screenHeight / 2 - 20 &&
                        f.cells[z].y - f.cells[z].radius < u.y + u.screenHeight / 2 + 20) {
                        return {
                            id: f.id,
                            x: f.x,
                            y: f.y,
                            cells: f.cells,
                            hue: f.hue
                        };
                    }
                }
            })
            .filter(function(f) { return f; });
        var visibleCells  = players
            .map(function(f) {
                for(var z=0; z<f.cells.length; z++)
                {
                    if ( f.cells[z].x+f.cells[z].radius > u.x - u.screenWidth/2 - 20 &&
                        f.cells[z].x-f.cells[z].radius < u.x + u.screenWidth/2 + 20 &&
                        f.cells[z].y+f.cells[z].radius > u.y - u.screenHeight/2 - 20 &&
                        f.cells[z].y-f.cells[z].radius < u.y + u.screenHeight/2 + 20) {
                        //z = f.cells.lenth;
                        if(f.id !== u.id) {
                            if (!f.buffs.invisible)
                                return {
                                    id: f.id,
                                    x: f.x,
                                    y: f.y,
                                    cells: f.cells,
                                    massTotal: Math.round(f.massTotal),
                                    hue: f.hue(),
                                    name: f.name,
                                    buffs: f.buffs,
                                    safe: f.evolution * c.evolutionMax < c.attackLevel
                                };
                        } else {
                            //console.log("Nombre: " + f.name + " Es Usuario");
                            return {
                                you: true,
                                x: f.x,
                                y: f.y,
                                cells: f.cells,
                                massTotal: Math.round(f.massTotal),
                                colorize: f.colorize,
                                hue: f.hue(),
                                evolution: f.evolution,
                                safe: f.evolution * c.evolutionMax < c.attackLevel,
                                buffs: f.buffs,
                                radius: util.massToRadius(f.massTotal),
                                skills: f.skills
                            };
                        }
                    }
                }
            })
            .filter(function(f) { return f; });

        sockets[u.id].emit('serverTellPlayerMove', visibleCells, visibleFood, visibleMass, visibleVirus, visibleBoses);
        if (leaderboardChanged) {
            sockets[u.id].emit('leaderboard', {
                players: players.length,
                leaderboard: leaderboard
            });
        }
    });
    leaderboardChanged = false;
}
function _debug(str, args, type){
    if (debugging || type === '[SERVER]' || type === '[CHAT]') {
        if (type === undefined) {
            type = '[DEBUG]';
        }
        if (args === undefined) {
            args = [];
        }
        args.forEach( function (arg) {
            str = str.replace( '{}', arg );
        } );
        console.log( type, str );
    }
}




setInterval(moveloop, TickRateM * 1000);
setInterval(gameloop, TickRateL * 1000);
setInterval(sendUpdates, TickRateN * 1000);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1';
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || c.port;
if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
    http.listen( serverport, ipaddress, function() {
        _debug('Listening on *:' + serverport);
    });
} else {
    http.listen( serverport, function() {
        _debug('Listening on *:' + c.port);
    });
}
