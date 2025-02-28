const { connectionPool } = require("../lib/ari-client");

module.exports = function (RED) {
    "use strict";

    function ari_hangup(n) {
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
                    const txt = `Hangup channel: ${msg.channelId} not found`;
                    console.debug(txt);
                    node.error(txt);
                    node.status({});
                    return;
                }
                console.debug(`Hangup channel: ${channel?.id}`);
                channel.on('ChannelDestroyed', event => {
                    //TODO event not catched !
                    //console.log('ChannelDestroyed channel:', event);
                    msg.event = 'ChannelDestroyed';
                    msg.payload = event;
                    node.send(msg);
                    node.status({});
                });

                await channel.hangup();
                msg.event = 'Hangup';
                node.send(msg);
                node.status({});
                console.debug(`Hangup ended`);
            } catch (err) {
                console.error(`Hangup error channel: ${msg.channelId}`, err);
                node.error(err);
                msg.event = 'Hangup';
                node.send(msg);
                node.status({});
            };
            
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