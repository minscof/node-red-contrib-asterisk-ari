const { connectionPool, getConnectionByKeyOrId } = require("../lib/ari-client");
const { handleStasisStartEvent, handleStasisEndEvent, handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    "use strict";

    function ari_incoming(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.connected = false;
        node.server = RED.nodes.getNode(n.server);
        //get the apps from the server config node
        if (node.server && node.server.credentials && node.server.url && node.server.apps) {
            const apps = node.server.apps.split(',');
            console.debug(`ari_incoming url = ${node.server.url} application = ${n.app} apps:`, apps);
            const setcon_promise = connectionPool.setconn(node.server.url, node.server.credentials.username, node.server.credentials.password, n.app, apps, n.topics, node);
            console.debug(`ari_incoming ${n.name} app: ${n.app} initializing...`);
            setcon_promise
                .finally(() => console.debug(`__________cleaning incoming promise`))
                .then(async connection => {
                    console.debug(`__________initialization incoming in progress... `);
                    // Listen for specific events
                    connection.on('StasisStart', event => handleStasisStartEvent(node, n.app, event, 'StasisStart', event.channel.id));

                    connection.on('StasisEnd', event => handleStasisEndEvent(node, n.app, event, 'StasisEnd', event.channel.id));
                        /*{
                        console.log('Channel ended:', event.channel.id);
                        connectionPool.unsetchan(event.channel.id);
                        handleChannelEvent(node, event, 'StasisEnd', event.channel.id)
                        node.status({ fill: "green", shape: "dot", text: "connected" });
                    });
                    */
                    connection.on('ChannelDestroyed', event => handleChannelEvent(node, event, 'ChannelDestroyed', event.channel.id));
                    connection.on('ChannelHangupRequest', event => handleChannelEvent(node, event, 'ChannelHangupRequest', event.channel.id));
                    connection.on('ChannelDialplan', event => handleChannelEvent(node, event, 'ChannelDialplan', event.channel.id));
                    connection.on('Dial', event => handleEvent(node, event, 'Dial'));
                    connection.on('BridgeDestroyed', event => handleEvent(node, event, 'BridgeDestroyed'));
                    connection.on('PeerStatusChange', event => handleEvent(node, event, 'PeerStatusChange'));
                    console.debug(`__________initialization incoming done`);
                },
                    err => {
                        console.debug(`__________initialization failed ${err}`);
                        node.error(err);
                        node.status({});
                    });

            node.on('close', function (done) {
                const connectionInfo = getConnectionByKeyOrId(connections, node.server.url);
                if (connectionInfo) {
                    connectionPool.deleteClient(connectionInfo);
                } else {
                    console.warn(`closing node ${node.name}, connection not found !`);
                }
                done();
            });
        } else {
            if (!node.server) console.debug(`ari_incoming : node.server undefined `);
            if (!node.server.credentials) console.debug(`ari_incoming : node.server.credentials undefined `);
            if (!node.server.url) console.debug(`ari_incoming : node.server.url undefined `);
            if (!node.server.apps) console.debug(`ari_incoming : node.server.apps undefined `);
            
            console.debug(`ari_incoming : config node undefined `);
            node.error(`config node undefined`);
        }
    }
    RED.nodes.registerType("ari_incoming", ari_incoming);

    //deprecated
    RED.nodes.registerType("ari_client", ari_incoming);

}