var io = require('socket.io-client');

var playerName;
var playerType;
var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;
var KEY_ESC = 27;
var KEY_ENTER = 13;
var KEY_CHAT = 13;
var KEY_Q = 81;
var KEY_W = 87;
var KEY_E = 69;
var KEY_R = 82;
var KEY_1 = 49;
var KEY_2 = 50;
var KEY_3 = 51;
var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;
var borderDraw = true;
var animLoopHandle;
var spin = -Math.PI;
var scale = 1;
//var enemySpin = -Math.PI;
var mobile = false;
var foodSides = 10;
var virusSides = 20;
// GUI
var GEvolution = document.getElementById('evol_prog');
var GLeadColor = document.getElementById('leadColor');
var GRedCount = document.getElementById('redCount');
var GGreenCount = document.getElementById('greenCount');
var GBlueCount = document.getElementById('blueCount');
var GMassCount = document.getElementById('massCount');
var GRadCount = document.getElementById('radiusCount');
var GEvolCount = document.getElementById('evolutionCount');
var chatlist = document.getElementById('chatList');

var SKILL_KEYS = {s1:'Q',s2:'W',s3:'E',s4:'R'};
var FULL_COLORS = {R:'Red', G:'Green', B:'Blue'};

var debug = function(args) {
    if (console && console.log) {
        console.log(args);
    }
};

if ( /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) ) {
    mobile = true;
}

String.prototype.format = function () {
    var i = 0, args = arguments;
    return this.replace(/\{\}/g, function () {
        return typeof args[i] != 'undefined' ? args[i++] : '';
    });
};

function startGame(type) {
    playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0,25);
    playerType = type;
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;

    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    if (!socket) {
        socket = io({query:"type=" + type});
        setupSocket(socket);
    }
    if (!animLoopHandle)
        animloop();
    socket.emit('respawn', {name:playerName, width:screenWidth, height:screenHeight});
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /.*/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null && regex.exec(playerNameInput.value)[0].trim() !== "" ;
}

window.onload = function() {

    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btnS.onclick = function () {
        startGame('spectate');
    };
    btn.onclick = function () {

        // Checks if the nick is valid.
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame('player');
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    var skillsMenu = document.getElementById('skillsButton');
    var settings = document.getElementById('settings');
    var skillsInfo = document.getElementById('skillsInfo');
    var instructions = document.getElementById('instructions');
    var closeLeftPane = document.getElementById('leftResize');
    var leftPane = document.getElementById('leftPane');
    var closeChatPane = document.getElementById('chatResize');
    var chatPane = document.getElementById('chatPane');

    $( '#helpPane' ).hide();
    document.getElementById('helpClose').onclick = function(){
        $('#helpPane').hide();
    };
    document.getElementById('nextHelp').onclick = function(){
        $('#helpPane').hide();
    };
    document.getElementById('exitHelp').onclick = function(){
        help.forEach(function(h, i){help[i] = false;});
        $('#helpPane').hide();
    };

    closeLeftPane.onclick = function(){
        if (leftPane.style.width !== '50px'){
            leftPane.style.width = '50px';
            leftPane.style.height = '20px';
        }else{
            leftPane.style.width = '100%';
            leftPane.style.height = '150px';
        }
    };
    closeChatPane.onclick = function(){
        if (chatPane.style.width !== '50px'){
            chatPane.style.width = '50px';
            chatPane.style.height = '20px';
        }else{
            chatPane.style.width = '100%';
            chatPane.style.height = '200px';
        }
    };
    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == '300px') {
            settings.style.maxHeight = '0px';
        } else {
            settings.style.maxHeight = '300px';
            skillsInfo.style.maxHeight = '0px';
        }
    };
    skillsMenu.onclick = function () {
        if (skillsInfo.style.maxHeight == '1000px') {
            skillsInfo.style.maxHeight = '0px';
        } else {
            skillsInfo.style.maxHeight = '1000px';
            settings.style.maxHeight = '0px';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// Canvas.
var screenWidth = window.innerWidth;
var screenHeight = window.innerHeight;
var gameWidth = 0;
var gameHeight = 0;
var xoffset = -gameWidth;
var yoffset = -gameHeight;
var userLang = navigator.language || navigator.userLanguage;

var help = [true, true, true, true];
var gameStart = false;
var disconnected = false;
var died = false;
var kicked = false;

// TODO: Break out into GameControls.
var continuity = true;
var startPingTime = 0;
var toggleMassState = 0;
var backgroundColor = '#181818';
var lineColor = '#ffffff';

var foodConfig = {
    border: 0
};

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: screenWidth / 2,
    y: screenHeight / 2,
    screenWidth: screenWidth,
    screenHeight: screenHeight,
    evolution:0,
    target: {x: screenWidth / 2, y: screenHeight / 2}
};

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var boses = [];
var leaderboard = [];
var target = {x: player.x, y: player.y};
var reenviar = true;
var directionLock = false;
var directions = [];

var c = document.getElementById('cvs');
c.width = screenWidth; c.height = screenHeight;
c.addEventListener('mousemove', gameInput, false);
c.addEventListener('mouseout', outOfBounds, false);
c.addEventListener('keydown', keyInput, false);
c.addEventListener('keyup', function(event) {reenviar = true; directionUp(event);}, false);
c.addEventListener('keydown', directionDown, false);
c.addEventListener('touchstart', touchInput, false);
c.addEventListener('touchmove', touchInput, false);
c.addEventListener('mousewheel', zooming, false);

// Register when the mouse goes off the canvas.
function outOfBounds() {
    if (!continuity) {
        target = { x : 0, y: 0 };
    }
}

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = toggleMass;

document.getElementById('continuity').onchange = toggleContinuity;

document.getElementById('roundFood').onchange = toggleRoundFood;

var graph = c.getContext('2d');

function ChatClient(config) {
    this.commands = {};
    var input = document.getElementById('chatInput');
    input.addEventListener('keypress', this.sendChat.bind(this));
    input.addEventListener('keyup', function(key) {
        input = document.getElementById('chatInput');

        key = key.which || key.keyCode;
        if (key === KEY_ESC) {
            input.value = '';
            c.focus();
        }
    });
}

// Chat box implementation for the users.
ChatClient.prototype.addChatLine = function (name, message, me) {
    if (mobile) {
        return;
    }
    var newline = document.createElement('li');

    // Colours the chat input correctly.
    newline.className = (me) ? 'me' : 'friend';
    newline.innerHTML = '<b>' + ((name.length < 1) ? 'An unnamed cell' : name) + '</b>: ' + message;
    
    this.appendMessage(newline);
};


// Chat box implementation for the system.
ChatClient.prototype.addSystemLine = function (message) {
    if (mobile) {
        return;
    }
    var newline = document.createElement('li');

    // Colours the chat input correctly.
    newline.className = 'system';
    newline.innerHTML = message;

    // Append messages to the logs.
    this.appendMessage(newline);
};

// Places the message DOM node into the chat box.
ChatClient.prototype.appendMessage = function (node) {
    if (mobile) {
        return;
    }
    var chatList = document.getElementById('chatList');
    if (chatList.childNodes.length > 10) {
        chatList.removeChild(chatList.childNodes[0]);
    }
    chatList.appendChild(node);
    chatlist.scrollTop = chatlist.scrollHeight;
};

// Sends a message or executes a command on the click of enter.
ChatClient.prototype.sendChat = function (key) {
    var commands = this.commands,
        input = document.getElementById('chatInput');

    key = key.which || key.keyCode;

    if (key === KEY_ENTER) {
        var text = input.value.replace(/(<([^>]+)>)/ig,'');
        if (text !== '') {

            // Chat command.
            if (text.indexOf('-') === 0) {
                var args = text.substring(1).split(' ');
                if (commands[args[0]]) {
                    commands[args[0]].callback(args.slice(1));
                } else {
                    this.addSystemLine('Unrecognized Command: ' + text + ', type -help for more info.');
                }

            // Allows for regular messages to be sent to the server.
            } else {
                socket.emit('playerChat', { sender: player.name, message: text });
                this.addChatLine(player.name, text, true);
            }

            // Resets input.
            input.value = '';
            c.focus();
        }
    }
};

// Allows for addition of commands.
ChatClient.prototype.registerCommand = function (name, description, callback) {
    this.commands[name] = {
        description: description,
        callback: callback
    };
};

// Allows help to print the list of all the commands and their descriptions.
ChatClient.prototype.printHelp = function () {
    var commands = this.commands;
    for (var cmd in commands) {
        if (commands.hasOwnProperty(cmd)) {
            this.addSystemLine('-' + cmd + ': ' + commands[cmd].description);
        }
    }
};

var chat = new ChatClient();

// Chat command callback functions.
function keyInput(event) {
	var key = event.keyCode;//event.which || event.keyCode;
    if (key === KEY_Q && reenviar) {
        socket.emit('skill', {type:1, level:1});
        reenviar = false;
    } else if (key === KEY_W && reenviar) {
        socket.emit('skill', {type:1, level:2});
        reenviar = false;
    } else if (key === KEY_E && reenviar) {
        socket.emit('skill', {type:1, level:3});
        reenviar = false;
    } else if (key === KEY_R && reenviar) {
        socket.emit('skill', {type:1, level:4});
        reenviar = false;
    } else if (key === KEY_1 && reenviar) {
        socket.emit('skill', {type:0, level:1});
        reenviar = false;
    } else if (key === KEY_2 && reenviar) {
        socket.emit('skill', {type:0, level:2});
        reenviar = false;
    } else if (key === KEY_3 && reenviar) {
        socket.emit('skill', {type:0, level:3});
        reenviar = false;
    }
        
        /* else if (key === KEY_FIREFOOD && reenviar) {
        socket.emit('1');
        reenviar = false;
    }
    else if (key === KEY_SPLIT && reenviar) {
       document.getElementById('split_cell').play();
        socket.emit('2');
        reenviar = false;
    }*/
    else if (key === KEY_CHAT) {
        document.getElementById('chatInput').focus();
    }
}
function zooming(event){
    socket.emit('windowResized', { screenWidth: screenWidth, screenHeight: screenHeight, zoom: scale + event.wheelDelta/1200});
}
/*
    $( "#feed" ).click(function() {
        socket.emit('1');
        reenviar = false;
});

    $( "#split" ).click(function() {
        socket.emit('2');
        reenviar = false;
});*/

// Function called when a key is pressed, will change direction if arrow key.
function directionDown(event) {
	var key = event.which || event.keyCode;

	if (directional(key)) {
		directionLock = true;
		if (newDirection(key,directions, true)) {
			updateTarget(directions);
			socket.emit('0', target);
		}
	}
}

// Function called when a key is lifted, will change direction if arrow key.
function directionUp(event) {
	var key = event.which || event.keyCode;
	if (directional(key)) {
		if (newDirection(key,directions, false)) {
			updateTarget(directions);
			if (directions.length === 0) directionLock = false;
			socket.emit('0', target);
		}
	}
}

// Updates the direction array including information about the new direction.
function newDirection(direction, list, isAddition) {
	var result = false;
	var found = false;
	for (var i = 0, len = list.length; i < len; i++) {
		if (list[i] == direction) {
			found = true;
			if (!isAddition) {
				result = true;
				// Removes the direction.
				list.splice(i, 1);
			}
			break;
		}
	}
	// Adds the direction.
	if (isAddition && found === false) {
		result = true;
		list.push(direction);
	}

	return result;
}

// Updates the target according to the directions in the directions array.
function updateTarget(list) {
	target = { x : 0, y: 0 };
	var directionHorizontal = 0;
	var directionVertical = 0;
	for (var i = 0, len = list.length; i < len; i++) {
		if (directionHorizontal === 0) {
			if (list[i] == KEY_LEFT) directionHorizontal -= Number.MAX_VALUE;
			else if (list[i] == KEY_RIGHT) directionHorizontal += Number.MAX_VALUE;
		}
		if (directionVertical === 0) {
			if (list[i] == KEY_UP) directionVertical -= Number.MAX_VALUE;
			else if (list[i] == KEY_DOWN) directionVertical += Number.MAX_VALUE;
		}
	}
	target.x += directionHorizontal;
	target.y += directionVertical;
}

function directional(key) {
	return horizontal(key) || vertical(key);
}

function horizontal(key) {
	return key == KEY_LEFT || key == KEY_RIGHT;
}

function vertical(key) {
	return key == KEY_DOWN || key == KEY_UP;
}
function checkLatency() {
    // Ping.
    startPingTime = Date.now();
    socket.emit('pings');
}

function toggleDarkMode() {
    var LIGHT = '#f2fbff',
        DARK = '#181818';
    var LINELIGHT = '#000000',
        LINEDARK = '#ffffff';

    if (backgroundColor === LIGHT) {
        backgroundColor = DARK;
        lineColor = LINEDARK;
        chat.addSystemLine('Dark mode enabled.');
    } else {
        backgroundColor = LIGHT;
        lineColor = LINELIGHT;
        chat.addSystemLine('Dark mode disabled.');
    }
}

function toggleBorder() {
    if (!borderDraw) {
        borderDraw = true;
        chat.addSystemLine('Showing border.');
    } else {
        borderDraw = false;
        chat.addSystemLine('Hiding border.');
    }
}

function toggleMass() {
    if (toggleMassState === 0) {
        toggleMassState = 1;
        chat.addSystemLine('Viewing mass enabled.');
    } else {
        toggleMassState = 0;
        chat.addSystemLine('Viewing mass disabled.');
    }
}

function toggleContinuity() {
    if (!continuity) {
        continuity = true;
        chat.addSystemLine('Continuity enabled.');
    } else {
        continuity = false;
        chat.addSystemLine('Continuity disabled.');
    }
}

function toggleRoundFood(args) {
    if (args || foodSides < 10) {
        foodSides = (args && !isNaN(args[0]) && +args[0] >= 3) ? +args[0] : 10;
        chat.addSystemLine('Food is now rounded!');
    } else {
        foodSides = 5;
        chat.addSystemLine('Food is no longer rounded!');
    }
}

// TODO: Break out many of these GameControls into separate classes.

chat.registerCommand('ping', 'Check your latency.', function () {
    checkLatency();
});

// chat.registerCommand('dark', 'Toggle dark mode.', function () {
//     toggleDarkMode();
// });
//
// chat.registerCommand('border', 'Toggle visibility of border.', function () {
//     toggleBorder();
// });
//
// chat.registerCommand('mass', 'Toggle visibility of mass.', function () {
//     toggleMass();
// });

// chat.registerCommand('continuity', 'Toggle continuity.', function () {
//     toggleContinuity();
// });

// chat.registerCommand('roundfood', 'Toggle food drawing.', function (args) {
//     toggleRoundFood(args);
// });

// chat.registerCommand('help', 'Information about the chat commands.', function () {
//     chat.printHelp();
// });
chat.registerCommand('boss', 'When is boss?.', function () {
    socket.emit('boss');
});
chat.registerCommand('login', 'Login as an admin.', function (args) {
    socket.emit('pass', args);
});

chat.registerCommand('kick', 'Kick a player, for admins only.', function (args) {
    socket.emit('kick', args);
});


// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pongs', function () {
        var latency = Date.now() - startPingTime;
        debug('Latency: ' + latency + 'ms');
        chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_failed', function () {
        socket.close();
        disconnected = true;
    });

    socket.on('disconnect', function () {
        socket.close();
        disconnected = true;
    });

    // Handle connection.
    socket.on('welcome', function (playerSettings) {
        player = playerSettings;
        /*player.name = playerName;
        player.screenWidth = screenWidth;
        player.screenHeight = screenHeight;
        player.target = target;
        socket.emit('gotit', player);*/
        gameStart = true;
        debug('Game started at: ' + gameStart);
        chat.addSystemLine('Connected to the game!');
        chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        showHelpMessage(0);
        if (mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
		c.focus();
    });

    socket.on('gameSetup', function(data) {
        gameWidth = data.gameWidth;
        gameHeight = data.gameHeight;
        resize();
    });

    socket.on('zoomSetup', function(zoom) {
        scale = zoom;
    });

    socket.on('playerDied', function (data) {
        chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> was eaten.');
    });

    socket.on('playerDisconnect', function (data) {
        chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> disconnected.');
    });

    socket.on('playerJoin', function (data) {
        chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> joined.');
    });

    socket.on('leaderboard', function (data) {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id){
                if(leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + "</span>";
                else
                    status += '<span class="me">' + (i + 1) + ". An unnamed cell</span>";
            } else {
                if(leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name;
                else
                    status += (i + 1) + '. An unnamed cell';
            }
        }
        //status += '<br />Players: ' + data.players;
        document.getElementById('status').innerHTML = status;
    });

    socket.on('bossTime', function (time) {
        var minutes = Math.floor(time/ (1000 * 60));
        var seconds = time % (60);
        chat.addSystemLine('{GAME} - The boss is coming in {} minutes {} seconds'.format(minutes, seconds));
    });
    socket.on('safeTime', function (state) {
        if(help[3] && state){
            showHelpMessage(3);
        }
        backgroundColor = state? "#681818" : "#181818";
    });

    socket.on('serverMSG', function (data) {
        chat.addSystemLine(data);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        chat.addChatLine(data.sender, data.message, false);
    });

    socket.on('levelUp', function (level, color) {
        if(help[2] && level === 1){
            showHelpMessage(2);
        }else if(help[3] && level === 2){
            showHelpMessage(3);
        }
        $($('.prgs_stage')[level-1]).addClass('prgs_stay_'+color.toLowerCase());
        $('#s'+level).css('background', 'url(./img/{}{}.jpg)'.format(color.toLowerCase(), level));
    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (userData, foodsList, massList, virusList, bossList) {
        var playerData;
        for(var i =0; i< userData.length; i++) {
            if(userData[i] !== undefined && userData[i].you === true) {
                playerData = userData[i];
                i = userData.length;
            }
        }
        if(playerType === 'player') {
            var xoffset = player.x - playerData.x;
            var yoffset = player.y - playerData.y;

            player.x = playerData.x;
            player.y = playerData.y;
            player.colorize = playerData.colorize;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
            player.xoffset = isNaN(xoffset) ? 0 : xoffset;
            player.yoffset = isNaN(yoffset) ? 0 : yoffset;
            player.evolution = playerData.evolution;
            player.buffs = playerData.buffs;
            player.skills = playerData.skills;
            player.radius = playerData.radius;
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
        boses = bossList;
    });

    // Death.
    socket.on('RIP', function () {
        gameStart = false;
        died = true;
        window.setTimeout(function() {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            died = false;
            if (animLoopHandle) {
                window.cancelAnimationFrame(animLoopHandle);
                animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (data) {
        gameStart = false;
        reason = data;
        kicked = true;
        socket.close();
    });

    /*socket.on('virusSplit', function (virusCell) {
        socket.emit('2', virusCell);
        reenviar = false;
    });*/
}

function drawCircle(centerX, centerY, radius, sides) {
    centerX /= scale;
    centerY /= scale;
    radius /= scale;

    var theta = 0;
    var x = 0;
    var y = 0;

    graph.beginPath();

    for (var i = 0; i < sides; i++) {
        theta = (i / sides) * 2 * Math.PI;
        x = centerX + radius * Math.sin(theta);
        y = centerY + radius * Math.cos(theta);
        graph.lineTo(x, y);
    }

    graph.closePath();
    graph.stroke();
    graph.fill();
}

function drawFood(food) {
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
    graph.lineWidth = foodConfig.border;
    drawCircle(food.x - player.x + screenWidth * scale/ 2, food.y - player.y + screenHeight * scale/ 2, food.radius, foodSides);
}

function drawVirus(virus) {
    graph.strokeStyle = virus.stroke;
    graph.fillStyle = virus.fill;
    graph.lineWidth = virus.strokeWidth;
    drawCircle(virus.x - player.x + screenWidth * scale/ 2, virus.y - player.y + screenHeight * scale/ 2, virus.radius, virusSides);
}

function drawBoss(boss) {
    graph.fillStyle = "hsl(0,20%,20%)";
    graph.strokeStyle = boss.hue === -1? 'hsl(0, 0%, 0%)' : 'hsl(' + boss.hue + ', 100%, 50%)';
    graph.lineWidth = "80";
    boss.cells.forEach(function(cell){
        drawCircle(cell.x - player.x + screenWidth * scale/ 2, cell.y - player.y + screenHeight * scale/ 2, cell.radius, virusSides);
    });    
}

function drawFireFood(mass) {
    graph.save();
    var buff = mass.type === 'toss' || mass.type === 'hook'? 0.1: 1;
    graph.strokeStyle = 'hsl(' + mass.hue + ', ' +100*buff+ '%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    graph.lineWidth = playerConfig.border+10;


    var w = 2*(mass.radius-5);
    var x = mass.x - player.x + screenWidth * scale  / 2 - 0.5*w;
    var y = mass.y - player.y + screenHeight * scale / 2 - 0.5*w;
    
    x /= scale;
    y /= scale;
    w /= scale;

    graph.translate(x + 0.5*w, y + 0.5*w);
    graph.rotate((Math.PI/180)*mass.speed);
    graph.translate(-(x + 0.5*w), -(y + 0.5*w));
    graph.fillRect(x, y, w, w);
    graph.translate(x + 0.5*w, y + 0.5*w);
    graph.rotate((Math.PI/180)*45);
    graph.translate(-(x + 0.5*w), -(y + 0.5*w));
    graph.fillRect(x, y, w, w);

    graph.restore();
    //drawCircle(mass.x - player.x + screenWidth / 2, mass.y - player.y + screenHeight / 2, mass.radius-5, 18 + (~~(mass.masa/5)));
}
function getColorsCooef(colors){
    var arr = Object.keys( colors ).map(function ( key ) { return colors[key]; });
    var maxColor = Math.max.apply(Math, arr );
    return arr.map(function(color){
        return maxColor? color/maxColor: 1;
    });
}
function drawPlayers(order) {
    var start = {
        x: (player.x - (screenWidth / 2) * scale )/ scale,
        y: (player.y - (screenHeight / 2) * scale )/ scale
    };

    for(var z=0; z<order.length; z++)
    {
        var userCurrent = users[order[z].nCell];
        var cellCurrent = users[order[z].nCell].cells[order[z].nDiv];

        var x=0;
        var y=0;

        var points = 30 + ~~(cellCurrent.mass/5);
        var increase = Math.PI * 2 / points;


        var color = userCurrent.buffs.invulnerable? 0.1: 1;
        var dMute = userCurrent.buffs.targetable? 1: 0.1;
        var alpha = userCurrent.buffs.invisible? 0.3: 1;
        var safe = userCurrent.safe? 0.5: 1;
        //graph.strokeStyle = 'hsl(' + userCurrent.hue + ', 100%, 45%)';
        //graph.fillStyle = 'hsla(' + userCurrent.hue + ', '+color+'%, 50%, '+alpha+')';
        graph.strokeStyle = 'hsla({},{}%,{}%,{})'.format(userCurrent.hue[0], userCurrent.hue[1]*0.7 * dMute, userCurrent.hue[2]*0.7 * dMute, safe);
        graph.fillStyle = 'hsla({},{}%,{}%,{})'.format(userCurrent.hue[0], userCurrent.hue[1]*color, userCurrent.hue[2] * color, alpha*safe);

        //var colors = getColorsCooef(userCurrent.colorize);
        //var hsl = rgbToHsl(colors[0], colors[1], colors[2]);


        //graph.strokeStyle = 'rgba({},{},{},{})'.format(colors[0] * alpha,colors[1] * 255,colors[2] * 255,0.45);
        //graph.fillStyle = 'rgba({},{},{},{})'.format(colors[0] * color ,colors[1] * color,colors[2] * color, alpha);

        //graph.strokeStyle = 'hsla({},{}%,{}%,{})'.format(hsl[0], hsl[1], hsl[2], 0.45);
        //graph.fillStyle = 'hsla({},{}%,{}%,{})'.format(hsl[0], hsl[1], hsl[2], alpha);


        graph.lineWidth = playerConfig.border / scale;

        var xstore = [];
        var ystore = [];

        spin += 0.0;

        var circle = {
            x: cellCurrent.x / scale - start.x,
            y: cellCurrent.y / scale - start.y
        };

        for (var i = 0; i < points; i++) {

            x = cellCurrent.radius/ scale * Math.cos(spin) + circle.x;
            y = cellCurrent.radius/ scale * Math.sin(spin) + circle.y;
            if(typeof(userCurrent.id) == "undefined") {
                x = valueInRange(-userCurrent.x + screenWidth / 2, gameWidth - userCurrent.x + screenWidth / 2, x);
                y = valueInRange(-userCurrent.y + screenHeight / 2, gameHeight - userCurrent.y + screenHeight / 2, y);
            } else {
                x = valueInRange(-cellCurrent.x - player.x + screenWidth/2 + (cellCurrent.radius/3), gameWidth - cellCurrent.x + gameWidth - player.x + screenWidth/2 - (cellCurrent.radius/3), x);
                y = valueInRange(-cellCurrent.y - player.y + screenHeight/2 + (cellCurrent.radius/3), gameHeight - cellCurrent.y + gameHeight - player.y + screenHeight/2 - (cellCurrent.radius/3) , y);
            }
            spin += increase;
            xstore[i] = x;
            ystore[i] = y;
        }
        /*if (wiggle >= player.radius/ 3) inc = -1;
        *if (wiggle <= player.radius / -3) inc = +1;
        *wiggle += inc;
        */
        graph.shadowBlur = 0;
        if (userCurrent.buffs.boost){
            graph.shadowBlur=30;
            graph.shadowColor="rgb(0,255,255)";
        }else if(userCurrent.buffs.slow[0]){
            graph.shadowBlur=30;
            graph.shadowColor="rgb(100,0,0)";
        }


        for (i = 0; i < points; ++i) {
            if (i === 0) {
                graph.beginPath();
                graph.moveTo(xstore[i], ystore[i]);
            } else if (i > 0 && i < points - 1) {
                graph.lineTo(xstore[i], ystore[i]);
            } else {
                graph.lineTo(xstore[i], ystore[i]);
                graph.lineTo(xstore[0], ystore[0]);
            }

        }
        graph.lineJoin = 'round';
        graph.lineCap = 'round';
        graph.fill();
        graph.stroke();

        graph.shadowBlur = 0;
        
        var nameCell = "";
        if(typeof(userCurrent.id) == "undefined")
            nameCell = player.name;
        else
            nameCell = userCurrent.name;

        var fontSize = Math.max(cellCurrent.radius / 3, 12);
        graph.lineWidth = playerConfig.textBorderSize;
        graph.fillStyle = playerConfig.textColor;
        graph.strokeStyle = playerConfig.textBorder;
        graph.miterLimit = 1;
        graph.lineJoin = 'round';
        graph.textAlign = 'center';
        graph.textBaseline = 'middle';
        graph.font = 'bold ' + fontSize + 'px sans-serif';

        if (toggleMassState === 0) {
            graph.strokeText(nameCell, circle.x, circle.y);
            graph.fillText(nameCell, circle.x, circle.y);
        } else {
            graph.strokeText(nameCell, circle.x, circle.y);
            graph.fillText(nameCell, circle.x, circle.y);
            graph.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
            if(nameCell.length === 0) fontSize = 0;
            graph.strokeText(Math.round(cellCurrent.mass), circle.x, circle.y+fontSize);
            graph.fillText(Math.round(cellCurrent.mass), circle.x, circle.y+fontSize);
        }
    }
}

function valueInRange(min, max, value) {
    return Math.min(max, Math.max(min, value));
}

function drawgrid() {
     graph.lineWidth = 1;
     graph.strokeStyle = lineColor;
     graph.globalAlpha = 0.15;
     graph.beginPath();

    for (var x = xoffset - player.x; x < screenWidth * scale ; x += screenHeight / (18 + (18 * scale) % 18)) {
        graph.moveTo(x / scale, 0);
        graph.lineTo(x / scale, screenHeight);
    }

    for (var y = yoffset - player.y ; y < screenHeight * scale ; y += screenHeight / (18 + (18 * scale) % 18)) {
        graph.moveTo(0, y / scale);
        graph.lineTo(screenWidth, y / scale);
    }

    graph.stroke();
    graph.globalAlpha = 1;
}

function drawborder() {
    graph.lineWidth = 1;
    graph.strokeStyle = playerConfig.borderColor;

    // Left-vertical.
    if (player.x <= screenWidth/2 * scale) {
        graph.beginPath();
        graph.moveTo((screenWidth/2 * scale - player.x) / scale , (screenHeight/2 * scale - player.y) / scale);
        graph.lineTo((screenWidth/2 * scale - player.x) / scale , (gameHeight + screenHeight/2 * scale - player.y) / scale + scale);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }

    // Top-horizontal.
    if (player.y <= screenHeight/2 * scale) {
        graph.beginPath();
        graph.moveTo((screenWidth/2 * scale - player.x) / scale, (screenHeight/2 * scale - player.y) / scale );
        graph.lineTo((gameWidth + screenWidth/2 * scale - player.x) / scale + scale, (screenHeight/2 * scale - player.y) / scale  );
        graph.strokeStyle = lineColor;
        graph.stroke();
    }

    // Right-vertical.
    if (gameWidth - player.x <= screenWidth/2 * scale) {
        graph.beginPath();
        graph.moveTo((gameWidth + screenWidth/2 * scale - player.x) / scale + scale, (screenHeight/2 * scale - player.y)/ scale);
        graph.lineTo((gameWidth + screenWidth/2 * scale - player.x) / scale + scale, (gameHeight + screenHeight/2 * scale - player.y) / scale + scale);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }

    // Bottom-horizontal.
    if (gameHeight - player.y <= screenHeight/2 * scale) {
        graph.beginPath();
        graph.moveTo((gameWidth + screenWidth/2 * scale- player.x) / scale + scale, (gameHeight + screenHeight/2 * scale - player.y) / scale + scale);
        graph.lineTo((screenWidth/2 * scale - player.x) / scale , (gameHeight + screenHeight/2 * scale - player.y) / scale + scale);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }
}

function gameInput(mouse) {
	if (!directionLock) {
		target.x = mouse.clientX - screenWidth / 2;
		target.y = mouse.clientY - screenHeight / 2;
	}
}

function touchInput(touch) {
    touch.preventDefault();
    touch.stopPropagation();
	if (!directionLock) {
		target.x = touch.touches[0].clientX - screenWidth / 2;
		target.y = touch.touches[0].clientY - screenHeight / 2;
	}
}

window.requestAnimFrame = (function() {
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.msRequestAnimationFrame     ||
            function( callback ) {
                window.setTimeout(callback, 1000 / 30);
            };
})();

window.cancelAnimFrame = (function(handle) {
    return  window.cancelAnimationFrame     ||
            window.mozCancelAnimationFrame;
})();

function animloop() {
    animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}
function getMaxColor(colors){
    return Object.keys(colors).reduce(function(a, b){
        return colors[a] > colors[b] ? a : b;
    });
}
function gameLoop() {
    if (died) {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, screenWidth, screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        graph.fillText('You died!', screenWidth / 2, screenHeight / 2);
    }
    else if (!disconnected) {
        if (gameStart) {
            graph.fillStyle = backgroundColor;
            graph.fillRect(0, 0, screenWidth, screenHeight);

            drawgrid();
            foods.forEach(drawFood);
            fireFood.forEach(drawFireFood);
            viruses.forEach(drawVirus);

            if (borderDraw) {
                drawborder();
            }
            var orderMass = [];
            for(var i=0; i<users.length; i++) {
                for(var j=0; j<users[i].cells.length; j++) {
                    orderMass.push({
                        nCell: i,
                        nDiv: j,
                        mass: users[i].cells[j].mass
                    });
                }
            }
            orderMass.sort(function(obj1,obj2) {
                return obj1.mass - obj2.mass;
            });

            drawPlayers(orderMass);
            boses.forEach(drawBoss);

            socket.emit('0', target); // playerSendTarget "Heartbeat".
            GEvolution.style.width = player.evolution*96+'%';
            GEvolCount.innerHTML = Math.round(player.evolution*100)/100;
            GRedCount.innerHTML = player.colorize.R;
            GGreenCount.innerHTML = player.colorize.G;
            GBlueCount.innerHTML = player.colorize.B;
            GMassCount.innerHTML = player.massTotal;
            GRadCount.innerHTML = parseInt(player.radius+0.5);
            var color = FULL_COLORS[(getMaxColor(player.colorize))];
            GLeadColor.innerHTML = color;
            GLeadColor.className = 'd' + color;

            for(var jj=0;jj<4;jj++){
                if (player.evolution >= (jj+1)/4.0){
                    $($('.prgs_stage')[jj]).addClass('prgs_active');
                    $($('.prgs_skill')[jj]).removeClass('inactive_skill');
                }else{
                    $($('.prgs_stage')[jj]).removeClass('prgs_active');
                    $($('.prgs_skill')[jj]).addClass('inactive_skill');
                }
            }
            for(var sname in player.skills) {
                var skill = player.skills[sname];
                if(skill.name !== undefined) {
                    var skill_img = $('#' + sname);
                    var skill_cd = $('#' + sname + ' .skill_cd');
                    if (skill.cooldown > 0) {
                        if (skill.duration > 0) {
                            skill_img.addClass('active_skill');
                            skill_img.removeClass('foractive_skill');
                        } else {
                            skill_img.removeClass('active_skill');
                            skill_img.removeClass('foractive_skill');
                        }
                        skill_cd.html(parseInt(skill.cooldown));
                    } else {
                        if (skill.passive) {
                            skill_img.addClass('passive_skill');
                            skill_img.removeClass('foractive_skill');
                            skill_cd.html("");
                        } else {
                            skill_img.addClass('foractive_skill');
                            skill_cd.html(SKILL_KEYS[sname]);
                        }
                        skill_img.removeClass('active_skill');
                    }
                }
            }

        } else {
            graph.fillStyle = '#333333';
            graph.fillRect(0, 0, screenWidth, screenHeight);

            graph.textAlign = 'center';
            graph.fillStyle = '#FFFFFF';
            graph.font = 'bold 30px sans-serif';
            graph.fillText('Game Over!', screenWidth / 2, screenHeight / 2);
        }
    } else {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, screenWidth, screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        if (kicked) {
            if (reason !== '') {
                graph.fillText('You were kicked for:', screenWidth / 2, screenHeight / 2 - 20);
                graph.fillText(reason, screenWidth / 2, screenHeight / 2 + 20);
            }
            else {
                graph.fillText('You were kicked!', screenWidth / 2, screenHeight / 2);
            }
        }
        else {
              graph.fillText('Disconnected!', screenWidth / 2, screenHeight / 2);
        }
        graph.fillText('Your opinions about the game you can send into the chat :)', screenWidth /2, screenHeight /3);
    }
}
function showHelpMessage(numb){
    if(help[numb]) {
        var header;
        var content;
        switch (numb) {
            case 0:
            {
                header = 'Welcome to RPColor!';
                content = userLang === 'ru'?
                    `1. Это Agario-зная модель игры с похожим геймплеем, но другими возможностями.<br>
                    2. Ваша масса здесь играет второстепенную роль в отличии от ваших умений.<br>
                    3. Собирая точки определенного цвета, вы получаете определеннон умение, их комбинации будут решать дальнейший ход игры.
                    <b>Не беспокойтесь о других игроках: вы не можете друг друга убить... Пока.</b>`
                        :
                    `1. This is kind of Agario game with another features.<br>
                     2. The main role is your skills that depend of your color.<br>
                     3. When you pick up a paint, it's added to you and mixed with other.<br>
                    <b>Don't worry about other players: they can't kill you...yet.</b>`;
                setTimeout(function(){ $( '#helpPane' ).hide();showHelpMessage(1);}, 8000);
                break;
            }
            case 1:
            {
                header = 'Step 1!';
                content = userLang === 'ru'?
                    `1. Все цвета соответсвуют цветовой палитре RGB. Сумма всех съеденых цветов образуют цвет вашего круга.<br>
                    2. Лидирующий цвет (можно посмотреть в статистеке) будет определять умение при достижении нового уровня.<br>
                    3. Для корреляции нужного цвета вы можете сбрасывать ненужные вам цвета клавишами 1, 2 и 3. Соотсвутсвуют R(красный), G(зеленый) и B(синий)
                    <b>Цель 1: получить уровень 1.</b>`
                    :
                    `1. There are RGB paints. The sum of all eaten colors form the color of your circle.<br>
                    2. The resulting skill depend of the leading color .<br>
                    3. You can discard your paint by 1,2 and 3 keys. (Red, Green and Blue color).<br>
                    <b>Goal 1: reach the first level.</b>`;
                break;
            }
            case 2:
            {
                header = 'Step 2!';
                content = userLang === 'ru'?
                    `1. Вы достигли 1 уровня. <br>
                    2. Активные умения активируются клавишами Q,W,E и R.<br>
                    2. Ваши умения могут наносить урон другим персонажам, давать эффекты вам или врагам или оказывать пассивное влияние.<br>
                    <b>Цель 2: получить уровень 2.</b>`
                    :
                    `1. You have reached the first level.<br>
                    2. Active skills are activated by Q, W, E and R keys.<br>
                    3. Your skills will deal damage or give some effects.<br>
                    <b>Goal 2: reach the level 2.</b>`;
                break;
            }
            case 3:
            {
                header = 'Step 3!';
                content = userLang === 'ru'?
                    `1. Вы достигли 2 уровня. <b>Осторожно: теперь вы можете съесть и быть съеденным. <br>
                    2. С увеличением уровня и массы ваша скорость уменьшается, в следствие чего вам сложнее добраться до противников.<br>
                    <b>Цель 3: получить максимальный уровень и не быть съеденным.</b>`
                    :
                    `You have reached the level 2. <br>
                    Caution: now you can kill or be killed.<br>
                    <b>Goal 3: to get the max level and don't be eaten.</b>`;
                break;
            }
            case 4:
            {
                header = 'Boss!';
                content = userLang === 'ru'?
                    `1. <b>В игре появился босс. <br>
                    2. Остерегайтесь его когда он находится в атакующей позиции(черный цвет).<br>
                    3. В пассивной позиции он становится одним из 3 цветов (красный, зеленый, синий). Получение точек этого цвета наносит ему урон. (Клавиши 1,2,3)<br>
                    4. Во время босса все игроки становятся союзниками. <br>
                    <b>Общая цель: убить босса.</b>`
                    :
                    `1. <b>The boss have come.</b><br>
                    2. Be careful when the boss is on attack-position.<br>
                    3. In the passive-position the boss activates one of three shields (red, green or blue). Paints of this color deals damage to the boss. (Keys 1, 2 and 3)<br>
                    4. During the boss time players can't kill each other.<br>
                    <b>GOAL: Kill the boss</b>`;

                break;
            }
            default:
            {
                return;
            }
        }
        $( '.helpWelcome' ).html( header );
        $( '.helpContent' ).html( content );
        $( '#helpPane' ).show();
        help[numb] = false;
    }
}

window.addEventListener('resize', resize);

function resize() {
    player.screenWidth = c.width = screenWidth = playerType == 'player' ? window.innerWidth  : gameWidth;
    player.screenHeight = c.height = screenHeight = playerType == 'player' ? window.innerHeight : gameHeight;
    socket.emit('windowResized', { screenWidth: screenWidth, screenHeight: screenHeight, zoom: scale });
}
