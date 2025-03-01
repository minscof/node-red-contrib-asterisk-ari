const { connectionPool } = require("../lib/ari-client");

module.exports = function (RED) {
    "use strict";

    function ari_answer(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.name = n.name || node.type;
        node.status({});

        node.on('input', async function (msg, send, done) {
            try {
                node.status({ fill: "blue", shape: "dot" });
                node.app = msg.app;
                const channel = connectionPool.getchan(msg.channelId);
                if (!channel) {
                    const errorMessage = `Answer: channel ${msg.channelId} not found, maybe hangup`;
                    node.error(errorMessage);
                    node.status({ fill: "red", shape: "dot", text: "channel not found" });
                    done(errorMessage);
                    return;
                }

                await channel.answer();
                console.debug(`Answer channel: ${channel.id} - call answered`);
                msg.event = 'Answer';
                send(msg); // Send the message to the next nodes
                node.status({});
                done();
            } catch (err) {
                console.error(`Answer channel: ${msg.channelId} - Error:`, err);
                node.error(err);
                node.status({ fill: "red", shape: "dot", text: "error" });
                done(err);
            }
        });

        node.on("close", function (done) {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
            done();
        });
    }
    RED.nodes.registerType("ari_answer", ari_answer);
}
