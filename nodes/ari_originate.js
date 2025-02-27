const { connectionPool } = require("../lib/ari-client");
const { handleStasisStartEvent, handleStasisEndEvent, handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    "use strict";

    function ari_originate(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.connected = false;
        node.server = RED.nodes.getNode(n.server);
        node.destination = n.destination;
        node.callerId = n.callerId;

        async function initializeConnection() {
            if (node.server && node.server.credentials && node.server.apps) {
                const apps = node.server.apps.split(',');
                console.debug(`ari_originate url = ${node.server.credentials.url} app: ${n.app} apps: `, apps);
                const setcon_promise_originate = connectionPool.setconn(node.server.credentials.url, node.server.credentials.username, node.server.credentials.password, n.app, apps, n.topics, node);
                console.debug(`ari_originate ${n.name} app: ${n.app} initializing...`);
                try {
                    const connection = await setcon_promise_originate;
                    console.debug(`__________promise originate success app: ${n.app}`);
                    node.status({ fill: "green", shape: "dot", text: "connected" });
                    connection.on('StasisStart', event => handleStasisStartEvent(node, n.app, event, 'StasisStart', event.channel.id));

                    connection.on('StasisEnd', event => handleStasisEndEvent(node, n.app, event, 'StasisEnd', event.channel.id));

                    connection.on('ChannelDestroyed', event => handleChannelEvent(node, event, 'ChannelDestroyed', event.channel.id));
                    connection.on('ChannelHangupRequest', event => handleChannelEvent(node, event, 'ChannelHangupRequest', event.channel.id));
                    connection.on('ChannelDialplan', event => handleChannelEvent(node, event, 'ChannelDialplan', event.channel.id));
                    connection.on('Dial', event => handleEvent(node, event, 'Dial'));

                    return connection;
                } catch (err) {
                    console.error(`__________promise originate failed ${err}`);
                    node.error(err);
                    node.status({ fill: "red", shape: "dot", text: "error" });
                    return null;
                }
            } else {
                console.debug(`ari_originate : config node undefined `);
                node.error(`config node undefined`);
                node.status({ fill: "red", shape: "dot", text: "config undefined" });
                return null;
            }
        }

        const connectionPromise = initializeConnection();

        node.on('input', async function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            try {
                let destination = msg.payload?.destination ?? node.destination; // Use optional chaining and nullish coalescing
                console.debug(`originate call endpoint = ${destination} `);
                if (!destination) {
                    node.error("destination undefined");
                    node.status({ fill: "red", shape: "dot", text: "destination undefined" });
                    return;
                }

                const connection = await connectionPromise;
                if (!connection) {
                    node.error("No connection available");
                    node.status({ fill: "red", shape: "dot", text: "connection failed" });
                    return;
                }
                const channel = connection.Channel();
                if(!channel){
                    node.error("No channel available");
                    node.status({ fill: "red", shape: "dot", text: "channel failed" });
                    return;
                }
                console.log('Channel created:', channel.id);
                console.log("📞 Trying to call...");
                await channel.originate({
                    endpoint: destination,
                    app: n.app,
                    callerId: node.callerId
                });

                console.debug(`Originate : call done...`);
                node.status({});
            } catch (err) {
                console.error(`Error during originate call:`, err);
                node.error(err);
                node.status({ fill: "red", shape: "dot", text: "call failed" });
            }
        });

        this.on("close", async function (done) {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
            done();
        });
    }
    RED.nodes.registerType("ari_originate", ari_originate);
}