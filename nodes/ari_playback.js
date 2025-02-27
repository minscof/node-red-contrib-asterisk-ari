const { connectionPool } = require("../lib/ari-client");
const { handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    function ari_playback(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.config = n;
        node.on('input', async function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            this.media2 = RED.util.evaluateNodeProperty(node.config.media2, node.config.media2Type, node, msg);
            const channel = connectionPool.getchan(msg.channelId);
            console.debug(`debug playback ${this.media2} - channelId ${msg.channelId}`);
            if (!this.media2) {
                console.debug(`error playback = media not defined`);
                node.error(`media not defined`);
                node.status({});
                return;
            }
            if (!channel) {
                node.error(`channel ${msg.channelId} is not valid!`);
                node.status({});
                return;
            }
            try {
                const playback = await channel.play({
                    media: this.media2
                });

                playback.on('PlaybackStarted', function (event, completedPlayback) {
                    //console.debug(`event playback started event`, event );
                    msg.event = event.type;
                    msg.payload = event;
                    node.send([null, msg]);
                    node.status({});
                });

                playback.on('PlaybackFinished', function (event, completedPlayback) {
                    //console.debug(`event playback finished event`, event );
                    msg.event = event.type;
                    msg.payload = event;
                    node.send([msg, null]);
                    node.status({});
                });
            } catch (err) {
                node.error(err);
                node.status({});
                return;
            }
        });

        node.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
        });
    }
    RED.nodes.registerType("ari_playback", ari_playback);
};