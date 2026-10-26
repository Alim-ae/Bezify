/* Minimal CEP bridge for this panel. */
function CSInterface() {}

CSInterface.prototype.evalScript = function (script, callback) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.evalScript(script, callback);
    } else if (callback) {
        callback("CEP is unavailable. Open this page from After Effects.");
    }
};
