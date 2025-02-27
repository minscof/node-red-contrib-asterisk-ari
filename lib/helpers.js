    
    const { connectionPool } = require("../lib/ari-client");
    
    // Helper function to handle StasisStart event
    function handleStasisStartEvent(node, app, event, eventName, channelId) {
        console.debug(`Stasis: ${app} start, new channel:`, event.channel.id);
        if (app !== event.application) {
            console.debug(`app: ${app} event for another app: ${event.application} `);
            return;
        }
        connectionPool.setchan(event.instanceChannel);
        const detail = Object.fromEntries(
            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
        );
        //console.debug(`${eventName} : ${channelId} detail :`, detail);
        const msg = { app: app, event: eventName, channelId: channelId, asteriskId: detail.asterisk_id, payload: detail };
        node.send([msg,null]);
        node.status({ fill: "blue", shape: "dot", text: `${detail.channel.caller.number} -> ${detail.channel.state}` });
    }

    // Helper function to handle StasisEnd event
    function handleStasisEndEvent(node, app, event, eventName, channelId) {
        console.debug(`Stasis: ${app} end, channel:`, event.channel.id);
        if (app !== event.application) {
            console.debug(`app: ${app} event for another app: ${event.application} `);
            return;
        }
        connectionPool.setchan(event.instanceChannel);
        const detail = Object.fromEntries(
            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
        );
        //console.debug(`${eventName} : ${channelId} detail :`, detail);
        const msg = { app: app, event: eventName, channelId: channelId, asteriskId: detail.asterisk_id, payload: detail };
        node.send([null,msg]);
        node.status({ fill: "green", shape: "dot", text: "connected" });
    }
    
    // Helper function to handle common channel events
    function handleChannelEvent(node, event, eventName, channelId) {
        const detail = Object.fromEntries(
            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
        );
        //console.debug(`${eventName} : ${channelId} detail :`, detail);
        const msg = { app: event.application, event: eventName, channelId: channelId, asteriskId: detail.asterisk_id, payload: detail };
        node.send([null, msg]);
        if (eventName == 'ChannelDestroyed') connectionPool.unsetchan(channelId);
    }

    // Helper function to handle common event
    function handleEvent(node, event, eventName) {
        const detail = Object.fromEntries(
            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
        );
        //console.debug(`${eventName} detail :`, detail);
        const msg = { app: event.application, event: eventName, asteriskId: detail.asterisk_id, payload: detail };
        node.send([null, msg]);
    }

    async function initializeConnection(node) {
        if (node.server && node.server.credentials && node.server.apps) {
            console.debug(`ari_${node.type} url = ${node.server.credentials.url} app: ${node.app} apps: `, node.apps);
            const setcon_promise = connectionPool.setconn(node.server.credentials.url, node.server.credentials.username, node.server.credentials.password, node.app, node.apps, node.topics, node);
            console.debug(`ari_${node.type} ${node.name} app: ${node.app} initializing...`);
            try {
                const connection = await setcon_promise;
                console.debug(`__________promise ${node.type} success app: ${node.app}`);
                node.status({ fill: "green", shape: "dot", text: "connected" });
                connection.on('StasisStart', event => handleStasisStartEvent(node, node.app, event, 'StasisStart', event.channel.id));
                connection.on('StasisEnd', event => handleStasisEndEvent(node, node.app, event, 'StasisEnd', event.channel.id));
    
                connection.on('ChannelDestroyed', event => handleChannelEvent(node, event, 'ChannelDestroyed', event.channel.id));
                connection.on('ChannelHangupRequest', event => handleChannelEvent(node, event, 'ChannelHangupRequest', event.channel.id));
                connection.on('ChannelDialplan', event => handleChannelEvent(node, event, 'ChannelDialplan', event.channel.id));
                connection.on('ChannelDtmfReceived', event => handleChannelEvent(node, event, 'ChannelDtmfReceived', event.channel.id));
    
                connection.on('Dial', event => handleEvent(node, event, 'Dial'));
                connection.on('BridgeDestroyed', event => handleEvent(node, event, 'BridgeDestroyed'));
                connection.on('PeerStatusChange', event => handleEvent(node, event, 'PeerStatusChange'));
    
                return connection;
            } catch (err) {
                console.error(`__________promise ${node.type} failed ${err}`);
                node.error(err);
                node.status({ fill: "red", shape: "dot", text: "error" });
                return null;
            }
        } else {
            console.debug(`ari_${node.type} : config node undefined `);
            node.error(`config node undefined`);
            node.status({ fill: "red", shape: "dot", text: "config undefined" });
            return null;
        }
    }

    module.exports = { handleStasisStartEvent, handleStasisEndEvent, handleChannelEvent, handleEvent, initializeConnection };