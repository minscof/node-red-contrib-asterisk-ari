const { connectionPool } = require("../lib/ari-client");

module.exports = function (RED) {
    "use strict";

    function ari_continueindialplan(n) {
        RED.nodes.createNode(this, n);
        const node = this;

        node.on('input', async function (msg, send, done) {
            node.status({ fill: "blue", shape: "dot" });
            try {
                const connection = connectionPool.getconn(msg.asteriskId);
                if (!connection) {
                    const err = `connection: ${msg.asteriskId} undefined`; 
                    node.error(err);
                    node.status({ fill: "red", shape: "dot", text: err });
                    done(err);
                    return;
                }

                console.debug("ari_continueindialplan - continueInDialplan start");
                await connection.channels.continueInDialplan({ channelId: msg.channelId });
                console.debug("ari_continueindialplan - continueInDialplan done");
                msg.payload = `continue in dialplan - end application : ${node.application}`;
                send(msg); // Use the provided 'send'
                node.status({});
                done(); // Signal that processing is complete
            } catch (err) {
                console.error("ari_continueindialplan - continueInDialplan error:", err);
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
};