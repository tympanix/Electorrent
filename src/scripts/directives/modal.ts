import { IDirectiveFactory } from "angular"

export let modal: IDirectiveFactory = function() {
    return {
        templateUrl: template,
        replace: true,
        transclude: true,
        scope: {
            title: '@',
            btnOk: '@',
            btnCancel: '@',
            closable: '<',
            icon: '@',
            approve: '&',
            deny: '&',
            hidden: '&',
            show: '&',
            after: '=',
            data: '=',
        },
        restrict: 'E',
        link: link
    };

    function template(elem, attrs) {
        return attrs.templateUrl || 'some/path/default.html'
    }

    function link(scope, element/*, attrs*/) {
        var accepted = false
        var previousFocus: HTMLElement | null = null
        var focusableElements: HTMLElement[] = []

        let modal: any = $(element)

        // Add ARIA attributes for dialog
        modal.attr({
            'role': 'dialog',
            'aria-modal': 'true'
        })

        // Set aria-labelledby from the header
        var header = modal.find('.header').first()
        if (header.length) {
            var headerId = header.attr('id')
            if (!headerId) {
                headerId = 'modal-header-' + Math.random().toString(36).substr(2, 9)
                header.attr('id', headerId)
            }
            modal.attr('aria-labelledby', headerId)
        }

        // Make close icon accessible
        var closeIcon = modal.children('i.close.icon')
        if (closeIcon.length) {
            closeIcon.attr({
                'role': 'button',
                'tabindex': '0',
                'aria-label': 'Close dialog'
            })
            closeIcon.on('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    closeIcon.click()
                }
            })
        }

        modal.modal({
            onDeny: function () {
                accepted = false
                return scope.deny()
            },
            onApprove: function () {
                accepted = true
                return scope.approve()
            },
            onHidden: function () {
                clearForm(element)
                removeFocusTrap()
                restoreFocus()
                scope.after && scope.after(accepted)
                return scope.hidden()
            },
            onShow: function() {
                accepted = false
                previousFocus = document.activeElement as HTMLElement
                scope.show()
            },
            onVisible: function() {
                modal.modal('refresh')
                setupFocusTrap()
                focusFirstElement()

                // Hide background from screen readers
                setBackgroundHidden(true)
            },
            closable: !!scope.closable,
            duration: 150
        });

        scope.applyAndClose = function() {
          if (scope.approve()) {
            modal.modal('hide')
          }
        }

        scope.$on("$destroy", function() {
            removeFocusTrap()
            element.remove();
        });

        function setupFocusTrap() {
            var focusableSelector = 'input:not([disabled]), button:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], a[role="button"], [tabindex]:not([tabindex="-1"]), .deny.button, .ok.button, .positive.button, .approve.button'
            focusableElements = Array.from(modal[0].querySelectorAll(focusableSelector))

            modal.on('keydown.focustrap', handleTabKey)
            modal.on('keydown.escape', function(e) {
                if (e.key === 'Escape') {
                    e.preventDefault()
                    modal.modal('hide')
                }
            })
        }

        function handleTabKey(e) {
            if (e.key !== 'Tab' || focusableElements.length === 0) return

            var firstElement = focusableElements[0]
            var lastElement = focusableElements[focusableElements.length - 1]

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault()
                    lastElement.focus()
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault()
                    firstElement.focus()
                }
            }
        }

        function focusFirstElement() {
            if (focusableElements.length > 0) {
                focusableElements[0].focus()
            }
        }

        function restoreFocus() {
            setBackgroundHidden(false)
            if (previousFocus) {
                previousFocus.focus()
                previousFocus = null
            }
        }

        function removeFocusTrap() {
            modal.off('keydown.focustrap')
            modal.off('keydown.escape')
        }

        function setBackgroundHidden(hidden: boolean) {
            var appContainer = document.getElementById('page-torrents') ||
                               document.getElementById('page-settings') ||
                               document.getElementById('page-welcome')
            if (appContainer) {
                if (hidden) {
                    appContainer.setAttribute('aria-hidden', 'true')
                } else {
                    appContainer.removeAttribute('aria-hidden')
                }
            }
        }
    }

    function clearForm(element){
        let form: any = $(element)
        form.form('clear');
        form.find('.error.message').empty()
    }

};
