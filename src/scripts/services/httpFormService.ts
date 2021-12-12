export let httpFormService = [function() {

    // I prepare the request data for the form post.
    function transformRequest(data, getHeaders) {
        var headers = getHeaders();
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        return(serializeData(data));
    }

    // Return the factory value.
    return(transformRequest);

    function serializeData(data) {
        // If this is not an object, defer to native stringification.
        if(!angular.isObject(data)) {
            return((data === null) ? "" : data.toString());
        }

        var buffer = [];
        // Serialize each key in the object.
        for(var name in data) {
            if(!data.hasOwnProperty(name)) {
                continue;
            }
            var value = data[name];
            buffer.push(parseComponent(name, value));
        }

        // Serialize the buffer and clean it up for transportation.
        return buffer.join("&")
    }

    function parseComponent(name, value) {
        return encodeURIComponent(name) + "=" + parseValue(value);
    }

    function parseValue(value){
        if (Array.isArray(value)) {
            var encoded = value.map(encodeURIComponent);
            return encoded.join('|');
        } else if (value !== null) {
            return encodeURIComponent(value)
        } else {
            return "";
        }
    }
}];