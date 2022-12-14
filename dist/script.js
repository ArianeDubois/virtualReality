/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/suncalc/suncalc.js":
/*!*****************************************!*\
  !*** ./node_modules/suncalc/suncalc.js ***!
  \*****************************************/
/***/ ((module) => {

/*
 (c) 2011-2015, Vladimir Agafonkin
 SunCalc is a JavaScript library for calculating sun/moon position and light phases.
 https://github.com/mourner/suncalc
*/

(function () { 'use strict';

// shortcuts for easier to read formulas

var PI   = Math.PI,
    sin  = Math.sin,
    cos  = Math.cos,
    tan  = Math.tan,
    asin = Math.asin,
    atan = Math.atan2,
    acos = Math.acos,
    rad  = PI / 180;

// sun calculations are based on http://aa.quae.nl/en/reken/zonpositie.html formulas


// date/time constants and conversions

var dayMs = 1000 * 60 * 60 * 24,
    J1970 = 2440588,
    J2000 = 2451545;

function toJulian(date) { return date.valueOf() / dayMs - 0.5 + J1970; }
function fromJulian(j)  { return new Date((j + 0.5 - J1970) * dayMs); }
function toDays(date)   { return toJulian(date) - J2000; }


// general calculations for position

var e = rad * 23.4397; // obliquity of the Earth

function rightAscension(l, b) { return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l)); }
function declination(l, b)    { return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l)); }

function azimuth(H, phi, dec)  { return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi)); }
function altitude(H, phi, dec) { return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H)); }

function siderealTime(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }

function astroRefraction(h) {
    if (h < 0) // the following formula works for positive altitudes only.
        h = 0; // if h = -0.08901179 a div/0 would occur.

    // formula 16.4 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
    // 1.02 / tan(h + 10.26 / (h + 5.10)) h in degrees, result in arc minutes -> converted to rad:
    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
}

// general sun calculations

function solarMeanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d); }

function eclipticLongitude(M) {

    var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)), // equation of center
        P = rad * 102.9372; // perihelion of the Earth

    return M + C + P + PI;
}

function sunCoords(d) {

    var M = solarMeanAnomaly(d),
        L = eclipticLongitude(M);

    return {
        dec: declination(L, 0),
        ra: rightAscension(L, 0)
    };
}


var SunCalc = {};


// calculates sun position for a given date and latitude/longitude

SunCalc.getPosition = function (date, lat, lng) {

    var lw  = rad * -lng,
        phi = rad * lat,
        d   = toDays(date),

        c  = sunCoords(d),
        H  = siderealTime(d, lw) - c.ra;

    return {
        azimuth: azimuth(H, phi, c.dec),
        altitude: altitude(H, phi, c.dec)
    };
};


// sun times configuration (angle, morning name, evening name)

var times = SunCalc.times = [
    [-0.833, 'sunrise',       'sunset'      ],
    [  -0.3, 'sunriseEnd',    'sunsetStart' ],
    [    -6, 'dawn',          'dusk'        ],
    [   -12, 'nauticalDawn',  'nauticalDusk'],
    [   -18, 'nightEnd',      'night'       ],
    [     6, 'goldenHourEnd', 'goldenHour'  ]
];

// adds a custom time to the times config

SunCalc.addTime = function (angle, riseName, setName) {
    times.push([angle, riseName, setName]);
};


// calculations for sun times

var J0 = 0.0009;

function julianCycle(d, lw) { return Math.round(d - J0 - lw / (2 * PI)); }

function approxTransit(Ht, lw, n) { return J0 + (Ht + lw) / (2 * PI) + n; }
function solarTransitJ(ds, M, L)  { return J2000 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L); }

function hourAngle(h, phi, d) { return acos((sin(h) - sin(phi) * sin(d)) / (cos(phi) * cos(d))); }
function observerAngle(height) { return -2.076 * Math.sqrt(height) / 60; }

// returns set time for the given sun altitude
function getSetJ(h, lw, phi, dec, n, M, L) {

    var w = hourAngle(h, phi, dec),
        a = approxTransit(w, lw, n);
    return solarTransitJ(a, M, L);
}


// calculates sun times for a given date, latitude/longitude, and, optionally,
// the observer height (in meters) relative to the horizon

SunCalc.getTimes = function (date, lat, lng, height) {

    height = height || 0;

    var lw = rad * -lng,
        phi = rad * lat,

        dh = observerAngle(height),

        d = toDays(date),
        n = julianCycle(d, lw),
        ds = approxTransit(0, lw, n),

        M = solarMeanAnomaly(ds),
        L = eclipticLongitude(M),
        dec = declination(L, 0),

        Jnoon = solarTransitJ(ds, M, L),

        i, len, time, h0, Jset, Jrise;


    var result = {
        solarNoon: fromJulian(Jnoon),
        nadir: fromJulian(Jnoon - 0.5)
    };

    for (i = 0, len = times.length; i < len; i += 1) {
        time = times[i];
        h0 = (time[0] + dh) * rad;

        Jset = getSetJ(h0, lw, phi, dec, n, M, L);
        Jrise = Jnoon - (Jset - Jnoon);

        result[time[1]] = fromJulian(Jrise);
        result[time[2]] = fromJulian(Jset);
    }

    return result;
};


// moon calculations, based on http://aa.quae.nl/en/reken/hemelpositie.html formulas

function moonCoords(d) { // geocentric ecliptic coordinates of the moon

    var L = rad * (218.316 + 13.176396 * d), // ecliptic longitude
        M = rad * (134.963 + 13.064993 * d), // mean anomaly
        F = rad * (93.272 + 13.229350 * d),  // mean distance

        l  = L + rad * 6.289 * sin(M), // longitude
        b  = rad * 5.128 * sin(F),     // latitude
        dt = 385001 - 20905 * cos(M);  // distance to the moon in km

    return {
        ra: rightAscension(l, b),
        dec: declination(l, b),
        dist: dt
    };
}

SunCalc.getMoonPosition = function (date, lat, lng) {

    var lw  = rad * -lng,
        phi = rad * lat,
        d   = toDays(date),

        c = moonCoords(d),
        H = siderealTime(d, lw) - c.ra,
        h = altitude(H, phi, c.dec),
        // formula 14.1 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
        pa = atan(sin(H), tan(phi) * cos(c.dec) - sin(c.dec) * cos(H));

    h = h + astroRefraction(h); // altitude correction for refraction

    return {
        azimuth: azimuth(H, phi, c.dec),
        altitude: h,
        distance: c.dist,
        parallacticAngle: pa
    };
};


// calculations for illumination parameters of the moon,
// based on http://idlastro.gsfc.nasa.gov/ftp/pro/astro/mphase.pro formulas and
// Chapter 48 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.

SunCalc.getMoonIllumination = function (date) {

    var d = toDays(date || new Date()),
        s = sunCoords(d),
        m = moonCoords(d),

        sdist = 149598000, // distance from Earth to Sun in km

        phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra)),
        inc = atan(sdist * sin(phi), m.dist - sdist * cos(phi)),
        angle = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) -
                cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));

    return {
        fraction: (1 + cos(inc)) / 2,
        phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI,
        angle: angle
    };
};


function hoursLater(date, h) {
    return new Date(date.valueOf() + h * dayMs / 24);
}

// calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article

SunCalc.getMoonTimes = function (date, lat, lng, inUTC) {
    var t = new Date(date);
    if (inUTC) t.setUTCHours(0, 0, 0, 0);
    else t.setHours(0, 0, 0, 0);

    var hc = 0.133 * rad,
        h0 = SunCalc.getMoonPosition(t, lat, lng).altitude - hc,
        h1, h2, rise, set, a, b, xe, ye, d, roots, x1, x2, dx;

    // go in 2-hour chunks, each time seeing if a 3-point quadratic curve crosses zero (which means rise or set)
    for (var i = 1; i <= 24; i += 2) {
        h1 = SunCalc.getMoonPosition(hoursLater(t, i), lat, lng).altitude - hc;
        h2 = SunCalc.getMoonPosition(hoursLater(t, i + 1), lat, lng).altitude - hc;

        a = (h0 + h2) / 2 - h1;
        b = (h2 - h0) / 2;
        xe = -b / (2 * a);
        ye = (a * xe + b) * xe + h1;
        d = b * b - 4 * a * h1;
        roots = 0;

        if (d >= 0) {
            dx = Math.sqrt(d) / (Math.abs(a) * 2);
            x1 = xe - dx;
            x2 = xe + dx;
            if (Math.abs(x1) <= 1) roots++;
            if (Math.abs(x2) <= 1) roots++;
            if (x1 < -1) x1 = x2;
        }

        if (roots === 1) {
            if (h0 < 0) rise = i + x1;
            else set = i + x1;

        } else if (roots === 2) {
            rise = i + (ye < 0 ? x2 : x1);
            set = i + (ye < 0 ? x1 : x2);
        }

        if (rise && set) break;

        h0 = h2;
    }

    var result = {};

    if (rise) result.rise = hoursLater(t, rise);
    if (set) result.set = hoursLater(t, set);

    if (!rise && !set) result[ye > 0 ? 'alwaysUp' : 'alwaysDown'] = true;

    return result;
};


// export as Node module / AMD module / browser variable
if (true) module.exports = SunCalc;
else {}

}());


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!*******************!*\
  !*** ./script.js ***!
  \*******************/
var SunCalc = __webpack_require__(/*! suncalc */ "./node_modules/suncalc/suncalc.js"); //get hours cuoch?? du soleil
// SunCalc.getTimes(getTimes(new Date(), 48.862760, 2.400570))


var times = SunCalc.getTimes(new Date(), 48.8, 2.4);
var sunriseStr = times.sunrise.getHours() + ':' + times.sunrise.getMinutes(); // get position of the sun (azimuth and altitude) at today's sunrise

var sunrisePos = SunCalc.getPosition(times.sunrise, 48.8, 2.4); // get sunrise azimuth in degrees

var sunriseAzimuth = sunrisePos.azimuth * 150 / Math.PI;
console.log(times); // get position of the sun (azimuth and altitude) at today's sunrise
// get sunrise azimuth in degrees

var today = new Date();
var hours = today.getHours();
var lighting = {};

if (hours >= times.nightEnd.getHours() && hours < times.solarNoon.getHours()) {
  lighting = {
    x: -10,
    y: 2,
    z: 0,
    intensity: 1,
    shininess: 20,
    reflectivity: 0.2,
    color: '#6E7579',
    blackReflectivity: 0.5
  };
  console.log('mornig');
} else if (hours >= times.solarNoon.getHours() && hours < times.goldenHour.getHours()) {
  lighting = {
    x: -5,
    y: 3,
    z: 0,
    intensity: 1.5,
    shininess: 15,
    reflectivity: 0.15,
    blackReflectivity: 0.5,
    color: '#7B7B79'
  };
  console.log('good afternoon');
} else if (hours >= times.goldenHour.getHours() && hours < times.sunset.getHours()) {
  lighting = {
    x: 10,
    y: 2,
    z: 0,
    intensity: 1,
    shininess: 30,
    reflectivity: 0.1,
    color: '#8C8D89',
    blackReflectivity: 0.5
  }; //finis trop tard

  console.log('golden hour');
} else if (hours >= times.sunset.getHours() && hours < times.night.getHours()) {
  lighting = {
    x: -1,
    y: 1,
    z: 0,
    intensity: 1,
    shininess: 10,
    reflectivity: 0.15,
    blackReflectivity: 0.5,
    color: '#6E7579'
  }; //finis trop tard

  console.log('sunset');
} else if (hours >= times.night.getHours()) {
  lighting = {
    x: -1,
    y: 1,
    z: 0,
    intensity: 1,
    shininess: 10,
    reflectivity: 0.15,
    blackReflectivity: 0.5,
    color: '#6E7579'
  };
  console.log('good night');
} else if (hours <= times.nightEnd.getHours() || hours == 0) {
  lighting = {
    x: -1,
    y: 1,
    z: 0,
    intensity: 1,
    shininess: 10,
    reflectivity: 0.15,
    blackReflectivity: 0.5,
    color: '#6E7579'
  };
  console.log('good night');
}

AFRAME.registerComponent('contreform', {
  init: function init() {
    var _this = this;

    var scene = document.querySelector('a-scene');
    var data = scene.setAttribute('renderer'); // data.exposure = 0.5;

    this.loaded = false;
    this.camera = document.querySelector('a-camera');
    var materials = [new THREE.MeshPhongMaterial({
      color: 0x202020,
      shininess: 50,
      reflectivity: lighting.blackReflectivity
    }), new THREE.MeshPhongMaterial({
      color: 0x202020,
      shininess: 50,
      reflectivity: lighting.blackReflectivity
    })];
    this.el.addEventListener("loaded", function (e) {
      _this.material = _this.el.getObject3D('mesh').material = materials;
    });
  }
});
AFRAME.registerComponent('form', {
  init: function init() {
    var _this2 = this;

    var materials = [new THREE.MeshPhongMaterial({
      color: 0xFFFFFF,
      shininess: lighting.shininess,
      reflectivity: lighting.reflectivity
    }), new THREE.MeshPhongMaterial({
      color: 0xFFFFFF,
      shininess: 50,
      reflectivity: lighting.blackReflectivity
    })];
    this.el.addEventListener("loaded", function (e) {
      _this2.material = _this2.el.getObject3D('mesh').material = materials;
    });
  }
});
AFRAME.registerComponent('forma', {
  init: function init() {
    var _this3 = this;

    var materials = [new THREE.MeshPhongMaterial({
      color: 0xFFFFFF,
      shininess: lighting.shininess,
      reflectivity: lighting.reflectivity
    }), new THREE.MeshPhongMaterial({
      color: 0xFFFFFF,
      shininess: lighting.shininess,
      reflectivity: lighting.reflectivity
    })];
    this.el.addEventListener("loaded", function (e) {
      _this3.material = _this3.el.getObject3D('mesh').material = materials;
    });
  }
});
AFRAME.registerComponent('intensity', {
  init: function init() {
    var _this4 = this;

    this.el.addEventListener("loaded", function (e) {
      var light = {
        type: 'directional',
        intensity: lighting.intensity
      };

      _this4.el.setAttribute('light', light);

      _this4.el.setAttribute('position', {
        x: 5,
        y: 10,
        z: 0
      });
    });
  }
});
AFRAME.registerComponent('color', {
  init: function init() {
    var _this5 = this;

    this.el.addEventListener("loaded", function (e) {
      var light = {
        color: lighting.color,
        type: 'ambient'
      };

      _this5.el.setAttribute('light', light);
    });
  }
});
AFRAME.registerComponent('point', {
  init: function init() {
    var _this6 = this;

    console.log(lighting);
    this.el.addEventListener("loaded", function (e) {
      var light = {
        color: lighting.color,
        type: 'point',
        intensity: lighting.intensity
      };

      _this6.el.setAttribute('light', light);

      _this6.el.setAttribute('position', {
        x: lighting.x,
        y: lighting.y,
        z: lighting.z
      });
    });
  }
});
})();

/******/ })()
;