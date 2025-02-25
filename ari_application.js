/**
 * @typedef {import('@ipcom/asterisk-ari').ChannelEvent} ChannelEvent
 */


let client;
(async () => {
    const { AriClient } = await import('@ipcom/asterisk-ari');
})();

const clientPromises = {}; // Stocke les promesses des clients

async function initializeClient(host, port, username, password, secure) {
    const key = `${host}:${port}`; // Identifiant unique du client

    if (!clientPromises[key]) {
        clientPromises[key] = (async () => {
            const { AriClient } = await import('@ipcom/asterisk-ari');
            return new AriClient({ host, port, username, password, secure });
        })();
    }

    return clientPromises[key]; // Retourne la promesse stockée
}

function getConnectionByKeyOrId(obj, keyOrId) {
    // Vérifie si keyOrId est une clé existante (URL)
    if (obj[keyOrId]) {
        //console.debug(`key ${keyOrId} found in obj , url ?`);
        //console.debug(`dump obj `,obj);
        return {url: obj[keyOrId].url, id: obj[keyOrId].id, connection: obj[keyOrId].connection, apps: obj[keyOrId].apps};
    }

    // Sinon, cherche par id
    //console.debug(`debug getConnection by ${keyOrId} `, Object.values(obj));
    return {url: Object.values(obj).find(entry => entry.id === keyOrId)?.url, id: keyOrId, connection: Object.values(obj).find(entry => entry.id === keyOrId)?.connection, apps: Object.values(obj).find(entry => entry.id === keyOrId)?.apps};
}

function parseUrl(url) {
    try {
        const parsedUrl = new URL(url); // Utilisation de l'API URL
        return {
            host: parsedUrl.hostname, // Extrait le nom d'hôte
            port: Number(parsedUrl.port) || (parsedUrl.protocol === 'https:' ? 443 : 80 ) // Définit un port par défaut si absent
        };
    } catch (error) {
        console.error("URL invalide :", error.message);
        return null;
    }
}

module.exports = function (RED) {
    "use strict";

    var connectionPool = (function () {
        var connections = {};
        connections['http://toto'] = {id:'zut', connection:45};
        var channels = {};
        var obj = {
            setconn: async (url, username, password, app, topics, node) => {
                console.debug(`setconn : url = ${url} - app = ${app}`);
                const tutu = getConnectionByKeyOrId(connections, url);
                if (tutu.connection) {
                    console.debug(`Connection already established for url: ${url} -> id: ${tutu.id} apps: ${tutu.apps}`);
                    node.status({ fill: "green", shape: "dot", text: "connected" });
                    return tutu.connection;
                }
                if (!client) {
                    console.debug(`client is undefined !`);
                    const msg = {payload: 'initializing'};
                    node.send([ null, msg ]);
                    node.status({ fill: "blue", shape: "dot", text: "initializing..." });
                }
                client = await initializeClient(parseUrl(url).host, parseUrl(url).port, username, password, false);
                try {
                    await client.connectWebSocket([app]); // registered application
                    const info = await client.asterisk.get();
                    //connections[info.system.entity_id] = client;
                    connections[url] = {url: url, id: info.system.entity_id, connection: client, apps: [app] };
                    console.debug(`setconn -> url: ${url} id: ${info.system.entity_id} apps: ${app} registered done`);
                    console.debug(`connections count :`, Object.keys(connections).length);
                    // Listen for specific events
                    /*
                    client.on('StasisStart', event => {
                        console.debug('New channel started:', event.channel.id);
                        const channelInstance = event.instanceChannel;
                        connectionPool.setchan(channelInstance);
                        const detail = Object.fromEntries(
                            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                        );
                        
                        console.debug(`StasisStart before node send ${node.name} for ${channelInstance.id} and asteriskId ${detail.asterisk_id}`);
                        node.send([{ event: 'StasisStart', channelId: channelInstance.id, asteriskId: detail.asterisk_id, payload: detail }, null]);
                        console.debug(`setconn ended id ${detail.asterisk_id}`);
                    });
                    */


                    /*
                    client.on('ChannelDestroyed', event => {
                        console.log('ChannelDestroyed:', event.channel.id);
                        const detail = Object.fromEntries(
                            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                        );
                        node.send([null, { event: 'ChannelDestroyed', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
                        node.status({ fill: "blue", shape: "dot", text: detail.cause_status });
                        node.status({ fill: "green", shape: "dot", text: "connected" });
                    });

                    client.on('ChannelHangupRequest', event => {
                        console.log('ChannelHangupRequest:', event.channel.id);
                        const detail = Object.fromEntries(
                            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                        );
                        node.send([null, { event: 'ChannelHangupRequest', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
                    });
                    
                    client.on('ChannelDialplan', event => {
                        console.log('ChannelDialplan', event.channel.id);
                        const detail = Object.fromEntries(
                            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                        );
                        node.send([null, { event: 'ChannelDialplan', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
                    });

                    client.on('Dial', event => {
                        console.log('Dialing:', event.peer.id);
                        //console.debug(`Dial event`,event);
                        node.send([null, { event: 'Dial', peerId: event.peer.id, asteriskId: event.asterisk_id, payload: event }]);
                        node.status({ fill: "blue", shape: "dot", text: event.dialstatus });
                    });
                    */

                } catch (error) {
                    console.error(`Error connecting app ${app} to WebSocket:`, error);
                    return;
                }
                return client;           
            },

            getconn: function (key) {
                console.debug(`getconn key: ${key} `);
                const tutu = getConnectionByKeyOrId(connections, key);
                if (!tutu.connection) {
                    console.debug(`connection not found for key ${key} ? !`)
                } else {
                    console.debug(`connection found for key ${key} , url: ${tutu.url} id: ${tutu.id} apps: ${tutu.apps}`)
                }
                const keyCount = Object.keys(connections).length;
                console.debug(`getconn  - count ${keyCount} `);
                return tutu.connection;  // Récupérer une connexion via son ID
            },
            /* to delete
            close: function(connection) {
                connection._nodeCount -= 1;
                if (connection._nodeCount === 0) {
                    delete connections[connection._id];
                }
            },
            */

            setchan: function (channel) {
                if (channel) {
                    var channelId = channel.id;
                    if (channelId in channels) {
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

            unsetchan: function(channelId) {
                let keyCount = Object.keys(channels).length;
                console.debug(`unsetchan before channel ${channelId} - count ${keyCount}`);
                return delete channels[channelId];
            }
        };
        //console.debug(`initialize the singleton when nodered start or at first installation of ths module.`);
        return obj;
    }());


    function clientLoaded(ari, app, topics, node, asteriskId) {
        node.status({ fill: "green", shape: "dot", text: "connected" });
        //console.debug(`topics debug ${topics}`);
        //console.log("topics2 =: %o", topics);
        // Conversion des topics en tableau
        /*
        const topicsTab = (topics || "").split(',').map(topic => topic.trim());
        console.debug(`topicsTab debug ${topicsTab}`);
        console.debug("topicsTab debug2 %o",topicsTab);
        */
        // Liste des callbacks disponibles
        /*
        const eventCallbacks = {
            'StasisStart': _stasisStart,
            'StasisEnd': _stasisEnd,
            'ChannelDtmfReceived': _channelDtmfReceived,
            'ChannelHangupRequest': _channelHangupRequest
        };
        */
        // Activation des callbacks uniquement pour les événements listés
        /*
        topics.forEach(event => {
            if (eventCallbacks[event]) {
                console.debug(`activate event ${event}`);
                cliant.on(event, eventCallbacks[event]);
            }
        });
        */

        // Fonction pour rechercher le callback correspondant dans le scope local
        function _findCallback(event) {
            const formattedEvent = event.charAt(0).toLowerCase() + event.slice(1);
            const callbackName = `_${formattedEvent}`;
            try {
                return eval(callbackName);
            } catch (e) {
                return undefined;
            }
        }

        topics.forEach(event => {
            // calculate callbacks dynamically with first letter in lowercase
            const formattedEvent = event.charAt(0).toLowerCase() + event.slice(1);
            const callbackName = `_${formattedEvent}`;

            const callback = _findCallback(event);

            if (typeof callback === 'function') {
                //console.debug(`activate event ${event} for node ${node.name}`);
                cliant.on(event, callback);
            } else {
                console.debug(`❌ function ${callbackName} not yet implemented for node ${node.name}...`);
            }
        });


        /*
        "subTypes": [
        "DeviceStateChanged",
        "PlaybackStarted",
        "PlaybackContinuing",
        "PlaybackFinished",
        "RecordingStarted",
        "RecordingFinished",
        "RecordingFailed",
        "ApplicationMoveFailed",
        "ApplicationReplaced",
        "BridgeCreated",
        "BridgeDestroyed",
        "BridgeMerged",
        "BridgeBlindTransfer",
        "BridgeAttendedTransfer",
        "BridgeVideoSourceChanged",
        "ChannelCreated",
        "ChannelDestroyed",
        "ChannelEnteredBridge",
        "ChannelLeftBridge",
        "ChannelStateChange",
        "ChannelDtmfReceived",
        "ChannelDialplan",
        "ChannelCallerId",
        "ChannelUserevent",
        "ChannelHangupRequest",
        "ChannelVarset",
        "ChannelToneDetected",
        "ChannelTalkingStarted",
        "ChannelTalkingFinished",
        "ChannelHold",
        "ChannelUnhold",
        "ContactStatusChange",
        "EndpointStateChange",
        "Dial",
        "StasisEnd",
        "StasisStart",
        "TextMessageReceived",
        "ChannelConnectedLine",
        "PeerStatusChange"
        */

        function _stasisStart(event, channel) {
            console.log(`StasisStart event for ${channel.id}`);
            //_stasisStart(event, channel) {
            var dialed = event.args[0] === 'dialed';
            if (!dialed) {
                console.log(`StasisStart deprecated before node send ${node.name} for ${channel.id} and asteriskId ${asteriskId}`);
                node.send([{ event: 'StasisStart', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);

            } else {
                console.log(`StasisStart event dialed ${event.args[0]} for ${channel.id}`);
            }
        }

        function _stasisEnd(event, channel) {
            console.log(`StasisEnd event for ${channel.id}`);
            node.send([{ event: 'StasisEnd', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _deviceStateChanged(event, channel) {
            node.send([{ event: 'DeviceStateChanged', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _endpointStateChange(event, channel) {
            node.send([{ event: 'EndpointStateChange', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelConnectedLine(event, channel) {
            node.send([{ event: 'ChannelConnectedLine', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _contactStatusChange(event, channel) {
            node.send([{ event: 'ContactStatusChange', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _applicationMoveFailed(event, channel) {
            node.send([{ event: 'ApplicationMoveFailed', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _applicationReplaced(event, channel) {
            node.send([{ event: 'ApplicationReplaced', asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelCreated(event, channel) {
            node.send([{ event: 'ChannelCreated', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelEnteredBridge(event, channel) {
            node.send([{ event: 'ChannelEnteredBridge', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelLeftBridge(event, channel) {
            node.send([{ event: 'ChannelLeftBridge', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelStateChange(event, channel) {
            if (event.channel.state = 'Ringing') {
                console.log("📞 ringing...");
            }
            node.send([{ event: 'ChannelStateChange', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelDtmfReceived(event, channel) {
            node.send([{ event: 'ChannelDtmfReceived', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelDialplan(event, channel) {
            node.send([{ event: 'ChannelDialplan', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelCallerId(event, channel) {
            node.send([{ event: 'ChannelCallerId', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelUserevent(event, channel) {
            node.send([{ event: 'ChannelUserevent', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelHangupRequest(event, channel) {
            //node.send({ payload: { event: 'ChannelHangupRequest', channelId: channel, details: event } });
            console.log(`📞 Appel raccroché - Raison : ${event.cause_txt} (Code: ${event.cause})`);

            if (event.cause === 21) {
                console.log("❌ Le correspondant a refusé l'appel !");
            }
            node.send([{ event: 'ChannelHangupRequest', channelId: channel.id, asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelDestroyed(event, channel) {
            let channelId = channel.id;
            node.send([{ event: 'ChannelDestroyed', channelId: channel.id, asteriskId: asteriskId, payload: event }, null]);
            console.debug(`_channelDestroyed : unsetchan ${channelId}...`);
            connectionPool.unsetchan(channelId);
        }

        function _channelToneDetected(event, channel) {
            node.send([{ event: 'ChannelToneDetected', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelTalkingStarted(event, channel) {
            node.send([{ event: 'ChannelTalkingStarted', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelTalkingFinished(event, channel) {
            node.send([{ event: 'ChannelTalkingFinished', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelHold(event, channel) {
            node.send([{ event: 'ChannelHold', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelUnhold(event, channel) {
            node.send([{ event: 'ChannelUnhold', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _channelVarset(event, channel) {
            node.send([{ event: 'ChannelVarset', channelId: channel.id, asteriskId: asteriskId, payload: event }, null]);
        }

        function _contactStatusChange(event) {
            node.send([{ event: 'ContactStatusChange', asteriskId: asteriskId, payload: event }, null]);
        }

        function _bridgeCreated(event) {
            node.send([{ event: 'BridgeCreated', asteriskId: asteriskId, payload: event }, null]);
        }

        function _bridgeDestroyed(event) {
            node.send([{ event: 'BridgeDestroyed', asteriskId: asteriskId, payload: event }, null]);
        }

        function _bridgeEnter(event) {
            node.send([{ event: 'BridgeEnter', asteriskId: asteriskId, payload: event }, null]);
        }

        function _bridgeLeave(event) {
            node.send([{ event: 'BridgeLeave', asteriskId: asteriskId, payload: event }, null]);
        }

        function _bridgeMerged(event) {
            node.send([{ event: 'BridgeMerged', asteriskId: asteriskId, payload: event }, null]);
        }

        function _bridgeBlindTransfer(event,channel) {
            node.send([{ event: 'BridgeBlindTransfer', channelId: connectionPool.setchan(channel), asteriskId: asteriskId, payload: event }, null]);
        }

        function _bridgeAttendedTransfer(event) {
            node.send([{ event: 'BridgeAttendedTransfer', asteriskId: asteriskId, payload: event }, null]);
        }

        function _bridgeVideoSourceChanged(event) {
            node.send([{ event: 'BridgeVideoSourceChanged', asteriskId: asteriskId, payload: event }, null]);
        }

        function _dial(event) {
            node.send([{ event: 'Dial', asteriskId: asteriskId, payload: event }, null]);
        }

        function _peerStatusChange(event) {
            node.send([{ event: 'PeerStatusChange', asteriskId: asteriskId, payload: event }, null]);
        }

        function _playbackStarted(event) {
            node.send([{ event: 'PlaybackStarted', asteriskId: asteriskId, payload: event }, null]);
        }

        function _playbackFinished(event) {
            node.send([{ event: 'PlaybackFinished', asteriskId: asteriskId, payload: event }, null]);
        }

        function _playbackContinuing(event) {
            node.send([{ event: 'PlaybackContinuing', asteriskId: asteriskId, payload: event }, null]);
        }

        function _recordingStarted(event) {
            node.send([{ event: 'RecordingStarted', asteriskId: asteriskId, payload: event }, null]);
        }

        function _recordingFinished(event) {
            node.send([{ event: 'RecordingFinished', asteriskId: asteriskId, payload: event }, null]);
        }

        function _recordingFailed(event) {
            node.send([{ event: 'RecordingFailed',  asteriskId: asteriskId, payload: event }, null]);
        }

        function _textMessageReceived(event) {
            node.send([{ event: 'TextMessageReceived', asteriskId: asteriskId, payload: event }, null]);
        }
        /*
        _close_app() {
            console.log(`Closing App ${this.app_name} on ${this.asterisk_cliant.url}`);
            this.asterisk_cliant.cliant.stop(this.app_name)
                .then(() => {
                    console.log(`Stopped App ${this.app_name} on ${this.asterisk_cliant.url}`);
                    node.status({ fill: "red", shape: "dot", text: `${this.app_name} on ${this.asterisk_cliant.url}` });
                    this.started = false;
                })
                .catch(err => console.error(err));
        }
        */

        cliant.start(app);

    }

    function ari_incoming(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        this.connected = false;
        this.server = RED.nodes.getNode(n.server);
        console.debug(`ari_incoming url = ${this.server.credentials.url} application = ${n.app_name}`);
        //console.debug(`ari_incoming topics =  ${n.topics}`);
        const setcon_promise = connectionPool.setconn(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, n.app_name, n.topics, this);
        console.debug(`ari_incoming ${n.name} app ${n.app_name} initializing...`);
        setcon_promise// se lance quand la promesse est acquittée, peu importe si celle-ci est tenue ou rompue
            .finally(() => console.debug(`__________nettoyage de la promesse`))
            // donc l'indicateur de chargement est toujours arrêté avant de continuer
            .then(async connection => {
                console.debug(`__________initialization in progress... `);

                node.status({ fill: "green", shape: "dot", text: "connected" });
                    
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

                client.on('StasisEnd', event => {
                    console.log('Channel ended:', event.channel.id);
                    connectionPool.unsetchan(event.channel.id);
                    const detail = Object.fromEntries(
                        Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                    );
                    node.send([null, { event: 'StasisEnd', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
                    node.status({ fill: "green", shape: "dot", text: "connected" });
                });

            },
             err => {
                console.debug(`__________initialization failed ${err}`);
                node.error(err);
                node.status({});
            });

    }
    RED.nodes.registerType("ari_incoming", ari_incoming);

    //deprecated
    RED.nodes.registerType("ari_client", ari_incoming);


    function ari_playback(n) {
        RED.nodes.createNode(this, n);
        var node = this;
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
            try {
                const playback = await channel.play({
                    media: this.media2
                });

                playback.on('PlaybackStarted', function (event, completedPlayback) {
                    //console.debug(`event playback started event`, event );
                    msg.event = event.type;
                    msg.payload = event;
                    node.send([null,msg]);
                    node.status({});
                });
                
                playback.on('PlaybackFinished', function (event, completedPlayback) {
                    //console.debug(`event playback finished event`, event );
                    msg.event = event.type;
                    msg.payload = event;
                    node.send([msg,null]);
                    node.status({});
                });
            } catch (err) {
                node.error(err);
                node.status({});
                return;
            }
        });

        this.on("close", function () {
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
/*            const secondChannel = await client.channels.createChannel({ endpoint: this.destination, app: 'attendant'});
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
                app: 'attendant', 
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
        this.connected = false;
        this.server = RED.nodes.getNode(n.server);
        console.debug(`ari_incoming_originate_node url = ${this.server.credentials.url} application = ${n.app_name}`);
        //console.debug(`ari_incoming_originate_node topics =  ${n.topics}`);
        this.destination = n.destination;
        this.callerId = n.callerId;
        node.on('input', function (msg) {
            node.status({ fill: "blue", shape: "dot" });

            let setcon_promise_originate = connectionPool.setconn(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, n.app_name, n.topics, this);
            console.debug(`end ari_originate_node ${n.name} app ${n.app_name} `);
            setcon_promise_originate// se lance quand la promesse est acquittée, peu importe si celle-ci est tenue ou rompue
                .finally(() => console.debug(`__________nettoyage de la promesse originate`))
                // donc l'indicateur de chargement est toujours arrêté avant de continuer
                .then(async connection => {
                    console.debug(`__________promise originate success`);
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
                    //todo
                    const channel = client.Channel();
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


                }, err => console.debug(`__________promesse originate rompue ${err}`));

        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
        });

    }
    RED.nodes.registerType("ari_originate", ari_originate);
}