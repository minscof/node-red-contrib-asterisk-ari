
//required to allow browser to access /resources/topics.js
//console.log("⚡ main.js is loaded!");
const path = require("path");

module.exports = function (RED) {
    // Expose the topics.js file via an HTTP route
    RED.httpAdmin.get("/resources/topics.js", function (req, res) {
        const path = require("path");
        //console.debug("Sending topics.js",path.join(__dirname, "resources", "topics.js"));
        res.sendFile(path.join(__dirname, "resources", "topics.js"));
    });
};

const EventEmitter = require('events');
//EventEmitter.defaultMaxListeners = 20; // Applique à tous les EventEmitter
/*
const originalOn = EventEmitter.prototype.on;
EventEmitter.prototype.on = function(event, listener) {
    console.log(`Ajout d'un écouteur pour l'événement: ${event}`);
    return originalOn.apply(this, arguments);
};
*/