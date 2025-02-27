const { connectionPool } = require("../lib/ari-client");
const { handleStasisStartEvent, handleStasisEndEvent, handleChannelEvent, handleEvent } = require("../lib/helpers");

module.exports = function (RED) {
    "use strict";
    
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
                msg.event = 'StasisEnd';
                msg.channelId = dialed.id;
                msg.payload = event;
                //bridge.destroy(function (err) { });
                //const remove = await connection.bridges.destroy(bridge.id);
                //console.log(`✅ Bridge destroyed with id: ${bridge.id}`);
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
            connection.on('StasisStart', event => handleStasisStartEvent(node, msg.app, event, 'StasisStart', event.channel.id));
            connection.on('StasisEnd', event => handleStasisEndEvent(node, n.app, event, 'StasisEnd', event.channel.id));
            
            connection.on('ChannelDestroyed', event => handleChannelEvent(node, event, 'ChannelDestroyed', event.channel.id));
            connection.on('ChannelHangupRequest', event => handleChannelEvent(node, event, 'ChannelHangupRequest', event.channel.id));
            connection.on('ChannelDialplan', event => handleChannelEvent(node, event, 'ChannelDialplan', event.channel.id));
            connection.on('Dial', event => handleEvent(node, event, 'Dial'));
            connection.on('BridgeDestroyed', event => handleEvent(node, event, 'BridgeDestroyed'));
            connection.on('PeerStatusChange', event => handleEvent(node, event, 'PeerStatusChange'));

/*

            connection.on('ChannelDestroyed', event => {
                console.log('ChannelDestroyed2:', event.channel.id);
                const detail = Object.fromEntries(
                    Object.entries(event).filter(([key]) => key !== 'instanceChannel')
                );
                node.send([null, { event: 'ChannelDestroyed', channelId: event.channel.id, asteriskId: detail.asterisk_id, payload: detail }]);
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
*/
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
                app: msg.app,  
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

}