const { connectionPool } = require("../lib/ari-client");

module.exports = function (RED) {
    "use strict";

    function ari_continueindialplan(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.name = n.name || node.type;
        node.status({});
        
        node.on('input', async function (msg, send, done) {
            try {
                node.status({ fill: "blue", shape: "dot" });
                node.app = msg.app;
                const connection = connectionPool.getconn(msg.asteriskId);
                console.log('channelId ', msg.channelId);
                                
                await connection.channels.continueDialplan(msg.channelId);
                console.debug(`${node.type} channel: ${msg.channelId} - call continueInDialplan`);
                msg.event = 'continueInDialplan';
                send(msg); // Send the message to the next nodes
                node.status({});
                done(); // Signal that processing is complete
            } catch (err) {
                console.error(`${node.type} - continueInDialplan error:`, err);
                node.error(err);
                node.status({ fill: "red", shape: "dot", text: err });
                done(err); // Signal error
            }
        });

        this.on("close", function (done) {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
            done();
        });
    }
    RED.nodes.registerType("ari_continueindialplan", ari_continueindialplan);
}