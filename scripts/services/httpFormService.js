angular.module('torrentApp').factory("httpFormService", function() {

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
            buffer.push(
                encodeURIComponent(name) +
                "=" +
                encodeURIComponent((value === null) ? "" : value)
            );
        }

        // Serialize the buffer and clean it up for transportation.
        return buffer.join("&").replace(/%20/g, "+");
    }
});