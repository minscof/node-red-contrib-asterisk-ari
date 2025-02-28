const { connectionPool } = require("../lib/ari-client");

module.exports = function (RED) {
    "use strict";

    function ari_answer(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.name = n.name || node.type;
        node.status({});

        node.on('input', async function (msg) {
            try {
                node.status({ fill: "blue", shape: "dot" });
                node.app = msg.app;
                const channel = connectionPool.getchan(msg.channelId);
                if (!channel) {
                    const err = `Answer: channel ${msg.channelId} not found, maybe hangup`;
                    node.error(err);
                    node.status({});
                    return;
                }
                
                await channel.answer();
                console.debug(`Answer channel: ${channel.id}`);
                //console.debug(`✅ Call answered channel: ${channel.id}`);
                msg.event = 'Answer';
                node.send(msg);
                node.status({});
            } catch (err) {
                console.error(`Answer channel: ${msg.channelId}`,err);
                node.error(err);
                node.status({});
            }
        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
        });
    }
    RED.nodes.registerType("ari_answer", ari_answer);
}