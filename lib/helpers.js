const { connectionPool } = require("../lib/ari-client");

/**
 * Handles the 'StasisStart' event.
 * @param {object} node - The Node-RED node.
 * @param {object} event - The ARI event.
 * @param {object} msg - The message object to send.
 */
function handleStasisStartEvent(node, event, msg) {
    connectionPool.setchan(event.instanceChannel);
    node.send([msg, null]); // Send to 'starting' output
    node.status({ fill: "blue", shape: "dot", text: `${msg.payload.channel.caller.number} -> ${msg.payload.channel.state}` });
}

/**
 * Handles the 'StasisEnd' event.
 * @param {object} node - The Node-RED node.
 * @param {object} event - The ARI event.
 * @param {object} msg - The message object to send.
 */
function handleStasisEndEvent(node, event, msg) {
    node.send([null, msg]); // Send to 'event' output
    node.status({ fill: "green", shape: "dot", text: "Connected" });
}

/**
 * Handles the 'ChannelDestroyed' event.
 * @param {object} node - The Node-RED node.
 * @param {object} event - The ARI event.
 * @param {object} msg - The message object to send.
 */
function handleChannelDestroyedEvent(node, event, msg) {
    connectionPool.unsetchan(event.channel.id);
    node.send([null, msg]); // Send to 'event' output
    node.status({ fill: "green", shape: "dot", text: "Connected" });
}

/**
 * Handles the 'Dial' event.
 * @param {object} node - The Node-RED node.
 * @param {object} event - The ARI event.
 * @param {object} msg - The message object to send.
 */
function handleDialEvent(node, event, msg) {
    node.send([null, msg]); // Send to 'event' output
    node.status({ fill: "blue", shape: "dot", text: `${event.type} ${event.dialstatus} -> ${event.dialstring}` });
}

/**
 * Handles all ARI events.
 * @param {object} node - The Node-RED node.
 * @param {object} event - The ARI event.
 */
function handleEvent(node, event) {
    // Ensure the event belongs to the correct application
    if (node.app !== event.application) {
        //console.debug(`⚠️ Ignoring event (${event.type}): Received for app "${event.application}", expected "${node.app}", channel: ${event.channel?.id}`);
        return;
    }

    console.debug(`🔹 Handling ARI event: ${event.type} by node: ${node.name} app: ${node.app}`);

    // Extract payload, excluding 'instanceChannel'
    const payload = Object.fromEntries(
        Object.entries(event).filter(([key]) => key !== 'instanceChannel')
    );

    // Construct the message
    const msg = {
        event: event.type,
        app: event.application || node.app, // Ensure 'app' is always present
        asteriskId: event.asterisk_id,
        ...(event.channel?.id && { channelId: event.channel.id }), // Include channelId if available
        payload
    };

    // Handle specific event types
    switch (event.type) {
        case 'StasisStart':
            handleStasisStartEvent(node, event, msg);
            break;
        case 'StasisEnd':
            handleStasisEndEvent(node, event, msg);
            break;
        case 'ChannelDestroyed':
            handleChannelDestroyedEvent(node, event, msg);
            break;
        case 'Dial':
            handleDialEvent(node, event, msg);
            break;
        default:
            node.send([null, msg]); // Send to 'event' output for all other cases
            break;
    }
}

/**
 * Initializes the connection to Asterisk ARI.
 * @param {object} node - The Node-RED node.
 */
async function initializeConnection(node) {
    if (node.server && node.server.credentials && node.apps) {
        console.debug(`${node.type} url = ${node.server.credentials.url} app: ${node.app} apps: `, node.apps);
        const setcon_promise = connectionPool.setconn(node.server.credentials.url, node.server.credentials.username, node.server.credentials.password, node.app, node.apps, node.topics, node);
        console.debug(`${node.type} ${node.name} app: ${node.app} initializing...`);
        try {
            const connection = await setcon_promise;
            
            if(!connection){
                node.status({ fill: "red", shape: "dot", text: "connection error" });
                node.error(`connection error`);
                return null;
            }
            node.connection = connection;
            
            console.debug(`__________promise ${node.type} success app: ${node.app}`);
            node.status({ fill: "green", shape: "dot", text: "connected" });

            //listen on topics defined for this node
            node.topics.forEach(topic => {
                connection.on(topic, event => handleEvent(node, event));
                console.log(`debug register callback on `, topic);
            });

/*
            example :
            connection.on('StasisStart', event => handleEvent(node, event));
            connection.on('StasisEnd', event => handleEvent(node, event));
            connection.on('ChannelDestroyed', event => handleEvent(node, event));
            connection.on('ChannelHangupRequest', event => handleEvent(node, event));
            connection.on('ChannelDialplan', event => handleEvent(node, event));
            connection.on('ChannelDtmfReceived', event => handleEvent(node, event));
            connection.on('Dial', event => handleEvent(node, event));
*/
            return connection;
        } catch (err) {
            console.error(`__________promise ${node.type} failed ${err}`);
            node.error(err);
            node.status({ fill: "red", shape: "dot", text: "error" });
            return null;
        }
    } else {
        console.debug(`${node.type} : config node undefined `);
        node.error(`config node undefined`);
        node.status({ fill: "red", shape: "dot", text: "config undefined" });
        return null;
    }
}

module.exports = { handleEvent, initializeConnection };
