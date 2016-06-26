angular.module("torrentApp").directive('contextMenu', ['$document', '$window', function($document, $window) {
    return {
        restrict: 'E',
        link: link
    };

    function link(scope, element, attr){
        element.data('contextmenu',true);

        // Bind show function to scope variable
        scope[attr.bind] = {
            show: showContextMenu(element),
            hide: hideContextMenu(element)
        };

        // Remove context menu when user clicks anywhere not in the context menu
        angular.element($document[0].body).on('click',function(event) {
            var inContext =  angular.element(event.target).inheritedData('contextmenu');
            if (!inContext) {
                $(element).hide();
            }
        });

        //Remove context menu when user presses the escape key
        angular.element($document).on('keyup', function(event){
            if (event.keyCode === 27 /* Escape key */){
                $(element).hide();
            }
        });

        $(element).find('.context.dropdown').each(function(){
            $(this)
            .mouseenter(function(){
                var menu = $(this).find('.menu')
                // var height = menu.innerHeight();
                // menu.addClass('upward');
                // menu.css('margin-top', (-1*height) + 'px')
                menu.show();
            })
            .mouseleave(function(){
                $(this).find('.menu').hide();
            });
        });
    }

    function bindCloseOperations(element) {
        // Remove context menu when the user scrolls the main content
        $('.main-content').one('scroll', function() {
            console.log("Scroll!");
            $(element).hide();
        });

        // Remove context menu on window resize
        $($window).one('resize', function(){
            console.log("Resize!");
            $(element).hide();
        });
    }

    function showContextMenu(element){
        return function(event){
            bindCloseOperations(element);

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
        };
    }

    function hideContextMenu(element) {
        return function(){
            $(element).hide();
        };
    }
}]);
