const { connectionPool } = require("../lib/ari-client");
const { handleStasisStartEvent,handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    function ari_originate(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.connected = false;
        node.server = RED.nodes.getNode(n.server);
        node.destination = n.destination;
        node.callerId = n.callerId;
/*
        // Helper function to handle common channel events
        function handleChannelEvent(node, event, eventName, channelId) {
            const detail = Object.fromEntries(
                Object.entries(event).filter(([key]) => key !== 'instanceChannel')
            );
            const msg = { event: eventName, channelId: channelId, asteriskId: detail.asterisk_id, payload: detail };
            console.debug(`${eventName} : ${channelId} detail :`, detail);
            node.send([null, msg]);
        }

        // Helper function to handle common event
        function handleEvent(node, event, eventName) {
            const detail = Object.fromEntries(
                Object.entries(event).filter(([key]) => key !== 'instanceChannel')
            );
            const msg = { event: eventName, asteriskId: detail.asterisk_id, payload: detail };
            console.debug(`${eventName} detail :`, detail);
            node.send([null, msg]);
        }
*/
        async function initializeConnection() {
            if (node.server && node.server.credentials && node.server.apps) {
                const apps = node.server.credentials.apps.split(',');
                console.debug(`ari_originate url = ${node.server.credentials.url} application = ${n.app_name} apps =`, apps);
                const setcon_promise_originate = connectionPool.setconn(node.server.credentials.url, node.server.credentials.username, node.server.credentials.password, n.app_name, apps, n.topics, node);
                console.debug(`ari_originate ${n.name} app ${n.app_name} initializing...`);
                try {
                    const connection = await setcon_promise_originate;
                    console.debug(`__________promise originate success`);
                    node.status({ fill: "green", shape: "dot", text: "connected" });
                    connection.on('StasisStart', event => {
                        console.debug(`application : ${event.application} app_name ${n.app_name}`);
                        if (event.application == n.app_name) {
                            handleStasisStartEvent(node, event, 'StasisStart', event.channel.id);
                        }
                    });
                    connection.on('StasisEnd', event => {
                        console.log('Channel ended:', event.channel.id);
                        connectionPool.unsetchan(event.channel.id);
                        handleChannelEvent(node, event, 'StasisEnd', event.channel.id)
                        node.status({ fill: "green", shape: "dot", text: "connected" });
                    });

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
                    app: n.app_name,
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