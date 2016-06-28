
var file = {
    settings: {
        first: "First element",
        second: "Second element",
        array: ['one', 'two', 'three', 'four']
    }
}

var settings = copy(file.settings);
settings.first = "No this";
settings.array.shift();

console.log("Original", file.settings);
console.log("Copy", settings);

function copy(object) {
    if (object === null){
        return object;
    } else if (typeof object === 'object'){
        if (Array.isArray(object)){
            return copyArray(object);
        } else {
            return copyObject(object);
        }
    } else {
        return object;
    }
}

function copyObject(_obj){
    var copyObj = {}
    for (var key in _obj) {
        if (_obj.hasOwnProperty(key)) {
            copyObj[key] = copy(_obj[key])
        }
    }
    return copyObj;
}

function copyArray(_obj){
    var copyArray = []
    for (var i = 0; i < _obj.length; i++){
        copyArray[i] = copy(_obj[i])
    }
    return copyArray;
}
