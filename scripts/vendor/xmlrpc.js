// Fix an IE problem (another one)
var HAS_ACTIVEX = false;
try {
    new ActiveXObject('MSXML2.DOMDocument');
    HAS_ACTIVEX = true;
} catch(e) {}

/**
 * XML-RPC communication service.
 */
angular.module('xml-rpc', [])

.factory('js2xml', ['helperXmlRpc', function(helperXmlRpc){
    /**
     * Convert Null to XmlRpc valid value (as xml element)
     */
    function null2xml_(doc, input) {
        return helperXmlRpc.createNode(doc, 'nil');
    };

    var js2xmlMethod_ = {};

    /**
     * Convert a string to a valid xmlrpc value (as xml element).
     */
    function string2xml_(doc, input) {
        return helperXmlRpc.createNode(doc, 'string', input);
    };
    js2xmlMethod_['string'] = string2xml_;

    /**
     * Convert a number to a valid xmlrpc value (as xml element).
     */
    function number2xml_(doc, input) {
        var type  = 'int',
            value = parseInt(input),
            f     = parseFloat(input);
        if (value != f) {
            type  = 'double';
            value = f;
        }
        return helperXmlRpc.createNode(doc, type, value.toString());
    };
    js2xmlMethod_['number'] = number2xml_;

    
    /**
     * Convert a boolean to a valid xmlrpc value (as xml element).
     */
    function boolean2xml_(doc, input) {
        return helperXmlRpc.createNode(doc, 'boolean', (input ? '1' : '0'));
    };
    js2xmlMethod_['boolean'] = boolean2xml_;

     


    /**
     * Convert an Array object to a valid xmlrpc value (as xml element).
     */
    function array2xml_(doc, input) {
        var elements = [];
        for (var i=0; i < input.length; i++) {
            elements.push(js2xml_(doc, input[i]));
        }
        return helperXmlRpc.createNode(doc, 'array',
            helperXmlRpc.createNode(doc, 'data', elements)
        );
    };

    /**
     * Convert an object to a valid xmlrpc value (as xml element).
     */
    function struct2xml_(doc, input) {
        var elements = [];
        for (var name in input) {
            elements.push(helperXmlRpc.createNode(doc, 'member',
                helperXmlRpc.createNode(doc, 'name', name),
                js2xml_(doc, input[name])
            ));
        }
        return helperXmlRpc.createNode(doc, 'struct', elements);
    };


    /**
     * Convert a DateTime object to a valid xmlrpc value (as xml element).
     */
    function date2xml_(doc, input) {
        var str = [
            input.getFullYear(),
            (input.getMonth() + 1 < 10)? '0' + (input.getMonth() + 1):input.getMonth() + 1,
            (input.getDate() < 10)? '0' + (input.getDate()):input.getDate(),
            'T',
            (input.getHours() < 10)? '0' + (input.getHours()):input.getHours(), ':',
            (input.getMinutes() < 10)? '0' + (input.getMinutes()):input.getMinutes(), ':',
            (input.getSeconds() < 10)? '0' + (input.getSeconds()):input.getSeconds(),
        ];

        return helperXmlRpc.createNode(doc, 'dateTime.iso8601', str.join(''));
    };

    /**
     * Convert an object to a valid xmlrpc value (as xml element).
     */
    function object2xml_(doc, input) {
        if (input instanceof Date) {
            return date2xml_(doc, input);
        }
        //else
        if (input instanceof Array)
            return array2xml_(doc, input);
        //else
        return struct2xml_(doc, input);
    };
    js2xmlMethod_['object'] = object2xml_;


    /**
     * Converts a javascript object to a valid xmlrpc value (as xml element).
     */
    function js2xml_(doc, input) {
        var type = typeof(input);
        var method = js2xmlMethod_[type];
        if (input === null) {
            method = null2xml_;
        } else if (method == undefined) {
            method = string2xml_;
        }
        return helperXmlRpc.createNode(doc, 'value', method(doc, input));
    };

    return {
        js2xml:js2xml_
    };
}])

.factory('xml2js', ['helperXmlRpc', function(helperXmlRpc){

    var isTrue_ = {
        '1':    true,
        'true': true
    };

    var xml2jsMethod_ = {};

    /**
     * Convert an xmlrpc string value (as an xml tree) to a javascript string.
     */
    function xml2null_(input) {
        return null;
    };
    xml2jsMethod_['nil'] = xml2null_;

    
    /**
     * Convert an xmlrpc string value (as an xml tree) to a javascript string.
     *
     * @param {!Element} input Xmlrpc string to convert.
     * @return {string} Javascript conversion of input.
     * @protected
     */
    function xml2string_(input) {
        var buf = [];
        helperXmlRpc.getTextContent(input, buf, false);
        return buf.join('');
    };
    xml2jsMethod_['string'] = xml2string_;

    /**
     * Convert an xmlrpc number (int or double) value to a javascript number.
     */
    function xml2number_(input) {
        return parseFloat(helperXmlRpc.getTextContent(input, []));
    };
    xml2jsMethod_['int'] = xml2number_;
    xml2jsMethod_['i8'] = xml2number_;
    xml2jsMethod_['i4'] = xml2number_;
    xml2jsMethod_['double'] = xml2number_;

     
    /**
     * Convert an xmlrpc boolean value to a javascript boolean.
     */
    function xml2boolean_(input) {
        var value = helperXmlRpc.getTextContent(input, []).toLowerCase();
        return isTrue_[value] || false;
    };
    xml2jsMethod_['boolean'] = xml2boolean_;

    /**
     * Convert an xmlrpc struct value to a javascript object.
     */
    function xml2struct_(input) {
        var memberNodes = helperXmlRpc.selectNodes(input, 'member') || [];
        var obj = {};
        for (var i=0; i < memberNodes.length; i++) {
            var node = helperXmlRpc.selectSingleNode(memberNodes[i], 'name');
            // If no name found, member is ignored
            if (node) {
                var label = helperXmlRpc.getTextContent(node, []);
                node = helperXmlRpc.selectSingleNode(memberNodes[i], 'value');
                obj[label] = xml2js_(node);
            }
        }
        return obj;
    };
    xml2jsMethod_['struct'] = xml2struct_;

    /**
     * Convert an xmlrpc array value to a javascript array.
     */
    function xml2array_(input) {
        var valueNodes = helperXmlRpc.selectNodes(input, 'data/value');
        if (!valueNodes.length) {
            valueNodes = helperXmlRpc.selectNodes(input, './value');
        }
        if (!valueNodes.length)
            return [];
        //else
        var map_ = (Array.prototype.map) ?
            function(arr, f, opt_obj) {
                return Array.prototype.map.call(arr, f, opt_obj);
            } :
            function(arr, f, opt_obj) {
                var l = arr.length;  // must be fixed during loop... see docs
                var res = new Array(l);
                var arr2 = (typeof arr == 'string') ? arr.split('') : arr;
                for (var i = 0; i < l; i++) {
                    if (i in arr2) {
                        res[i] = f.call(opt_obj, arr2[i], i, arr);
                    }
                }
                return res;
            };        

        return map_(valueNodes, xml2js_);
    };
    xml2jsMethod_['array'] = xml2array_;

    /**
     * Convert an xmlrpc dateTime value to an itrust.date.DateTime.
     */
    function xml2datetime_(input) {
        var value = helperXmlRpc.getTextContent(input, []);
        if (!value) {
            return new Date();
        }
        if (value[value.length-1]=='T') {
            value = value.substring(0, value.length-1);
        }
        var parts = value.match(/\d+/g);
        if(value.indexOf('-') == -1){
            var toSplit = parts[0];
            parts[0] = toSplit.substring(0,4);
            parts.splice(1, 0, toSplit.substring(4,6));
            parts.splice(2, 0, toSplit.substring(6));
        }
        return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
    };
    xml2jsMethod_['datetime'] = xml2datetime_;
    xml2jsMethod_['datetime.iso8601'] = xml2datetime_;

    

    /**
     * Convert an xmlrpc value (as an xml tree) to a javascript object.
     */
    function xml2js_(input) {
        var elt = helperXmlRpc.selectSingleNode(input, './*');
        if (!elt)
            return null;
        //else
        var method = xml2jsMethod_[elt.nodeName.toLowerCase()];
        if (method == undefined) {
            method = xml2struct_;
        }
        return method(elt);
    };

    return {
        xml2js:xml2js_,
    };
}])

.factory('xmlrpc', ['$http', 'helperXmlRpc', 'js2xml', 'xml2js', function($http, helperXmlRpc, js2xml, xml2js){
    var configuration = {};

    /**
     * Serialize a XML document to string.
     */
    function serialize(xml){
        var text = xml.xml;
        if (text) {
            return text;
        }
        if (typeof XMLSerializer != 'undefined') {
            return new XMLSerializer().serializeToString(xml);
        }
        throw Error('Your browser does not support serializing XML documents');
    };

    /**
     * Creates a xmlrpc call of the given method with given params.
     */
    function createCall(method, params){
        var doc = helperXmlRpc.createDocument('methodCall');
        doc.firstChild.appendChild(
            helperXmlRpc.createNode(doc, 'methodName', method)
        );
        if (arguments.length > 2) {
            params = helperXmlRpc.cloneArray(arguments);
            params.shift(); 
        }
        if (params && params.length > 0) {
            var paramsNode = helperXmlRpc.createNode(doc, 'params');
            for (var i=0; i < params.length; i++) {
                paramsNode.appendChild(helperXmlRpc.createNode(doc, 'param',
                    js2xml.js2xml(doc, params[i])
                ));
            }
            doc.firstChild.appendChild(paramsNode);
        }
        return (serialize(doc)).replace(/[\s\xa0]+$/, '');

    };

    // Use the promise system from angular.
    // This method return a promise with the response
    function callMethod(method, params){
        var xmlstr = createCall(method, params);
        var targetAddr = configuration.hostName + "" + configuration.pathName;
        return $http.post(targetAddr, xmlstr, {headers: {'Content-Type': 'text/xml'}})
            .then(function(responseFromServer) {
                var responseText = responseFromServer.data;
                var response = null;
                try {
                    response = parseResponse(responseText);
                } catch (err) {
                    response = err;
                }
                return response;
            }, function(responseFromServer){
                if(responseFromServer.status in configuration){
                    if(typeof configuration[responseFromServer.status] == "function"){
                        return configuration[responseFromServer.status].call();
                    }
                }
            });
    };


    /**
     * Parse an xmlrpc response and return the js object.
     */
    function parseResponse(response){
        var doc = helperXmlRpc.loadXml(response);
        var rootNode = doc.firstChild;
        if (!rootNode)
            return undefined;
        //else
        var node = helperXmlRpc.selectSingleNode(rootNode, '//fault');
        var isFault = (node != undefined);
        node = helperXmlRpc.selectSingleNode(rootNode, '//value');
        var value = xml2js.xml2js(node);
        if (isFault) {
            throw value;
        }
        //else
        return value;
    };

    /**
     * Configure the service (Host name and service path).
     * Actually, 401, 404 and 500 server errors are originally defined, but any error code can be added
     */
    function config(conf) {
        angular.extend(configuration, {
            hostName:"",
            pathName:"/rpc2",
            500:function(){},
            401:function(){},
            404:function(){}
        }, conf);
    };

    config();

    return {
        callMethod : callMethod,
        config : config
    };
}])


.factory('helperXmlRpc', function(){
    /**
     * Clones an array object
     */
    function cloneArray_(object){
        var length = object.length;

        if (length > 0) {
            var rv = new Array(length);
            for (var i = 0; i < length; i++) {
                rv[i] = object[i];
            }
            return rv;
        }
        return [];
    };
 
    /**
     * Creates a XML document for IEs browsers 
     */
    function createMsXmlDocument_(){
        var doc = new ActiveXObject('MSXML2.DOMDocument');
        if (doc) {
            doc.resolveExternals = false;
            doc.validateOnParse = false;
            try {
                doc.setProperty('ProhibitDTD', true);
                doc.setProperty('MaxXMLSize', 2 * 1024);
                doc.setProperty('MaxElementDepth', 256);
            } catch (e) {
                // No-op.
            }
        }
        return doc;
    };
    
    /**
     * Creates a XML document
     */
    function createDocument(opt_rootTagName, opt_namespaceUri){
        if (opt_namespaceUri && !opt_rootTagName) {
            throw Error("Can't create document with namespace and no root tag");
        }
        if (HAS_ACTIVEX) {
            var doc = createMsXmlDocument_();
            if (doc) {
                if (opt_rootTagName) {
                    doc.appendChild(doc.createNode(1,
                                       opt_rootTagName,
                                       opt_namespaceUri || ''));
                }
                return doc;
            }
        }
        else if (document.implementation && document.implementation.createDocument) {
            return document.implementation.createDocument(opt_namespaceUri || '',
                                                  opt_rootTagName || '',
                                                  null);
        } 
        throw Error('Your browser does not support creating new documents');
    };

    
    /**
     * Creates a XML node and set the child(ren) node(s)
     */
    function createNode(doc, nodeName, children){
        var elt = doc.createElement(nodeName);

        var appendChild = function(child) {
            if(typeof child == 'object' && child.nodeType !== 1){
                for(var i in child){
                    elt.appendChild(
                        (typeof child == 'string') ? doc.createTextNode(child[i]) : child[i]
                    );
                }
            } else {
                elt.appendChild(
                    (typeof child == 'string') ? doc.createTextNode(child) : child
                );
            }
        }
        if (arguments.length > 3) {
            children = cloneArray_(arguments);
            children.shift(); //shift doc
            children.shift(); //shift nodeName
        }
        if (typeof children == 'array') {
            angular.forEach(children, appendChild);
        } else if (children) {
            appendChild(children);
        }
        return elt;
    };

    /**
     * Generate an ID for XMLRPC request
     */
    function generateId(){
        return 'xmlrpc-'+(new Date().getTime())+'-'+Math.floor(Math.random()*1000);
    };
 
    /**
     * Creates an XML document from a string
     */
    function loadXml_(xml) {
        if (HAS_ACTIVEX) {
            var doc = createMsXmlDocument_();
            doc.loadXML(xml);
            return doc;
        }
        else if (typeof DOMParser != 'undefined') {
            return new DOMParser().parseFromString(xml, 'application/xml');
        }
        throw Error('Your browser does not support loading xml documents');
    };

    /**
     * Returns the document in which the node is.
     */
    function getOwnerDocument_(node) {
        return (
            node.nodeType == 9 ? node :
            node.ownerDocument || node.document);
    };
    
    /**
     * Return a single node with the given name in the given node
     */
    function selectSingleNode_(node, path) {
        if (typeof node.selectSingleNode != 'undefined') {
            var doc = getOwnerDocument_(node);
            if (typeof doc.setProperty != 'undefined') {
                doc.setProperty('SelectionLanguage', 'XPath');
            }
            return node.selectSingleNode(path);
        } else if (document.implementation.hasFeature('XPath', '3.0')) {
            var doc = getOwnerDocument_(node);
            var resolver = doc.createNSResolver(doc.documentElement);
            var result = doc.evaluate(path, node, resolver,
                XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue;
        }
        return null;
    };

    /**
     * Returns the string content of a node
     */
    function getTextContent_(node, buf, normalizedWhitespace){
        var PREDEFINED_TAG_VALUES_ = {'IMG': ' ', 'BR': '\n'};
        if (node.nodeName in ['SCRIPT', 'STYLE', 'HEAD', 'IFRAME', 'OBJECT']) {
            // ignore certain tags
        } else if (node.nodeType == 3) {
            if (normalizedWhitespace) {
                buf.push(String(node.nodeValue).replace(/(\r\n|\r|\n)/g, ''));
            } else {
                
                buf.push(node.nodeValue);
            }
        } else if (node.nodeName in PREDEFINED_TAG_VALUES_) {
            buf.push(PREDEFINED_TAG_VALUES_[node.nodeName]);
        } else {
            var child = node.firstChild;
            while (child) {
                getTextContent_(child, buf, normalizedWhitespace);
                child = child.nextSibling;
            }
        }
        return buf.join('');
    };

    /**
     * Returns all the nodes in a array that are inside the given node with the given path
     */
    function selectNodes_(node, path) {
        if (typeof node.selectNodes != 'undefined') {
            var doc = getOwnerDocument_(node);
            if (typeof doc.setProperty != 'undefined') {
                doc.setProperty('SelectionLanguage', 'XPath');
            }
            return node.selectNodes(path);
        } else if (document.implementation.hasFeature('XPath', '3.0')) {
            var doc = getOwnerDocument_(node);
            var resolver = doc.createNSResolver(doc.documentElement);
            var nodes = doc.evaluate(path, node, resolver,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            var results = [];
            var count = nodes.snapshotLength;
            for (var i = 0; i < count; i++) {
                results.push(nodes.snapshotItem(i));
            }
            return results;
        } else {
            return [];
        }
    };

    return {
        cloneArray:cloneArray_,
        createDocument: createDocument,
        createNode: createNode,
        generateId: generateId,
        loadXml: loadXml_,
        getOwnerDocument:getOwnerDocument_,
        selectNodes: selectNodes_,
        getTextContent : getTextContent_,
        selectSingleNode: selectSingleNode_
    };

});
