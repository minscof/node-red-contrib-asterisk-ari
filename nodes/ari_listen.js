const { initializeConnection } = require("../lib/helpers");

module.exports = function (RED) {
    "use strict";

    // Fonction asynchrone séparée pour gérer l'initialisation
    async function initializeNode(node, n) {
        try {
            const connectionPromise = initializeConnection(node); 
            node.connection = await connectionPromise;
        } catch (error) {
            node.error("Error initialization: " + error.message);
            node.status({ fill: "red", shape: "dot", text: "connection failed" });
        }
    }
    
    function ari_listen(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.name = n.name || node.type;
        node.connected = false;
        node.server = RED.nodes.getNode(n.server);
        node.apps = node.server.apps.split(',');
        node.app = n.app;
        node.topics = n.topics;
        
        initializeNode(this, node);
    }
    RED.nodes.registerType("ari_listen", ari_listen);

    //deprecated
    RED.nodes.registerType("ari_listener", ari_listen);
}