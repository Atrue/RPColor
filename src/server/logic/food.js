//var c = require('../../../config.json');
var util = require('../lib/util');
/////
var colors = ['R', 'G', 'B'];

function Food(id, mass, position, color, target, speed){
    this.id = id;
    this.mass = mass? mass: Math.random() + 0.5;
    this.radius = util.massToRadius(this.mass);
    position = position? position: util.randomPosition(this.radius);
    this.x = position.x;
    this.y = position.y;    
    this.target = target? target: {x:0, y:0};
    this.speed = speed? speed: 0;
    if(color === undefined) {
        color = Math.floor( Math.random() * 3 );
        this.hue = color * 120;
        this.type = colors[color];
    }else{
        this.hue = color * 120;
        this.type = colors[color];
    }
}

exports.Food = Food;
