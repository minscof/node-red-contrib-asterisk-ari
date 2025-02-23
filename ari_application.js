var client = require('ari-client');

module.exports = function (RED) {
    "use strict";

    var stasis_apps = {};

    var connectionPool = (function () {
        var connections = {};
        var channels = {};
        var obj = {
            setconn: function (url, username, password, app, topics, node) {

                return new Promise((resolve, reject) => {

                    function connectToAsterisk() {
                        console.log(`Try to connect node ${node.name} to Asterisk...`);
                        try {
                            client.connect(url, username, password, function (err, ari) {
                                if (err) {
                                    console.error(`Connection failed for node ${node.name} to Asterisk : err= ${err.message}`);
                                    node.error(err);
                                    console.error(`Connection failed user ${username}  password ${password} error ${err}`);
                                    node.status({ fill: "red", shape: "dot", text: "disconnected" });
                                    node.connected = false;
                                } else {
                                    console.log(`Connection success for node ${node.name} to Asterisk.`);
                                    node.connected = true;

                                    // Stoppe les tentatives de reconnexion
                                    console.log(`Cancel retry connect node ${node.name} to Asterisk ${retryIntervalId}!`);
                                    //clearInterval(retryInterval);
                                    clearInterval(retryIntervalId);

                                    // Appelle la fonction principale

                                    function _checkConnection(ari) {
                                        console.debug(`Start checkConnection for node ${node.name} every 4000 ms`);
                                        ari.asterisk.ping((err, info) => {
                                            if (err) {
                                                console.error(`Ping failed for connection node ${node.name}`);
                                                node.status({ fill: "red", shape: "dot", text: "disconnected" });
                                                node.connected = false;
                                            } else {
                                                console.debug(`Pong for app ${app} and nodeId ${node.id} name ${node.name} `);
                                                node.status({ fill: "green", shape: "dot", text: "connected" });
                                                node.connected = true;
                                                console.debug(`Cancel _checkConnection to Asterisk ${retryIntervalId} for ${node.name}!`);
                                                clearInterval(retryIntervalId);
                                            };
                                        });
                                    };

                                    ari.on('WebSocketMaxRetries', (err) => {
                                        console.log(`WebSocketMaxRetries node ${node.name} err ${err}..`);
                                        node.connected = false;
                                        node.error(err);
                                        node.status({ fill: "red", shape: "dot", text: "disconnected" });
                                        /*
                                        retryIntervalId = setInterval(function ()clientLoaded {
                                            _checkConnection(ari);
                                        }, 4000);
                                        */
                                        retryIntervalId = setInterval(connectToAsterisk, 4000);
                                        console.debug(`setInterval Bis retryIntervalId = ${retryIntervalId}`);
                                    });

                                    ari.asterisk.getInfo((err, info) => {
                                        if (err || !info.system || !info.system.entity_id) {
                                            console.error(`Impossible d'obtenir l'ID de la connexion node ${node.name}`);
                                            reject(new Error("Whoops2! what about a retry ?"));
                                            console.debug(`after reject promise2  retry ?!`);
                                            return;
                                        }

                                        var asterikId = info.system.entity_id; // Utilisation de l'entity_id

                                        connections[asterikId] = ari;
                                        console.debug(`Cancel _checkConnection to Asterisk ${retryIntervalId} for ${node.name}!`);
                                        clearInterval(retryIntervalId);

                                        console.debug(`Connection success to Asterisk Id = ${asterikId} for app = ${app} for node ${node.name}`);
                                        clientLoaded(ari, app, topics, node, asterikId);
                                        resolve({
                                            asterikId: asterikId,
                                            ari: ari
                                        });
                                        console.debug(`Promise resolved for ${app} node ${node.name} - la promesse a été tenue et cela semble vrai ...`);
                                    });
                                }
                            });
                        } catch (error) {
                            node.error(error);
                            console.error(`Connection failed user ${username}  password ${password} error ${error}`);
                            node.status({ fill: "red", shape: "dot", text: "error - disconnected" });
                            node.connected = false;
                        }
                    }

                    //Start trying to connect to asterisk, then retry after delay in case of failure
                    console.debug(`First try to connect node ${node.name} to Asterisk`);
                    var retryIntervalId = setInterval(connectToAsterisk, 10000);
                    connectToAsterisk();
                    console.debug(`Before initiate retry to connect node ${node.name} to Asterisk`);
                });
            },


            getconn: function (asterikId) {
                return connections[asterikId];  // Récupérer une connexion via son ID
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
                    channels[channelId] = channel;
                    let keyCount = Object.keys(channels).length;
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


    function clientLoaded(ari, app, topics, node, asterikId) {
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
                ari.on(event, eventCallbacks[event]);
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
            //const callback = typeof window !== 'undefined' ? window[callbackName] : global[callbackName];
            //const callback =  typeof clientLoaded[callbackName] === 'function' ? clientLoaded[callbackName] : undefined;
            //console.debug(`looking for activate event ${event} callbakname= ${callbackName}`);
            //console.debug("typeof callback", typeof clientLoaded[callbackName]);

            const callback = _findCallback(event);

            if (typeof callback === 'function') {
                //console.debug(`activate event ${event} for node ${node.name}`);
                ari.on(event, callback);
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
                console.log(`StasisStart before node send ${node.name} for ${channel.id} and asteriskId ${asterikId}`);
                node.send([{ event: 'StasisStart', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);

            } else {
                console.log(`StasisStart event dialed ${event.args[0]} for ${channel.id}`);
            }
        }

        function _stasisEnd(event, channel) {
            console.log(`StasisEnd event for ${channel.id}`);
            node.send([{ event: 'StasisEnd', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _deviceStateChanged(event, channel) {
            node.send([{ event: 'DeviceStateChanged', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _endpointStateChange(event, channel) {
            node.send([{ event: 'EndpointStateChange', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelConnectedLine(event, channel) {
            node.send([{ event: 'ChannelConnectedLine', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _contactStatusChange(event, channel) {
            node.send([{ event: 'ContactStatusChange', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _applicationMoveFailed(event, channel) {
            node.send([{ event: 'ApplicationMoveFailed', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _applicationReplaced(event, channel) {
            node.send([{ event: 'ApplicationReplaced', asteriskId: asterikId, payload: event }, null]);
        }

        function _channelCreated(event, channel) {
            node.send([{ event: 'ChannelCreated', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelEnteredBridge(event, channel) {
            node.send([{ event: 'ChannelEnteredBridge', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelLeftBridge(event, channel) {
            node.send([{ event: 'ChannelLeftBridge', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelStateChange(event, channel) {
            if (event.channel.state = 'Ringing') {
                console.log("📞 ringing...");
            }
            node.send([{ event: 'ChannelStateChange', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelDtmfReceived(event, channel) {
            node.send([{ event: 'ChannelDtmfReceived', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelDialplan(event, channel) {
            node.send([{ event: 'ChannelDialplan', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelCallerId(event, channel) {
            node.send([{ event: 'ChannelCallerId', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelUserevent(event, channel) {
            node.send([{ event: 'ChannelUserevent', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelHangupRequest(event, channel) {
            //node.send({ payload: { event: 'ChannelHangupRequest', channelId: channel, details: event } });
            console.log(`📞 Appel raccroché - Raison : ${event.cause_txt} (Code: ${event.cause})`);

            if (event.cause === 21) {
                console.log("❌ Le correspondant a refusé l'appel !");
            }
            node.send([{ event: 'ChannelHangupRequest', channelId: channel.id, asteriskId: asterikId, payload: event }, null]);
        }

        function _channelDestroyed(event, channel) {
            let channelId = channel.id;
            //connectionPool.setchan(channel)
            node.send([{ event: 'ChannelDestroyed', channelId: channel.id, asteriskId: asterikId, payload: event }, null]);
            /* must remove the channel*/
            console.debug(`_channelDestroyed : unsetchan ${channelId}...`);
            connectionPool.unsetchan(channelId);
        }

        function _channelToneDetected(event, channel) {
            node.send([{ event: 'ChannelToneDetected', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelTalkingStarted(event, channel) {
            node.send([{ event: 'ChannelTalkingStarted', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelTalkingFinished(event, channel) {
            node.send([{ event: 'ChannelTalkingFinished', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelHold(event, channel) {
            node.send([{ event: 'ChannelHold', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelUnhold(event, channel) {
            node.send([{ event: 'ChannelUnhold', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _channelVarset(event, channel) {
            node.send([{ event: 'ChannelVarset', channelId: channel.id, asteriskId: asterikId, payload: event }, null]);
        }

        function _contactStatusChange(event) {
            node.send([{ event: 'ContactStatusChange', asteriskId: asterikId, payload: event }, null]);
        }

        function _bridgeCreated(event) {
            node.send([{ event: 'BridgeCreated', asteriskId: asterikId, payload: event }, null]);
        }

        function _bridgeDestroyed(event) {
            node.send([{ event: 'BridgeDestroyed', asteriskId: asterikId, payload: event }, null]);
        }

        function _bridgeEnter(event) {
            node.send([{ event: 'BridgeEnter', asteriskId: asterikId, payload: event }, null]);
        }

        function _bridgeLeave(event) {
            node.send([{ event: 'BridgeLeave', asteriskId: asterikId, payload: event }, null]);
        }

        function _bridgeMerged(event) {
            node.send([{ event: 'BridgeMerged', asteriskId: asterikId, payload: event }, null]);
        }

        function _bridgeBlindTransfer(event,channel) {
            node.send([{ event: 'BridgeBlindTransfer', channelId: connectionPool.setchan(channel), asteriskId: asterikId, payload: event }, null]);
        }

        function _bridgeAttendedTransfer(event) {
            node.send([{ event: 'BridgeAttendedTransfer', asteriskId: asterikId, payload: event }, null]);
        }

        function _bridgeVideoSourceChanged(event) {
            node.send([{ event: 'BridgeVideoSourceChanged', asteriskId: asterikId, payload: event }, null]);
        }

         function _dial(event) {
            node.send([{ event: 'Dial', asteriskId: asterikId, payload: event }, null]);
        }

        function _peerStatusChange(event) {
            node.send([{ event: 'PeerStatusChange', asteriskId: asterikId, payload: event }, null]);
        }

        function _playbackStarted(event) {
            node.send([{ event: 'PlaybackStarted', asteriskId: asterikId, payload: event }, null]);
        }

        function _playbackFinished(event) {
            node.send([{ event: 'PlaybackFinished', asteriskId: asterikId, payload: event }, null]);
        }

        function _playbackContinuing(event) {
            node.send([{ event: 'PlaybackContinuing', asteriskId: asterikId, payload: event }, null]);
        }

        function _recordingStarted(event) {
            node.send([{ event: 'RecordingStarted', asteriskId: asterikId, payload: event }, null]);
        }

        function _recordingFinished(event) {
            node.send([{ event: 'RecordingFinished', asteriskId: asterikId, payload: event }, null]);
        }

        function _recordingFailed(event) {
            node.send([{ event: 'RecordingFailed',  asteriskId: asterikId, payload: event }, null]);
        }

        function _textMessageReceived(event) {
            node.send([{ event: 'TextMessageReceived', asteriskId: asterikId, payload: event }, null]);
        }
        /*
        _close_app() {
            console.log(`Closing App ${this.app_name} on ${this.asterisk_ari.url}`);
            this.asterisk_ari.ari.stop(this.app_name)
                .then(() => {
                    console.log(`Stopped App ${this.app_name} on ${this.asterisk_ari.url}`);
                    node.status({ fill: "red", shape: "dot", text: `${this.app_name} on ${this.asterisk_ari.url}` });
                    this.started = false;
                })
                .catch(err => console.error(err));
        }
        */

        ari.start(app);

    }


    function ari_incoming(n) {
        RED.nodes.createNode(this, n);
        this.connected = false;
        this.server = RED.nodes.getNode(n.server);
        console.debug(`ari_incoming url = ${this.server.credentials.url} application = ${n.app_name}`);
        console.debug(`ari_incoming topics =  ${n.topics}`);
        //console.debug("ari_incoming topics2 =: %o", n.topics);
        //var application_node = this;
        //connectionPool.setconn(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, n.app_name, application_node);
        let setcon_promise = connectionPool.setconn(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, n.app_name, n.topics, this);
        console.debug(`end ari_incoming ${n.name} app ${n.app_name} result ${setcon_promise}`);
        setcon_promise// se lance quand la promesse est acquittée, peu importe si celle-ci est tenue ou rompue
            .finally(() => console.debug(`__________nettoyage de la promesse`))
            // donc l'indicateur de chargement est toujours arrêté avant de continuer
            .then(result => console.debug(`__________promesse réussie asterikId = ${result.asterikId}`), err => console.debug(`__________promesse rompue ${err}`));
    }
    RED.nodes.registerType("ari_incoming", ari_incoming);

    //deprecated
    RED.nodes.registerType("ari_client", ari_incoming);


    function ari_playback(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.config = n;
        node.on('input', function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            this.media2 = RED.util.evaluateNodeProperty(node.config.media2, node.config.media2Type, node, msg);
            var ari = connectionPool.getconn(msg.asteriskId);
            var channel = connectionPool.getchan(msg.channelId);
            var playback = ari.Playback(); 
            console.debug(`debug playback ${this.media2} - channelId ${msg.channelId}`);
            if (!this.media2) {
                console.debug(`error playback = media not defined`);
                node.error(`media not defined`);
                node.status({});
                return;
            }
            channel.play({ media: this.media2 }, playback, function (err, newPlayback) {
                if (err) {
                    console.debug(`error playback = ${err}`);
                    node.error(err);
                    node.status({});
                    return;
                }
            });
            playback.on('PlaybackFinished', function (event, completedPlayback) {
                msg.payload = event;
                node.send(msg);
                node.status({});
            });
        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.ari.disconnect();
        });
    }
    RED.nodes.registerType("ari_playback", ari_playback);


    function ari_hangup(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.on('input', function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            var channel = connectionPool.getchan(msg.channelId);
            channel.hangup(function (err) {
                if (err) {
                    console.debug(`error hangup = ${err}`);
                    node.error(err);
                    node.status({});
                };
                node.status({});
            });
        });
    }
    RED.nodes.registerType("ari_hangup", ari_hangup);


    function ari_answer(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.on('input', function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            console.debug(`node en cours d'execution -> blue`);
            var ari = connectionPool.getconn(msg.asteriskId);
            console.debug(`get ari  = ${ari}`);
            var channel = connectionPool.getchan(msg.channelId);
            console.debug(`get channelId  = ${channel.id}`);
            ari.channels.answer({ channelId: channel.id }, function (err) {
                if (err) {
                    console.debug(`error answer  = ${err}`);
                    node.error(err);
                    node.status({});
                }
                console.debug(`answer done`);
                msg.payload = 'answered';
                node.send(msg);
                node.status({});
                console.debug(`fin execution du node`);
            });
        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.ari.disconnect();
        });
    }
    RED.nodes.registerType("ari_answer", ari_answer);


    function ari_continueindialplan(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.on('input', function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            var ari = connectionPool.getconn(msg.asteriskId);
            var channel = connectionPool.getchan(msg.channelId);
            ari.channels.continueInDialplan({ channelId: channel.id }, function (err) {
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
            // eg: node.ari.disconnect();
        });
    }
    RED.nodes.registerType("ari_continueindialplan", ari_continueindialplan);


    function ari_bridgedial(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        this.destination = n.destination;
        this.callerId = n.callerId;
        node.on('input', function (msg) {
            node.status({ fill: "blue", shape: "dot" });
            var ari = connectionPool.getconn(msg.asteriskId);
            var channel = connectionPool.getchan(msg.channelId);
            // Create outbound channel
            var dialed = ari.Channel();
            var bridge = ari.Bridge();
            var bridgeid = bridge.id;
            bridge.create({ type: 'mixing, dtmf_events' }, function (err) { if (err) { throw err; } });
            ari.start(bridgeid);
            dialed.on('StasisStart', function (event, dialed) {
                dialed.continue(function (err) { if (err) { throw err; } });
                bridge.addChannel({ channel: [channel.id, dialed.id] }, function (err) {
                    if (err) {
                        node.error(err);
                        node.status({});
                    };
                });
                var channelId = connectionPool.setchan(dialed);
                var bmsg = {};
                bmsg.channelId = channelId;
                bmsg.asteriskId = ari.id;
                msg.type = "connected";
                bmsg.type = "connected";
                bmsg.payload = { bridge: bridge.id };
                msg.payload = { bridge: bridge.id };
                if (n.connected_event) {
                    node.send([msg, bmsg]);
                }
            });
            dialed.on('StasisEnd', function (event, dialed) {
                bridge.destroy(function (err) { });
                msg.type = "ended";
                msg.payload = event;
                if (n.ended_event) {
                    node.send([msg, null]);
                }
                node.status({});
            });
            channel.on('StasisEnd', function (event, channel) {
                var msg = {}
                msg.type = "ended";
                msg.channelId = dialed.id;
                msg.asteriskId = ari.id;
                msg.payload = event;
                bridge.destroy(function (err) { });
                if (n.ended_event) {
                    node.send([null, msg]);
                }

                node.status({});
            });
            channel.on('ChannelDtmfReceived', function (event, channel) {
                var msg = {}
                msg.type = "DTMF";
                msg.channelId = channel.id;
                msg.asteriskId = ari.id;
                msg.payload = event;
                node.send([msg, null]);
            });
            dialed.on('ChannelDtmfReceived', function (event, dialled) {
                var msg = {};
                msg.type = "DTMF";
                msg.channelId = dialled.id;
                msg.asteriskId = ari.id;
                msg.payload = event;
                node.send([null, msg]);
            });

            dialed.originate({ endpoint: this.destination, callerId: this.callerId, app: bridgeid, appArgs: 'dialed' }, function (err, response) {
                if (err) { throw err; };
            });
        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.ari.disconnect();
        });
    }
    RED.nodes.registerType("ari_bridgedial", ari_bridgedial);

    function ari_originate(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        this.connected = false;
        this.server = RED.nodes.getNode(n.server);
        console.debug(`ari_incoming_originate_node url = ${this.server.credentials.url} application = ${n.app_name}`);
        console.debug(`ari_incoming_originate_node topics =  ${n.topics}`);
        this.destination = n.destination;
        this.callerId = n.callerId;
        node.on('input', function (msg) {
            node.status({ fill: "blue", shape: "dot" });

            let setcon_promise_originate = connectionPool.setconn(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, n.app_name, n.topics, this);
            console.debug(`end ari_originate_node ${n.name} app ${n.app_name} result ${setcon_promise_originate}`);
            setcon_promise_originate// se lance quand la promesse est acquittée, peu importe si celle-ci est tenue ou rompue
                .finally(() => console.debug(`__________nettoyage de la promesse originate`))
                // donc l'indicateur de chargement est toujours arrêté avant de continuer
                .then(result => {
                    console.debug(`__________promesse originate réussie asterikId ${result.asterikId}`);

                    var ari = result.ari;
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
                    ari.channels.originate({
                        endpoint: destination,
                        callerId: n.callerId, // Numéro affiché
                        app: n.app_name
                    })
                        .then(channel => {
                            console.log(`📞 Appel en cours vers ${callee}...`);
                            /*
                                            // Écoute des événements liés à ce canal
                                            ari.on('StasisStart', event => {
                                                console.log(`✅ Appel connecté à ${callee} StasisStart appli ${n.app_name} debug event ${event}`);
                                                msg.payload = event;
                                                node.send([null, msg]);
                                            });
                            
                                            ari.on('ChannelHangupRequest', event => {
                                                console.log(`❌ Appel terminé ChannelHangupRequest appli ${n.app_name} debug event ${event}`);
                                                msg.payload = event;
                                                node.send([null, msg]);
                                            });
                            
                                            ari.on('ChannelDestroyed', event => {
                                                console.log(`❌ Appel terminé ChannelDestroyed appli ${n.app_name} debug event ${event}`);
                                                msg.payload = event;
                                                node.send([null, msg]);
                                            });
                            
                                            ari.on('StasisEnd', event => {
                                                console.log(`❌ Appel terminé StasisEnd appli ${n.app_name} debug event ${event}`);
                                                msg.payload = event;
                                                node.send([null, msg]);
                                            });
                            */
                            return channel;
                        })
                        .catch(err => {
                            console.error(`❌ Erreur lors de l'initialisation de l'appel :`, err.message || err);
                        });


                }, err => console.debug(`__________promesse originate rompue ${err}`));

        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.ari.disconnect();
        });

    }
    RED.nodes.registerType("ari_originate", ari_originate);
}