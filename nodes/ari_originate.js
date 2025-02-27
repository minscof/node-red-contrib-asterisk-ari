const { initializeConnection } = require("../lib/helpers");

module.exports = function (RED) {
    "use strict";

    function ari_originate(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.type = 'originate';
        node.name = n.name || node.type;
        node.connected = false;
        node.server = RED.nodes.getNode(n.server);
        node.apps = node.server.apps.split(',');
        node.app = n.app;
        node.topics = n.topics;
        node.destination = n.destination;
        node.callerId = n.callerId;
        
        const connectionPromise = initializeConnection(node);

        node.on('input', async function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            try {
                let destination = msg.payload?.destination ?? node.destination; // Use optional chaining and nullish coalescing
                console.debug(`originate call endpoint = ${destination} `);
                if (!destination) {
                    node.error("destination undefined");
                    node.status({ fill: "red", shape: "dot", text: "destination undefined" });
                    return;
                }

                const connection = await connectionPromise;
                if (!connection) {
                    node.error("No connection available");
                    node.status({ fill: "red", shape: "dot", text: "connection failed" });
                    return;
                }
                const channel = connection.Channel();
                if(!channel){
                    node.error("No channel available");
                    node.status({ fill: "red", shape: "dot", text: "channel failed" });
                    return;
                }
                console.log('Channel created:', channel.id);
                console.log("📞 Trying to call...");
                await channel.originate({
                    endpoint: destination,
                    app: node.app,
                    callerId: node.callerId
                });

                console.debug(`Originate : call done...`);
                node.status({});
            } catch (err) {
                console.error(`Error during originate call:`, err);
                node.error(err);
                node.status({ fill: "red", shape: "dot", text: "call failed" });
            }
        });

        this.on("close", async function (done) {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
            done();
        });
    }
    RED.nodes.registerType("ari_originate", ari_originate);
}