module.exports = function (RED) {
    function AsteriskAriNode(n) {
        RED.nodes.createNode(this, n);
        this.url = n.url;
        this.apps = n.apps || ""; // Liste d'applications sous forme de chaîne
        this.credentials = this.credentials || {};
    }

    RED.nodes.registerType("asterisk_ari", AsteriskAriNode, {
        category: "config",
        defaults: {
            url: { type: "text", required: true }, // ex http://localhost:8088
            apps: { value: "", required: true } // Chaîne de texte (ex: "app1,app2,app3")
        },
        credentials: {
            username: { type: "text", required: true },
            password: { type: "password", required: true }
        }
    });
};