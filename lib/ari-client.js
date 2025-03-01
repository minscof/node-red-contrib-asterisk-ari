/**
 * @typedef {import('@ipcom/asterisk-ari').ChannelEvent} ChannelEvent
 */

let AriClient;
let clientReady = (async () => {
    ({ AriClient } = await import('@ipcom/asterisk-ari')); // Import unique
    console.log('✅ AriClient is loaded!');
})();

// Function to create AriClient instance after import
async function createAriClient(config) {
    await clientReady; // Wait until import is completed
    return new AriClient(config);
}

// Function to initialize AriClient with connection details
async function initializeClient(host, port, username, password, secure) {
    console.debug(`Init AriClient for ${host}:${port}`);
    return await createAriClient({ host, port, username, password, secure });
}

// Function to retrieve a connection by key (URL) or ID
function getConnectionByKeyOrId(obj, keyOrId) {
    // Check if keyOrId is an existing key (URL)
    if (obj[keyOrId]) {
        return obj[keyOrId];
    }
    // Otherwise, search by ID
    return Object.values(obj).find(entry => entry.id === keyOrId);
}

// Function to parse URL string and extract host and port
function parseUrl(url) {
    try {
        const parsedUrl = new URL(url); // Use the URL API
        return {
            host: parsedUrl.hostname, // Extract the hostname
            port: Number(parsedUrl.port) || (parsedUrl.protocol === 'https:' ? 443 : 80) // Set default port if not provided
        };
    } catch (error) {
        console.error("Invalid URL :", error.message);
        return null;
    }
}

const connectionPool = (function () {
    const connections = {}; // key = url, value = {id, connection, apps, status: {connected, initializing, error, disconnected}}
    const channels = {};
    let connectionsCount = 0;

    const obj = {
        setconn: async (url, username, password, app, apps, topics, node) => {
            console.debug(`setconn : url: ${url} , app: ${app} `);
            const existingConnectionInfo = getConnectionByKeyOrId(connections, url);

            if (existingConnectionInfo) {
                if (existingConnectionInfo.status.connected) {
                    console.debug(`connection already exists and connected for ${url}`);
                    node.status({ fill: "green", shape: "dot", text: "connected" });
                    if (!existingConnectionInfo.apps.includes(app)) {
                        console.debug(`Connection already established for url: ${url} -> id: ${existingConnectionInfo.id} apps: ${existingConnectionInfo.apps} but app: ${app} is missing`);
                        existingConnectionInfo.apps.push(app);
                    }
                    return existingConnectionInfo.connection;
                } else if (existingConnectionInfo.status.initializing) {
                    console.debug(`connection initializing for ${url}`);
                    node.status({ fill: "blue", shape: "dot", text: "initializing..." });
                    return existingConnectionInfo.connection;
                } else {
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
                id: null, // will be filled after connection
                connection: client,
                apps: apps, // Initialize the apps array
                status: {
                    connected: false,
                    initializing: true,
                    error: false,
                    disconnected: false
                }
            };

            try {
                await client.connectWebSocket(apps); // registered application
                const info = await client.asterisk.get();
                connections[url].id = info.system.entity_id;
                connections[url].status.connected = true;
                connections[url].status.initializing = false;
                connections[url].status.disconnected = false;
                connections[url].status.error = false;
                connectionsCount = Object.keys(connections).length;
                console.debug(`setconn -> url: ${url} id: ${info.system.entity_id} apps: ${apps} registered done`);
                console.debug(`connections count :`, connectionsCount);
                node.status({ fill: "green", shape: "dot", text: "connected" });
                return client;
            } catch (error) {
                console.error(`Error connecting app: ${app} to WebSocket url ${url} :`, error);
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
            return connectionInfo.connection;  // Retrieve a connection via its ID
        },

        setchan: function (channel) {
            if (channel) {
                const channelId = channel.id;
                if (channels[channelId]) {
                    console.debug(`setchan channel: ${channelId} already defined `);
                } else {
                    //console.debug(`setchan ${channelId} new channel `);
                    channels[channelId] = channel;
                }
                const keyCount = Object.keys(channels).length;
                console.debug(`setchan channel: ${channelId} - channels count ${keyCount} `);
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
            console.debug(`unsetchan channel: ${channelId} - channel's count (before delete): ${keyCount}`);
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

module.exports = { initializeClient, getConnectionByKeyOrId, parseUrl, connectionPool };
