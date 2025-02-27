const { connectionPool } = require("../lib/ari-client");
const { handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    function ari_answer(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.on('input', async function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            const channel = connectionPool.getchan(msg.payload.channel.id);
            if (!channel) {
                let err = `channel ${msg.payload.channel.id} not found, maybe hangup`;
                node.error(err);
                node.status({});
                return;
            }
            console.debug(`get channelId  = ${channel.id}`);
            try {
                await channel.answer();
            } catch (err) {
                node.error(err);
                node.status({});
                return;
            }
            console.debug(`✅ Call answered channel id: ${channel.id}`);
            msg.event = 'Answered';
            node.send(msg);
            node.status({});
            console.debug(`Answer ended`);
        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
        });
    }
    RED.nodes.registerType("ari_answer", ari_answer);
};