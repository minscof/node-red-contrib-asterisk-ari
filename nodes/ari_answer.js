const { connectionPool } = require("../lib/ari-client");
const { handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    "use strict";

    function ari_answer(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.type = 'answer';
        node.name = n.name || node.type;
        node.status({});

        node.on('input', async function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            try {
                const channel = connectionPool.getchan(msg.payload.channel.id);
                if (!channel) {
                    const err = `Answer: channel ${msg.payload.channel.id} not found, maybe hangup`;
                    node.error(err);
                    node.status({});
                    return;
                }
                console.debug(`Answer channel: ${channel.id}`);
                await channel.answer();
                console.debug(`✅ Call answered channel id: ${channel.id}`);
                msg.event = 'Answered';
                node.send(msg);
                node.status({});
                console.debug(`Answer ended`);
            } catch (err) {
                console.error(`Answer channel: ${channel.id}`,err);
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