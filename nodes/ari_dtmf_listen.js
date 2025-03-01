const { connectionPool } = require("../lib/ari-client");

module.exports = function (RED) {
    "use strict";

    function ari_dtmf_listen(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.name = n.name || node.type;
        node.codes = n.codes?.split(',') || [];
        node.codeLength = n.codeLength || 4;
        node.codeTimeout = n.codeTimeout || 5000;
        console.debug(node.codes, node.codeLength, node.codeTimeout);

        /*
        const validCodes = ["1234", "5678"]; // List of valid codes
        const maxLength = 4;
        const timeoutMs = 5000; // 5 seconds timeout
        */

        // Callback when the code is correct
        function successCallback(code) {
            console.log(`✅ Correct code entered: ${code}`);
            const successMsg = { ...node.msg, code: code };
            successMsg.event = 'CodeSuccessfull';
            delete successMsg.dtmf;
            node.send([successMsg, null, null]);
            node.status({ fill: "blue", shape: "dot", text: `dtmf: code ${successMsg.code}` });
        }

        // Callback when the code is incorrect
        function failureCallback(code) {
            console.log(`❌ Incorrect code entered: ${code}`);
        }

        // Create the DTMF checker
        const dtmfChecker = createDTMFChecker(node.codes, node.codeLength, node.codeTimeout, successCallback, failureCallback);
        //const dtmfChecker = createDTMFChecker(validCodes, maxLength, timeoutMs, successCallback, failureCallback);

        // Simulating DTMF entry
        dtmfChecker.checkDigit("1");
        dtmfChecker.checkDigit("2");
        dtmfChecker.checkDigit("3");
        dtmfChecker.checkDigit("#"); // ✅ Success: "123#" is valid

        dtmfChecker.checkDigit("5");
        dtmfChecker.checkDigit("6");
        dtmfChecker.checkDigit("7");
        // If no digit is entered for 5 seconds, it resets automatically

        dtmfChecker.reset(); // Manually reset the input

        node.status({});

        node.on('input', async function (msg) {
            try {
                node.status({ fill: "blue", shape: "dot", text: `waiting dtmf ${msg.channelId}` });
                node.app = msg.app;
                node.msg = msg;
                const channel = connectionPool.getchan(node.msg.channelId);
                if (!channel) {
                    const err = `${node.type} channel ${node.msg.channelId} not found, maybe hangup`;
                    node.error(err);
                    node.status({});
                    return;
                }
                console.debug(`${node.type} channel: ${channel.id}`);
                channel.on('ChannelDtmfReceived', event => {
                    console.log(`${node.type} ChannelDtmfReceived dtmf ${event.dtmf} :`, event.channel.id);
                    //console.debug('event=',event);
                    //console.debug('msg=',msg);
                    dtmfChecker.checkDigit(event.dtmf);
                    node.msg.event = 'ChannelDtmfReceived';
                    node.msg.dtmf = event.dtmf;
                    node.msg.payload.type = event.type;
                    node.send([null, node.msg, null]);
                    node.status({ fill: "blue", shape: "dot", text: `dtmf: ${node.msg.dtmf}` });
                });
                channel.on('ChannelDestroyed', event => {
                    console.log(`${node.type} ChannelDestroyed :`, event.channel.id);
                    node.msg.event = 'ChannelDestroyed';
                    node.send([null, null, node.msg]);
                    node.status({});
                });
                console.debug(`${node.type} listening...`);
            } catch (err) {
                console.error(`${node.type} channel: ${node.msg.channelId}`, err);
                node.error(err);
                node.status({});
            }
        });

        this.on("close", function () {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.cliant.disconnect();
        });
    }

    function createDTMFChecker(validCodes, maxLength, timeoutMs, onSuccess, onFailure) {
        let enteredCode = "";
        let timeoutHandle = null;

        function resetContext() {
            enteredCode = "";
            if (timeoutHandle) clearTimeout(timeoutHandle);
        }

        function startTimeout() {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            timeoutHandle = setTimeout(() => {
                console.log("⏳ Timeout: Resetting entered code.");
                resetContext();
            }, timeoutMs);
        }

        return {
            checkDigit: function (digit) {
                enteredCode += digit;
                startTimeout();

                // Check if max length is reached
                if (enteredCode.length >= maxLength) {
                    if (validCodes.includes(enteredCode)) {
                        onSuccess(enteredCode);
                    } else {
                        onFailure(enteredCode);
                    }
                    resetContext(); // Reset after validation
                }
            },

            reset: function () {
                console.log("🔄 Manual reset triggered.");
                resetContext();
            }
        };
    }


    RED.nodes.registerType("ari_dtmf_listen", ari_dtmf_listen);
}
