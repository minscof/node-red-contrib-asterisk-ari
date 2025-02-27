const { connectionPool } = require("../lib/ari-client");
const { handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    function ari_continueindialplan(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.on('input', function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            const connection = connectionPool.getconn(msg.asteriskId);
            connection.channels.continueInDialplan({ channelId: msg.channelId }, function (err) {
                if (err) {
                    node.error(err);
                    node.status({});
                };
                msg.payload = `continue in dialplan - end application : ${node.application}`;
                node.send(msg);
                node.status({});
            });
        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
        });
    }
    RED.nodes.registerType("ari_continueindialplan", ari_continueindialplan);
};