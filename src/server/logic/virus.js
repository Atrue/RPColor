var c = require('../../../config.json');
var util = require('../lib/util');
/////
function Virus(id, position, mass){
    mass = mass? mass: util.randomInRange(c.virus.defaultMass.from, c.virus.defaultMass.to, true);
    var radius = util.massToRadius(mass);
    position = position? position: c.virusUniformDisposition ? util.uniformPosition(all, radius) : util.randomPosition(radius);
    this.id = id;
    this.x = position.x;
    this.y = position.y;
    this.radius = radius;
    this.mass = mass;
    this.fill = c.virus.fill;
    this.live = 15;
    this.stroke = c.virus.stroke;
    this.strokeWidth = c.virus.strokeWidth;
}


exports.Virus = Virus;
