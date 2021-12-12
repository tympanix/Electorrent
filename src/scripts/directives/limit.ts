
export let limitBind = [function() {
    return {
        scope: false,
        controller: controller,
        bindToController: {
            limit: '=limitBind'
        },
        link: link
    };

    function link(scope, element, attr, ctrl) {
        ctrl.setContainer(element)

        $(window).on('resize', function() {
            scope.$apply(function() {
                ctrl.updateLimit()
            })
        })
    }

    function controller() {
        this.updateLimit = function(element, force) {
            if (element) {
                this.elementHeight = element.outerHeight()
            }
            var limit = Math.ceil(this.container.innerHeight() / this.elementHeight)
            if (limit > this.limit || force) {
                this.limit = limit
            }
        }

        this.setContainer = function(element) {
            this.container = element
        }
    }

}];

export let limitSource = function() {
    return {
        scope: false,
        require: '^^limitBind',
        link: link
    };

    function link(scope, element, attr, ctrl) {
        if (scope.$first) {
            ctrl.updateLimit(element, true)
        }
    }

};

