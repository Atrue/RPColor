var c = require('../../../config.json');
var util = require('../lib/util');
/////
var colors = ['R', 'G', 'B'];


function Cell(position, mass, speed, ismain) {
    this.mass = mass? mass: c.defaultPlayerMass;
    this.x = position.x;
    this.y = position.y;
    this.radius = util.massToRadius(this.mass);
    this.speed = speed? speed: 6.25;
    this.isMain = ismain? true: false;
}
function Boss(id, position){
    this.id = id;
    this.x = position.x;
    this.y = position.y;
    this.hue = -1;
    this.spawnTime = Date.now();
    this.changeTime = Date.now();
    this.cells = [new Cell(position, c.boss.mass, 0, true)];
    this.massTotal = c.boss.mass;
    this.radius = util.massToRadius(this.massTotal);
    this.target = {x:0, y:0};
    this.maxSpeed = 6.25;
    this.activeSkill = 0;
    this.type = 'boss';
    this.buffs = {
        invisible: false,
        invulnerable: false,
        boost: false,
        slow: [false, 0],
        reducible: true,
        respawnable: false,
        targetable: [true, 0, false], //3 - isStun
        withcd: 0,
        eats: 25,
        resist: 0,
    };
    this.getActiveColor = function(){
        if( this.hue !== -1){
            return colors[this.hue / 120];
        }
        return -1;
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
exports.Boss = Boss;
exports.Cell = Cell;
