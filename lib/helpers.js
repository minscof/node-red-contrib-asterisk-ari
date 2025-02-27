    
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

    module.exports = { handleStasisStartEvent, handleStasisEndEvent, handleChannelEvent, handleEvent };