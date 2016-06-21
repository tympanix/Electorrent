angular.module("torrentApp").directive('contextMenu', ['$document', '$window', function($document, $window) {
    return {
        restrict: 'E',
        scope : {
            bind: '='
        },
        link: link
    }

    function link(scope, element){
        element.data('contextmenu',true);

        // Bind show function to scope variable
        scope.bind = { show: showContextMenu(element) };

        // Remove context menu when user clicks anywhere not in the context menu
        angular.element($document[0].body).on('click',function(event) {
            var inContext =  angular.element(event.target).inheritedData('contextmenu');
            if (!inContext) {
                $(element).hide();
            }
        });

        // Remove context menu when user presses the escape key
        angular.element($document).on('keyup', function(event){
            if (event.keyCode === 27 /* Escape key */){
                $(element).hide();
            }
        });

        // Remove context menu on window resize
        angular.element($window).on('resize', function(event){
            $(element).hide();
        });

        // Remove context menu when the user scrolls the main content
        angular.element('.main-content').bind("scroll", function() {
            $(element).hide();
        });
    }

    function showContextMenu(element){
        return function(event){
            var totWidth = $(window).width();
            var totHeight = $(window).height();

            var menuWidth = $(element).width();
            var menuHeight = $(element).height();

            var posX = event.pageX;
            var posY = event.pageY;

            var menuX = posX;
            var menuY = posY;

            if (posX + menuWidth >= totWidth) menuX -= menuWidth;
            if (posY + menuHeight >= totHeight) menuY -= menuHeight;

            $(element).css({
                left: menuX,
                top: menuY,
                display: 'block'
            });
        }
    }
}]);
