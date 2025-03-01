const availableTopics = [
    "StasisStart",
    "StasisEnd",
    "ContactStatusChange",
    "DeviceStateChanged",
    "EndpointStateChange",
    "Dial",
    "ChannelConnectedLine",
    "ChannelHangupRequest",
    "TextMessageReceived",
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
    "ChannelVarset",
    "ChannelToneDetected",
    "ChannelTalkingStarted",
    "ChannelTalkingFinished",
    "ChannelHold",
    "ChannelUnhold",
    "PeerStatusChange",
    "PlaybackStarted",
    "PlaybackContinuing",
    "PlaybackFinished",
    "RecordingStarted",
    "RecordingFinished",
    "RecordingFailed"
];

const listenerDefaultTopics = [
    "StasisStart",
    "StasisEnd",
    "DeviceStateChanged",
    "EndpointStateChange",
    "Dial",
    "ChannelConnectedLine",
    "ChannelHangupRequest",
    "ChannelCreated",
    "ChannelDestroyed",
    "ChannelStateChange",
    //"ChannelDtmfReceived",
    "ChannelDialplan",
    "ChannelCallerId",
    "PeerStatusChange"
];

const originateDefaultTopics = [
    "StasisStart",
    "StasisEnd",
    "DeviceStateChanged",
    "EndpointStateChange",
    "Dial",
    "ChannelConnectedLine",
    "ChannelHangupRequest",
    "ChannelCreated",
    "ChannelDestroyed",
    "ChannelStateChange",
    "ChannelDialplan",
    "ChannelCallerId",
    "PeerStatusChange"
];


const defaultTopicsNodeType = { 'ari_listener': listenerDefaultTopics,
                                'ari_originate': originateDefaultTopics };



// Vérifier si on est dans Node.js (serveur) ou dans le navigateur
if (typeof module !== "undefined" && module.exports) {
    module.exports = { availableTopics, defaultTopicsNodeType }; // Export pour Node.js
} else {
    window.availableTopics = availableTopics; // Définit en variable globale pour le navigateur
}

//module.exports = { availableTopics };