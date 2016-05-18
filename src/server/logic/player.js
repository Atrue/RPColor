var c = require('../../../config.json');
var util = require('../lib/util');
/////
//var colors = ['R', 'G', 'B'];
var SKILLS = {
    r1: function(){return new Skill('r1', 15, 0);}, //impulse
    g1: function(){return new Skill('g1', 30, 4);}, //shield
    b1: function(){return new Skill('b1', 22, 5);}, //speed
    r2: function(){return new Skill('r2', 5, 0);}, //fire
    g2: function(){return new Skill('g2', 21, 1.0);}, //hook
    b2: function(){return new Skill('b2', 20, 1.0);}, //toss
    r3: function(){return new Skill('r3', 40, 4);}, //20%main, -speed
    g3: function(){return new Skill('g3', 30, 15);}, //stun bomb
    b3: function(){return new Skill('b3', 7, 0);}, //slowarrow
    r4: function(){return new Skill('r4', 25, 5);}, //split-tp
    g4: function(){return new Skill('g4', 100, 0, true);}, //respawn
    b4: function(){return new Skill('b4', 60, 7);} //invisible
};
function Skill(name, cd, dur, passive){
    this.name = name;
    this.state_cooldown = cd;
    this.state_duration = dur;
    this.cooldown = 0;
    this.duration = 0;
    this.passive = passive? true: false;
}
function Cell(position, mass, speed, ismain) {
    this.mass = mass? mass: c.defaultPlayerMass;
    this.x = position.x;
    this.y = position.y;
    this.radius = util.massToRadius(this.mass);
    this.speed = speed? speed: 6.25;
    this.isMain = ismain? true: false;
}
function Player(id, type, position, name, target, screenW, screenH){
    if (position === undefined){
        position = util.randomPosition(util.massToRadius(c.defaultPlayerMass));
    }
    this.name = name;
    this.screenWidth = screenW;
    this.screenHeight = screenH;
    this.id = id;
    this.x = position.x;
    this.y = position.y;
    this.cells = [];
    this.massTotal = 0;
    this.colorize = {R:0,G:0,B:0};
    this.buffs = {
        invisible: false,
        invulnerable: false,
        boost: false,
        slow: [false, 0],
        reducible: true,
        respawnable: false,
        targetable: [true, 0],
        withcd: 0,
        eats: 1,
        resist: 0
    };
    if(type === 'player') {
        this.cells = [new Cell(position, 0, 0, true)];
        this.massTotal = c.defaultPlayerMass;
    }
    this.evolution = 0;
    this.maxLevel = 0;
    this.type = type;
    this.target = target !== undefined? target: {
        x:0,
        y:0
    };
    this.maxSpeed = 6.25;
    this.startTime = Date.now();
    this.lastHeartbeat = new Date().getTime();
    this.skills = {s1:{},s2:{},s3:{},s4:{}};
    //this.hue = Math.round(Math.random() * 360);
    this.addSkill = function(level, type){
        this.skills['s'+level] = SKILLS[(type+''+level)]();
        //passive skills
        switch(this.skills['s'+level].name){
            case 'g1':
                this.buffs.reducible = false;
                this.buffs.eats += 0.3;
                break;
            case 'b2':
                this.buffs.withcd += 0.15;
                break;
            case 'g4':
                this.buffs.respawnable = true;
                break;
        }
    };
    this.hue = function(){
        return rgbToHsl(getColorsCooef(this.colorize));
    };
    this.getMaxColor = function(){
        return getMaxColor(this.colorize);
    };
    this.eatColor = function(color, mass){
        color = color? color: this.getMaxColor();
        if(this.colorize.hasOwnProperty(color)) {
            this.colorize[color] += mass;
            this.massTotal += mass;
            this.getMainCell().mass += mass;
            return true;
        }
        return false;
    };
    this.reduceColor = function(color, mass){
        color = color? color: this.getMaxColor();
        if(this.colorize.hasOwnProperty(color)){
            if (this.colorize[color] >= 1 && this.massTotal > mass + c.defaultPlayerMass){
                this.colorize[color] -= 1;
                this.massTotal -= mass;
                this.getMainCell().mass -= mass;
                return true;
            }
        }
        return false;
        
    };
    this.getMainCell = function(){
        var mainCell = this.cells.reduce(function(prev, curr) {
            return prev.isMain > curr.isMain ? prev : curr;
        });
        if(!mainCell.isMain){
            mainCell = Math.max.apply(Math, this.cells.map(function(cell){return cell.mass;}));
            mainCell.isMain = true;
        }
        return mainCell;
    };
}
function getMaxColor(colors){
    return Object.keys(colors).reduce(function(a, b){
        return colors[a] > colors[b] ? a : b;
    });
}
function getColorsCooef(colors){
    var arr = Object.keys( colors ).map(function ( key ) { return colors[key]; });
    var maxColor = Math.max.apply(Math, arr );
    return arr.map(function(color){
        return maxColor? color/maxColor: 1;
    });
}
function rgbToHsl(colors){
    var r = colors[0]; var g = colors[1]; var b = colors[2];
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h * 360, s*100, l*100];
}

exports.Player = Player;
exports.Cell = Cell;
