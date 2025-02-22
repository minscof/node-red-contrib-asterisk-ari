var ari = require('ari-client');

module.exports = function(RED) {
    "use strict";

    var stasis_apps = {};
    
    var ariConnectionPool = (function() {
        var connections = {};
        var channels = {};        
        var obj = {
            setconn: function(url, username, password, app, topics, node) {
                
                return new Promise((resolve, reject) => {
                
                    function connectToAri() {
                        console.log(`Try to connect node ${node.name} to ARI...`);
                        try {
                            ari.connect(url, username, password, function (err, client) {
                                if (err) {
                                    console.error(`Connection failed for node ${node.name} to ARI : err= ${err.message}`);
                                    node.error(err);
                                    console.error(`Connection failed user ${username}  password ${password} error ${err}`);
                                    node.status({fill:"red",shape:"dot",text:"disconnected"});
                                    node.connected = false;
                                } else {
                                    console.log(`Connection success for node node ${node.name} to ARI.`);
                                    node.connected = true;
                        
                                    // Stoppe les tentatives de reconnexion
                                    console.log(`Cancel retry connect node ${node.name} to ARI ${retryIntervalId}!`);
                                    //clearInterval(retryInterval);
                                    clearInterval(retryIntervalId);
                        
                                    // Appelle la fonction principale
                                    
                                    function _checkConnection(client) {
                                        console.debug(`Start checkConnection for node ${node.name} every 4000 ms`); 
                                        client.asterisk.ping((err, info) => {
                                            if (err) {
                                                console.error(`Ping failed for connection node ${node.name}`);
                                                node.status({fill:"red",shape:"dot",text:"disconnected"});
                                                node.connected = false;
                                            } else {
                                                console.debug(`Pong for app ${app} and node id ${node.id} name ${node.name} `);
                                                node.status({fill:"green",shape:"dot",text:"connected"});
                                                node.connected = true;
                                                //console.debug("dump5 client %o", client);
                                                console.debug(`Cancel _checkConnection to ARI ${retryIntervalId} for ${node.name}!`);
                                                clearInterval(retryIntervalId);
                                            };
                                        });
                                    };

                                    client.on('WebSocketMaxRetries', (err) => {
                                        console.log(`WebSocketMaxRetries node ${node.name} err ${err}..`);
                                        //console.debug("dump4 client %o", client);
                                        node.connected = false;
                                        node.error(err);
                                        node.status({fill:"red",shape:"dot",text:"disconnected"});
                                        /*
                                        retryIntervalId = setInterval(function () {
                                            _checkConnection(client);
                                        }, 4000);
                                        */
                                        retryIntervalId = setInterval(connectToAri, 4000);
                                        console.debug(`setInterval Bis retryIntervalId = ${retryIntervalId}`);
                                    });

                                    client.asterisk.getInfo((err, info) => {
                                        if (err || !info.system || !info.system.entity_id) {
                                            console.error(`Impossible d'obtenir l'ID de la connexion node ${node.name}`);
                                            reject(new Error("Whoops2! what about a retry ?"));
                                            console.debug(`after reject promise2  retry ?!`);
                                            return;
                                        }
                                
                                        var id = info.system.entity_id; // Utilisation de l'entity_id
                                        
                                        connections[id] = client;
                                        //console.debug("dump3 client %o", client);
                                        //console.debug(`dump client  ${client}`);
                                        console.debug(`Cancel _checkConnection to ARI ${retryIntervalId} for ${node.name}!`);
                                        clearInterval(retryIntervalId);

                                        console.debug(`Connection success with ID = ${id} for app = ${app} for node ${node.name}`);
                                        clientLoaded(client, app, topics, node, id);
                                        resolve({
                                            id: id,
                                            client: client
                                        });
                                        console.debug(`Promise resolved for ${app} node ${node.name} - la promesse a été tenue et cela semble vrai ...`);
                                    });

                                    //clientLoaded(client);

                                    
                                }
                            });
                        } catch (error) {
                            node.error(error);
                            console.error(`Connection failed user ${username}  password ${password} error ${error}`);
                            node.status({fill:"red",shape:"dot",text:"error - disconnected"});
                            node.connected = false;
                        }
                    }
                      
                    //Start trying to connect to ari, then retry after delay in case of failure
                    console.debug(`First try to connect node ${node.name} to ARI`);
                    var retryIntervalId = setInterval(connectToAri, 10000);
                    connectToAri();
                    console.debug(`Before initiate retry to connect node ${node.name} to ARI`);
                });
            },
            
    
            getconn: function(id) {
                return connections[id];  // Récupérer une connexion via son ID
            },
            /* to delete
            close: function(connection) {
                connection._nodeCount -= 1;
                if (connection._nodeCount === 0) {
                    delete connections[connection._id];
                }
            },
            */

            setchan: function(channel){
                var id = channel.id;
                channels[id] = channel;
                return id;
            },

            getchan: function(id){
                return channels[id];
            }
        };
        //console.debug(`initialize the singleton when nodered start or at first installation of ths module.`);
        return obj;
    }());
    

    function clientLoaded (client, app, topics, node, id) {      
        node.status({fill:"green",shape:"dot",text:"connected"});
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
                client.on(event, eventCallbacks[event]);
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
                console.debug(`activate event ${event} for node ${node.name}`);
                client.on(event, callback);
            } else {
                console.debug(`❌ function ${callbackName} not yet implemented for node ${node.name}...`);
            }
        });

        
        //client.on('StasisStart', stasisStart); 
        //client.on('ChannelDtmfReceived', function(event, channel){});
        /*
        client.on('StasisStart', _stasisStart);
        client.on('StasisEnd', _stasisEnd);
        client.on('ChannelDtmfReceived', _channelDtmfReceived);
        client.on('ChannelHangupRequest', _channelHangupRequest);
        client.on('ChannelDestroyed', _channelDestroyed);
        client.on('ChannelVarset', _channelVarset);
        client.on('BridgeCreated', _bridgeCreated);
        client.on('BridgeDestroyed', _bridgeDestroyed);
        client.on('BridgeEnter', _bridgeEnter);
        client.on('BridgeLeave', _bridgeLeave);
        client.on('PlaybackStarted', _playbackStarted);
        client.on('PlaybackFinished', _playbackFinished);
        client.on('RecordingStarted', _recordingStarted);
        client.on('RecordingFinished', _recordingFinished);
        client.on('RecordingFailed', _recordingFailed);
        */
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
            if (!dialed){
                console.log(`StasisStart before node send ${node.name} for ${channel.id} and client ${id}`);
                node.send([{ event: 'StasisStart', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);

            } else {
                console.log(`StasisStart event dialed ${event.args[0]} for ${channel.id}`);
            }
        }

        function _stasisEnd(event, channel) {
            console.log(`StasisEnd event for ${channel.id}`);
            node.send([{ event: 'StasisEnd', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }
        
        function _deviceStateChanged(event, channel) {
            node.send([{ event: 'DeviceStateChanged', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _endpointStateChange(event, channel) {
            node.send([{ event: 'EndpointStateChange', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelConnectedLine(event, channel) {
            node.send([{ event: 'ChannelConnectedLine', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }
        
        function _channelCreated(event, channel) {
            node.send([{ event: 'ChannelCreated', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }
        
        function _channelEnteredBridge(event, channel) {
            node.send([{ event: 'ChannelEnteredBridge', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelLeftBridge(event, channel) {
            node.send([{ event: 'ChannelLeftBridge', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelStateChange(event, channel) {
            if (event.channel.state = 'Ringing') {
                console.log("📞 ringing...");
            }
            node.send([{ event: 'ChannelStateChange', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelDtmfReceived(event, channel) {
            node.send([{ event: 'ChannelDtmfReceived', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelDialplan(event, channel) {
            node.send([{ event: 'ChannelDialplan', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelCallerId(event, channel) {
            node.send([{ event: 'ChannelCallerId', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelUserevent(event, channel) {
            node.send([{ event: 'ChannelUserevent', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }    

        function _channelHangupRequest(event, channel) {
            //node.send({ payload: { event: 'ChannelHangupRequest', channel: channel, details: event } });
            console.log(`📞 Appel raccroché - Raison : ${event.cause_txt} (Code: ${event.cause})`);

            if (event.cause === 21) {
                console.log("❌ Le correspondant a refusé l'appel !");
            }
            node.send([{ event: 'ChannelHangupRequest', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelDestroyed(event, channel) {
            node.send([{ event: 'ChannelDestroyed', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelToneDetected(event, channel) {
            node.send([{ event: 'ChannelToneDetected', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelTalkingStarted(event, channel) {
            node.send([{ event: 'ChannelTalkingStarted', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelTalkingFinished(event, channel) {
            node.send([{ event: 'ChannelTalkingFinished', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelHold(event, channel) {
            node.send([{ event: 'ChannelHold', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelUnhold(event, channel) {
            node.send([{ event: 'ChannelUnhold', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _channelVarset(event, channel) {
            node.send([{ event: 'ChannelVarset', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _bridgeCreated(event) {
            node.send([{ event: 'BridgeCreated', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _bridgeDestroyed(event) {
            node.send([{ event: 'BridgeDestroyed', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _bridgeEnter(event, channel) {
            node.send([{ event: 'BridgeEnter', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _bridgeLeave(event, channel) {
            node.send([{ event: 'BridgeLeave', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _playbackStarted(event) {
            node.send([{ event: 'PlaybackStarted', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _playbackFinished(event) {
            node.send([{ event: 'PlaybackFinished', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _recordingStarted(event) {
            node.send([{ event: 'RecordingStarted', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _recordingFinished(event) {
            node.send([{ event: 'RecordingFinished', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
        }

        function _recordingFailed(event) {
            node.send([{ event: 'RecordingFailed', channel: ariConnectionPool.setchan(channel), client: id, payload: event }, null]);
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

        client.start(app);

    }


    function ari_application_node(n) {
        RED.nodes.createNode(this, n); 
        this.connected = false;       
        this.server = RED.nodes.getNode(n.server);
        console.debug(`ari_application_node url = ${this.server.credentials.url} application = ${n.app_name}`);
        console.debug(`ari_application_node topics =  ${n.topics}`);
        //console.debug("ari_application_node topics2 =: %o", n.topics);
        //var application_node = this;
        //ariConnectionPool.setconn(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, n.app_name, application_node);
        let setcon_promise = ariConnectionPool.setconn(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, n.app_name, n.topics,this);
        console.debug(`end ari_application_node ${n.name} app ${n.app_name} result ${setcon_promise}`);
        setcon_promise// se lance quand la promesse est acquittée, peu importe si celle-ci est tenue ou rompue
        .finally(() => console.debug(`__________nettoyage de la promesse`))
        // donc l'indicateur de chargement est toujours arrêté avant de continuer
        .then(result => console.debug(`__________promesse réussie id client = ${result.id}`), err => console.debug(`__________promesse rompue ${err}`));
    }
    RED.nodes.registerType("ari_client", ari_application_node);
    

    function ari_playback(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.config = n;
        node.on('input', function (msg) {
          node.status({fill:"blue",shape:"dot"});
          this.media2 = RED.util.evaluateNodeProperty(node.config.media2, node.config.media2Type, node, msg);
          var client = ariConnectionPool.getconn(msg.client);
          var channel = ariConnectionPool.getchan(msg.channel);
          var playback = client.Playback();
          console.debug(`debug playback ${this.media2}`);
          if (!this.media2) {
            console.debug(`error playback = media not defined`);
                node.error(`media not defined`);
                node.status({});
                return;
          }
          channel.play({media: this.media2}, playback, function(err, newPlayback) {
            if (err) {
                console.debug(`error playback = ${err}`);
                node.error(err);
                node.status({});
                return;
            }
          });
          playback.on('PlaybackFinished', function(event, completedPlayback) {
            msg.payload = event;
            node.send(msg);
            node.status({});
          });
        });         
          
        this.on("close", function() {
              // Called when the node is shutdown - eg on redeploy.
              // Allows ports to be closed, connections dropped etc.
              // eg: node.client.disconnect();
        });
    }
    RED.nodes.registerType("ari_playback",ari_playback);


    function ari_hangup(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.on('input', function (msg) {
          node.status({fill:"blue",shape:"dot"});
            var channel = ariConnectionPool.getchan(msg.channel);
            channel.hangup(function(err) {
                if (err) {
                    console.debug(`error hangup = ${err}`);
                    node.error(err);
                    node.status({});
                };
                node.status({});
            });            
        });
    } 
    RED.nodes.registerType("ari_hangup",ari_hangup);


    function ari_answer(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.on('input', function (msg) {
          node.status({fill:"blue",shape:"dot"});
          console.debug(`node en cours d'execution -> blue`);
          var client = ariConnectionPool.getconn(msg.client);
          console.debug(`get client  = ${client}`);
          var channel = ariConnectionPool.getchan(msg.channel);
          console.debug(`get channelId  = ${channel.id}`);
          client.channels.answer({channelId: channel.id},function (err) {
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
          
        this.on("close", function() {
              // Called when the node is shutdown - eg on redeploy.
              // Allows ports to be closed, connections dropped etc.
              // eg: node.client.disconnect();
        });
    }
    RED.nodes.registerType("ari_answer",ari_answer);


    function ari_continueindialplan(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.on('input', function (msg) {
          node.status({fill:"blue",shape:"dot"});
          var client = ariConnectionPool.getconn(msg.client);
          var channel = ariConnectionPool.getchan(msg.channel);
          client.channels.continueInDialplan({channelId: channel.id},function (err) {
            if (err) {
                node.error(err);
                node.status({});
            };
            msg.payload = 'continue in dialplan - end application : ${node.application}';
            node.send(msg);
            node.status({});
          });
        });         
          
        this.on("close", function() {
              // Called when the node is shutdown - eg on redeploy.
              // Allows ports to be closed, connections dropped etc.
              // eg: node.client.disconnect();
        });
    }
    RED.nodes.registerType("ari_continueindialplan",ari_continueindialplan);

    
    function ari_bridgedial(n){
        RED.nodes.createNode(this,n);
        var node = this;
        this.destination = n.destination;
        this.callerId = n.callerId;
        node.on('input', function (msg) {
          node.status({fill:"blue",shape:"dot"});
          var client = ariConnectionPool.getconn(msg.client);
          var channel = ariConnectionPool.getchan(msg.channel);
          // Create outbound channel
          var dialed = client.Channel();
          var bridge = client.Bridge();
          var bridgeid = bridge.id;
          bridge.create({type: 'mixing, dtmf_events'}, function(err) {if (err) {throw err;}});
          client.start(bridgeid);
          dialed.on('StasisStart', function(event, dialed) {
            dialed.continue(function(err) {if (err) {throw err;}});
            bridge.addChannel({channel: [channel.id, dialed.id]}, function(err) {
                if (err) {
                    node.error(err);
                    node.status({});
                };
            });
            var channelid = ariConnectionPool.setchan(dialed);
            var bmsg = {};
            bmsg.channel = channelid;
            bmsg.client = client.id;
            msg.type = "connected";
            bmsg.type = "connected";
            bmsg.payload = {bridge : bridge.id};
            msg.payload = {bridge : bridge.id};
            if (n.connected_event) {
                node.send([msg, bmsg]);
            }
          });
          dialed.on('StasisEnd', function(event, dialed) {
            bridge.destroy(function(err) {});
            msg.type = "ended";
            msg.payload = event;
            if (n.ended_event) {
                node.send([msg, null]);
            }
            node.status({});
          });
          channel.on('StasisEnd', function(event, channel) {
            var msg = {}
            msg.type = "ended";
            msg.channel = dialed.id;
            msg.client = client.id;
            msg.payload = event;
            bridge.destroy(function(err) {});
            if (n.ended_event) {
                node.send([null, msg]);
            }
            
            node.status({});
          });
          channel.on('ChannelDtmfReceived', function(event, channel){
            var msg = {}
            msg.type = "DTMF";
            msg.channel = channel.id;
            msg.client = client.id;
            msg.payload = event;
            node.send([msg, null]);
          });
          dialed.on('ChannelDtmfReceived', function(event, dialled){
            var msg = {};
            msg.type = "DTMF";
            msg.channel = dialled.id;
            msg.client = client.id;
            msg.payload = event;
            node.send([null, msg]);
          });

          dialed.originate({endpoint: this.destination, callerId: this.callerId, app: bridgeid, appArgs: 'dialed'}, function(err, response) {
              if (err) {throw err;};
          });
        });

        this.on("close", function() {
              // Called when the node is shutdown - eg on redeploy.
              // Allows ports to be closed, connections dropped etc.
              // eg: node.client.disconnect();
        });
    }
    RED.nodes.registerType("ari_bridgedial",ari_bridgedial);

    function ari_originate(n){
        RED.nodes.createNode(this,n);
        var node = this;
        this.connected = false;       
        this.server = RED.nodes.getNode(n.server);
        console.debug(`ari_application_originate_node url = ${this.server.credentials.url} application = ${n.app_name}`);
        console.debug(`ari_application_originate_node topics =  ${n.topics}`);
        this.destination = n.destination;
        this.callerId = n.callerId;
        node.on('input', function (msg) {
          node.status({fill:"blue",shape:"dot"});

          let setcon_promise_originate = ariConnectionPool.setconn(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, n.app_name, n.topics,this);
          console.debug(`end ari_originate_node ${n.name} app ${n.app_name} result ${setcon_promise_originate}`);
          setcon_promise_originate// se lance quand la promesse est acquittée, peu importe si celle-ci est tenue ou rompue
          .finally(() => console.debug(`__________nettoyage de la promesse originate`))
          // donc l'indicateur de chargement est toujours arrêté avant de continuer
          .then(result => {
            console.debug(`__________promesse originate réussie id client ${result.id}`);

            //var client = ariConnectionPool.getconn('80:af:ca:63:b7:7c');
            var client = result.client;
            console.debug(`originate call destination node  = ${n.destination} `)
            let destination = msg.payload.destination ?? n.destination;
            console.debug(`originate call destination = ${destination} `);
            let callee = destination.includes('/') ? destination.split('/')[1].split('@')[0] : null;
            console.debug(`originate call destination = ${destination} callee = ${callee}`);
            if (!destination) {
                node.error("destination undefined");
                node.status({});
                return;
            };
      

            console.log("📞 Trying to call...");
            client.channels.originate({
                endpoint: destination,
                callerId: n.callerId, // Numéro affiché
                app: n.app_name
            })
            .then(channel => {
                console.log(`📞 Appel en cours vers ${callee}...`);
/*
                // Écoute des événements liés à ce canal
                client.on('StasisStart', event => {
                    console.log(`✅ Appel connecté à ${callee} StasisStart appli ${n.app_name} debug event ${event}`);
                    msg.payload = event;
                    node.send([null, msg]);
                });

                client.on('ChannelHangupRequest', event => {
                    console.log(`❌ Appel terminé ChannelHangupRequest appli ${n.app_name} debug event ${event}`);
                    msg.payload = event;
                    node.send([null, msg]);
                });

                client.on('ChannelDestroyed', event => {
                    console.log(`❌ Appel terminé ChannelDestroyed appli ${n.app_name} debug event ${event}`);
                    msg.payload = event;
                    node.send([null, msg]);
                });

                client.on('StasisEnd', event => {
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

        this.on("close", function() {
              // Called when the node is shutdown - eg on redeploy.
              // Allows ports to be closed, connections dropped etc.
              // eg: node.client.disconnect();
        });      
        
    }
    RED.nodes.registerType("ari_originate",ari_originate);
}