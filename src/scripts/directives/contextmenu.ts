
export let contextMenu = ['$rootScope', '$document', '$window', 'electron', function($rootScope, $document, $window, electron) {

    var contextMenu = null;
    var checkboxes = []
    var previousFocus = null;

    return {
        restrict: 'E',
        scope: {
            menu: '=',
            bind: '=',
            click: '=',
            debug: '=?'
        },
        compile: compile
    };

    function compile(element) {
        contextMenu = element;
        element.addClass('torrent context menu');
        return link;
    }

    function render(scope, element, attr?){
        if (!scope.menu) return;

        element.empty();
        checkboxes = []

        var list = angular.element('<div class="ui vertical menu" role="menu"></div>');

        element.append(list);

        if (electron.program.debug) {
            appendDebugItem(list, scope);
        }

        scope.menu.forEach(function(item){
            if (item.menu) {
                appendSubmenu(list, item, scope);
            } else {
                appendMenuItem(list, item, scope);
            }
        });

        bindMenuActions(element);

    }

    function appendDebugItem(element, scope) {
        if (typeof scope.debug !== 'function') return;

        var debug = {
            label: 'Debug',
            icon: 'help',
            click: scope.debug
        }
        appendMenuItem(element, debug, scope)
    }

    function appendMenuItem(element, item, scope) {
        var menuItem = angular.element('<a class="item" role="menuitem" tabindex="-1"></a>');

        if (item.role) {
            menuItem.attr('data-role', item.role)
        }

        if (item.icon) {
            addIcon(menuItem, item.icon);
        } else if (item.check) {
            addCheckbox(menuItem, item.check);
        }

        menuItem.bind('click', function() {
            hideAndRestoreFocus(element);
            scope.click(item.click, item.label);
        });

        menuItem.bind('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                hideAndRestoreFocus(element);
                scope.click(item.click, item.label);
            }
        });

        menuItem.append(item.label);
        element.append(menuItem);
    }

    function addCheckbox(item, predicate) {
        var check = angular.element('<div class="ui checkbox"></div>')
        var checkbox = angular.element('<input type="checkbox">')
        var label = angular.element('<label></label>')
        check.append(checkbox)
        check.append(label)
        item.append(check)
        checkboxes.push({
            checkbox: checkbox[0],
            predicate: predicate
        })
    }

    function addIcon(item, iconName) {
        var icon = angular.element('<i></i>')
        icon.addClass('ui ' + iconName + ' icon');
        icon.attr('aria-hidden', 'true');
        item.append(icon);
    }

    function appendSubmenu(element, submenu, scope) {
        var list = angular.element('<div class="ui context dropdown item" role="menuitem" aria-haspopup="true" aria-expanded="false" tabindex="-1">');
        var menu = angular.element('<div class="menu" role="menu">');

        submenu.menu.forEach(function(item) {
            appendMenuItem(menu, item, scope);
        });

        addIcon(list, 'dropdown');

        list.append(submenu.label);
        list.append(menu);
        element.append(list);

    }

    function getMenuItems(container) {
        return $(container).find('[role="menuitem"]').not(function() {
            // Exclude items inside hidden submenus
            var parentMenu = $(this).closest('[role="menu"]');
            return parentMenu.length > 1 && parentMenu.first().css('display') === 'none';
        });
    }

    function getVisibleMenuItems(container) {
        return $(container).children('[role="menu"]').first().children('[role="menuitem"]');
    }

    function focusItemByIndex(items, index) {
        if (items.length === 0) return;
        if (index < 0) index = items.length - 1;
        if (index >= items.length) index = 0;
        items.eq(index).focus();
    }

    function bindMenuActions(element) {
        $(element).find('.context.dropdown').each(function(){
            var dropdown = $(this);
            dropdown
            .mouseenter(function(){
                openSubmenu(dropdown);
            })
            .mouseleave(function(){
                closeSubmenu(dropdown);
            });
        });
    }

    function openSubmenu(dropdown) {
        var menu = dropdown.find('.menu');
        menu.show();
        dropdown.attr('aria-expanded', 'true');
    }

    function closeSubmenu(dropdown) {
        var menu = dropdown.find('.menu');
        menu.hide();
        dropdown.attr('aria-expanded', 'false');
    }

    function hideAndRestoreFocus(element) {
        var el = $(element);
        if (el.css('display') === 'none') return;
        el.css('display', 'none');
        el.attr('aria-hidden', 'true');
        if (previousFocus) {
            previousFocus.focus();
            previousFocus = null;
        }
    }

    function link(scope, element, attr){
        scope.program = electron.program;

        element.data('contextmenu', true);
        element.attr('role', 'menu');
        element.attr('aria-label', 'Torrent actions');

        render(scope, element, attr);

        // Bind show function to scope variable
        scope.bind = {
            show: showContextMenu(scope, element),
            hide: hideContextMenu(scope, element)
        };

        // Remove context menu when user clicks anywhere not in the context menu
        angular.element($document[0].body).on('click',function(event) {
            var rootElement: any = angular.element(event.target)
            var inContext = rootElement.inheritedData('contextmenu');
            if (!inContext) {
                hideAndRestoreFocus(element);
            }
        });

        // Handle keyboard navigation within the context menu
        angular.element(element).on('keydown', function(event) {
            var visible = $(element).is(':visible');
            if (!visible) return;

            var topItems = getVisibleMenuItems(element);
            var focused: any = $(document.activeElement);
            var currentIndex = topItems.index(focused);

            // Check if we're inside a submenu
            var parentDropdown: any = focused.closest('.context.dropdown');
            var inSubmenu = parentDropdown.length > 0 && focused.closest('.menu').parent('.context.dropdown').length > 0;

            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (inSubmenu) {
                    // Close submenu, focus parent item
                    closeSubmenu(parentDropdown);
                    parentDropdown.focus();
                } else {
                    hideAndRestoreFocus(element);
                }
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                if (inSubmenu) {
                    var subItems = parentDropdown.find('.menu [role="menuitem"]');
                    var subIndex = subItems.index(focused);
                    focusItemByIndex(subItems, subIndex + 1);
                } else {
                    focusItemByIndex(topItems, currentIndex + 1);
                }
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                if (inSubmenu) {
                    var subItems = parentDropdown.find('.menu [role="menuitem"]');
                    var subIndex = subItems.index(focused);
                    focusItemByIndex(subItems, subIndex - 1);
                } else {
                    focusItemByIndex(topItems, currentIndex - 1);
                }
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                event.stopPropagation();
                // Open submenu if focused item has one
                if (focused.hasClass('dropdown') || focused.hasClass('context')) {
                    openSubmenu(focused);
                    var subItems = focused.find('.menu [role="menuitem"]');
                    if (subItems.length > 0) {
                        subItems.first().focus();
                    }
                }
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                event.stopPropagation();
                // Close submenu if inside one
                if (inSubmenu) {
                    closeSubmenu(parentDropdown);
                    parentDropdown.focus();
                }
            } else if (event.key === 'Home') {
                event.preventDefault();
                event.stopPropagation();
                topItems.first().focus();
            } else if (event.key === 'End') {
                event.preventDefault();
                event.stopPropagation();
                topItems.last().focus();
            } else if (event.key === 'Tab') {
                // Trap focus within the menu
                event.preventDefault();
                event.stopPropagation();
            }
        });

        scope.$watch(function() {
            return $rootScope.$btclient;
        }, function(client) {
            if (client) {
                render(scope, element, attr);
            }
        });
    }

    function updateCheckboxes(scope, items) {
        checkboxes.forEach(item => {
            item.checkbox.checked =
                items.every(i => item.predicate(i))
        })
    }

    function bindCloseOperations(element) {
        // Unbind any stale handlers from previous invocations
        $('.main-content').off('scroll.contextmenu');
        $($window).off('resize.contextmenu');

        // Remove context menu when the user scrolls the main content
        $('.main-content').one('scroll.contextmenu', function() {
            hideAndRestoreFocus(element);
        });

        // Remove context menu on window resize
        $($window).one('resize.contextmenu', function(){
            hideAndRestoreFocus(element);
        });
    }

    function showContextMenu(scope, element){
        return function(event, items){
            // Save the currently focused element to restore later
            previousFocus = document.activeElement;

            bindCloseOperations(element);
            updateCheckboxes(scope, items)

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
            $(element).attr('aria-hidden', 'false');

            // Focus the first menu item for keyboard/screen reader access
            setTimeout(function() {
                var firstItem = $(element).find('[role="menuitem"]').first();
                if (firstItem.length) {
                    firstItem.trigger('focus');
                }
            }, 50);
        };
    }

    function hideContextMenu(scope, element) {
        return function(){
            hideAndRestoreFocus(element);
        };
    }
}];
