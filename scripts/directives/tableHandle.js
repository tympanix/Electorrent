angular.module("torrentApp").directive('handle', ["$timeout", function($timeout) {
    return {
        restrict: 'C',
        link: link
    };

    function link(scope, handle /*, attr*/){

        $timeout(function(){
            intilialize(scope, handle);
        }, 100)

    }

    function intilialize(scope, handle){
        var table = $(handle).closest('table');
        var column = $(handle).parent();
        var minWidth = 25

        // Replace columns width with absolut measurements
        $(column).width($(column).width())

        $(handle).height($(table).height())

        $(column).resize(function(){
            console.log("Resize!");
            $(handle).height($(table).height());
        })

        $(handle).mousedown(function(event){
            event.preventDefault();
            $(table).unbind();
            $(handle).addClass('active');

            var orgX = event.clientX;
            var orgWidth = $(column).width();
            console.log("Width", orgWidth);

            $(table).mousemove(function(event){
                var newX = event.clientX;
                var diffX = newX - orgX;
                var newWidth = orgWidth - diffX;

                if (newWidth < minWidth) newWidth = minWidth;
                $(column).width(newWidth);
            })

            $(table).one('mouseup', function(event){
                $(handle).removeClass('active');
                $(table).unbind();
            })

            $(table).one('mouseleave', function(event){
                $(handle).removeClass('active');
                $(table).unbind();
            })
        })
    }

}]);
