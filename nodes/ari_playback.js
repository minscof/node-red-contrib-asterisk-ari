const { connectionPool } = require("../lib/ari-client");

module.exports = function (RED) {
    function ari_playback(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.config = n;
        node.on('input', async function (msg) {
            try {
                node.status({ fill: "blue", shape: "dot" });
                node.app = msg.app;
                this.media2 = RED.util.evaluateNodeProperty(node.config.media2, node.config.media2Type, node, msg);
                const channel = connectionPool.getchan(msg.channelId);
                console.debug(`${node.type} ${this.media2} - channel: ${msg.channelId}`);
                if (!this.media2) {
                    console.debug(`${node.type} error playback = media not defined`);
                    node.error(`media not defined`);
                    node.status({});
                    return;
                }
                if (!channel) {
                    node.error(`channel ${msg.channelId} is not valid!`);
                    node.status({});
                    return;
                }
            
                const playback = await channel.play({
                    media: this.media2
                });

                playback.on('PlaybackStarted', function (event, completedPlayback) {
                    //console.debug(`${node.type} event playback started event`, event );
                    msg.event = event.type;
                    msg.payload = event;
                    node.send([null, msg]);
                    node.status({ fill: "blue", shape: "dot", text: "playing" });
                });

                playback.on('PlaybackFinished', function (event, completedPlayback) {
                    //console.debug(`${node.type} event playback finished event`, event );
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