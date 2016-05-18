var c = require('../../../config.json');
var util = require('../lib/util');
/////


function Fire(id, mass, damage, hue, target, x, y, speed, effect, parent){
    this.id = id;
    this.masa = mass === undefined? c.fireFood: mass;
    this.damage = damage;
    this.hue = hue;
    this.target = target === undefined? {x:0,y:0}: target;
    this.x = x;
    this.y = y;
    this.radius = util.massToRadius(mass);
    this.speed = speed;
    this.effect = effect;
    this.parent = parent;

}

exports.Fire = Fire;
