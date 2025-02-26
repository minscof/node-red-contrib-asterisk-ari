/**
 * @typedef {import('@ipcom/asterisk-ari').ChannelEvent} ChannelEvent
 */

let AriClient;
let clientReady = (async () => {
    ({ AriClient } = await import('@ipcom/asterisk-ari')); // Import unique
    console.log('✅ AriClient is loaded!');
})();

// Fonction pour créer des clients après l'import
async function createAriClient(config) {
    await clientReady; // Attend que l'import soit terminé
    return new AriClient(config);
}

async function initializeClient(host, port, username, password, secure) {
    console.debug(`Init AriClient for ${host}:${port}`);
    return await createAriClient({ host, port, username, password, secure });
}

function getConnectionByKeyOrId(obj, keyOrId) {
    // Vérifie si keyOrId est une clé existante (URL)
    if (obj[keyOrId]) {
        return obj[keyOrId];
    }
    // Sinon, cherche par id
    return Object.values(obj).find(entry => entry.id === keyOrId);
}

function parseUrl(url) {
    try {
        const parsedUrl = new URL(url); // Utilisation de l'API URL
        return {
            host: parsedUrl.hostname, // Extrait le nom d'hôte
            port: Number(parsedUrl.port) || (parsedUrl.protocol === 'https:' ? 443 : 80) // Définit un port par défaut si absent
        };
    } catch (error) {
        console.error("URL invalide :", error.message);
        return null;
    }
}

module.exports = function (RED) {
    "use strict";

    const connectionPool = (function () {
        const connections = {}; //key = url, value = {id, connection, apps, status: {connected, initializing, error}}
        const channels = {};
        let connectionsCount = 0;
        const obj = {
            setconn: async (url, username, password, app, apps, topics, node) => {
                console.debug(`setconn : url = ${url} - app = ${app} `);
                const existingConnectionInfo = getConnectionByKeyOrId(connections, url);
                
                if (existingConnectionInfo) {
                    if (existingConnectionInfo.status.connected) {
                        console.debug(`connection already exists and connected for ${url}`);
                        node.status({ fill: "green", shape: "dot", text: "connected" });
                        if (existingConnectionInfo.apps.includes(app)) {
                            console.debug(`Connection already established for url: ${url} -> id: ${existingConnectionInfo.id} apps: ${existingConnectionInfo.apps}`);
                        } else {
                            console.debug(`Connection already established for url: ${url} -> id: ${existingConnectionInfo.id} apps: ${existingConnectionInfo.apps} but ${app} is missing`);
                            existingConnectionInfo.apps.push(app);
                        }
                        return existingConnectionInfo.connection;
                    } else if (existingConnectionInfo.status.initializing) {
                        console.debug(`connection initializing for ${url}`);
                        node.status({ fill: "blue", shape: "dot", text: "initializing..." });
                        return existingConnectionInfo.connection;
                    } else if (existingConnectionInfo.status.error) {
                        console.debug(`connection in error for ${url}`);
                        node.status({ fill: "red", shape: "dot", text: "connection error" });
                        return null;
                    }
                }

                console.debug(`connection does not exist for ${url} - creating`);
                node.status({ fill: "blue", shape: "dot", text: "initializing..." });
                const parsedUrl = parseUrl(url);
                if (!parsedUrl) {
                    node.error(`Invalid URL: ${url}`);
                    node.status({ fill: "red", shape: "dot", text: "invalid URL" });
                    return null;
                }

                const client = await initializeClient(parsedUrl.host, parsedUrl.port, username, password, false);
                connections[url] = {
                    url: url,
                    id: null, // will be fill after connection
                    connection: client,
                    apps: apps, // Initialize the apps array
                    status: {
                        connected: false,
                        initializing: true,
                        error: false
                    }
                };
                try {
                    await client.connectWebSocket(apps); // registered application
                    const info = await client.asterisk.get();
                    connections[url].id = info.system.entity_id;
                    connections[url].status.connected = true;
                    connections[url].status.initializing = false;
                    connectionsCount = Object.keys(connections).length;
                    console.debug(`setconn -> url: ${url} id: ${info.system.entity_id} apps: ${apps} registered done`);
                    console.debug(`connections count :`, connectionsCount);
                    node.status({ fill: "green", shape: "dot", text: "connected" });
                    return client;
                } catch (error) {
                    console.error(`Error connecting app ${app} to WebSocket url ${url} :`, error);
                    connections[url].status.connected = false;
                    connections[url].status.initializing = false;
                    connections[url].status.error = true;
                    node.status({ fill: "red", shape: "dot", text: "connection error" });
                    return null;
                }
            },

            getconn: function (key) {
                console.debug(`getconn key: ${key} `);
                const connectionInfo = getConnectionByKeyOrId(connections, key);
                if (!connectionInfo) {
                    console.debug(`connection not found for key ${key} !`)
                    return null;
                }
                
                if (!connectionInfo.status || !connectionInfo.status.connected) {
                    console.debug(`connection not connected for key ${key} !`)
                    return null;
                }
                console.debug(`connection found for key ${key} , url: ${connectionInfo.url} id: ${connectionInfo.id} apps: ${connectionInfo.apps}`)
                const keyCount = Object.keys(connections).length;
                console.debug(`getconn  - count ${keyCount} `);
                return connectionInfo.connection;  // Récupérer une connexion via son ID
            },

            setchan: function (channel) {
                if (channel) {
                    const channelId = channel.id;
                    if (channels[channelId]) {
                        console.debug(`setchan ${channelId} already defined `);
                    } else {
                        console.debug(`setchan ${channelId} new channel `);
                        channels[channelId] = channel;
                    }
                    const keyCount = Object.keys(channels).length;
                    console.debug(`setchan ${channelId} - count ${keyCount} `);
                    return channelId;
                }
                console.debug(`error setchan channel is undefined`);
                return false;
            },

            getchan: function (channelId) {
                return channels[channelId];
            },

            unsetchan: function (channelId) {
                const keyCount = Object.keys(channels).length;
                console.debug(`unsetchan before channel ${channelId} - count ${keyCount}`);
                const result = delete channels[channelId];
                return result;
            },

            deleteClient: async (connectionInfo) => {
                //connectionInfo.connection.closeWebSocket(); //if you want to use it, you need to add it in the lib
                delete connections[connectionInfo.url];
                connectionsCount = Object.keys(connections).length;
                console.debug(`delete connection done: count ${connectionsCount} `);
            }
        };
        return obj;
    }());

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

    function ari_incoming(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.connected = false;
        node.server = RED.nodes.getNode(n.server);
        //get the apps from the server config node
        if (node.server && node.server.credentials && node.server.url && node.server.apps) {
            const apps = node.server.apps.split(',');
            console.debug(`ari_incoming url = ${node.server.url} application = ${n.app_name} apps =`, apps);
            const setcon_promise = connectionPool.setconn(node.server.url, node.server.credentials.username, node.server.credentials.password, n.app_name, apps, n.topics, node);
            console.debug(`ari_incoming ${n.name} app ${n.app_name} initializing...`);
            setcon_promise
                .finally(() => console.debug(`__________cleaning incoming promise`))
                .then(async connection => {
                    console.debug(`__________initialization incoming in progress... `);
                    // Listen for specific events
                    connection.on('StasisStart', event => {
                        console.debug('New channel started:', event.channel.id);
                        const channelInstance = event.instanceChannel;
                        connectionPool.setchan(channelInstance);
                        const detail = Object.fromEntries(
                            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                        );
                        console.debug(`StasisStart before node send ${node.name} for ${channelInstance.id} and asteriskId ${detail.asterisk_id}`);
                        node.send([{ event: 'StasisStart', channelId: channelInstance.id, asteriskId: detail.asterisk_id, payload: detail }, null]);
                        node.status({ fill: "blue", shape: "dot", text: `${detail.channel.caller.number} -> ${detail.channel.state}` });
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

    function ari_answer(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.on('input', async function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            const channel = connectionPool.getchan(msg.payload.channel.id);
            if (!channel) {
                let err = `channel ${msg.payload.channel.id} not found, maybe hangup`;
                node.error(err);
                node.status({});
                return;
            }
            console.debug(`get channelId  = ${channel.id}`);
            try {
                await channel.answer();
            } catch (err) {
                node.error(err);
                node.status({});
                return;
            }
            console.debug(`✅ Call answered channel id: ${channel.id}`);
            msg.event = 'Answered';
            node.send(msg);
            node.status({});
            console.debug(`Answer ended`);
        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
        });
    }
    RED.nodes.registerType("ari_answer", ari_answer);


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


    function ari_bridgedial(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        this.destination = n.destination;
        this.callerId = n.callerId;
        node.on('input', async function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            console.debug(`originate static output endpoint (node)  = ${n.destination} `)
            const destination = msg.payload.destination ?? n.destination;
            console.debug(`originate call endpoint = ${destination} `);
            const callee = destination.includes('/') ? destination.split('/')[1].split('@')[0] : null;
            console.debug(`originate call destination = ${destination} callee = ${callee}`);
            if (!destination) {
                node.error("destination undefined");
                node.status({});
                return;
            };

            const connection = connectionPool.getconn(msg.asteriskId);
            //console.debug(`ari_bridgedial `, connection);
            if (!connection) {
                const err = 'ari_bridgedial ari connection undefined !';
                node.error(err);
                node.status({});
                return;
            }
            console.debug(`asteriskId : ${msg.asteriskId} `);
            const channel = connectionPool.getchan(msg.channelId);
            
            connection.on('BridgeCreated', async event => {
                // event.bridge contains the raw bridge data
                console.log('Bridge  debug created:', event.bridge.id);
            
                // event.instanceBridge provides a ready-to-use BridgeInstance
                const bridgeInstance = event.instanceBridge;
            
                // Direct control through the instance
                //await bridgeInstance.add({ channel: [channel.id, dialed.id] });
            });

            // Create outbound channel
            const dialed = await connection.Channel();
            console.debug(`Channel dialed id: ${dialed.id}`);
/*            const secondChannel = await connection.channels.createChannel({ endpoint: this.destination, app: 'attendant'});
            console.log("🔍 second channel created:", secondChannel);

            const bridgeInfo = await connection.bridges.createBridge({
                type: 'mixing',
                name: 'myBridge debug'
            });
            console.log(`✅ Bridge created id: ${bridgeInfo.id}`);
            const bridge = connection.Bridge(bridgeInfo.id);
*/
          
            channel.on('StasisEnd', async function (event, channel) {
                console.debug(`channel StasisEnd`);
                var msg = {}
                msg.event = "StasisEnd";
                msg.channelId = dialed.id;
                msg.payload = event;
                //bridge.destroy(function (err) { });
                //const remove = await connection.bridges.destroy(bridge.id);
                //console.log(`✅ Bridge destroyed with id: ${bridge.id}`);
                msg.event = 'StasisEnd';
                node.send([null, msg]);                
                node.status({});
            });

            channel.on('ChannelDtmfReceived', function (event, channel) {
                console.debug(`channel ChannelDtmfReceived`);
                var msg = {}
                msg.type = "DTMF";
                msg.channelId = channel.id;
                msg.payload = event;
                node.send([msg, null]);
            });

            channel.on('ChannelStateChange', event => {
                console.log('Channel state changed:', event.channel.state);
            });

            channel.on('ChannelDialplan', event => {
                console.log('Channel ChannelDialplan:', event.channel.state);
            });

            // Listen for specific events
            connection.on('StasisStart', event => {
                console.debug('New channel started:', event.channel.id);
                const channelInstance = event.instanceChannel;
                connectionPool.setchan(channelInstance);
                const detail = Object.fromEntries(
                    Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                );
                
                console.debug(`StasisStart2 before node send ${node.name} for ${channelInstance.id} and asteriskId ${detail.asterisk_id}`);
                node.send([{ event: 'StasisStart', channelId: channelInstance.id, asteriskId: detail.asterisk_id, payload: detail }, null]);
                console.debug(`setconn ended id ${detail.asterisk_id}`);
            });

            connection.on('StasisEnd', event => {
                console.log('Channel2 ended:', event.channel.id);
                connectionPool.unsetchan(event.channel.id);
                const detail = Object.fromEntries(
                    Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                );
                node.send([null, { event: 'StasisEnd', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
            });

            connection.on('ChannelDestroyed', event => {
                console.log('ChannelDestroyed2:', event.channel.id);
                const detail = Object.fromEntries(
                    Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                );
                node.send([null, { event: 'ChannelDestroyed', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
                //node.status({ fill: "blue", shape: "dot", text: detail.cause_status });
                //node.status({ fill: "green", shape: "dot", text: "connected" });
            });

            connection.on('ChannelHangupRequest', event => {
                console.log('ChannelHangupRequest2:', event.channel.id);
                const detail = Object.fromEntries(
                    Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                );
                node.send([null, { event: 'ChannelHangupRequest', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
            });
            
            connection.on('ChannelDialplan', event => {
                console.log('ChannelDialplan2', event.channel.id);
                const detail = Object.fromEntries(
                    Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                );
                node.send([null, { event: 'ChannelDialplan', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
            });

            connection.on('Dial', event => {
                console.log('Dialing:', event.peer.id);
                //console.debug(`Dial event`,event);
                node.send([null, { event: 'Dial', peerId: event.peer.id, asteriskId: event.asterisk_id, payload: event }]);
                node.status({ fill: "blue", shape: "dot", text: `${event.dialstatus} -> ${event.dialstring}` });
            });

            connection.on('BridgeDestroyed', event => {
                console.log('BridgeDestroyed2:', event.bridge.id);
                const detail = Object.fromEntries(
                    Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                );
                node.send([null, { event: 'BridgeDestroyed', bridgeId: event.bridge.id, asteriskId: detail.asterisk_id, payload: detail }]);
            });

            connection.on('PeerStatusChange', event => {
                console.log('PeerStatusChange2:', event);
                const detail = Object.fromEntries(
                    Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                );
                node.send([null, { event: 'PeerStatusChange', endpoint: '?', asteriskId: detail.asterisk_id, payload: detail }]);
            });





            console.log("📞 Trying to call...");
            /*
            await dialed.originate({ endpoint: this.destination, callerId: this.callerId, app: bridge.id, appArgs: 'dialed' }, function (err, response) {
                if (err) { throw err; };
                if (response) {
                    console.debug(`dialed originate`);
                    console.debug(`Bridgedial bridge:`,bridge);


                    // Monitor channel events in bridge
                    bridge.on('ChannelEnteredBridge', event => {
                        console.log('Channel entered bridge:', event.channel.id);
                    });
                    
                    bridge.on('ChannelLeftBridge', event => {
                        console.log('Channel left bridge:', event.channel.id);
                    });

                    bridge.on('BridgeMerged', event => {
                        console.log('Bridge merged:', event.bridge.id);
                    });

                }
                
            });
            */
            

            console.log("🔄 Setting up call...");

            await dialed.originate({ 
                endpoint: this.destination, 
                callerId: this.callerId, 
                app: 'attendant',  //TODO attendant is hardcoded !
                appArgs: 'dialed' 
            });

            console.log("📞 After trying to call...");

/*
            // add channels to bridge
            await bridge.add({ channel: [channel.id, secondChannel.id] });
            //console.log("🔍 Bridge channels added:", bridge);
            
*/
                   
        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
        });
    }
    RED.nodes.registerType("ari_bridgedial", ari_bridgedial);

    function ari_originate(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.connected = false;
        node.server = RED.nodes.getNode(n.server);
        if (node.server && node.server.credentials && node.server.url && node.server.apps) {
            const apps = node.server.apps.split(',');
            console.debug(`ari_originate url = ${node.server.url} application = ${n.app_name} apps =`, apps);
            //const setcon_promise = connectionPool.setconn(node.server.url, node.server.credentials.username, node.server.credentials.password, n.app_name, apps, n.topics, node);
            //console.debug(`ari_incoming_originate_node topics =  ${n.topics}`);
            this.destination = n.destination;
            this.callerId = n.callerId;

            node.status({ fill: "blue", shape: "dot" });

            const setcon_promise_originate = connectionPool.setconn(node.server.url, node.server.credentials.username, node.server.credentials.password, n.app_name, apps, n.topics, node);
            console.debug(`ari_originate ${n.name} app ${n.app_name} initializing...`);
            setcon_promise_originate// se lance quand la promesse est acquittée, peu importe si celle-ci est tenue ou rompue
                .finally(() => console.debug(`__________cleaning originate promise`))
                // donc l'indicateur de chargement est toujours arrêté avant de continuer
                .then(async connection => {
                    console.debug(`__________promise originate success`);
                    node.status({ fill: "green", shape: "dot", text: "connected" });


                    connection.on('ChannelDestroyed', event => {
                        console.log('ChannelDestroyed:', event.channel.id);
                        const detail = Object.fromEntries(
                            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                        );
                        node.send([null, { event: 'ChannelDestroyed', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
                        node.status({ fill: "blue", shape: "dot", text: detail.cause_status });
                        node.status({ fill: "green", shape: "dot", text: "connected" });
                    });

                    connection.on('ChannelHangupRequest', event => {
                        console.log('ChannelHangupRequest:', event.channel.id);
                        const detail = Object.fromEntries(
                            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                        );
                        node.send([null, { event: 'ChannelHangupRequest', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
                    });

                    connection.on('ChannelDialplan', event => {
                        console.log('ChannelDialplan', event.channel.id);
                        const detail = Object.fromEntries(
                            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                        );
                        node.send([null, { event: 'ChannelDialplan', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
                    });

                    connection.on('Dial', event => {
                        console.log('Dialing:', event.peer.id);
                        //console.debug(`Dial event`,event);
                        node.send([null, { event: 'Dial', peerId: event.peer.id, asteriskId: event.asterisk_id, payload: event }]);
                        node.status({ fill: "blue", shape: "dot", text: event.dialstatus });
                    });
                }, err => console.debug(`__________promise originate failed ${err}`));

            node.on('input', async function (msg) {
                console.debug(`originate static output endpoint (node)  = ${n.destination} `)
                let destination = msg.payload.destination ?? n.destination;
                console.debug(`originate call endpoint = ${destination} `);
                let callee = destination.includes('/') ? destination.split('/')[1].split('@')[0] : null;
                console.debug(`originate call destination = ${destination} callee = ${callee}`);
                if (!destination) {
                    node.error("destination undefined");
                    node.status({});
                    return;
                };
                console.log("📞 Trying to call...");

                // Create a channel instance
                const connection = connectionPool.getconn(node.server.url)
                const channel = connection.Channel();
                console.log('Channel created:', channel.id);

                // Originate a call

                await channel.originate({
                    endpoint: destination,
                    app: n.app_name
                });

                console.debug(`Originate : call done...`);

                /*
                                    cliant.channels.originate({
                                        endpoint: destination,
                                        callerId: n.callerId, // Numéro affiché
                                        app: n.app_name
                                    })
                                        .then(channel => {
                                            console.log(`📞 Appel en cours vers ${callee}...`);
                                            return channel;
                                        })
                                        .catch(err => {
                                            console.error(`❌ Erreur lors de l'initialisation de l'appel :`, err.message || err);
                                        });
                                        */


            });

            this.on("close", function () {
                // Called when the node is shutdown - eg on redeploy.
                // Allows ports to be closed, connections dropped etc.
                // eg: node.cliant.disconnect();
            });
        } else {
            console.debug(`ari_originate : config node undefined `);
            node.error(`config node undefined`);
        }

    }
    RED.nodes.registerType("ari_originate", ari_originate);
}