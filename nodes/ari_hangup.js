const { connectionPool } = require("../lib/ari-client");
const { handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    function ari_hangup(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.on('input', function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            var channel = connectionPool.getchan(msg.channelId);
            if (!channel) {
                console.debug(`hangup : channel ${msg.channelId} not found (already destroyed) `);
                node.status({});
                return;
            }
            //console.debug(`ari_hangup : before channel.hangup channel=`, channel.channelData);
            channel.hangup(function (err) {
                if (err) {
                    node.error(err);
                    node.status({});
                };
                node.status({});
                msg.event = 'Hangup';
                node.send(msg);
                node.status({});
                console.debug(`ari_hangup ended`);
            });
            //console.debug(`ari_hangup : after channel.hangup channel=`, channel.channelData);
            channel.on('ChannelDestroyed', event => {
                //console.log('ChannelDestroyed channel:', event);
                node.status({});
                msg.event = 'Destroyed';
                msg.payload = event;
                node.send(msg);
                node.status({});
            });
        });
    }
    RED.nodes.registerType("ari_hangup", ari_hangup);
};