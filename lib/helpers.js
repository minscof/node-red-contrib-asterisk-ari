    
    const { connectionPool } = require("../lib/ari-client");
    
    // Helper function to handle StasisStart event
    function handleStasisStartEvent(node, event, eventName, channelId) {
        console.debug('New channel started:', event.channel.id);
        connectionPool.setchan(event.instanceChannel);
        const detail = Object.fromEntries(
            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
        );
        const msg = { event: eventName, channelId: channelId, asteriskId: detail.asterisk_id, payload: detail };
        console.debug(`${eventName} : ${channelId} detail :`, detail);
        node.send([msg,null]);
        //node.send([{ event: 'StasisStart', channelId: channelInstance.id, asteriskId: detail.asterisk_id, payload: detail }, null]);
        node.status({ fill: "blue", shape: "dot", text: `${detail.channel.caller.number} -> ${detail.channel.state}` });
    }
    
    // Helper function to handle common channel events
    function handleChannelEvent(node, event, eventName, channelId) {
        const detail = Object.fromEntries(
            Object.entries(event).filter(([key]) => key !== 'instanceChannel')
        );
        const msg = { event: eventName, channelId: channelId, asteriskId: detail.asterisk_id, payload: detail };
        console.debug(`${eventName} : ${channelId} detail :`, detail);
        node.send([null, msg]);
        if (eventName == 'ChannelDestroyed') connectionPool.unsetchan(channelId);
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

    module.exports = { handleStasisStartEvent, handleChannelEvent, handleEvent };