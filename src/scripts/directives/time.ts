
export let time = ['$timeout', '$filter', function($timeout, $filter) {

    const DAY = 60*60*24*1000
    const HOUR = 60*60*1000
    const MINUTE = 60*1000

    let filter = $filter('date')

    return {
        restrict: 'A',
        scope: {
          time: "="
        },
        compile: compile
    };

    function compile(/*element, attr, ctrl*/) {
        return link;
    }

    function link(scope, element /*, attr, ctrl*/){
        var timer

        element.bind('$destroy', function() {
            $timeout.cancel(timer)
        })

        function startTimer(scope, element) {
            let next = nextUpdate(scope)

            if (next) {
                timer = $timeout(function() {
                    updateTime(scope, element)
                    startTimer(scope, element)
                }, next)
            }
        }

        updateTime(scope, element)
        startTimer(scope, element)
    }

    function updateTime(scope, element) {
        element.html(filter(scope.time))
    }

    function nextUpdate(scope) {
        var date = new Date(scope.time)
        var diff = Math.abs(Date.now() - date.getTime())

        if (diff > DAY) {
            return
        } else if (diff < HOUR) {
            return MINUTE
        } else if (diff < 6*HOUR) {
            return 15*MINUTE
        } else {
            return 30*MINUTE
        }

    }

}];

