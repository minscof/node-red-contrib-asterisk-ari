const { connectionPool } = require("../lib/ari-client");
const { handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    "use strict";
    
    function ari_hangup(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.type = 'hangup';
        node.name = n.name || node.type;
        node.status({});

        node.on('input', async function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            try {
                const channel = connectionPool.getchan(msg.channelId);
                if (!channel) {
                    console.debug(`Hangup : channel ${msg.channelId} not found (already destroyed) `);
                    node.error(err);
                    node.status({});
                    return;
                }
                console.debug(`Answer channel: ${channel.id}`);
                channel.on('ChannelDestroyed', event => {
                    //console.log('ChannelDestroyed channel:', event);
                    msg.event = 'ChannelDestroyed';
                    msg.payload = event;
                    node.send(msg);
                    node.status({});
                });
            
                await channel.hangup();
            } catch (err) {
                console.error(`Hangup channel: ${channel.id}`,err);
                    node.error(err);
                    node.status({});
                    return;
                };
                msg.event = 'Hangup';
                node.send(msg);
                node.status({});
                console.debug(`Hangup ended`);
            });
            //console.debug(`ari_hangup : after channel.hangup channel=`, channel.channelData);
            
        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
        });
    }
    RED.nodes.registerType("ari_hangup", ari_hangup);
}