const { connectionPool } = require("../lib/ari-client");
const { handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    "use strict";

    function ari_dtmf_listen(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.type = 'dtmf_listen';
        node.name = n.name || node.type;
        node.status({});

        node.on('input', async function (msg) {
            node.status({ fill: "blue", shape: "dot", text: "waiting dtmf_listen" });
            try {
                const channel = connectionPool.getchan(msg.payload.channel.id);
                if (!channel) {
                    const err = `dtmf_listen: channel ${msg.payload.channel.id} not found, maybe hangup`;
                    node.error(err);
                    node.status({});
                    return;
                }
                console.debug(`dtmf_listen channel: ${channel.id}`);
                channel.on('ChannelDtmfReceived', event => {
                    console.log(`ChannelDtmfReceived digit ${event.digit} :`, event.channel.id);
                    msg.event = 'ChannelDtmfReceived';
                    msg.digit = event.digit
                    node.send(msg);
                    node.status({});
                });
                
                console.debug(`dtmf_listen ended`);
            } catch (err) {
                console.error(`dtmf_listen channel: ${channel.id}`,err);
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
    RED.nodes.registerType("ari_dtmf_listen", ari_dtmf_listen);
}