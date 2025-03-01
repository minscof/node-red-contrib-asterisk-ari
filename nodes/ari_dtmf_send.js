const { connectionPool } = require("../lib/ari-client");

module.exports = function (RED) {
    "use strict";

    function ari_dtmf_send(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.name = n.name || node.type;
        node.status({});

        node.on('input', async function (msg, send, done) {
            try {
                node.status({ fill: "blue", shape: "dot" });
                node.app = msg.app;
                const dtmf = msg.dtmf || '*';

                const connection = connectionPool.getconn(msg.asteriskId);

                await connection.channels.sendDTMF(msg.channelId, dtmf);
                console.debug(`${node.type} channel: ${msg.channelId} - send DTMF ${dtmf}`);
                msg.event = 'SendDTMF';
                msg.dtmf = dtmf;
                send(msg); // Send the message to the next nodes
                node.status({});
                done(); // Signal that processing is complete
            } catch (err) {
                console.error(`${node.type} channel: ${msg.channelId} - Error:`, err);
                node.error(err);
                node.status({ fill: "red", shape: "dot", text: err });
                done(err); // Signal error
            }
        });

        node.on("close", function (done) {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
            done();
        });
    }
    RED.nodes.registerType("ari_sendDTMF", ari_dtmf_send);
}
